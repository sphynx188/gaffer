import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Pause, Play, X } from 'lucide-react'
import type { Tactic } from '../../store'
import { PitchCanvas } from '../design/PitchCanvas'
import { frameAt } from '../design/canvas/interpolate'
import { useTimelinePlayback } from '../design/timeline/useTimelinePlayback'

// Presentation mode (TACTICS_BOARD_REWORK_PLAN.md Stage 8.3): full-screen,
// phase-by-phase stepping, no chrome, driven by the `phases[]` Stage 5 built.
// Teloframe gates this behind PRO; the plan is explicit that there is no
// reason to here.
//
// ── "Builds directly on board-only mode (7.5)" ────────────────────────────
// Board-only strips the editor down to the pitch. This goes one step further
// and strips the APP down to the pitch: `fixed inset-0` puts it over AppShell's
// nav rail too, which board-only can't do from inside the layout. So the
// editor hands off to this component entirely rather than rendering it on top
// — one Konva stage on screen, not two.
//
// The Fullscreen API is requested on top of that, because the actual use is a
// laptop plugged into a clubhouse TV. It is best-effort: Safari and iOS refuse
// it outside a user gesture chain, and the fixed overlay is already the whole
// viewport, so a refusal changes nothing a coach would notice.
//
// ── What a "step" is ──────────────────────────────────────────────────────
// One phase. Entering a step parks the playhead at that phase's start; Play
// runs the animation forward and STOPS at the phase's end rather than running
// on into the next one — the point of stepping is that the coach talks between
// phases. A tactic with no phases still presents: it gets one implicit step
// covering the whole timeline, which is better than a screen that can't be
// advanced.

interface Step {
  name: string
  start: number
  end: number
  color: string | null
}

export function TacticPresentation({ tactic, onExit }: { tactic: Tactic; onExit: () => void }) {
  const steps: Step[] = useMemo(() => {
    const phases = [...tactic.phases].sort((a, b) => a.startSeconds - b.startSeconds)
    if (phases.length === 0) {
      return [{ name: tactic.name, start: 0, end: tactic.duration_seconds, color: null }]
    }
    return phases.map((phase) => ({
      name: phase.name,
      start: phase.startSeconds,
      end: phase.endSeconds,
      color: phase.color,
    }))
  }, [tactic.phases, tactic.duration_seconds, tactic.name])

  const [index, setIndex] = useState(0)
  const step = steps[Math.min(index, steps.length - 1)]

  const playback = useTimelinePlayback(tactic.duration_seconds)
  const frame = useMemo(
    () => frameAt(tactic.scene, tactic.keyframes, playback.currentTime),
    [tactic.scene, tactic.keyframes, playback.currentTime]
  )

  // Sized against the live viewport rather than a Tailwind class: PitchCanvas
  // takes pixel budgets, not CSS, because it has to hand Konva a stage size.
  const [viewport, setViewport] = useState(() => ({
    width: typeof window === 'undefined' ? 1280 : window.innerWidth,
    height: typeof window === 'undefined' ? 800 : window.innerHeight,
  }))
  useEffect(() => {
    const onResize = () => setViewport({ width: window.innerWidth, height: window.innerHeight })
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // Best-effort fullscreen, per the note above. Exiting the element also has
  // to exit the browser's fullscreen, or the coach is left on a black screen
  // with no chrome and no obvious way back.
  useEffect(() => {
    const root = document.documentElement
    void root.requestFullscreen?.().catch(() => {})
    return () => {
      if (document.fullscreenElement) void document.exitFullscreen?.().catch(() => {})
    }
  }, [])

  // Entering a step parks the playhead at its start. `playback.seek` is stable
  // (useCallback in the hook), so this runs on step changes and nothing else.
  const stepStart = step.start
  useEffect(() => {
    playback.pause()
    playback.seek(stepStart)
    // `playback` is recreated every render; depending on the whole object
    // would re-park the playhead on every frame of playback.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepStart])

  // Stop at the phase's end instead of running on into the next one. Watched
  // here rather than added to useTimelinePlayback: a play range is what
  // presentation means by a step, not something the drill timeline has ever
  // needed, and the shared hook is the wrong place to put a tactics-only idea.
  useEffect(() => {
    if (!playback.playing) return
    if (playback.currentTime < step.end) return
    playback.pause()
    playback.seek(step.end)
    // Same reason as above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playback.playing, playback.currentTime, step.end])

  const atFirst = index === 0
  const atLast = index === steps.length - 1
  const goPrev = () => setIndex((i) => Math.max(0, i - 1))
  const goNext = () => setIndex((i) => Math.min(steps.length - 1, i + 1))

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return
      if (event.key === 'Escape') onExit()
      if (event.key === 'ArrowRight' || event.key === 'PageDown') goNext()
      if (event.key === 'ArrowLeft' || event.key === 'PageUp') goPrev()
      if (event.key === ' ') {
        // Or the browser scrolls the page behind the overlay.
        event.preventDefault()
        playback.togglePlay()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  })

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-surface px-4 py-4">
      <PitchCanvas
        pitch={tactic.pitch}
        frame={frame}
        maxWidth={viewport.width - 32}
        maxHeight={Math.max(240, viewport.height - 150)}
      />

      <div className="flex w-full max-w-2xl shrink-0 items-center justify-center gap-2">
        <button
          type="button"
          onClick={goPrev}
          disabled={atFirst}
          aria-label="Previous phase"
          className={CONTROL + ' disabled:opacity-30'}
        >
          <ChevronLeft className="h-5 w-5" />
        </button>

        {/* The phase's own colour is the one non-token colour here, and it has
            to be — a phase's colour is data a coach chose, not chrome. */}
        <div className="flex min-w-0 flex-1 items-center justify-center gap-2">
          {step.color && (
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: step.color }} aria-hidden />
          )}
          <p className="truncate text-base font-semibold text-ink">{step.name}</p>
          <span className="shrink-0 text-xs tabular-nums text-ink-faint">
            {index + 1}/{steps.length}
          </span>
        </div>

        <button
          type="button"
          onClick={playback.togglePlay}
          aria-label={playback.playing ? 'Pause' : 'Play this phase'}
          className="flex h-12 w-12 items-center justify-center rounded-full bg-accent text-white hover:bg-accent-hover"
        >
          {playback.playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
        </button>

        <button
          type="button"
          onClick={goNext}
          disabled={atLast}
          aria-label="Next phase"
          className={CONTROL + ' disabled:opacity-30'}
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      <button
        type="button"
        onClick={onExit}
        aria-label="Leave presentation"
        title="Leave presentation (Esc)"
        className="fixed right-4 top-4 flex h-11 w-11 items-center justify-center rounded-md text-ink-muted transition-colors hover:bg-panel-raised hover:text-ink"
      >
        <X className="h-5 w-5" />
      </button>
    </div>
  )
}

const CONTROL =
  'flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-line text-ink-muted transition-colors hover:border-line-strong hover:text-ink'
