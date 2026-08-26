import { useCallback, useMemo } from 'react'
import type { DrillScene, EntityState, Keyframe } from '../../../store'
import type { RenderFrame } from '../canvas/interpolate'
import { keyframeAt } from './cursor'
import type { TimelineHost } from './TimelineHost'
import type { TimelinePlayback } from './useTimelinePlayback'

// Teloframe's context-aware primary control: "Add Keyframe" when the playhead
// sits between keyframes, "Update Keyframe" when it's parked on one. Shared by
// the button in the track editor and the `K` shortcut on the bar, which is why
// it's a hook rather than a method on either component.

/**
 * The states to write into a keyframe for what's currently on the pitch.
 *
 * Every entity in the scene gets an entry: a position if it's on the pitch,
 * `{ hidden: true }` if it isn't, so a keyframe always describes the whole cast
 * rather than leaving absences implicit.
 *
 * `previous` is the state the keyframe already holds, passed when updating so
 * per-keyframe authoring that isn't positional — a body shape, an explicit
 * facing, a drawn route — survives a re-capture instead of being wiped by it.
 * It's deliberately not passed when adding: a route stored on one keyframe
 * describes the run to the keyframe that followed it at the time, and copying
 * it onto a new one in the middle would describe a journey nobody drew.
 */
export function captureKeyframeStates(
  scene: DrillScene,
  frame: RenderFrame,
  previous?: Record<string, EntityState>
): Record<string, EntityState> {
  const states: Record<string, EntityState> = {}
  for (const entity of scene.entities) {
    const live = frame.entities.find((candidate) => candidate.id === entity.id)
    if (!live) {
      states[entity.id] = { hidden: true }
      continue
    }
    const kept = { ...(previous?.[entity.id] ?? {}) }
    delete kept.hidden
    states[entity.id] = { ...kept, x: live.x, y: live.y }
  }
  return states
}

// Whether what's on the pitch has drifted from what the parked keyframe
// stores — the dirty dot on the Update button.
function framePlacementDiffers(frame: RenderFrame, keyframe: Keyframe): boolean {
  for (const entity of frame.entities) {
    const stored = keyframe.states[entity.id]
    if (!stored || stored.hidden === true || stored.x !== entity.x || stored.y !== entity.y) return true
  }
  for (const [id, stored] of Object.entries(keyframe.states)) {
    if (stored.hidden === true) continue
    if (!frame.entities.some((entity) => entity.id === id)) return true
  }
  return false
}

export interface KeyframeToggle {
  /** The keyframe the playhead is parked on, if any. */
  parked: Keyframe | null
  /** True when the pitch differs from what `parked` stores. */
  dirty: boolean
  label: string
  toggle: () => void
}

export function useKeyframeToggle(
  host: TimelineHost | null,
  frame: RenderFrame | null,
  playback: TimelinePlayback
): KeyframeToggle {
  const parked = useMemo(
    () => (host ? keyframeAt(host.keyframes, playback.currentTime) : null),
    [host, playback.currentTime]
  )

  const dirty = parked !== null && frame !== null && framePlacementDiffers(frame, parked)

  const toggle = useCallback(() => {
    if (!host || !frame) return
    if (parked) {
      host.updateKeyframeState(parked.id, captureKeyframeStates(host.scene, frame, parked.states))
      return
    }
    // Hands the interpolated frame in rather than letting the store guess:
    // without it a keyframe added mid-segment would capture the previous
    // keyframe's positions and the document would visibly snap there.
    host.addKeyframe(playback.currentTime, captureKeyframeStates(host.scene, frame))
  }, [host, frame, parked, playback.currentTime])

  return { parked, dirty, label: parked ? 'Update keyframe' : 'Add keyframe', toggle }
}
