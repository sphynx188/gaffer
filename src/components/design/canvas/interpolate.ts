import type { DrillScene, EntityState, Keyframe, Marking, SceneEntity } from '../../../store'

// The correctness core of the drill editor (DRILL_CREATOR_REWORK_PLAN.md
// Stage 3.1). Everything downstream — the canvas, playback, onion skin, the
// per-segment speed readout, a future 3D renderer — reads the drill through
// this one pure function, so `(scene, keyframes, t)` in and a plain list of
// placed shapes out is the whole contract. It never touches React, Konva,
// the store or Supabase.
//
// This is what the phases[] model could not express: two phases weren't
// guaranteed to describe the same elements, so there was no general way to
// interpolate between them (see the comment DrillLibrary.tsx used to carry).
// Entities have one id for the life of the drill, so "where is this player at
// t?" finally has an answer.

// One entity, resolved to an actual position on the pitch at a moment in
// time. `x`/`y` stay in the normalized 0-1 space every coordinate in this app
// uses; `facing` is degrees clockwise from the +x axis (canvas convention: y
// grows downward, so a positive angle turns clockwise on screen).
export interface RenderFrame {
  entities: Array<SceneEntity & { x: number; y: number; facing: number }>
  markings: Marking[]
}

interface Vector {
  x: number
  y: number
}

// Below this, a travel vector is treated as no movement at all rather than
// as a direction. Normalized coordinates run 0-1, so this is well under a
// pixel on any pitch we render.
const MOTIONLESS = 1e-9

const RAD_TO_DEG = 180 / Math.PI

// Samples per Catmull-Rom span when flattening a custom route into the
// polyline its arc-length table is built from. Sixteen is comfortably past
// the point where more samples stop moving a marker by a visible pixel at
// any pitch size this app renders.
const SAMPLES_PER_SPAN = 16

// A state is only renderable if it's actually on the pitch and actually
// carries a position. `hidden` states have no coordinates by construction
// (see EntityState in store/types.ts), and migration 013b writes exactly
// `{ hidden: true }` for an entity a keyframe doesn't place.
function isPlaced(state: EntityState | undefined): state is EntityState & { x: number; y: number } {
  return (
    state !== undefined &&
    state.hidden !== true &&
    typeof state.x === 'number' &&
    typeof state.y === 'number'
  )
}

function normalizeDegrees(degrees: number): number {
  const wrapped = degrees % 360
  return wrapped < 0 ? wrapped + 360 : wrapped
}

// Keyframes are kept sorted by the store, but frameAt is a public pure
// function and shouldn't trust its caller. Checking is O(n) and allocates
// nothing; sorting only happens if something handed us an unordered list.
function inTimeOrder(keyframes: Keyframe[]): Keyframe[] {
  for (let i = 1; i < keyframes.length; i++) {
    if (keyframes[i].t < keyframes[i - 1].t) return [...keyframes].sort((a, b) => a.t - b.t)
  }
  return keyframes
}

interface Bracket {
  // The keyframe in force at `t` — the one whose stored state decides whether
  // an entity is on the pitch, and which keyframe-bound markings are drawn.
  before: Keyframe
  // The keyframe being travelled towards, or null at/after the last one.
  after: Keyframe | null
  // Position within [before, after], 0 at `before` and 1 at `after`.
  alpha: number
  // The segment preceding `before`, used only to keep `facing` pointing the
  // way an entity was last travelling once it has stopped at the final
  // keyframe. Never affects position.
  previous: Keyframe | null
}

// Clamps before the first keyframe and after the last, exactly as the plan
// specifies: outside the keyframed range a drill holds its end pose rather
// than extrapolating off the pitch.
function bracketAt(ordered: Keyframe[], t: number): Bracket | null {
  if (ordered.length === 0) return null

  const last = ordered.length - 1
  if (t >= ordered[last].t) {
    return { before: ordered[last], after: null, alpha: 0, previous: last > 0 ? ordered[last - 1] : null }
  }
  if (t <= ordered[0].t) {
    // alpha 0 pins the position to the first keyframe; carrying `after`
    // anyway means facing still points along the run that's about to happen
    // rather than snapping to an arbitrary default.
    return { before: ordered[0], after: ordered[1] ?? null, alpha: 0, previous: null }
  }

  let index = 0
  for (let i = 1; i <= last; i++) {
    if (ordered[i].t <= t) index = i
    else break
  }
  const before = ordered[index]
  const after = ordered[index + 1]
  const span = after.t - before.t
  return {
    before,
    after,
    // The store refuses two keyframes on the same time, so `span` is only
    // ever zero if something bypassed it; treat that as "sitting on `before`".
    alpha: span > 0 ? (t - before.t) / span : 0,
    previous: index > 0 ? ordered[index - 1] : null,
  }
}

