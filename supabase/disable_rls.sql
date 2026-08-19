-- Gaffer — Disable RLS (rollback / escape hatch)
--
-- Companion to migrations/004_reenable_rls.sql. Run this ONLY if, after
-- re-enabling RLS, authenticated writes start failing again with 42501
-- (the same Supabase write-path issue described in
-- gaffer_mvp_build_steps.md Phase 0.5.2 and supabase-support-ticket.md).
--
-- This does NOT drop any policies or touch the function grants tightened in
-- 004_reenable_rls.sql — it only flips RLS back off, so re-running
-- migrations/004_reenable_rls.sql afterward (once the underlying issue is
-- actually fixed) is a clean single-step re-apply, no rebuild needed.
--
-- Paste this whole file into the SQL editor and run it once, or apply it via
-- the Supabase MCP `apply_migration` tool with name `disable_rls_rollback`.
--
-- IMPORTANT: this re-opens all 8 tables to anyone holding the anon key.
-- Treat re-disabling as an emergency unblock, not a resting state — don't
-- add real player/session data while this is in effect, same caveat as the
-- original schema.sql warning.

alter table team           disable row level security;
alter table team_coaches   disable row level security;
alter table player         disable row level security;
alter table player_notes   disable row level security;
alter table session        disable row level security;
alter table availability   disable row level security;
alter table drill          disable row level security;
alter table session_drills disable row level security;
