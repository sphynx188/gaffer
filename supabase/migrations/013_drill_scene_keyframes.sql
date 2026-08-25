-- Migration 013 — drill.scene / drill.keyframes / drill.duration_seconds / drill.pitch
--
-- Stage 1 of DRILL_CREATOR_REWORK_PLAN.md: replace the "list of independent
-- snapshots" drill model (drill.phases) with "one cast of entities + keyframes
-- over a timeline".
--
-- Under phases[], a player in phase 1 and the "same" player in phase 2 were
-- two unrelated objects that happened to share an id because addPhase
-- ('duplicate') copied the array by value. Nothing could interpolate between
-- two phases because there was no guarantee they described the same elements —
-- see the comment DrillLibrary.tsx carries about why its preview cuts rather
-- than tweens. `scene.entities` gives every marker one id for the whole life of
-- the drill, and `keyframes[].states` says where each of them is at time `t`;
-- that identity is what every later stage (interpolation, onion skin, movement
-- paths, the per-segment speed readout, 3D) is defined in terms of.
--
-- Purely additive. `phases` and `pitch_size` stay in place and stay
-- authoritative — 013b derives the new columns from them, and migration 014
-- drops them once the backfill has been read back in the new editor (rework
-- plan Stage 1.4). Keeping the old columns until then is what makes 013b
-- safely re-runnable.
--
-- Scene content is jsonb for the same reason phases was (see CLAUDE.md's data
-- model section): extending it — a new equipment type, a new marking kind, a
-- new per-entity property — never needs another migration.

alter table drill add column scene jsonb not null default '{"entities":[],"markings":[]}'::jsonb;
alter table drill add column keyframes jsonb not null default '[]'::jsonb;
alter table drill add column duration_seconds integer not null default 15;
alter table drill add column pitch jsonb not null default
  '{"preset":"full","widthMeters":68,"lengthMeters":105,"orientation":"portrait","overlays":[]}'::jsonb;