// --- Custom movement routes -------------------------------------------------
//
// `EntityState.path` holds the waypoints of a hand-drawn run from this
// keyframe to the next. A straight lerp through them would corner sharply at
// every waypoint, so the route is treated as a centripetal Catmull-Rom spline
// (alpha = 0.5) through [start, ...waypoints, end].
//
// Centripetal rather than uniform because uniform Catmull-Rom overshoots and
// can form a cusp when waypoints are unevenly spaced, which a hand-drawn route
// always is — a player would visibly swing wide of a corner the coach drew.

function knot(previous: number, a: Vector, b: Vector): number {
  // alpha = 0.5 is what makes this centripetal; the exponent is applied to
  // the distance, so this is sqrt of the chord length.
  return previous + Math.sqrt(Math.hypot(b.x - a.x, b.y - a.y))
}

function interpolateKnots(a: Vector, b: Vector, ta: number, tb: number, t: number): Vector {
  if (tb === ta) return { x: a.x, y: a.y }
  const w = (t - ta) / (tb - ta)
  return { x: a.x + (b.x - a.x) * w, y: a.y + (b.y - a.y) * w }
}

// One Catmull-Rom span between p1 and p2, shaped by its neighbours p0 and p3.
// Barry-Goldman pyramidal form, which is what lets the knot spacing be
// non-uniform.
function catmullRom(p0: Vector, p1: Vector, p2: Vector, p3: Vector, u: number): Vector {
  const t0 = 0
  const t1 = knot(t0, p0, p1)
  const t2 = knot(t1, p1, p2)
  const t3 = knot(t2, p2, p3)
  // Coincident control points collapse a knot span; there's no curve to
  // evaluate, so stay put rather than dividing by zero.
  if (t2 === t1) return { x: p1.x, y: p1.y }

  const t = t1 + (t2 - t1) * u
  const a1 = interpolateKnots(p0, p1, t0, t1, t)
  const a2 = interpolateKnots(p1, p2, t1, t2, t)
  const a3 = interpolateKnots(p2, p3, t2, t3, t)
  const b1 = interpolateKnots(a1, a2, t0, t2, t)
  const b2 = interpolateKnots(a2, a3, t1, t3, t)
  return interpolateKnots(b1, b2, t1, t2, t)
}

// Mirrored phantom endpoints, so the spline leaves the start and arrives at
// the end along the direction the route actually implies. Duplicating the
// endpoints instead (the other common choice) collapses a knot span and
// flattens the tangent there, which reads as a hesitation at both ends of
// every run.
function mirrorStart(controls: Vector[]): Vector {
  return { x: 2 * controls[0].x - controls[1].x, y: 2 * controls[0].y - controls[1].y }
}

function mirrorEnd(controls: Vector[]): Vector {
  const n = controls.length - 1
  return { x: 2 * controls[n].x - controls[n - 1].x, y: 2 * controls[n].y - controls[n - 1].y }
}

interface ArcTable {
  points: Vector[]
  // cumulative[i] is the distance along the flattened curve at points[i].
  cumulative: number[]
  length: number
}

// Flattens the spline into a dense polyline and measures it, so `alpha` can
// be spent as distance travelled rather than as spline parameter. Without
// this a marker would visibly speed up through tightly-spaced waypoints and
// crawl through widely-spaced ones — and Stage 4's speed readout would be
// reporting a number the animation doesn't actually move at.
function buildArcTable(controls: Vector[]): ArcTable {
  const padded = [mirrorStart(controls), ...controls, mirrorEnd(controls)]
  const points: Vector[] = []
  const cumulative: number[] = []
  let length = 0

  for (let span = 1; span < padded.length - 2; span++) {
    const p0 = padded[span - 1]
    const p1 = padded[span]
    const p2 = padded[span + 1]
    const p3 = padded[span + 2]
    // The first span contributes its start point; later spans don't, since
    // the previous span already ended there.
    const first = span === 1 ? 0 : 1
    for (let step = first; step <= SAMPLES_PER_SPAN; step++) {
      const point = catmullRom(p0, p1, p2, p3, step / SAMPLES_PER_SPAN)
      if (points.length > 0) length += Math.hypot(point.x - points[points.length - 1].x, point.y - points[points.length - 1].y)
      points.push(point)
      cumulative.push(length)
    }
  }

  return { points, cumulative, length }
}

interface Placement extends Vector {
  // Direction of travel at this instant, unnormalized. Zero when stationary.
  dx: number
  dy: number
}

