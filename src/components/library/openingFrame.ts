import type { PitchConfig, DrillScene, Keyframe } from '../../store'
import type { RenderFrame } from '../design/canvas/interpolate'

/**
 * The board as it stands at the FIRST keyframe — what the Library's tiles draw
 * instead of a stored PNG (2026-08-30).
 *
 * Takes `frameAt` as an argument rather than importing it so this helper stays
 * usable from both the drill and tactic pages without either of them reaching
 * across into the other's module graph.
 *
 * Returns null when there is nothing worth drawing — a document with no
 * keyframes, or one whose opening frame is empty. The tile then falls back to
 * the stored thumbnail and finally to the file glyph, so a brand-new empty
 * drill still looks like an item rather than a blank green rectangle.
 */
export function openingFrame(
  doc: { scene: DrillScene; keyframes: Keyframe[]; pitch: PitchConfig },
  frameAt: (scene: DrillScene, keyframes: Keyframe[], t: number) => RenderFrame
): { pitch: PitchConfig; frame: RenderFrame } | null {
  if (!doc.keyframes || doc.keyframes.length === 0) return null
  // The earliest keyframe, not `t = 0`: nothing guarantees the first one sits
  // at zero, and asking for a time before it would interpolate from nowhere.
  const first = doc.keyframes.reduce((a, b) => (b.t < a.t ? b : a))
  const frame = frameAt(doc.scene, doc.keyframes, first.t)
  if (!frame || frame.entities.length === 0) return null
  return { pitch: doc.pitch, frame }
}
