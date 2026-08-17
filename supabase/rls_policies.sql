-- Gaffer RLS policies — Phase 0.3
-- Companion to schema.sql. Run this in the Supabase SQL editor AFTER
-- schema.sql, once, on the same project.
--
-- schema.sql already turned RLS on for all 8 tables with zero policies,
-- which means everything is currently locked down to everyone (anon and
-- authenticated alike get nothing back). This script is what unlocks real
-- access for real coaches.
--
-- Every policy is written as a `team_coaches` MEMBERSHIP check — "does
-- auth.uid() appear in team_coaches for this row's team_id" — never as a
-- `team.owner_id = auth.uid()` check. That's the seam that makes a future
-- multi-coach invite flow a UI-only change (build guide 0.3 step 2).

-- ── Helper functions ────────────────────────────────────────────────────
-- security definer so the function itself bypasses RLS on team_coaches when
-- it looks up membership. Without this, a policy on team_coaches that
-- queries team_coaches from inside its own USING clause risks recursive
-- policy evaluation; routing through a security-definer function sidesteps
-- that entirely and lets every other table's policy reuse the same check.

create or replace function public.is_team_member(check_team_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from team_coaches
    where team_id = check_team_id
      and user_id = auth.uid()
  );
$$;

create or replace function public.is_team_owner(check_team_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from team_coaches
    where team_id = check_team_id
      and user_id = auth.uid()
      and role = 'owner'
  );
$$;

-- ── team ────────────────────────────────────────────────────────────────
-- Insert is the one exception to "membership, never owner_id": at insert
-- time no team_coaches row exists yet (the on_team_created trigger adds it
-- AFTER insert), so there's nothing for is_team_member() to find. The
-- insert check has to be owner_id = auth.uid() out of necessity, not
-- preference — everything downstream of that first insert is membership.

create policy "team_select_members" on team
  for select using (is_team_member(id));

create policy "team_insert_self_owner" on team
  for insert with check (owner_id = auth.uid());

create policy "team_update_members" on team
  for update using (is_team_member(id)) with check (is_team_member(id));

create policy "team_delete_owner" on team
  for delete using (is_team_owner(id));

-- ── team_coaches ────────────────────────────────────────────────────────
-- Select: any member of the team can see the full coaching staff list.
-- Insert/update/delete: owner only. (The auto-seed trigger on team runs as
-- postgres via security definer and owns the table, so it bypasses these
-- policies regardless — this is only for future manual/invite-flow writes.)

create policy "team_coaches_select_members" on team_coaches
  for select using (is_team_member(team_id));

create policy "team_coaches_insert_owner" on team_coaches
  for insert with check (is_team_owner(team_id));

create policy "team_coaches_update_owner" on team_coaches
  for update using (is_team_owner(team_id)) with check (is_team_owner(team_id));

create policy "team_coaches_delete_owner" on team_coaches
  for delete using (is_team_owner(team_id));

-- ── player ──────────────────────────────────────────────────────────────

create policy "player_all_members" on player
  for all using (is_team_member(team_id))
  with check (is_team_member(team_id));

-- ── player_notes ────────────────────────────────────────────────────────
-- No direct team_id — join up through player (build guide 0.3 step 3).

create policy "player_notes_all_members" on player_notes
  for all using (
    is_team_member((select team_id from player where player.id = player_notes.player_id))
  )
  with check (
    is_team_member((select team_id from player where player.id = player_notes.player_id))
  );

-- ── session ─────────────────────────────────────────────────────────────

create policy "session_all_members" on session
  for all using (is_team_member(team_id))
  with check (is_team_member(team_id));

-- ── availability ────────────────────────────────────────────────────────
-- No direct team_id — join up through session (build guide 0.3 step 3).

create policy "availability_all_members" on availability
  for all using (
    is_team_member((select team_id from session where session.id = availability.session_id))
  )
  with check (
    is_team_member((select team_id from session where session.id = availability.session_id))
  );

-- ── drill ───────────────────────────────────────────────────────────────
-- team_id is nullable: null means "coach-owned", meant to be usable across
-- every team a coach belongs to (build guide 2d / US-14). There is no
-- owner_id column on drill to scope "which coach" owns an unscoped drill,
-- so for now (single-coach MVP, per the project plan) any authenticated
-- user can read/write coach-owned drills.
--
-- KNOWN GAP, flagged for Phase 4 multi-coach work: once a second coach who
-- ISN'T a member of every team exists, this clause makes every
-- team_id-null drill visible/editable by every authenticated coach, not
-- just its creator. Fixing that cleanly needs an owner_id uuid column on
-- drill plus a real check here — don't forget this when multi-coach ships.

create policy "drill_all_members_or_unscoped" on drill
  for all using (
    team_id is null or is_team_member(team_id)
  )
  with check (
    team_id is null or is_team_member(team_id)
  );

-- ── session_drills ──────────────────────────────────────────────────────
-- No direct team_id — join up through session. Deliberately checks the
-- SESSION's team, not the drill's: attaching a drill to a session is
-- authorized by membership on the session's team, which is what lets a
-- coach-owned (team_id null) drill be attached to any of their teams'
-- sessions in the first place.

create policy "session_drills_all_members" on session_drills
  for all using (
    is_team_member((select team_id from session where session.id = session_drills.session_id))
  )
  with check (
    is_team_member((select team_id from session where session.id = session_drills.session_id))
  );
