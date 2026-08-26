import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { AlignHorizontalDistributeCenter, Eraser, Trash2 } from 'lucide-react'
import type { RenderFrame } from '../canvas/interpolate'
import { formatSegment, segmentSpeeds, type SpeedVerdict } from './speeds'
import type { TimelineHost } from './TimelineHost'
import { useKeyframeToggle } from './useKeyframeToggle'
import type { TimelinePlayback } from './useTimelinePlayback'

// The expandable track (Stage 4.3): ruler, playhead, keyframe diamonds, and a
// bar per segment carrying the speed that segment demands.

interface TimelineEditorProps {
  host: TimelineHost
  playback: TimelinePlayback
  // What's on the pitch right now. Add/Update capture it, and the dirty dot
  // compares it against whatever the parked keyframe stores.
  frame: RenderFrame | null
  className?: string
}

// Tick spacings to choose from, coarsest that still gives a readable ruler.
const TICK_STEPS = [0.5, 1, 2, 5, 10, 15, 30, 60]
const MAX_TICKS = 10

// Segment bars carry their verdict as a tinted fill plus a matching border and
// label — the status tokens design.md reserves for exactly this.
const VERDICT_CLASS: Record<SpeedVerdict, string> = {
  ok: 'border-ok/40 bg-ok/10 text-ok',
  warn: 'border-warn/50 bg-warn/15 text-warn',
  bad: 'border-bad/60 bg-bad/20 text-bad',
}

const ACTION =
  'flex h-11 lg:h-8 items-center gap-1.5 rounded-md border border-line px-2 text-xs font-medium text-ink-muted transition-colors hover:border-line-strong hover:text-ink disabled:opacity-40 disabled:hover:border-line disabled:hover:text-ink-muted'

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n))
}

function tickStepFor(duration: number): number {
  for (const step of TICK_STEPS) {
    if (duration / step <= MAX_TICKS) return step
  }
  return duration / MAX_TICKS
}

