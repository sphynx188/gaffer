-- Migration 016 — drill metadata columns
--
-- Stage 8 of DRILL_CREATOR_REWORK_PLAN.md. A drill record was `name +
-- pitch_size + orientation`; everything that makes a drill findable and
-- coachable — objective, level, session-block fit, player counts, coaching
-- points — had nowhere to live. This is what turns a diagram into a session
-- asset, and it's what Stage 9's library filters read.
--
-- Numbered 016, not 015 as the plan's text says: 015 was taken by Stage 6's
-- equipment remap (015_remap_equipment_types.sql), written after the plan.
--
-- Real columns, not jsonb, and deliberately so. Scene content lives in jsonb
-- because it's only ever read whole; these get filtered and sorted ("a
-- 12-minute technical rondo for 8 players"), so they must be columns the
-- planner can index. `coaching` is the one exception — its five lists are
-- only ever read as a set, never filtered on, so it stays jsonb and can grow
-- (the derived-equipment override already does) without another migration.
--
-- Every column is nullable with no default: the eleven existing drills carry
-- none of this, and a drill with no objective recorded is a different thing
-- from one whose objective is the empty string.

alter table drill
  add column objective           text,
  add column description         text,
  add column category            text,
  add column subcategory         text,
  add column duration_minutes    integer,
  add column players_recommended integer,
  add column min_players         integer,
  add column max_players         integer,
  add column age_min             text,
  add column age_max             text,
  add column difficulty          text,
  add column intensity           text,
  add column phase_of_play       text,
  add column session_block       text,   -- activation|technical|tactical|game|recovery
  add column setup_minutes       integer,
  add column learning_outcome    text,
  add column video_url           text,
  add column thumbnail_url       text,
  add column coaching            jsonb not null default '{}'::jsonb;  -- points/progressions/regressions/mistakes/setup

-- The two filters the library leads with (plan Stage 9.2).
create index on drill (category);
create index on drill (session_block);
