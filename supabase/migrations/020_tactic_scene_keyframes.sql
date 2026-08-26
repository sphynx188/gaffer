-- Migration 020 — tactic.scene / keyframes / phases / pitch / sides / view,
--                  light metadata, and the session_tactics join table
--
-- Stage 1 of TACTICS_BOARD_REWORK_PLAN.md: put tactics on the SAME
-- entities+keyframes model migration 013 gave drills, so `frameAt`,
-- PitchCanvas, the timeline and the export path all work on a tactic
-- unchanged. `tactic.board` — players[] + arrows[] + annotations[], each
-- player holding exactly one position — could never animate, because there
-- was nowhere to say where a player is at a *different* moment.
--
-- Purely additive, exactly as 013 was. `board` stays in place and stays
-- authoritative; 020b derives the new columns from it, and migration 021
-- drops it once all four tactics have been opened in the new editor
-- (Stage 7). Keeping `board` until then is what makes 020b safely re-runnable
-- — the same property that made 013b re-runnable, and the same property that
-- expired for 013b the moment the new editor started writing scene directly
-- (see 013b's SUPERSEDED banner, and CLAUDE.md).
--
-- Scene content is jsonb for the reason CLAUDE.md's data-model section gives:
-- extending it — a new marking kind, a new per-entity property — never needs
-- another migration. That is also why Stage 1.1's eight new SceneEntity
-- fields (player_id, role, scale, markerStyle, roleTag, highlight, statusRing,
-- statusColor) appear nowhere below: they live inside `scene`, and they are
-- added to the SHARED SceneEntity rather than a forked tactic entity, so one
-- canvas and one interpolator serve both drills and tactics.

alter table tactic add column scene jsonb not null default '{"entities":[],"markings":[]}'::jsonb;
alter table tactic add column keyframes jsonb not null default '[]'::jsonb;
alter table tactic add column phases jsonb not null default '[]'::jsonb;
alter table tactic add column duration_seconds integer not null default 15;

-- Landscape is the DEFAULT, matching Teloframe and reading better for a
-- full-pitch diagram — but only a default. Orientation is a live switcher in
-- the editor (decided 2026-08-26, plan 1.6), not a creation-time choice, which
-- is why TacticBoard.tsx's hardcoded portrait TACTIC_PITCH constant goes away
-- in this same change.
--
-- The four EXISTING tactics are deliberately backfilled as portrait, not
-- landscape — see 020b's header. Their coordinates were authored against that
-- hardcoded portrait pitch, and flipping the pitch without flipping the
-- content is precisely the bug plan 1.6 documents.
alter table tactic add column pitch jsonb not null default
  '{"preset":"full","widthMeters":68,"lengthMeters":105,"orientation":"landscape","overlays":[]}'::jsonb;

-- Two real sides with formations — one of only three things about the tactics
-- board that is genuinely new rather than adopted from the drill editor (the
-- others being phases and the roster binding). `teamId` null means a
-- placeholder opposition rather than a real team from the `team` table.
alter table tactic add column sides jsonb not null default
  '{"home":{"formation":"4-3-3","color":"#3b82f6","teamId":null},
    "away":{"formation":"4-4-2","color":"#ef4444","teamId":null}}'::jsonb;

alter table tactic add column view text not null default 'single';

-- Light metadata only (decided 2026-08-26): enough to find a tactic and to put
-- it in a session, deliberately NOT drill's ~19 columns. A tactic is a
-- thinking tool a coach works through, not a 15-minute pitch activity with
-- equipment, intensity and an age band. Plain `text` with the vocabulary
-- enforced in TypeScript only, following migration 016's precedent for
-- drill.phase_of_play rather than inventing a check constraint here.
alter table tactic add column description   text;
alter table tactic add column phase_of_play text;
alter table tactic add column thumbnail_url text;
alter table tactic add column share_token   text;

-- Partial unique index rather than a bare `unique`, matching migration 018's
-- drill_share_token_key exactly: identical semantics for the many un-shared
-- rows (SQL NULLs never collide either way), but it doesn't index them.
--
-- NOTE FOR STAGE 8: there is deliberately NO anon select policy here yet. 018
-- pairs drill.share_token with `drill_shared_read`, scoped to a reader who
-- actually presents the token in the x-share-token header. The equivalent
-- policy for tactics belongs with the sharing UI that mints these tokens
-- (Stage 8.3) — adding an anon-reachable policy now would open a public
-- surface that nothing in src/ can even use. `tactic_all_members` (012) has no
-- `to` clause, so it does apply to anon, but tactic.team_id is NOT NULL and
-- is_team_member is false for anon — so it fails closed and carries none of
-- the `team_id is null` hole 018 Part 1 had to close on drill.
create unique index tactic_share_token_key on tactic (share_token)
  where share_token is not null;

-- ── session_tactics ───────────────────────────────────────────────────────
-- Mirrors session_drills column for column (schema.sql:91) so the planner can
-- hold both kinds of item in one ordered list (Stage 9.4) rather than growing
-- a parallel panel.
create table session_tactics (
  id                       uuid primary key default gen_random_uuid(),
  session_id               uuid not null references session (id) on delete cascade,
  tactic_id                uuid not null references tactic (id)  on delete cascade,
  order_index              integer not null default 0,
  planned_duration_minutes integer,
  notes                    text,
  created_at               timestamptz not null default now()
);

-- FK indexes, same as session_drills has (schema.sql:110-111) — the RLS join
-- below hits session_id on every single row read.
create index on session_tactics (session_id);
create index on session_tactics (tactic_id);

alter table session_tactics enable row level security;

-- Reuses the `is_team_member` helper defined once in rls_policies.sql rather
-- than redefining a membership check inline (CLAUDE.md). Identical in shape to
-- session_drills_all_members, and identical in reasoning: it checks the
-- SESSION's team, not the tactic's. Attaching a tactic to a session is
-- authorized by membership on the session's team.
--
-- Scoped `to authenticated` — session_drills' own policy predates 018 and has
-- no `to` clause; this one starts with the clause 018 had to retrofit. It
-- changes nothing about behaviour (every caller in src/ is a signed-in coach)
-- and costs nothing to get right the first time.
create policy "session_tactics_all_members" on session_tactics
  for all to authenticated
  using (
    is_team_member((select team_id from session where session.id = session_tactics.session_id))
  )
  with check (
    is_team_member((select team_id from session where session.id = session_tactics.session_id))
  );
