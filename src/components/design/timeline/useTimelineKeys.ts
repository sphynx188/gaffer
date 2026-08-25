import { useEffect } from 'react'
import type { Keyframe } from '../../../store'
import { stepKeyframe } from './cursor'
import { FRAME_SECONDS, type TimelinePlayback } from './useTimelinePlayback'

// Space play/pause, arrows step a frame, `,`/`.` jump keyframe to keyframe,
// `K` adds or updates a keyframe (Stage 4.6).

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
  enabled?: boolean
}

export function useTimelineKeys({ playback, keyframes, onToggleKeyframe, enabled = true }: TimelineKeysOptions) {
  const { seek, step, togglePlay, currentTime } = playback

  useEffect(() => {
    if (!enabled) return

    const onKeyDown = (event: KeyboardEvent) => {
      // Never steal a key from a form field — the duration input on the
      // timeline itself is one.
      if (isTypingTarget(event.target)) return
      // The canvas claims arrow keys for nudging a selection and space for
      // panning, and calls preventDefault when it does. This listener is on
      // window, so it runs after that and can stand down. Without this, one
      // arrow press would both nudge a player and scrub the playhead.
      if (event.defaultPrevented) return

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
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [enabled, keyframes, currentTime, seek, step, togglePlay, onToggleKeyframe])
}
