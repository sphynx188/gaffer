-- 037_fixed_keyframe_grid_duration.sql — widens drill/tactic
-- `duration_seconds` from `integer` to `numeric(4,1)`.
--
-- Keyframe timing is now a FIXED GRID rather than something a coach edits:
-- keyframe N sits at exactly N × 1.5s, at most 10 of them, and
-- `duration_seconds` is derived as (count − 1) × 1.5 rather than typed in.
-- Half of those spans are non-integer — 2 keyframes is 1.5s, 4 is 4.5s, the
-- full 10 is 13.5s — so an integer column can't hold the derived value: it
-- would round 13.5 down to 13 and strand the last keyframe past the end of
-- its own drill, which is exactly the duration/keyframe drift this change
-- exists to remove. numeric(4,1) holds up to 999.9s at the one decimal the
-- grid can ever produce.
--
-- Widening int → numeric is lossless and needs no backfill: every existing
-- value is already a whole number of seconds and stays one. Drills authored
-- before the grid keep whatever duration they had until their keyframes are
-- next touched, at which point the regrid brings both onto the rule together.
alter table public.drill
  alter column duration_seconds type numeric(4,1);

alter table public.tactic
  alter column duration_seconds type numeric(4,1);

-- The column default was 15 — a figure from when a coach typed the duration
-- in. A new document is seeded with exactly one keyframe, and one keyframe's
-- derived duration is one gap (durationForCount), so 15 would have started
-- every new tactic off the grid until its first keyframe edit. The drill side
-- passes the derived value explicitly in `createDrill`; the tactic side leans
-- on this default, so it has to be right here too.
alter table public.drill  alter column duration_seconds set default 1.5;
alter table public.tactic alter column duration_seconds set default 1.5;
