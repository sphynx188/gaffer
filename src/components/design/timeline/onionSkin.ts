import type { DrillScene, Keyframe } from '../../../store'
import { frameAt, type RenderFrame } from '../canvas/interpolate'
import { stepKeyframe } from './cursor'

/**
 * The frames to ghost beneath the live one (Stage 4.5) — the keyframe before
 * the playhead and the one after it, resolved through the same `frameAt` the
 * live frame comes from.
 *
 * `stepKeyframe` is strict on both sides, so parking on a keyframe ghosts its
 * neighbours rather than ghosting itself on top of the live frame.
 */
export function onionFramesFor(scene: DrillScene, keyframes: Keyframe[], t: number): RenderFrame[] {
  const frames: RenderFrame[] = []
  const before = stepKeyframe(keyframes, t, -1)
  const after = stepKeyframe(keyframes, t, 1)
  if (before) frames.push(frameAt(scene, keyframes, before.t))
  if (after) frames.push(frameAt(scene, keyframes, after.t))
  return frames
}
