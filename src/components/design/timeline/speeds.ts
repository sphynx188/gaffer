import type { DrillScene, EntityState, Keyframe, PitchConfig } from '../../../store'

// The per-segment physics readout (DRILL_CREATOR_REWORK_PLAN.md Stage 4.4).
// A drill diagram will happily show a player covering ninety metres in a
// second; this is what tells a coach that before they take it to a session.

// Realistic ceilings. ~8 m/s is a quick sprint for an outfield player (a
// little over 28 km/h); ~25 m/s is a driven pass. Numbers past these aren't
// wrong as arithmetic, they're a drill that can't be run as drawn.
export const PLAYER_MAX_SPEED = 8
export const BALL_MAX_SPEED = 25

// Where the caution band starts, as a fraction of the ceiling. Set by the
// plan's own Verify step: 105m in 15s is 7 m/s and has to read green against
// the 8 m/s ceiling, so the band can't open at the 80% that would otherwise be
// the natural choice.
const CAUTION_RATIO = 0.9

export type SpeedVerdict = 'ok' | 'warn' | 'bad'

export interface SegmentSpeeds {
  fromId: string
  toId: string
  startSeconds: number
  endSeconds: number
  seconds: number
  // Fastest player and fastest ball in this segment, m/s.
  playerMax: number
  ballMax: number
  verdict: SpeedVerdict
}

// Normalized 0-1 coordinates aren't square: x spans one pitch axis and y the
// other, and which is which depends on the orientation. PitchConfig stores the
// canonical *portrait* dimensions plus an orientation flag — the same
// convention pitchGeometry.ts's transpose() uses — so landscape swaps them.
// Getting this backwards would quietly report a 68m run as 105m.
export function pitchSpanMeters(pitch: PitchConfig): { x: number; y: number } {
  return pitch.orientation === 'landscape'
    ? { x: pitch.lengthMeters, y: pitch.widthMeters }
    : { x: pitch.widthMeters, y: pitch.lengthMeters }
}

function placed(state: EntityState | undefined): state is EntityState & { x: number; y: number } {
  return state !== undefined && state.hidden !== true && typeof state.x === 'number' && typeof state.y === 'number'
}

// Straight-line distance between two keyframe states, in metres.
//
// This is the chord, which is what Stage 4.4 specifies. Once Stage 6's Draw
// Route lets a coach bend a run, the real distance along that route is longer
// than its chord and this becomes a lower bound — closing that gap means
// measuring the spline in metre space, which interpolate.ts already knows how
// to do internally.
function metersBetween(
  from: EntityState & { x: number; y: number },
  to: EntityState & { x: number; y: number },
  span: { x: number; y: number }
): number {
  return Math.hypot((to.x - from.x) * span.x, (to.y - from.y) * span.y)
}

export function verdictFor(playerMax: number, ballMax: number): SpeedVerdict {
  const worst = Math.max(playerMax / PLAYER_MAX_SPEED, ballMax / BALL_MAX_SPEED)
  if (worst > 1) return 'bad'
  if (worst >= CAUTION_RATIO) return 'warn'
  return 'ok'
}

/**
 * One entry per gap between consecutive keyframes, carrying the fastest
 * player and the fastest ball that gap demands.
 *
 * Entities that are off the pitch at either end of a segment are skipped —
 * an entity appearing or leaving hasn't travelled, and counting the jump
 * from nowhere would report a nonsense speed on an otherwise sane drill.
 */
export function segmentSpeeds(scene: DrillScene, keyframes: Keyframe[], pitch: PitchConfig): SegmentSpeeds[] {
  const ordered = [...keyframes].sort((a, b) => a.t - b.t)
  const span = pitchSpanMeters(pitch)
  const segments: SegmentSpeeds[] = []

  for (let i = 0; i < ordered.length - 1; i++) {
    const from = ordered[i]
    const to = ordered[i + 1]
    const seconds = to.t - from.t
    // The store refuses two keyframes on one time, so this only guards
    // against data that bypassed it; there's no honest speed to report for a
    // segment with no duration.
    if (seconds <= 0) continue

    let playerMax = 0
    let ballMax = 0
    for (const entity of scene.entities) {
      if (entity.kind === 'equipment') continue // cones don't run
      const a = from.states[entity.id]
      const b = to.states[entity.id]
      if (!placed(a) || !placed(b)) continue
      const speed = metersBetween(a, b, span) / seconds
      if (entity.kind === 'player') playerMax = Math.max(playerMax, speed)
      else ballMax = Math.max(ballMax, speed)
    }

    segments.push({
      fromId: from.id,
      toId: to.id,
      startSeconds: from.t,
      endSeconds: to.t,
      seconds,
      playerMax,
      ballMax,
      verdict: verdictFor(playerMax, ballMax),
    })
  }

  return segments
}

// `7.5s · P 7.0 m/s · B 0.0 m/s` — the readout drawn on each segment bar.
// Deliberately no seconds. Every gap is one fixed grid step (scene.regrid),
// so the number would be the same on every bar and tells a coach nothing —
// what varies, and what actually decides whether a segment is realistic, is
// how fast the gap requires the player and the ball to move.
export function formatSegment(segment: SegmentSpeeds): string {
  return `P ${segment.playerMax.toFixed(1)} m/s · B ${segment.ballMax.toFixed(1)} m/s`
}
