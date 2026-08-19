-- Gaffer — Re-enable RLS
-- Companion to schema.sql / rls_policies.sql. Run this ONCE, in the Supabase
-- SQL editor, before either of:
--   (a) adding any real player/session/note data, or
--   (b) Supabase support resolves the write-path bug tracked in
--       supabase-support-ticket.md,
-- whichever comes first. See gaffer_mvp_build_steps.md, "Phase 0.5.2 —
-- Re-enable RLS" for the full story: every authenticated POST request was
-- failing RLS's WITH CHECK evaluation on this project even with fully
-- correct policies (confirmed via a raw table insert, an RPC-wrapped
-- insert, and a manual SQL simulation of the exact JWT claims — all pointed
-- at a Supabase platform bug, not the schema or policies themselves). RLS
-- was disabled table-by-table as a temporary unblock so Phase 0.5.1 could
-- be completed; this script puts it back exactly as rls_policies.sql
-- defined it. The policies themselves were never dropped, so this is a
-- pure re-enable — no need to re-run rls_policies.sql afterward.
--
-- IMPORTANT: before running this, re-test that writes work under RLS again
-- (e.g. try creating a team from the app) — if support hasn't fixed the
-- underlying bug yet, re-enabling will immediately re-block every write.

alter table team           enable row level security;
alter table team_coaches   enable row level security;
alter table player         enable row level security;
alter table player_notes   enable row level security;
alter table session        enable row level security;
alter table availability   enable row level security;
alter table drill          enable row level security;
alter table session_drills enable row level security;
