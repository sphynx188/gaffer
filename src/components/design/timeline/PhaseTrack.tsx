import { useState, type PointerEvent as ReactPointerEvent } from 'react'
import { X } from 'lucide-react'
import type { TacticPhase } from '../../../store'

const CHIP =
  'min-h-11 rounded-md border px-2 text-xs font-medium transition-colors lg:min-h-8 border-line text-ink-muted hover:border-line-strong hover:text-ink'

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n))
}
import { formatClock } from './cursor'
import { framesToSeconds, secondsToFrames } from './frames'
import { MIN_PHASE_SECONDS, PHASE_COLORS, QUICK_PRESETS, boundsFor } from './phases'

// Phases (TACTICS_BOARD_REWORK_PLAN.md Stage 5.2): named, coloured bands laid
// over the keyframe track — "Build-up", "Press", "Transition".
//
// Purely organisational. A phase groups keyframes for the coach and has NO
// effect on interpolation, which is why `frameAt` has never heard of one and
// why nothing here touches a keyframe. It is vocabulary and structure, not
// geometry — and not to be confused with the drill `phases[]` model migration
// 014 dropped, which really was geometry.
//
// Bands MAY NOT OVERLAP. That is enforced here, where the drag happens, rather
// than in the store: Stage 2's addTacticPhase/updateTacticPhase shipped without
// the constraint, and clamping the gesture that could violate it keeps their
// contract as specified while making the invariant unreachable in the UI.

interface PhaseTrackProps {
  phases: TacticPhase[]
  duration: number
  currentTime: number
  percentOf: (seconds: number) => number
  timeAt: (clientX: number) => number
  onUpdate: (phaseId: string, patch: Partial<Omit<TacticPhase, 'id'>>) => void
  onRemove: (phaseId: string) => void
}

export function PhaseTrack({
  phases,
  duration,
  currentTime,
  percentOf,
  timeAt,
  onUpdate,
  onRemove,
}: PhaseTrackProps) {
  // An edge being dragged previews where it would land without writing there —
  // updatePhase is a committed mutation, so calling it per pointer move would
  // push one undo entry per frame of the drag. Same reasoning as the keyframe
  // diamonds in TimelineEditor.
  const [dragging, setDragging] = useState<{ id: string; edge: 'start' | 'end'; t: number } | null>(null)

  const beginEdgeDrag =
    (id: string, edge: 'start' | 'end', t: number) => (event: ReactPointerEvent<HTMLElement>) => {
      event.stopPropagation()
      event.currentTarget.setPointerCapture(event.pointerId)
      setDragging({ id, edge, t })
    }

  const moveEdge = (event: ReactPointerEvent<HTMLElement>) => {
    if (!dragging) return
    const phase = phases.find((p) => p.id === dragging.id)
    if (!phase) return
    const { min, max } = boundsFor(phases, dragging.id, duration)
    const raw = timeAt(event.clientX)
    const t =
      dragging.edge === 'start'
        ? clamp(raw, min, phase.endSeconds - MIN_PHASE_SECONDS)
        : clamp(raw, phase.startSeconds + MIN_PHASE_SECONDS, max)
    setDragging({ ...dragging, t })
  }

  const commitEdge = (event: ReactPointerEvent<HTMLElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    if (!dragging) return
    onUpdate(dragging.id, dragging.edge === 'start' ? { startSeconds: dragging.t } : { endSeconds: dragging.t })
    setDragging(null)
  }

  const startOf = (phase: TacticPhase) =>
    dragging?.id === phase.id && dragging.edge === 'start' ? dragging.t : phase.startSeconds
  const endOf = (phase: TacticPhase) =>
    dragging?.id === phase.id && dragging.edge === 'end' ? dragging.t : phase.endSeconds

  return (
    <div className="relative h-7" aria-label="Phases">
      {phases.map((phase) => {
        const start = startOf(phase)
        const end = endOf(phase)
        // The band under the playhead reads as live — this is what the verify
        // step means by "band colours track the playhead".
        //
        // Half-open [start, end): a boundary belongs to the band starting
        // there, not to both. Inclusive on both ends lit two bands at once
        // every time the playhead crossed a join, which reads as a glitch. The
        // one exception is the very last instant, which would otherwise fall
        // outside every band.
        const active =
          currentTime >= phase.startSeconds &&
          (currentTime < phase.endSeconds || (currentTime >= duration && phase.endSeconds >= duration))
        return (
          <div
            key={phase.id}
            className={
              'group absolute top-0 flex h-full items-center gap-1 overflow-hidden rounded border px-1 text-[10px] font-medium transition-opacity ' +
              (active ? 'opacity-100' : 'opacity-55')
            }
            style={{
              left: `${percentOf(start)}%`,
              width: `${Math.max(percentOf(end) - percentOf(start), 0)}%`,
              borderColor: phase.color,
              backgroundColor: `${phase.color}2e`,
              color: phase.color,
            }}
            title={`${phase.name} · ${formatClock(phase.startSeconds)}–${formatClock(phase.endSeconds)}`}
          >
            {/* Edge handles. Pointer capture lives on the handle so a fast drag
                that leaves the band still tracks. */}
            <span
              role="slider"
              tabIndex={0}
              aria-label={`${phase.name} start`}
              aria-valuenow={Math.round(start * 100) / 100}
              aria-valuemin={0}
              aria-valuemax={duration}
              onPointerDown={beginEdgeDrag(phase.id, 'start', phase.startSeconds)}
              onPointerMove={moveEdge}
              onPointerUp={commitEdge}
              onPointerCancel={commitEdge}
              className="absolute inset-y-0 left-0 w-2 cursor-ew-resize touch-none"
            />
            <span className="truncate pl-1.5">{phase.name}</span>
            <button
              type="button"
              onClick={() => onRemove(phase.id)}
              aria-label={`Remove the ${phase.name} phase`}
              className="ml-auto hidden shrink-0 rounded p-0.5 hover:bg-panel group-hover:block"
            >
              <X className="h-3 w-3" />
            </button>
            <span
              role="slider"
              tabIndex={0}
              aria-label={`${phase.name} end`}
              aria-valuenow={Math.round(end * 100) / 100}
              aria-valuemin={0}
              aria-valuemax={duration}
              onPointerDown={beginEdgeDrag(phase.id, 'end', phase.endSeconds)}
              onPointerMove={moveEdge}
              onPointerUp={commitEdge}
              onPointerCancel={commitEdge}
              className="absolute inset-y-0 right-0 w-2 cursor-ew-resize touch-none"
            />
          </div>
        )
      })}
    </div>
  )
}

