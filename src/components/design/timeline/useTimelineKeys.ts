import { useEffect } from 'react'
import type { Keyframe } from '../../../store'
import { stepKeyframe } from './cursor'
import { FRAME_SECONDS, type TimelinePlayback } from './useTimelinePlayback'

// Space play/pause, arrows step a frame, `,`/`.` jump keyframe to keyframe,
// `K` adds or updates a keyframe (Stage 4.6). `T` and `G` toggle the two
// movement visualisations, and Ctrl/Cmd+C/V copy and paste a whole keyframe
// (TACTICS_BOARD_REWORK_PLAN.md Stages 5.5 and 5.6) — each only when the host
// supplies a handler, so the drill editor doesn't grow silent shortcuts for
// controls it doesn't have.

function isTypingTarget(target: EventTarget | null): boolean {
  const element = target as HTMLElement | null
  if (!element || typeof element.tagName !== 'string') return false
  const tag = element.tagName.toLowerCase()
  return tag === 'input' || tag === 'textarea' || tag === 'select' || element.isContentEditable === true
}

export interface TimelineKeysOptions {
  playback: TimelinePlayback
  keyframes: Keyframe[]
  onToggleKeyframe?: () => void
  onTogglePlayerPaths?: () => void
  onToggleGhostTrails?: () => void
  onCopyKeyframe?: () => void
  onPasteKeyframe?: () => void
  enabled?: boolean
}

export function useTimelineKeys({
  playback,
  keyframes,
  onToggleKeyframe,
  onTogglePlayerPaths,
  onToggleGhostTrails,
  onCopyKeyframe,
  onPasteKeyframe,
  enabled = true,
}: TimelineKeysOptions) {
  const { seek, step, togglePlay, currentTime } = playback

  useEffect(() => {
    if (!enabled) return

    const onKeyDown = (event: KeyboardEvent) => {
      // Never steal a key from a form field — a keyframe's name, the drill's
      // own metadata fields, anything the editor renders as an input.
      if (isTypingTarget(event.target)) return
      // The canvas claims arrow keys for nudging a selection and space for
      // panning, and calls preventDefault when it does. This listener is on
      // window, so it runs after that and can stand down. Without this, one
      // arrow press would both nudge a player and scrub the playhead.
      if (event.defaultPrevented) return

      // Copy/paste first: they are the only shortcuts here that carry a
      // modifier, and `c` and `v` would otherwise fall through to the plain
      // single-key cases below.
      if (event.metaKey || event.ctrlKey) {
        if ((event.key === 'c' || event.key === 'C') && onCopyKeyframe) {
          onCopyKeyframe()
          event.preventDefault()
        } else if ((event.key === 'v' || event.key === 'V') && onPasteKeyframe) {
          onPasteKeyframe()
          event.preventDefault()
        }
        return
      }

      switch (event.key) {
        case ' ':
          togglePlay()
          event.preventDefault()
          break
        case 'ArrowLeft':
          step(-FRAME_SECONDS)
          event.preventDefault()
          break
        case 'ArrowRight':
          step(FRAME_SECONDS)
          event.preventDefault()
          break
        case ',': {
          const previous = stepKeyframe(keyframes, currentTime, -1)
          if (previous) seek(previous.t)
          break
        }
        case '.': {
          const next = stepKeyframe(keyframes, currentTime, 1)
          if (next) seek(next.t)
          break
        }
        case 'k':
        case 'K':
          onToggleKeyframe?.()
          break
        case 't':
        case 'T':
          onTogglePlayerPaths?.()
          break
        case 'g':
        case 'G':
          onToggleGhostTrails?.()
          break
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [
    enabled,
    keyframes,
    currentTime,
    seek,
    step,
    togglePlay,
    onToggleKeyframe,
    onTogglePlayerPaths,
    onToggleGhostTrails,
    onCopyKeyframe,
    onPasteKeyframe,
  ])
}