export function TimelineEditor({ host, playback, frame, className }: TimelineEditorProps) {
  const trackRef = useRef<HTMLDivElement | null>(null)
  // A keyframe being dragged shows where it would land without writing there
  // yet. moveKeyframe is a committed mutation — calling it on every pointer
  // move would push a separate undo entry per frame of the drag.
  const [dragging, setDragging] = useState<{ id: string; t: number } | null>(null)
  const [durationDraft, setDurationDraft] = useState<string | null>(null)

  const { parked, dirty, label, toggle } = useKeyframeToggle(host, frame, playback)
  const duration = host.duration
  const segments = segmentSpeeds(host.scene, host.keyframes, host.pitch)

  const percentOf = (seconds: number) => (duration > 0 ? clamp((seconds / duration) * 100, 0, 100) : 0)

  const timeAt = (clientX: number): number => {
    const box = trackRef.current?.getBoundingClientRect()
    if (!box || box.width === 0) return 0
    return clamp(((clientX - box.left) / box.width) * duration, 0, duration)
  }

  const handleTrackPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (dragging) return
    event.currentTarget.setPointerCapture(event.pointerId)
    playback.pause()
    playback.seek(timeAt(event.clientX))
  }

  const handleTrackPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (dragging) {
      setDragging({ ...dragging, t: timeAt(event.clientX) })
      return
    }
    if (event.currentTarget.hasPointerCapture(event.pointerId)) playback.seek(timeAt(event.clientX))
  }

  const handleTrackPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    if (dragging) {
      host.moveKeyframe(dragging.id, dragging.t)
      setDragging(null)
    }
  }

  const beginKeyframeDrag = (id: string, t: number) => (event: ReactPointerEvent<HTMLElement>) => {
    // Without this the track underneath would treat the press as a scrub.
    event.stopPropagation()
    trackRef.current?.setPointerCapture(event.pointerId)
    playback.pause()
    playback.seek(t)
    setDragging({ id, t })
  }

  const commitDuration = () => {
    if (durationDraft === null) return
    const parsed = Number(durationDraft)
    if (Number.isFinite(parsed) && parsed > 0) host.setDuration(parsed)
    setDurationDraft(null)
  }

  const tickStep = tickStepFor(Math.max(duration, 1))
  const ticks: number[] = []
  for (let t = 0; t <= duration + 1e-9; t += tickStep) ticks.push(Number(t.toFixed(3)))

  return (
    <div className={'space-y-3 rounded-xl border border-line bg-panel p-3 ' + (className ?? '')}>
      <div
        ref={trackRef}
        className="relative h-20 cursor-pointer touch-none select-none rounded-md bg-panel-raised"
        onPointerDown={handleTrackPointerDown}
        onPointerMove={handleTrackPointerMove}
        onPointerUp={handleTrackPointerUp}
        onPointerCancel={handleTrackPointerUp}
      >
        {/* Ruler */}
        <div className="relative h-5 border-b border-line">
          {ticks.map((tick) => (
            <div key={tick} className="absolute top-0 h-full" style={{ left: `${percentOf(tick)}%` }}>
              <div className="h-1.5 w-px bg-line-strong" />
              <span className="absolute left-1 top-0 font-mono text-[10px] tabular-nums text-ink-faint">{tick}s</span>
            </div>
          ))}
        </div>

        {/* One bar per gap between keyframes, carrying what that gap demands. */}
        <div className="relative mt-1 h-9">
          {segments.map((segment) => (
            <div
              key={`${segment.fromId}-${segment.toId}`}
              className={
                'absolute top-0 flex h-full items-center justify-center overflow-hidden rounded border px-1 text-[10px] font-medium tabular-nums ' +
                VERDICT_CLASS[segment.verdict]
              }
              style={{ left: `${percentOf(segment.startSeconds)}%`, width: `${percentOf(segment.seconds)}%` }}
              title={formatSegment(segment)}
            >
              <span className="truncate">{formatSegment(segment)}</span>
            </div>
          ))}
        </div>

        {/* Keyframe diamonds, draggable to retime. */}
        {host.keyframes.map((keyframe) => {
          const at = dragging?.id === keyframe.id ? dragging.t : keyframe.t
          const isParked = parked?.id === keyframe.id
          return (
            <button
              key={keyframe.id}
              type="button"
              onPointerDown={beginKeyframeDrag(keyframe.id, keyframe.t)}
              className="absolute bottom-0 flex h-6 w-6 -translate-x-1/2 items-center justify-center rounded-full transition-colors"
              style={{ left: `${percentOf(at)}%` }}
              title={`${keyframe.name ? keyframe.name + ' · ' : ''}${keyframe.t}s — drag to retime`}
              aria-label={`Keyframe at ${keyframe.t} seconds`}
            >
              <span
                className={
                  'block h-3 w-3 rotate-45 rounded-[2px] ' + (isParked ? 'bg-accent' : 'bg-ink-muted')
                }
              />
            </button>
          )
        })}

        {/* Playhead */}
        <div
          className="pointer-events-none absolute inset-y-0 w-px bg-accent"
          style={{ left: `${percentOf(playback.currentTime)}%` }}
        >
          <div className="absolute -left-1 top-0 h-2 w-2 rounded-full bg-accent" />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={toggle}
          disabled={!frame}
          className="flex h-11 items-center gap-1.5 rounded-md bg-accent px-3 text-xs font-semibold lg:h-8 text-white transition-colors hover:bg-accent-hover disabled:opacity-40"
        >
          {label}
          {dirty && <span className="h-1.5 w-1.5 rounded-full bg-white" title="The pitch differs from this keyframe" />}
        </button>

        <button
          type="button"
          onClick={() => parked && host.deleteKeyframe(parked.id)}
          disabled={!parked}
          className={ACTION}
          title={parked ? 'Delete the keyframe under the playhead' : 'Park the playhead on a keyframe to delete it'}
        >
          <Trash2 className="h-3.5 w-3.5" />
          Delete
        </button>

        <button
          type="button"
          onClick={() => host.clearKeyframes()}
          disabled={host.keyframes.length === 0}
          className={ACTION}
        >
          <Eraser className="h-3.5 w-3.5" />
          Clear keyframes
        </button>

        <button
          type="button"
          onClick={() => host.balanceTiming()}
          disabled={host.keyframes.length < 2}
          className={ACTION}
          title="Spread the keyframes evenly across the timeline"
        >
          <AlignHorizontalDistributeCenter className="h-3.5 w-3.5" />
          Balance timing
        </button>

        <label htmlFor="drill-duration" className="ml-auto text-xs font-medium text-ink-muted">
          Duration
        </label>
        <input
          id="drill-duration"
          type="number"
          min={1}
          step={1}
          value={durationDraft ?? String(duration)}
          onChange={(e) => setDurationDraft(e.target.value)}
          onBlur={commitDuration}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur()
          }}
          className="h-11 w-20 rounded-md border border-line bg-panel px-2 text-sm lg:h-8 tabular-nums text-ink outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/30"
        />
        <span className="text-xs text-ink-muted">s</span>
      </div>
    </div>
  )
}
