-- Migration 024 — tactic thumbnails, and session duplication that keeps them
--
-- TACTICS_BOARD_REWORK_PLAN.md Stage 9. Two changes, both consequences of
-- making a tactic a plannable, browsable thing alongside a drill.
--
-- ── Part 1: let tactic thumbnails into the drill-thumbnails bucket ────────
--
-- Stage 9.2 says to "reuse the drill capture path (migration 017's bucket,
-- and the RLS fix in 4ff2363)". Reusing the BUCKET is the instruction, so
-- tactic thumbnails land in `drill-thumbnails` at `<tactic id>.png` beside the
-- drills, rather than in a second bucket with a second set of policies to keep
-- in step. The name is now a slight misnomer; a rename would break every
-- thumbnail_url already stored, which is a bad trade for tidier naming.
--
-- Without this, `<tactic id>.png` fails the insert policy: the id matches no
-- drill, so the subquery finds nothing and the upload is refused. Fails
-- closed, which is why nothing was exposed in the meantime — but it also
-- means tactic thumbnails simply could not be written until now.
--
-- ── HEED MIGRATION 019'S BUG. It is armed again here. ─────────────────────
-- 017 wrote `split_part(name, '.', 1)` inside a correlated subquery over
-- `public.drill`, and `drill` has its own `name` column, so the unqualified
-- `name` silently resolved to the DRILL'S TITLE instead of the uploaded
-- object's path. 019 rewrote it as `... in (select d.id::text from ...)` so
-- `name` is read in the policy's own top-level scope.
--
-- `public.tactic` ALSO has a `name` column. The exact same shadowing bug is
-- available to anyone who "simplifies" the clauses below back into an
-- `exists (select 1 from tactic t where t.id::text = split_part(name,...))`.
-- Keep the `in (select ...)` form. It is not a style preference.

drop policy if exists "drill_thumbnail_insert" on storage.objects;
drop policy if exists "drill_thumbnail_update" on storage.objects;
drop policy if exists "drill_thumbnail_delete" on storage.objects;

-- A drill is team-scoped OR coach-owned (team_id null); a tactic is always
-- team-scoped, so it gets no `is null` arm — the same asymmetry migration 012
-- documents between the two tables' own policies.
create policy "drill_thumbnail_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'drill-thumbnails'
    and (
      split_part(name, '.', 1) in (
        select d.id::text from public.drill d
        where d.team_id is null or public.is_team_member(d.team_id)
      )
      or split_part(name, '.', 1) in (
        select t.id::text from public.tactic t
        where public.is_team_member(t.team_id)
      )
    )
  );

create policy "drill_thumbnail_update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'drill-thumbnails'
    and (
      split_part(name, '.', 1) in (
        select d.id::text from public.drill d
        where d.team_id is null or public.is_team_member(d.team_id)
      )
      or split_part(name, '.', 1) in (
        select t.id::text from public.tactic t
        where public.is_team_member(t.team_id)
      )
    )
  );

create policy "drill_thumbnail_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'drill-thumbnails'
    and (
      split_part(name, '.', 1) in (
        select d.id::text from public.drill d
        where d.team_id is null or public.is_team_member(d.team_id)
      )
      or split_part(name, '.', 1) in (
        select t.id::text from public.tactic t
        where public.is_team_member(t.team_id)
      )
    )
  );

-- `drill_thumbnail_select` (019) is left exactly as it is: it grants read of
-- the whole bucket to any authenticated coach and has no per-row join, so it
-- already covers tactic objects. 019's header explains why it exists at all —
-- the upload's own RETURNING lookup needs it, or every upload fails with a
-- generic RLS error regardless of membership.

-- ── Part 2: duplicate_session copies the tactic line-up too ───────────────
--
-- Not in Stage 9's numbered list, but required for it to be coherent: 9.4
-- puts drills and tactics in ONE ordered line-up, and `duplicate_session`
-- (migration 003) copies `session_drills` only. Left alone, duplicating a
-- session would silently drop every tactic from the copy and renumber nothing
-- — the coach would get a line-up with holes in it and no indication why.
--
-- The insert is placed inside the same function body, so it inherits 003's
-- atomicity note unchanged: one rpc() call is one transaction, and a failure
-- anywhere rolls back the new session row along with both line-ups. There is
-- no window in which a duplicated session exists with a partial line-up.
--
-- `order_index` is copied verbatim from both tables rather than renumbered.
-- Stage 9 maintains ONE contiguous sequence shared across the two tables (see
-- SessionItemsPanel), so copying both sides as-is preserves the interleaved
-- order exactly; renumbering either side independently would scramble it.
--
-- ── AND A PRE-EXISTING BUG THIS TURNED UP: duplication has been broken ────
--
-- Migration 003 is this function's ONLY definition, and its insert reads
-- `physical_load` and `equipment` from `session`. Migration 009 dropped both
-- of those columns and never redefined the function. plpgsql resolves column
-- references when the statement first executes, so every call since 009 has
-- failed with:
--
--     column "physical_load" of relation "session" does not exist
--
-- Found by running Stage 9's own Verify step against the live app, not by
-- reading: the Duplicate button has been dead for the whole of migrations
-- 009-023. It is fixed here rather than in a migration of its own because
-- this file already rewrites this exact function — shipping a knowingly
-- broken body would be worse than the small scope creep of correcting it.
--
-- The column list below is the live one. Note `start_time`, added after 003
-- and therefore never copied even when the function did work: a session
-- duplicated from a 16:45 slot should land at 16:45, not at null.

create or replace function public.duplicate_session(
  source_session_id uuid,
  new_date date
)
returns session
language plpgsql
set search_path = public
as $$
declare
  new_session session;
begin
  insert into session (team_id, date, duration_minutes, start_time, coaching_notes, season_label)
  select team_id, new_date, duration_minutes, start_time, coaching_notes, season_label
  from session
  where id = source_session_id
  returning * into new_session;

  if new_session.id is null then
    raise exception 'Session % not found or not accessible', source_session_id;
  end if;

  insert into session_drills (session_id, drill_id, order_index, planned_duration_minutes, notes)
  select new_session.id, drill_id, order_index, planned_duration_minutes, notes
  from session_drills
  where session_id = source_session_id;

  insert into session_tactics (session_id, tactic_id, order_index, planned_duration_minutes, notes)
  select new_session.id, tactic_id, order_index, planned_duration_minutes, notes
  from session_tactics
  where session_id = source_session_id;

  return new_session;
end;
$$;
