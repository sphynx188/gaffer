-- 041_backfill_keyframe_grid.sql — brings every existing drill and tactic
-- onto the fixed keyframe grid migration 037 and the editor rework
-- established: keyframe N at exactly N × 1.5s, duration = (count − 1) × 1.5.
--
-- **DO NOT RE-RUN THIS.** It is idempotent in the mathematical sense — a
-- second run over already-gridded data computes the same values and changes
-- nothing — but it derives every keyframe's time from its POSITION, so if a
-- future change ever reintroduces meaningful per-keyframe timing this file
-- would flatten it. It is a one-time repair, not a maintenance script. See
-- 013b's header for what happens when a backfill outlives the model it was
-- written for.
--
-- What it actually changed, on 2026-09-02:
--
--   * 56 of 61 documents: `duration_seconds` only. Their keyframe times were
--     already on the 1.5s grid (the 2026-08-31 retiming had put them there);
--     what was stale was the duration column, which was an `integer` until
--     037 and so had rounded 4.5 to 5 and 7.5 to 8. Nothing about the
--     animation moved — the drill simply stopped claiming to be half a
--     second longer than its own last keyframe.
--
--   * 1 drill, "2v2 — Overlap on the Flank": keyframe times too, from
--     [0, 1.351, 2.7, 4.051] with a duration of 7.0. Those numbers are the
--     signature of the `scaleTiming` defect 037 removed — 1.5 × 0.9 = 1.35,
--     compounding per press, while the integer duration sat frozen at a
--     rounding fixed point. This is the one document the bug actually
--     damaged, and this restores it to [0, 1.5, 3, 4.5] at 4.5s.
--
-- Ordering is by each keyframe's EXISTING time, so the running order a coach
-- authored is preserved exactly; only the spacing is normalised. `jsonb_set`
-- rewrites the `t` field in place, which is what keeps every keyframe's
-- `states` map (every entity's position) untouched — verified afterwards:
-- zero keyframes lost their states, no duplicate times, every gap exactly
-- 1.5s, and every document's last keyframe equal to its duration.
--
-- A full pre-change copy of both columns for all 61 rows is in
-- `public._keyframe_grid_backup_20260902` (id, kind, keyframes,
-- duration_seconds). Restore with:
--
--   update public.drill d set keyframes = b.keyframes,
--          duration_seconds = b.duration_seconds
--   from public._keyframe_grid_backup_20260902 b
--   where b.kind = 'drill' and b.id = d.id;
--   -- and the same for tactic
--
-- Drop that table once the grid has been exercised in anger for a while.

with regridded as (
  select d.id,
         (select jsonb_agg(
                   jsonb_set(kf.value, '{t}', to_jsonb((round(((kf.ord - 1) * 1.5)::numeric, 3))::float8))
                   order by kf.ord)
          from (select value, row_number() over (order by (value->>'t')::numeric) as ord
                from jsonb_array_elements(d.keyframes)) kf) as keyframes,
         greatest(1, jsonb_array_length(d.keyframes) - 1) * 1.5 as duration
  from public.drill d
  where jsonb_array_length(d.keyframes) > 0
)
update public.drill d set keyframes = r.keyframes, duration_seconds = r.duration
from regridded r where d.id = r.id;

with regridded as (
  select t.id,
         (select jsonb_agg(
                   jsonb_set(kf.value, '{t}', to_jsonb((round(((kf.ord - 1) * 1.5)::numeric, 3))::float8))
                   order by kf.ord)
          from (select value, row_number() over (order by (value->>'t')::numeric) as ord
                from jsonb_array_elements(t.keyframes)) kf) as keyframes,
         greatest(1, jsonb_array_length(t.keyframes) - 1) * 1.5 as duration
  from public.tactic t
  where jsonb_array_length(t.keyframes) > 0
)
update public.tactic t set keyframes = r.keyframes, duration_seconds = r.duration
from regridded r where t.id = r.id;
