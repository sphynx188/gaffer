import type { DrillScene, Keyframe, PhasePoint } from '../../../store'
import { frameAt, type RenderFrame } from '../canvas/interpolate'
import { stepKeyframe } from './cursor'

// Player paths and ghost trails (TACTICS_BOARD_REWORK_PLAN.md Stage 5.5).
//
// Both are derived from data `frameAt` already produces, so neither adds any
// state — which is why they are pure functions here rather than anything in the
// store. Onion skin (onionSkin.ts) is the third of the trio and predates them;
// all three toggle independently.

/** The route one entity takes from the keyframe before `t` to the one after. */
export interface MotionPath {
  entityId: string
  /** Normalized 0-1, in draw order. At least two points, or it isn't a path. */
  points: PhasePoint[]
}

// Below this an entity is standing still and its "path" would be a dot.
const MOVED_EPSILON = 0.004

/**
 * Player paths (`T`): the route line for each moving entity across the segment
 * the playhead is in.
 *
 * Uses `EntityState.path` when the coach has drawn one, and the straight line
 * between the two keyframe positions when they haven't — which is exactly what
 * the entity will actually travel, since that is what `interpolate` walks.
 *
 * Deliberately scoped to the CURRENT segment rather than the whole timeline: a
 * line per entity per segment across a six-keyframe tactic is a plate of
 * spaghetti, and the question a coach is asking is "where does this run go from
 * here".
 */
export function motionPathsFor(scene: DrillScene, keyframes: Keyframe[], t: number): MotionPath[] {
  if (keyframes.length < 2) return []
  const ordered = [...keyframes].sort((a, b) => a.t - b.t)
  // The segment containing `t`: the last keyframe at or before it, and its
  // successor. Parking exactly on a keyframe shows the run leaving it.
  let from = ordered[0]
  for (const keyframe of ordered) {
    if (keyframe.t <= t) from = keyframe
    else break
  }
  const to = ordered.find((keyframe) => keyframe.t > from.t)
  if (!to) return []

  const paths: MotionPath[] = []
  for (const entity of scene.entities) {
    const start = from.states[entity.id]
    const end = to.states[entity.id]
    if (!start || !end || start.hidden || end.hidden) continue
    if (start.x === undefined || start.y === undefined || end.x === undefined || end.y === undefined) continue
    if (Math.hypot(end.x - start.x, end.y - start.y) < MOVED_EPSILON) continue
    paths.push({
      entityId: entity.id,
      points: [{ x: start.x, y: start.y }, ...(start.path ?? []), { x: end.x, y: end.y }],
    })
  }
  return paths
}

// How far back a trail reaches, and how many copies it is made of. Short
// enough to read as "just came from here" rather than as a second formation.
const TRAIL_SECONDS = 0.6
const TRAIL_STEPS = 4

/**
 * Ghost trails (`G`): a few faded copies strung out behind whatever is moving.
 *
 * Sampled backwards from the playhead through the same `frameAt` the live frame
 * comes from, nearest-first — so the caller can fade them by index without
 * having to know the sampling interval.
 *
 * Returns nothing at t = 0: there is no "behind" at the start of a tactic, and
 * stacking four copies on the opening frame just makes it look smeared.
 */
export function trailFramesFor(scene: DrillScene, keyframes: Keyframe[], t: number): RenderFrame[] {
  if (t <= 0 || keyframes.length < 2) return []
  const frames: RenderFrame[] = []
  for (let step = 1; step <= TRAIL_STEPS; step++) {
    const at = t - (TRAIL_SECONDS / TRAIL_STEPS) * step
    if (at < 0) break
    frames.push(frameAt(scene, keyframes, at))
  }
  return frames
}

/**
 * Whether anything is actually moving across the current segment — what the
 * `T`/`G` toggles use to stay quiet on a static diagram, and what
 * `stepKeyframe` is imported here for.
 */
export function hasMovementAt(scene: DrillScene, keyframes: Keyframe[], t: number): boolean {
  if (motionPathsFor(scene, keyframes, t).length > 0) return true
  // A path is only computed forwards; parking on the last keyframe still has
  // movement behind it worth trailing.
  const previous = stepKeyframe(keyframes, t, -1)
  return previous !== null && motionPathsFor(scene, keyframes, previous.t).length > 0
}
