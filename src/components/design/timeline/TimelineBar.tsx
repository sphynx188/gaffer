import { ChevronDown, ChevronUp, Layers, Pause, Play, Repeat, SkipBack, SkipForward } from 'lucide-react'
import type { Keyframe } from '../../../store'
import { formatClock, stepKeyframe } from './cursor'
import type { TimelinePlayback } from './useTimelinePlayback'
import { useTimelineKeys } from './useTimelineKeys'

// The always-visible strip under the pitch (Stage 4.2): clock, keyframe count,
// transport, speed, loop, onion skin, and the handle that opens the track
// editor. Presentational — it owns no drill state and mutates nothing; every
// action is either a playback call or a callback the host passes in, the same
// separation PitchCanvas keeps.

interface TimelineBarProps {
  playback: TimelinePlayback
  duration: number
  keyframes: Keyframe[]
  onionSkin: boolean
  onToggleOnionSkin: () => void
  expanded: boolean
  onToggleExpanded: () => void
  // `K`, and the context-aware button in the track editor, share this.
  onToggleKeyframe?: () => void
  className?: string
}

const CONTROL = 'flex h-11 w-11 lg:h-8 lg:w-8 items-center justify-center rounded-md text-ink-muted transition-colors hover:bg-panel-raised hover:text-ink disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-ink-muted'
const TOGGLE_ON = 'flex h-11 lg:h-8 items-center gap-1.5 rounded-md border border-accent bg-accent px-2 text-xs font-medium text-white transition-colors'
const TOGGLE_OFF = 'flex h-11 lg:h-8 items-center gap-1.5 rounded-md border border-line px-2 text-xs font-medium text-ink-muted transition-colors hover:border-line-strong hover:text-ink'

export function TimelineBar({
  playback,
  duration,
  keyframes,
  onionSkin,
  onToggleOnionSkin,
  expanded,
  onToggleExpanded,
  onToggleKeyframe,
  className,
}: TimelineBarProps) {
  // Wired here rather than left to the host: the bar is the part of the
  // timeline that's always on screen, so the shortcuts exist wherever it does.
  useTimelineKeys({ playback, keyframes, onToggleKeyframe })

  const previous = stepKeyframe(keyframes, playback.currentTime, -1)
  const next = stepKeyframe(keyframes, playback.currentTime, 1)

  return (
    <div
      data-onboarding-anchor="timeline-bar"
      className={
        'flex flex-wrap items-center gap-2 rounded-xl border border-line bg-panel px-3 py-2 ' + (className ?? '')
      }
    >
      <p className="font-mono text-sm tabular-nums text-ink">
        {formatClock(playback.currentTime)}
        <span className="text-ink-faint"> / {formatClock(duration)}</span>
      </p>
      <p className="text-xs text-ink-muted">
        {keyframes.length} {keyframes.length === 1 ? 'keyframe' : 'keyframes'}
      </p>

      <div className="flex items-center gap-0.5">
        <button type="button" className={CONTROL} onClick={() => playback.seek(0)} title="Skip to start" aria-label="Skip to start">
          <SkipBack className="h-4 w-4" />
        </button>
        <button
          type="button"
          className={CONTROL}
          onClick={() => previous && playback.seek(previous.t)}
          disabled={!previous}
          title="Previous keyframe (,)"
          aria-label="Previous keyframe"
        >
          <ChevronUp className="h-4 w-4 -rotate-90" />
        </button>
        <button
          type="button"
          className="flex h-11 w-11 items-center justify-center rounded-md bg-accent lg:h-8 lg:w-8 text-white transition-colors hover:bg-accent-hover disabled:opacity-40"
          onClick={playback.togglePlay}
          disabled={duration <= 0}
          title={playback.playing ? 'Pause (space)' : 'Play (space)'}
          aria-label={playback.playing ? 'Pause' : 'Play'}
        >
          {playback.playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </button>
        <button
          type="button"
          className={CONTROL}
          onClick={() => next && playback.seek(next.t)}
          disabled={!next}
          title="Next keyframe (.)"
          aria-label="Next keyframe"
        >
          <ChevronUp className="h-4 w-4 rotate-90" />
        </button>
        <button type="button" className={CONTROL} onClick={() => playback.seek(duration)} title="Skip to end" aria-label="Skip to end">
          <SkipForward className="h-4 w-4" />
        </button>
      </div>

      <button
        type="button"
        onClick={playback.cycleSpeed}
        className="h-11 rounded-md border border-line px-2 font-mono lg:h-8 text-xs tabular-nums text-ink-muted transition-colors hover:border-line-strong hover:text-ink"
        title="Playback speed"
      >
        {playback.speed}×
      </button>

      <button
        type="button"
        onClick={playback.toggleLoop}
        aria-pressed={playback.loop}
        className={playback.loop ? TOGGLE_ON : TOGGLE_OFF}
        title="Loop"
      >
        <Repeat className="h-3.5 w-3.5" />
        Loop
      </button>

      <button
        type="button"
        onClick={onToggleOnionSkin}
        aria-pressed={onionSkin}
        className={onionSkin ? TOGGLE_ON : TOGGLE_OFF}
        title="Show the keyframes either side at low opacity"
      >
        <Layers className="h-3.5 w-3.5" />
        Onion skin
      </button>

      <button
        type="button"
        onClick={onToggleExpanded}
        aria-expanded={expanded}
        className={TOGGLE_OFF + ' ml-auto'}
        title={expanded ? 'Collapse the timeline' : 'Expand the timeline'}
      >
        {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
        Timeline
      </button>
    </div>
  )
}
