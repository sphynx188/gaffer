import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  Eraser,
  Maximize2,
  Plus,
  Trash2,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'
import { KEYFRAME_GAP_SECONDS, MAX_KEYFRAMES } from '../../../store/sceneActions'
import type { RenderFrame } from '../canvas/interpolate'
import { AddPhaseDialog, PhaseTrack } from './PhaseTrack'
import { firstFreeSpan } from './phases'
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

// Timeline zoom (Stage 5.4). 1 is fit-to-view; above that the track grows wider
// than its container and scrolls, which is the only way to place a keyframe
// precisely on a long tactic.
const ZOOM_MIN = 1
const ZOOM_MAX = 8
const ZOOM_STEP = 1.5

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

export function TimelineEditor({ host, playback, frame, className }: TimelineEditorProps) {
  const trackRef = useRef<HTMLDivElement | null>(null)
  const [zoom, setZoom] = useState(1)
  const [addingPhase, setAddingPhase] = useState(false)

  const { parked, dirty, label, toggle } = useKeyframeToggle(host, frame, playback)
  const duration = host.duration
  const parkedIndex = parked ? host.keyframes.findIndex((k) => k.id === parked.id) : -1

  // Reordering moves the keyframe out from under the playhead, so the playhead
  // follows it to its new slot — otherwise the next press would act on
  // whichever keyframe slid into the old position instead.
  const moveParked = (delta: number) => {
    if (!parked || parkedIndex === -1) return
    host.reorderKeyframe(parked.id, delta)
    playback.seek((parkedIndex + delta) * KEYFRAME_GAP_SECONDS)
  }
  const segments = segmentSpeeds(host.scene, host.keyframes, host.pitch)

  // Phases are a tactics concept; a host that doesn't supply them gets no
  // phase track and no Add Phase button rather than an inert one.
  const phases = host.phases
  const canPhase = !!host.addPhase && !!host.updatePhase && !!host.removePhase
  const freeSpan = phases ? firstFreeSpan(phases, duration) : null

  const percentOf = (seconds: number) => (duration > 0 ? clamp((seconds / duration) * 100, 0, 100) : 0)

  const timeAt = (clientX: number): number => {
    const box = trackRef.current?.getBoundingClientRect()
    if (!box || box.width === 0) return 0
    return clamp(((clientX - box.left) / box.width) * duration, 0, duration)
  }

  const zoomBy = (factor: number) => setZoom((z) => clamp(z * factor, ZOOM_MIN, ZOOM_MAX))

  // Ctrl/Cmd + = / - / 0, per the published shortcut reference. preventDefault
  // matters: without it the browser zooms the whole page instead.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey)) return
      if (event.key === '=' || event.key === '+') {
        setZoom((z) => clamp(z * ZOOM_STEP, ZOOM_MIN, ZOOM_MAX))
        event.preventDefault()
      } else if (event.key === '-' || event.key === '_') {
        setZoom((z) => clamp(z / ZOOM_STEP, ZOOM_MIN, ZOOM_MAX))
        event.preventDefault()
      } else if (event.key === '0') {
        setZoom(1)
        event.preventDefault()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  // `P` adds a phase. Lives here rather than in useTimelineKeys because the
  // dialog it opens is this component's, and the shortcut should not fire when
  // the track is collapsed and there is nowhere for the dialog to appear.
  useEffect(() => {
    if (!canPhase) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return
      const target = event.target as HTMLElement | null
      const tag = target?.tagName?.toLowerCase()
      if (tag === 'input' || tag === 'textarea' || tag === 'select' || target?.isContentEditable) return
      if (event.key === 'p' || event.key === 'P') setAddingPhase(true)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [canPhase])

  const handleTrackPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId)
    playback.pause()
    playback.seek(timeAt(event.clientX))
  }

  const handleTrackPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) playback.seek(timeAt(event.clientX))
  }

  const handleTrackPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  return (
    <div className={'space-y-3 rounded-xl border border-line bg-panel p-3 ' + (className ?? '')}>
      {/* The zoom viewport. Everything inside is sized as a percentage of the
          inner width, so `percentOf` needs no knowledge of the zoom at all —
          the track simply gets wider and this scrolls. */}
      <div className="overflow-x-auto">
        <div style={{ width: `${zoom * 100}%`, minWidth: '100%' }}>
          {phases && phases.length > 0 && (
            <div className="mb-1">
              <PhaseTrack
                phases={phases}
                duration={duration}
                currentTime={playback.currentTime}
                percentOf={percentOf}
                timeAt={timeAt}
                onUpdate={(phaseId, patch) => host.updatePhase?.(phaseId, patch)}
                onRemove={(phaseId) => host.removePhase?.(phaseId)}
              />
            </div>
          )}
          <div
            ref={trackRef}
            className="relative h-20 cursor-pointer touch-none select-none rounded-md bg-panel-raised"
            onPointerDown={handleTrackPointerDown}
            onPointerMove={handleTrackPointerMove}
            onPointerUp={handleTrackPointerUp}
            onPointerCancel={handleTrackPointerUp}
          >
        {/* Ruler. Numbered by KEYFRAME, not by seconds — the grid makes every
            gap identical, so a seconds scale would only expose an internal
            unit a coach never sets. */}
        <div className="relative h-5 border-b border-line">
          {host.keyframes.map((keyframe, index) => (
            <div key={keyframe.id} className="absolute top-0 h-full" style={{ left: `${percentOf(keyframe.t)}%` }}>
              <div className="h-1.5 w-px bg-line-strong" />
              <span className="absolute left-1 top-0 font-mono text-[10px] tabular-nums text-ink-faint">
                {index + 1}
              </span>
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

        {/* Keyframe diamonds. Click to park the playhead on one; they can't be
            dragged, because the 1.5s grid owns their times (scene.regrid) and
            a coach never sees or sets the seconds behind them. */}
        {host.keyframes.map((keyframe, index) => {
          const isParked = parked?.id === keyframe.id
          const label = keyframe.name || `Keyframe ${index + 1}`
          return (
            <button
              key={keyframe.id}
              type="button"
              onPointerDown={(event) => {
                // Without this the track underneath would treat it as a scrub.
                event.stopPropagation()
                playback.pause()
                playback.seek(keyframe.t)
              }}
              className="absolute bottom-0 flex h-6 w-6 -translate-x-1/2 items-center justify-center rounded-full transition-colors"
              style={{ left: `${percentOf(keyframe.t)}%` }}
              title={label}
              aria-label={label}
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
        </div>
      </div>

      {addingPhase && freeSpan && (
        <AddPhaseDialog
          duration={duration}
          span={freeSpan}
          onCreate={(phase) => {
            host.addPhase?.(phase)
            setAddingPhase(false)
          }}
          onCancel={() => setAddingPhase(false)}
        />
      )}

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
          disabled={!parked || host.keyframes.length <= 1}
          className={ACTION}
          title={
            !parked
              ? 'Park the playhead on a keyframe to delete it'
              : host.keyframes.length <= 1
                ? 'A drill always keeps at least one keyframe'
                : 'Delete the keyframe under the playhead'
          }
        >
          <Trash2 className="h-3.5 w-3.5" />
          Delete
        </button>

        <button
          type="button"
          onClick={() => host.clearKeyframes()}
          disabled={host.keyframes.length <= 1}
          className={ACTION}
          title={host.keyframes.length <= 1 ? 'Nothing to clear' : 'Collapse back to a single keyframe'}
        >
          <Eraser className="h-3.5 w-3.5" />
          Clear keyframes
        </button>

        {/* What replaced drag-to-retime. A coach can still change WHEN a
            keyframe happens relative to the others — that's the running
            order — but not the seconds, which the grid owns. */}
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={() => moveParked(-1)}
            disabled={!parked || parkedIndex <= 0}
            className={ACTION}
            title={parked ? 'Move this keyframe earlier' : 'Park the playhead on a keyframe to move it'}
            aria-label="Move keyframe earlier"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => moveParked(1)}
            disabled={!parked || parkedIndex === -1 || parkedIndex >= host.keyframes.length - 1}
            className={ACTION}
            title={parked ? 'Move this keyframe later' : 'Park the playhead on a keyframe to move it'}
            aria-label="Move keyframe later"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>

        {canPhase && (
          <button
            type="button"
            onClick={() => setAddingPhase((open) => !open)}
            disabled={!freeSpan}
            aria-expanded={addingPhase}
            className={ACTION}
            title={freeSpan ? 'Add a phase (P)' : 'No room left on the phase track'}
          >
            <Plus className="h-3.5 w-3.5" />
            Add phase
          </button>
        )}

        {/* Zoom (Stage 5.4). The readout is a percentage the way Teloframe's
            is, and fit-to-view is the same thing as zoom 1 here because the
            track is laid out as a percentage of its container. */}
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={() => zoomBy(1 / ZOOM_STEP)}
            disabled={zoom <= ZOOM_MIN}
            className={ACTION}
            title="Zoom out (Ctrl+-)"
            aria-label="Zoom out"
          >
            <ZoomOut className="h-3.5 w-3.5" />
          </button>
          <span className="w-11 text-center font-mono text-[10px] tabular-nums text-ink-faint">
            {Math.round(zoom * 100)}%
          </span>
          <button
            type="button"
            onClick={() => zoomBy(ZOOM_STEP)}
            disabled={zoom >= ZOOM_MAX}
            className={ACTION}
            title="Zoom in (Ctrl+=)"
            aria-label="Zoom in"
          >
            <ZoomIn className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setZoom(1)}
            disabled={zoom === 1}
            className={ACTION}
            title="Fit the whole timeline (Ctrl+0)"
            aria-label="Fit timeline"
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Was a Duration input. Duration is derived from the keyframe count
            now (scene.regrid), so this reports the shape of the drill in the
            unit a coach actually thinks in — keyframes — rather than offering
            a seconds field that can disagree with them. */}
        <span className="ml-auto text-xs font-medium text-ink-muted tabular-nums">
          {host.keyframes.length} / {MAX_KEYFRAMES} keyframes
        </span>
      </div>
    </div>
  )
}
