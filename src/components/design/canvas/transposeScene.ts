import type { DrillScene, Keyframe, PhasePoint } from '../../../store'

// Flipping a pitch between portrait and landscape must move the CONTENT as
// well as the markings (TACTICS_BOARD_REWORK_PLAN.md Stage 1.6).
//
// `pitchGeometry.getPitchMarkings` renders landscape as the canonical portrait
// authoring put through `transpose()` — every x/y swapped. Until this helper
// existed, the orientation toggle patched `pitch.orientation` and nothing
// else, so the goalmouth, penalty box and halfway line all moved while every
// entity stayed at whatever normalized (x, y) it held. In a drill that is
// often survivable, because a drill is frequently a generic grid. In a tactic
// it is not: flip a 4-3-3 and the back four ends up strung across a touchline.
//
// The transform is the DIAGONAL MIRROR (x, y) -> (y, x), not a 90° rotation,
// precisely so it matches what pitchGeometry already does to the markings. A
// rotation would agree with the markings on one axis and disagree on the
// other, which looks almost right and is therefore worse.
//
// The invariant: a player standing in the home penalty area is still standing
// in the home penalty area after the flip. Transposing twice is the identity,
// so flipping back and forth is lossless.
//
// Coordinates are normalized 0-1 on both axes, so the swap needs no knowledge
// of the pitch's metre dimensions — which is also why this lives here rather
// than in pitchGeometry.

function transposePoint(point: PhasePoint): PhasePoint {
  return { x: point.y, y: point.x }
}

// Angles are degrees clockwise from +x with y growing downward (the canvas
// convention `interpolate.ts` documents). The diagonal mirror about y = x
// sends a direction (dx, dy) to (dy, dx), so an angle `a` becomes `90 - a`.
// That is what keeps a heading pointing at the same bit of pitch, and a goal
// standing across the goal line rather than along it, after the flip.
//
// The plan's Stage 1.6 lists only the three positional fields. Angles are the
// same defect on the same content: fixing where a player stands but not which
// way they face leaves a flip half-applied, and half-applied is harder to
// spot than not applied at all.
function transposeAngle(degrees: number): number {
  const flipped = (90 - degrees) % 360
  return flipped < 0 ? flipped + 360 : flipped
}

export function transposeScene(scene: DrillScene): DrillScene {
  return {
    ...scene,
    // Entities carry no position — that lives on EntityState — so the only
    // thing to move on one is its `rotation` (equipment only; a player's
    // heading is per-keyframe and handled in transposeKeyframes).
    entities: scene.entities.map((entity) =>
      entity.rotation === undefined ? entity : { ...entity, rotation: transposeAngle(entity.rotation) }
    ),
    markings: scene.markings.map((marking) => ({
      ...marking,
      points: marking.points.map(transposePoint),
    })),
  }
}

export function transposeKeyframes(keyframes: Keyframe[]): Keyframe[] {
  return keyframes.map((keyframe) => ({
    ...keyframe,
    states: Object.fromEntries(
      Object.entries(keyframe.states).map(([entityId, state]) => {
        const next = { ...state }
        // A hidden entity has no position to swap (see EntityState), and
        // `x`/`y` are only ever both present or both absent.
        if (next.x !== undefined && next.y !== undefined) {
          const swapped = transposePoint({ x: next.x, y: next.y })
          next.x = swapped.x
          next.y = swapped.y
        }
        if (next.facing !== undefined) next.facing = transposeAngle(next.facing)
        if (next.path) next.path = next.path.map(transposePoint)
        return [entityId, next]
      })
    ),
  }))
}