/**
 * The Add Phase dialog. Name, the six quick presets, start/end **in frames**
 * with an mm:ss.xx readout, and the seven colour swatches.
 *
 * Frames appear here and nowhere else in the app, which is exactly what plan
 * 5.3 asks for: Teloframe's dialog reads `END FRAME 150`, and a coach who
 * thinks that way can type it, but `Keyframe.t` stays float seconds because
 * seconds are already load-bearing in interpolate.ts, speeds.ts and 013b.
 */
export function AddPhaseDialog({
  duration,
  span,
  onCreate,
  onCancel,
}: {
  duration: number
  /** The gap the new phase will occupy — the first free one on the track. */
  span: { start: number; end: number }
  onCreate: (phase: Omit<TacticPhase, 'id'>) => void
  onCancel: () => void
}) {
  const [name, setName] = useState('')
  const [color, setColor] = useState(PHASE_COLORS[0])
  const [startFrame, setStartFrame] = useState(secondsToFrames(span.start))
  const [endFrame, setEndFrame] = useState(secondsToFrames(span.end))

  const startSeconds = framesToSeconds(startFrame)
  const endSeconds = framesToSeconds(endFrame)
  const valid = name.trim().length > 0 && endSeconds - startSeconds >= MIN_PHASE_SECONDS

  return (
    <div className="space-y-3 rounded-xl border border-line bg-panel-raised p-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">Add phase</p>
        <button
          type="button"
          onClick={onCancel}
          aria-label="Cancel"
          className="rounded p-1 text-ink-muted transition-colors hover:text-ink"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div>
        <label htmlFor="phase-name" className="block text-xs font-medium text-ink-muted">
          Phase name
        </label>
        <input
          id="phase-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Build-up, Attack, Counter"
          autoFocus
          className="mt-1 h-11 w-full rounded-md border border-line bg-panel px-2 text-sm text-ink outline-none transition-colors focus:border-accent lg:h-9"
        />
      </div>

      <div className="flex flex-wrap gap-1">
        {QUICK_PRESETS.map((preset) => (
          <button key={preset} type="button" onClick={() => setName(preset)} className={CHIP}>
            {preset}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <FrameField
          id="phase-start"
          label="Start frame"
          value={startFrame}
          max={secondsToFrames(duration)}
          onChange={setStartFrame}
          seconds={startSeconds}
        />
        <FrameField
          id="phase-end"
          label="End frame"
          value={endFrame}
          max={secondsToFrames(duration)}
          onChange={setEndFrame}
          seconds={endSeconds}
        />
      </div>

      <div>
        <p className="text-xs font-medium text-ink-muted">Colour</p>
        <div className="mt-1 flex flex-wrap gap-1.5">
          {PHASE_COLORS.map((swatch) => (
            <button
              key={swatch}
              type="button"
              aria-label={`Phase colour ${swatch}`}
              aria-pressed={color === swatch}
              onClick={() => setColor(swatch)}
              style={{ backgroundColor: swatch }}
              className={
                'h-7 w-7 rounded-full border-2 transition-colors ' +
                (color === swatch ? 'border-ink' : 'border-transparent hover:border-line-strong')
              }
            />
          ))}
        </div>
      </div>

      <button
        type="button"
        disabled={!valid}
        onClick={() => onCreate({ name: name.trim(), startSeconds, endSeconds, color })}
        className="h-11 rounded-md bg-accent px-3 text-xs font-semibold text-white transition-colors hover:bg-accent-hover disabled:opacity-40 lg:h-9"
      >
        Create phase
      </button>
    </div>
  )
}

function FrameField({
  id,
  label,
  value,
  max,
  onChange,
  seconds,
}: {
  id: string
  label: string
  value: number
  max: number
  onChange: (frames: number) => void
  seconds: number
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-xs font-medium text-ink-muted">
        {label}
      </label>
      <input
        id={id}
        type="number"
        min={0}
        max={max}
        step={1}
        value={value}
        onChange={(e) => onChange(clamp(Number(e.target.value) || 0, 0, max))}
        className="mt-1 h-11 w-24 rounded-md border border-line bg-panel px-2 text-sm tabular-nums text-ink outline-none transition-colors focus:border-accent lg:h-9"
      />
      <p className="mt-0.5 font-mono text-[10px] tabular-nums text-ink-faint">{formatClock(seconds)}</p>
    </div>
  )
}

