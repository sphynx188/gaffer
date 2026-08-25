-- Migration 014 — Drop drill.phases and drill.pitch_size
--
-- ============================================================================
-- NOT YET APPLIED. This file is written but deliberately not run.
--
-- DRILL_CREATOR_REWORK_PLAN.md Stage 1.4 gates it on: "once a manual
-- read-back of all 11 drills IN THE NEW EDITOR looks right". That editor is
-- Stage 5. Until then `phases` stays the authoritative copy of every drill's
-- content and 013b stays re-runnable, which is the whole reason 013/013b are
-- purely additive. Applying this early would destroy the only source the
-- backfill can be re-derived from.
--
-- Apply it when all of the following are true:
--   1. The entities+keyframes editor (Stages 2-5) is reading and writing
--      `scene` / `keyframes` / `duration_seconds` / `pitch`.
--   2. 013b has been re-run, so any drill created or edited through the old
--      phases-based editor in the meantime is represented in the new columns.
--   3. All 11 drills have been opened in that editor and nothing has moved.
--
-- Apply it together with the src/ changes, not before them — the 008 / 009 /
-- 010 precedent CLAUDE.md names is "drop the column and strip all the UI in
-- the same change, rather than leaving it half-wired". The references still
-- standing at the time this file was written:
--   src/store/types.ts          DrillPhase and friends, PitchSize,
--                               PITCH_SIZE_LABELS, Drill.phases,
--                               Drill.pitch_size
--   src/store/index.ts          the re-exports of all of the above
--   src/store/slices/drillSlice.ts   every phases[] action (Stage 2 rewrites
--                               this file around entities and keyframes)
--   src/components/design/DrillPreview.tsx    the phase filmstrip, phase meta
--                               form and pitch-size picker (Stages 3/5)
--   src/components/design/PitchCanvas.tsx     the `phase` and `pitchSize`
--                               props (Stage 3 swaps them for `frame` and
--                               `pitch`)
--   src/components/design/pitchGeometry.ts    getPitchMarkings(size, …)
--                               (Stage 7 generalises it to metre dimensions)
--   src/components/design/DrillLibrary.tsx    phase-cut preview and the
--                               pitch-size search/label (Stages 7/9)
--   src/components/SessionDrillsPanel.tsx     pitchLabel(pitch_size, …)
--                               (Stage 7)
-- ============================================================================

alter table drill
  drop column phases,
  drop column pitch_size;

-- The enum type has no other user once the column is gone — drill.orientation
-- keeps `pitch_orientation`, which stays. Same cleanup migration 011 did for
-- `pitch_format`.
drop type pitch_size;
