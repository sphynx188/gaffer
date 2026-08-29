import { ChevronDown, ChevronUp, Footprints, Layers, Pause, Play, Plus, Repeat, SkipBack, SkipForward, Spline } from 'lucide-react'
import type { Keyframe } from '../../../store'
import { formatClock, keyframeAt, stepKeyframe } from './cursor'
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
  // The always-available "add the next keyframe" chip strip (first-phase-
  // studio comparison, 2026-08-29) — one click, no play/pause/scrub first.
  // Optional the same way onToggleKeyframe is: a host that doesn't pass it
  // just doesn't get the strip.
  onAppendKeyframe?: () => void

  // Player paths (`T`) and ghost trails (`G`), rework plan Stage 5.5. Optional
  // and independent of each other and of onion skin — a coach turns on the one
  // that answers the question they have. A host that doesn't pass them simply
  // doesn't get the buttons.
  playerPaths?: boolean
  onTogglePlayerPaths?: () => void
  ghostTrails?: boolean
  onToggleGhostTrails?: () => void

  // Ctrl+C / Ctrl+V over the keyframe under the playhead (Stage 5.6).
  onCopyKeyframe?: () => void
  onPasteKeyframe?: () => void
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
  onAppendKeyframe,
  playerPaths,
  onTogglePlayerPaths,
  ghostTrails,
  onToggleGhostTrails,
  onCopyKeyframe,
  onPasteKeyframe,
  className,
}: TimelineBarProps) {
  // Wired here rather than left to the host: the bar is the part of the
  // timeline that's always on screen, so the shortcuts exist wherever it does.
  useTimelineKeys({
    playback,
    keyframes,
    onToggleKeyframe,
    onTogglePlayerPaths,
    onToggleGhostTrails,
    onCopyKeyframe,
    onPasteKeyframe,
  })

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
      {onAppendKeyframe && (
        <div className="flex items-center gap-1" role="group" aria-label="Keyframes">
          {keyframes.map((keyframe, index) => {
            const isParked = keyframeAt(keyframes, playback.currentTime)?.id === keyframe.id
            return (
              <button
                key={keyframe.id}
                type="button"
                onClick={() => playback.seek(keyframe.t)}
                aria-pressed={isParked}
                title={`Keyframe ${index + 1} — ${keyframe.t}s`}
                className={
                  'flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold tabular-nums transition-colors ' +
                  (isParked
                    ? 'bg-accent text-white'
                    : 'bg-panel-raised text-ink-muted hover:text-ink')
                }
              >
                {index + 1}
              </button>
            )
          })}
          <button
            type="button"
            onClick={onAppendKeyframe}
            title="Add the next keyframe, starting from where the last one left off"
            aria-label="Add next keyframe"
            className="flex h-8 w-8 items-center justify-center rounded-full border border-dashed border-line text-ink-muted transition-colors hover:border-line-strong hover:text-ink"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      )}

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

      {onTogglePlayerPaths && (
        <button
          type="button"
          onClick={onTogglePlayerPaths}
          aria-pressed={playerPaths}
          className={playerPaths ? TOGGLE_ON : TOGGLE_OFF}
          title="Show the route each moving player takes (T)"
        >
          <Spline className="h-3.5 w-3.5" />
          Paths
        </button>
      )}

      {onToggleGhostTrails && (
        <button
          type="button"
          onClick={onToggleGhostTrails}
          aria-pressed={ghostTrails}
          className={ghostTrails ? TOGGLE_ON : TOGGLE_OFF}
          title="Trail faded copies behind whatever is moving (G)"
        >
          <Footprints className="h-3.5 w-3.5" />
          Trails
        </button>
      )}

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
