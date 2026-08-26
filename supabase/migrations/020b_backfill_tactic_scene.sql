-- Migration 020b — backfill tactic.scene / keyframes / duration_seconds / pitch
--
-- Derives the entities+keyframes shape added by 020 from the `board` shape it
-- replaces (TACTICS_BOARD_REWORK_PLAN.md Stage 1.4). Reads `board` and writes
-- only the new columns, so it is re-runnable and non-destructive: `board`
-- stays authoritative until migration 021 drops it.
--
-- ── READ THIS BEFORE EVER RE-RUNNING IT ───────────────────────────────────
-- 013b, this script's direct ancestor, carried a "re-run me whenever a drill
-- is edited" instruction that INVERTED the moment the new editor started
-- writing scene/keyframes directly — after which `phases` was the stale copy
-- and a re-run would have destroyed real work (see 013b's SUPERSEDED banner
-- and 014's header for the full diff). The same trap is armed here.
--
-- This script is safe to re-run ONLY while `board` is still the authoritative
-- copy — that is, only until the tactics editor UI starts saving scene and
-- keyframes. From that first save `board` is stale, and re-running this would
-- roll a tactic back to its pre-rework state.
--
-- CORRECTED 2026-08-26, during Stage 2. An earlier draft of this header put
-- that cutoff at Stage 2 ("once tacticSlice is rewritten"), which is wrong and
-- is exactly the kind of stale gate that made 013b dangerous. Stage 2 adds the
-- entities+keyframes STORE ACTIONS, but the screen a coach actually uses
-- (TacticBoard.tsx) still reads and writes `board` — nothing calls the new
-- actions yet. `board` therefore remains authoritative through Stage 2, and
-- this script remains both re-runnable and worth re-running right before the
-- UI switches over.
--
-- The real cutoff is STAGE 7, when TacticBoard is replaced by the new editor.
-- Re-run this one last time immediately before that switch, so anything a
-- coach did on the old screen in the meantime is carried across; after it, do
-- not run it again. Migration 021's header carries the same gate, and the
-- check to run before trusting either is the read-only diff: compute what this
-- script WOULD write and confirm no tactic's live scene holds more than the
-- backfill would produce.
-- ──────────────────────────────────────────────────────────────────────────
--
-- The rules, in the plan's order:
--
--  1. board.players[] -> scene.entities[], kind 'player', team 'home',
--     carrying player_id. `number`/`label` are deliberately NOT frozen in:
--     they are resolved from the roster at render time (which is what the
--     old TacticBoard adapter did too, reading squad_number and name off the
--     live Player row), so renaming a player or changing their squad number
--     still updates every tactic they appear in.
--     Entity ids are the TacticPlayer ids unchanged, so a marker keeps its
--     identity across the migration exactly as 013b kept drill element ids.
--  2. One keyframe at t = 0 holding every entity's {x, y}. A tactic today is
--     a static diagram, so one keyframe is the whole timeline; Stage 4 is
--     where a coach adds the second one and it starts to animate.
--  3. board.arrows[] -> markings kind 'arrow', points [from, to], style.dash
--     set from kind === 'ball' — the same mapping 013b used.
--  4. board.annotations[] -> markings kind 'text'.
--     Marking ids are carried through UNNAMESPACED, unlike 013b's
--     "<phaseId>:arrow:<id>". 013b had to namespace because arrow ids were
--     only unique within a phase; a tactic has exactly one board, and every id
--     on it came from crypto.randomUUID, so they are already unique.
--     No keyframeId either: a tactic's arrows and notes belong to the whole
--     diagram, not to one moment. (013b bound each marking to its phase's
--     keyframe because a phase's arrows really were per-phase.)
--  5. duration_seconds 15; phases [].
--
-- ── Why these four rows get PORTRAIT and not the column's landscape default ─
-- 020's `pitch` default is landscape, and that is right for tactics created
-- from here on. But these four were authored against TacticBoard.tsx's
-- hardcoded portrait TACTIC_PITCH, so their normalized coordinates mean
-- "portrait". Writing landscape would transpose the markings (pitchGeometry
-- renders landscape as the portrait authoring put through transpose()) while
-- leaving every player where they were — which is exactly the live bug plan
-- 1.6 documents, and would break this stage's own definition of done ("all 4
-- tactics round-trip with the same players in the same places").
--
-- Orientation is switchable at any time from the editor, and doing so now
-- transposes the content in lockstep (canvas/transposeScene.ts), so any of
-- these four can be flipped to landscape by hand, correctly, in one click.
-- The dimensions below are the ones TACTIC_PITCH carried, which are also the
-- ones 013b wrote for every full-pitch drill — so a tactic and a full-pitch
-- drill render through the identical code path onto the identical geometry.

with entities as (
  select
    t.id as tactic_id,
    jsonb_agg(
      jsonb_build_object(
        'id',        p.val->>'id',
        'kind',      'player',
        'team',      'home',
        'player_id', p.val->>'player_id'
      )
      order by p.ord
    ) as entities,
    jsonb_object_agg(
      p.val->>'id',
      jsonb_build_object('x', p.val->'x', 'y', p.val->'y')
      order by p.ord
    ) as states
  from tactic t
  cross join lateral jsonb_array_elements(coalesce(t.board->'players', '[]'::jsonb)) with ordinality p(val, ord)
  group by t.id
),
markings as (
  select tactic_id, jsonb_agg(marking order by kind_rank, ord) as markings
  from (
    select
      t.id as tactic_id, 0 as kind_rank, a.ord,
      jsonb_build_object(
        'id',     a.val->>'id',
        'kind',   'arrow',
        'points', jsonb_build_array(a.val->'from', a.val->'to'),
        'style',  jsonb_build_object('dash', coalesce(a.val->>'kind', 'player') = 'ball')
      ) as marking
    from tactic t
    cross join lateral jsonb_array_elements(coalesce(t.board->'arrows', '[]'::jsonb)) with ordinality a(val, ord)
    union all
    select
      t.id, 1, n.ord,
      jsonb_build_object(
        'id',     n.val->>'id',
        'kind',   'text',
        'points', jsonb_build_array(jsonb_build_object('x', n.val->'x', 'y', n.val->'y')),
        'text',   n.val->>'text'
      )
    from tactic t
    cross join lateral jsonb_array_elements(coalesce(t.board->'annotations', '[]'::jsonb)) with ordinality n(val, ord)
  ) m
  group by tactic_id
),
computed as (
  select
    t.id,
    jsonb_build_object(
      'entities', coalesce(e.entities, '[]'::jsonb),
      'markings', coalesce(m.markings, '[]'::jsonb)
    ) as scene,
    -- One keyframe always, even for an empty board: without one there is
    -- nowhere for the editor to record a position, the same reason a drill
    -- always keeps at least one (drillSlice.makeInitialKeyframe).
    jsonb_build_array(
      jsonb_build_object(
        'id',     'kf-' || t.id,
        't',      0,
        'states', coalesce(e.states, '{}'::jsonb)
      )
    ) as keyframes,
    jsonb_build_object(
      'preset',       'full',
      'widthMeters',  68,
      'lengthMeters', 105,
      'orientation',  'portrait',
      'overlays',     '[]'::jsonb
    ) as pitch
  from tactic t
  left join entities e on e.tactic_id = t.id
  left join markings m on m.tactic_id = t.id
)
update tactic t
set scene            = c.scene,
    keyframes        = c.keyframes,
    duration_seconds = 15,
    phases           = '[]'::jsonb,
    pitch            = c.pitch
from computed c
where t.id = c.id;
