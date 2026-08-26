-- Migration 003 — duplicate_session RPC (Phase 3.2, US-16)
--
-- ============================================================================
-- SUPERSEDED 2026-08-26 by migration 024, which is now the live definition of
-- this function. Do not read the body below as current.
--
-- Two things were wrong with it by then, both found by running
-- TACTICS_BOARD_REWORK_PLAN.md Stage 9's Verify step against the live app:
--
--   1. BROKEN SINCE MIGRATION 009. The insert reads `physical_load` and
--      `equipment`; 009 dropped both columns from `session` and never
--      redefined this function, so every call from 009 onward failed with
--      `column "physical_load" of relation "session" does not exist`. The
--      Duplicate button was dead for the whole of 009-023.
--   2. It never copied `start_time` (added after this file was written) and,
--      as of Stage 9, never copied the `session_tactics` line-up either.
--
-- 024 fixes all three. Everything below is kept as the historical record of
-- WHY the function exists at all — the atomicity and SECURITY INVOKER
-- reasoning is unchanged and still worth reading.
-- ============================================================================
--
-- Context: gaffer_project_plan_final.md §4 flagged this from the start as
-- one of the two deliberate exceptions to "no custom API layer, PostgREST
-- directly" — duplicating a session copies a variable number of
-- `session_drills` rows alongside the new `session` row, and that has to
-- succeed or fail as one transaction, not a client-side loop of inserts
-- that could partially commit. Run this once, in the Supabase SQL editor,
-- against the already-deployed project (do NOT also re-run schema.sql —
-- it would try to recreate tables that already exist).
--
-- Deliberately SECURITY INVOKER (the default — no `security definer`
-- here), unlike schema.sql's `handle_new_team` trigger. That trigger needed
-- definer because it runs at the exact moment of a team's own insert,
-- before any `team_coaches` row exists yet for `is_team_member` to find.
-- Here the source session already exists and its team membership is
-- already established, so running as the caller lets rls_policies.sql's
-- existing `session_all_members` / `session_drills_all_members` policies do
-- the authorization for free: a coach can only duplicate a session on a
-- team they belong to (the initial `select` simply returns nothing for a
-- session they can't see), and the new session_drills rows are only
-- insertable because that same membership check passes on the new row's
-- session_id.
--
-- Does NOT touch `availability` — per build guide 3.2's "availability data
-- is not copied (fresh availability for the new date)", that's left to the
-- client (sessionSlice.duplicateSession), which seeds fresh `unconfirmed`
-- rows for the current roster the same way sessionSlice.createSession
-- already does for a brand-new session, rather than carrying over the
-- source session's player responses. Keeping that out of this function
-- also keeps it from needing to know about `players` at all.
--
-- Does NOT create any new "template" entity — this is a plain `session` row
-- copy, same table every other session lives in, per build guide 3.2's
-- Definition of Done.

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
  insert into session (team_id, date, duration_minutes, physical_load, equipment, coaching_notes, season_label)
  select team_id, new_date, duration_minutes, physical_load, equipment, coaching_notes, season_label
  from session
  where id = source_session_id
  returning * into new_session;

  -- No row inserted means either the source session doesn't exist or RLS
  -- (session_all_members) hid it from this caller — either way, there's
  -- nothing to duplicate. Raising here aborts and rolls back the whole
  -- function call (see the atomicity note below) rather than silently
  -- handing the client back a null/empty session.
  if new_session.id is null then
    raise exception 'Session % not found or not accessible', source_session_id;
  end if;

  insert into session_drills (session_id, drill_id, order_index, planned_duration_minutes, notes)
  select new_session.id, drill_id, order_index, planned_duration_minutes, notes
  from session_drills
  where session_id = source_session_id;

  return new_session;
end;
$$;

-- No RLS/grant changes needed: PostgREST already exposes every function in
-- the `public` schema to `rpc()` calls from the anon/authenticated roles by
-- default, and SECURITY INVOKER means this one carries no privileges beyond
-- what the calling coach already has via the policies above.
--
-- Atomicity note: a single `rpc()` call executes this entire function body
-- as one statement in one transaction. If the `raise exception` above
-- fires, or either insert fails for any other reason, every change already
-- made inside this call — including the new `session` row — is rolled back
-- together. There is no window where a new session can exist with a
-- partial or missing drill line-up.
