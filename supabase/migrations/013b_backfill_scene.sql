-- Migration 013b — backfill drill.scene / keyframes / duration_seconds / pitch
--
-- ############################################################################
-- SUPERSEDED AND INERT — DO NOT RUN. Migration 014 dropped `drill.phases` and
-- `drill.pitch_size` on 2026-08-26, so this script's inputs no longer exist and
-- it will simply error.
--
-- Do not "fix" it by reconstructing phases from the backup either. The
-- instruction below to re-run it "if any drill is created or edited through
-- the old phases-based editor" inverted once the entities+keyframes editor
-- shipped: from then on the editor wrote scene/keyframes directly and never
-- touched phases, making phases the STALE copy. A read-only dry run on
-- 2026-08-26 showed re-running this would have cut one drill from 17 entities
-- to 0, another from 5 keyframes to 1, reset a third's pitch preset, and
-- reverted six drills' equipment names to their pre-015 values. See 014's
-- header for the full diff.
--
-- Kept in the repo as the record of how the entities+keyframes data was
-- originally derived, not as a runnable script.
-- ############################################################################
--
-- Derives the entities+keyframes shape added by 013 from the phases[] shape it
-- replaces (DRILL_CREATOR_REWORK_PLAN.md Stage 1.3). Reads `phases` and
-- `pitch_size` and writes only the four new columns, so it is re-runnable and
-- non-destructive: `phases` stays authoritative until migration 014 drops it.
-- Re-run it if any drill is created or edited through the old phases-based
-- editor between now and 014.
--
-- The rules, in the plan's order:
--
--  1. Union every phase's players / cones / balls BY ELEMENT ID into
--     scene.entities. Ids already carry across duplicated phases (addPhase
--     ('duplicate') reused them deliberately — see drillSlice.ts), so this
--     correctly re-identifies the same marker rather than inventing a new one
--     per phase. First occurrence wins for an entity's static properties.
--  2. Phase i becomes keyframes[i] at t = the sum of phases 0..i-1's
--     duration_seconds, defaulting to 3s per phase where unset — the same
--     DEFAULT_PHASE_SECONDS (and the same `|| default` treatment of 0)
--     DrillLibrary.tsx already uses to step its preview.
--  3. keyframes[i].states[entityId] = {x, y} for elements present in phase i,
--     {hidden: true} for entities the drill has but that phase doesn't.
--  4. Each phase's arrows become markings of kind 'arrow' (points [from, to],
--     style.dash set from kind === 'ball'); annotations become kind 'text'.
--     Both are bound to that phase's keyframe via keyframeId, which is what
--     carries today's per-phase arrows and notes across losslessly. Marking
--     ids are namespaced "<phaseId>:arrow:<id>" / "<phaseId>:text:<id>"
--     because arrow and annotation ids are only unique within a phase, while
--     scene.markings is one flat array for the whole drill.
--  5. duration_seconds = the total of every phase's duration, minimum 5s.
--  6. pitch derived from pitch_size / orientation via the rework plan's
--     Stage 7 preset table: full 105x68, three_quarter 79x68, half 53x68,
--     quarter 35x68 (metres). widthMeters/lengthMeters are the canonical
--     *portrait* authoring with `orientation` applied on top, matching
--     pitchGeometry.ts's existing transpose() convention. The old pitch_size
--     value is carried through as the preset key so each row's provenance
--     survives; Stage 7 owns the real preset table and can remap it.
--
-- Ordering is chosen to preserve today's rendering: entities are ordered
-- equipment, then balls, then players (PitchCanvas's existing z-order), which
-- also keeps each phase's original player order intact so assignTeamColors
-- still hands team A and team B the same two colours. Markings put arrows
-- before text for the same reason.
--
-- Two things worth knowing about this conversion:
--
--  * It is lossy in exactly one place on the current data. "Finishing Circuit"
--    carries player id p1 with number 7 in phase 1 and number 11 in phase 2.
--    An entity has one number for the whole drill by definition, so the first
--    occurrence (7) wins. This is inherent to the model change, not to this
--    SQL.
--  * The quarter-pitch mapping (35x68) comes from the plan's Stage 7 table and
--    is NOT the same shape as today's pitchGeometry.QUARTER (30x40), so the
--    three quarter-pitch drills will render at a different aspect ratio once
--    Stage 7 starts reading `pitch`. Marker coordinates are normalized 0-1 and
--    are unaffected.

with phase_rows as (
  select
    dr.id                                                         as drill_id,
    p.ord - 1                                                     as phase_index,
    p.val                                                         as phase,
    p.val->>'id'                                                  as phase_id,
    coalesce(nullif((p.val->>'duration_seconds')::numeric, 0), 3) as secs
  from drill dr
  cross join lateral jsonb_array_elements(dr.phases) with ordinality p(val, ord)
),
phase_times as (
  select
    pr.*,
    coalesce(sum(pr.secs) over (
      partition by pr.drill_id order by pr.phase_index
      rows between unbounded preceding and 1 preceding
    ), 0) as t_start
  from phase_rows pr
),
elements as (
  select pt.drill_id, pt.phase_index, pt.phase_id, 'equipment'::text as kind, 0 as kind_rank, e.ord as el_ord, e.val as el
    from phase_times pt
    cross join lateral jsonb_array_elements(coalesce(pt.phase->'cones', '[]'::jsonb)) with ordinality e(val, ord)
  union all
  select pt.drill_id, pt.phase_index, pt.phase_id, 'ball', 1, e.ord, e.val
    from phase_times pt
    cross join lateral jsonb_array_elements(coalesce(pt.phase->'balls', '[]'::jsonb)) with ordinality e(val, ord)
  union all
  select pt.drill_id, pt.phase_index, pt.phase_id, 'player', 2, e.ord, e.val
    from phase_times pt
    cross join lateral jsonb_array_elements(coalesce(pt.phase->'players', '[]'::jsonb)) with ordinality e(val, ord)
),
entity_first as (
  select distinct on (drill_id, el->>'id')
    drill_id, el->>'id' as entity_id, kind, kind_rank, phase_index, el_ord, el
  from elements
  order by drill_id, el->>'id', phase_index, kind_rank, el_ord
),
ent as (
  select
    drill_id,
    jsonb_agg(
      case kind
        when 'player' then jsonb_strip_nulls(jsonb_build_object(
          'id', entity_id, 'kind', 'player',
          'team', el->>'team', 'number', el->'number', 'label', el->>'label'))
        when 'equipment' then jsonb_strip_nulls(jsonb_build_object(
          'id', entity_id, 'kind', 'equipment',
          'equipment', coalesce(el->>'kind', 'cone'), 'color', el->>'color'))
        else jsonb_build_object('id', entity_id, 'kind', 'ball')
      end
      order by phase_index, kind_rank, el_ord
    ) as entities
  from entity_first
  group by drill_id
),
keyframe_states as (
  select
    pt.drill_id, pt.phase_id,
    jsonb_object_agg(
      ef.entity_id,
      case when el.el is null then jsonb_build_object('hidden', true)
           else jsonb_build_object('x', el.el->'x', 'y', el.el->'y') end
    ) as states
  from phase_times pt
  join entity_first ef on ef.drill_id = pt.drill_id
  left join elements el
    on  el.drill_id    = pt.drill_id
    and el.phase_index = pt.phase_index
    and el.kind        = ef.kind
    and el.el->>'id'   = ef.entity_id
  group by pt.drill_id, pt.phase_id
),
kf as (
  select
    pt.drill_id,
    jsonb_agg(
      jsonb_strip_nulls(jsonb_build_object(
        'id', pt.phase_id,
        't', pt.t_start,
        'name', pt.phase->>'label',
        'states', coalesce(ks.states, '{}'::jsonb)
      )) order by pt.phase_index
    ) as keyframes,
    greatest(5, ceil(sum(pt.secs))::int) as duration_seconds
  from phase_times pt
  left join keyframe_states ks on ks.drill_id = pt.drill_id and ks.phase_id = pt.phase_id
  group by pt.drill_id
),
mk as (
  select drill_id, jsonb_agg(marking order by phase_index, kind_rank, ord) as markings
  from (
    select pt.drill_id, pt.phase_index, 0 as kind_rank, a.ord,
      jsonb_build_object(
        'id',         pt.phase_id || ':arrow:' || (a.val->>'id'),
        'kind',       'arrow',
        'points',     jsonb_build_array(a.val->'from', a.val->'to'),
        'style',      jsonb_build_object('dash', coalesce(a.val->>'kind', 'player') = 'ball'),
        'keyframeId', pt.phase_id
      ) as marking
    from phase_times pt
    cross join lateral jsonb_array_elements(coalesce(pt.phase->'arrows', '[]'::jsonb)) with ordinality a(val, ord)
    union all
    select pt.drill_id, pt.phase_index, 1, n.ord,
      jsonb_build_object(
        'id',         pt.phase_id || ':text:' || (n.val->>'id'),
        'kind',       'text',
        'points',     jsonb_build_array(jsonb_build_object('x', n.val->'x', 'y', n.val->'y')),
        'text',       n.val->>'text',
        'keyframeId', pt.phase_id
      )
    from phase_times pt
    cross join lateral jsonb_array_elements(coalesce(pt.phase->'annotations', '[]'::jsonb)) with ordinality n(val, ord)
  ) m
  group by drill_id
),
computed as (
  select
    dr.id,
    jsonb_build_object(
      'entities', coalesce(ent.entities, '[]'::jsonb),
      'markings', coalesce(mk.markings, '[]'::jsonb)
    )                                  as scene,
    coalesce(kf.keyframes, '[]'::jsonb) as keyframes,
    coalesce(kf.duration_seconds, 5)    as duration_seconds,
    jsonb_build_object(
      'preset',       dr.pitch_size::text,
      'widthMeters',  68,
      'lengthMeters', case dr.pitch_size
                        when 'full'          then 105
                        when 'three_quarter' then 79
                        when 'half'          then 53
                        when 'quarter'       then 35
                      end,
      'orientation',  dr.orientation::text,
      'overlays',     '[]'::jsonb
    )                                   as pitch
  from drill dr
  left join ent on ent.drill_id = dr.id
  left join mk  on mk.drill_id  = dr.id
  left join kf  on kf.drill_id  = dr.id
)
update drill d
set scene            = c.scene,
    keyframes        = c.keyframes,
    duration_seconds = c.duration_seconds,
    pitch            = c.pitch
from computed c
where d.id = c.id;