function sampleArcTable(table: ArcTable, alpha: number): Placement {
  const { points, cumulative, length } = table
  const last = points.length - 1
  if (last <= 0) return { x: points[0].x, y: points[0].y, dx: 0, dy: 0 }

  const target = alpha * length
  // Binary search for the polyline segment holding `target`.
  let lo = 0
  let hi = last
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (cumulative[mid] < target) lo = mid + 1
    else hi = mid
  }
  const index = Math.max(1, lo)
  const from = points[index - 1]
  const to = points[index]
  const segment = cumulative[index] - cumulative[index - 1]
  const w = segment > 0 ? (target - cumulative[index - 1]) / segment : 0

  return {
    x: from.x + (to.x - from.x) * w,
    y: from.y + (to.y - from.y) * w,
    dx: to.x - from.x,
    dy: to.y - from.y,
  }
}

// Where an entity is `alpha` of the way from one keyframe state to the next,
// and which way it's travelling as it gets there.
function placeBetween(
  from: EntityState & { x: number; y: number },
  to: EntityState & { x: number; y: number },
  alpha: number
): Placement {
  const path = from.path
  if (path && path.length > 0) {
    const controls: Vector[] = [{ x: from.x, y: from.y }, ...path, { x: to.x, y: to.y }]
    const table = buildArcTable(controls)
    // A route whose points all coincide has no length to spend alpha on.
    if (table.length > 0) return sampleArcTable(table, alpha)
  }

  const dx = to.x - from.x
  const dy = to.y - from.y
  return { x: from.x + dx * alpha, y: from.y + dy * alpha, dx, dy }
}

// Explicit facing wins outright. Otherwise the entity faces the way it's
// travelling, rotated by how it's carrying its body through the run:
// backpedalling is 180 degrees off the direction of travel, and a shuffle is
// 90 degrees off it — left being a counter-clockwise turn on screen.
function facingFor(state: EntityState, dx: number, dy: number): number {
  if (typeof state.facing === 'number') return normalizeDegrees(state.facing)

  const moving = Math.abs(dx) > MOTIONLESS || Math.abs(dy) > MOTIONLESS
  const travel = moving ? Math.atan2(dy, dx) * RAD_TO_DEG : 0

  switch (state.bodyShape) {
    case 'backpedal':
      return normalizeDegrees(travel + 180)
    case 'shuffle_left':
      return normalizeDegrees(travel - 90)
    case 'shuffle_right':
      return normalizeDegrees(travel + 90)
    default:
      return normalizeDegrees(travel)
  }
}

// The direction an entity was travelling on the way into `before`, used when
// there's nothing ahead to travel towards — so a player who has arrived at
// the last keyframe keeps facing the way they ran in, instead of snapping
// back to zero degrees.
function arrivalDirection(previous: Keyframe | null, entityId: string, at: Vector): Vector {
  const from = previous?.states[entityId]
  if (!isPlaced(from)) return { x: 0, y: 0 }
  return { x: at.x - from.x, y: at.y - from.y }
}

/**
 * Resolves a drill to the set of shapes that should be on the pitch at `t`
 * seconds. Pure: same arguments, same result, no shared state.
 *
 * - Entities are placed by interpolating between the keyframe in force at `t`
 *   and the one after it, along a custom route where the earlier state has
 *   one and in a straight line otherwise.
 * - An entity is on the pitch only if the keyframe in force places it, so one
 *   that appears part-way through a drill arrives at its own keyframe rather
 *   than sliding in from nowhere, and one that leaves holds its last position
 *   until that keyframe passes.
 * - Markings are the static ones plus those bound to the keyframe in force,
 *   which is what makes the per-phase arrows and notes migration 013b carried
 *   across show up at the moment they belong to.
 */
export function frameAt(scene: DrillScene, keyframes: Keyframe[], t: number): RenderFrame {
  const ordered = inTimeOrder(keyframes)
  const bracket = bracketAt(ordered, t)

  if (!bracket) {
    // No timeline at all: nothing can be placed, but markings that aren't
    // bound to a keyframe still belong to the drill.
    return { entities: [], markings: scene.markings.filter((marking) => !marking.keyframeId) }
  }

  const entities: RenderFrame['entities'] = []
  for (const entity of scene.entities) {
    const from = bracket.before.states[entity.id]
    if (!isPlaced(from)) continue

    const to = bracket.after ? bracket.after.states[entity.id] : undefined
    if (isPlaced(to)) {
      const placement = placeBetween(from, to, bracket.alpha)
      entities.push({
        ...entity,
        x: placement.x,
        y: placement.y,
        facing: facingFor(from, placement.dx, placement.dy),
      })
      continue
    }

    // Nothing ahead to travel towards — either this is the last keyframe, or
    // the entity comes off the pitch at the next one. Hold position.
    const arrival = arrivalDirection(bracket.previous, entity.id, from)
    entities.push({ ...entity, x: from.x, y: from.y, facing: facingFor(from, arrival.x, arrival.y) })
  }

  const governingId = bracket.before.id
  return {
    entities,
    markings: scene.markings.filter((marking) => !marking.keyframeId || marking.keyframeId === governingId),
  }
}
