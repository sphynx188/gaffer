-- Migration 007 — Add start_time to session (Calendar week-grid feature)
--
-- Context: the new cross-team Calendar view positions each session on a
-- true time-axis grid (start-time-driven row offset, card height
-- proportional to duration), which the existing `session.date` (calendar
-- date only) + `duration_minutes` pair can't support — there's no time-of-
-- day today. Nullable rather than not-null: every existing session row has
-- no time-of-day, and a NOT NULL column would need a synthetic backfill
-- value for historical rows, which is worse than just treating "no time
-- set" as a real, representable state. Going forward the app form requires
-- it for every new/edited session (enforced client-side, not by a DB
-- constraint) — only pre-migration rows can still have a null start_time.
--
-- No RLS change needed — session_all_members (rls_policies.sql) already
-- gates the whole row by team membership; a new column on an already-RLS'd
-- table needs no new policy. Run this once, in the Supabase SQL editor,
-- against the already-deployed project — do NOT re-run (the `alter table
-- add column` will error on a column that already exists).

alter table session
  add column start_time time;

comment on column session.start_time is
  'Local time-of-day the session starts (no timezone — same "wall clock, coach''s local time" assumption as `date`). Nullable only for rows created before this column existed; the app form requires it for every session created or edited since.';
