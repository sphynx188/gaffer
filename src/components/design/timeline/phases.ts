import type { TacticPhase } from '../../../store'

// The non-component half of the phase track (Stage 5.2), split out so
// PhaseTrack.tsx exports only components and fast refresh keeps working.

// Teloframe's own six quick presets (§1 of the plan).
export const QUICK_PRESETS = ['Build-up', 'Attack', 'Counter', 'Press', 'Transition', 'Defense']

// Their seven swatches.
export const PHASE_COLORS = ['#3b82f6', '#ef4444', '#f59e0b', '#10b981', '#a855f7', '#ec4899', '#64748b']

// A band narrower than this is unreadable and undraggable.
export const MIN_PHASE_SECONDS = 0.2

/**
 * The room a phase has to grow into: up to its neighbours on either side, and
 * never outside the timeline. Clamping a drag to this is what makes overlap
 * unreachable — see PhaseTrack's header for why the invariant is enforced at
 * the gesture rather than in the store.
 */
export function boundsFor(
  phases: TacticPhase[],
  phaseId: string,
  duration: number
): { min: number; max: number } {
  const others = phases.filter((p) => p.id !== phaseId).sort((a, b) => a.startSeconds - b.startSeconds)
  const self = phases.find((p) => p.id === phaseId)
  if (!self) return { min: 0, max: duration }
  const before = others.filter((p) => p.endSeconds <= self.startSeconds).pop()
  const after = others.find((p) => p.startSeconds >= self.endSeconds)
  return { min: before ? before.endSeconds : 0, max: after ? after.startSeconds : duration }
}

/** The first gap long enough to hold a new phase, or null if the track is full. */
export function firstFreeSpan(
  phases: TacticPhase[],
  duration: number
): { start: number; end: number } | null {
  const ordered = [...phases].sort((a, b) => a.startSeconds - b.startSeconds)
  let cursor = 0
  for (const phase of ordered) {
    if (phase.startSeconds - cursor >= MIN_PHASE_SECONDS) return { start: cursor, end: phase.startSeconds }
    cursor = Math.max(cursor, phase.endSeconds)
  }
  return duration - cursor >= MIN_PHASE_SECONDS ? { start: cursor, end: duration } : null
}
