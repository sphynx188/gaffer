import { useEffect, useMemo, useState } from 'react'
import type { DrillScene, Keyframe } from '../store'
import { frameAt, type RenderFrame } from '../components/design/canvas/interpolate'

// Loops a board's animation for the Home tab's hero (2026-08-30) — the one
// place in the app a drill plays without a coach pressing play. Deliberately
// not the editor's playhead: that one is a transport with scrubbing, speed
// and keyframe snapping, and this only needs "run, hold, run again".
//
// Static (the opening keyframe) whenever motion would be wrong: the coach has
// asked the OS for reduced motion, the board has fewer than two keyframes so
// there is nothing to move between, or the caller has switched it off. Stops
// while the tab is hidden — a background rAF loop redrawing a canvas nobody
// can see is what pitch-side battery should not be spent on.

interface PlayableBoard {
  scene: DrillScene
  keyframes: Keyframe[]
  duration_seconds: number
}

// Rests on the last keyframe before starting over, and briefly on the first
// so the loop's seam reads as a reset rather than a stutter.
const HOLD_END_MS = 1400
const HOLD_START_MS = 500
// The hero is one small canvas; 30fps is indistinguishable from 60 at that
// size and halves the redraw work.
const FRAME_MS = 1000 / 30

function earliestKeyframe(keyframes: Keyframe[]): Keyframe | null {
  if (keyframes.length === 0) return null
  return keyframes.reduce((a, b) => (b.t < a.t ? b : a))
}

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export function useBoardPlayback(board: PlayableBoard | null, enabled = true): RenderFrame | null {
  // The resting picture is derived, not stored: it is what shows before the
  // first tick, whenever playback is off, and the instant the board changes
  // (so a new hero never flashes the old board's last frame).
  const opening = useMemo(() => {
    if (!board) return null
    const first = earliestKeyframe(board.keyframes)
    return frameAt(board.scene, board.keyframes, first ? first.t : 0)
  }, [board])
  const [live, setLive] = useState<{ board: PlayableBoard; frame: RenderFrame } | null>(null)

  useEffect(() => {
    if (!board) return
    const first = earliestKeyframe(board.keyframes)
    if (!first || !enabled || board.keyframes.length < 2 || prefersReducedMotion()) return

    const last = board.keyframes.reduce((a, b) => (b.t > a.t ? b : a))
    // Run from the first keyframe to the last, not 0..duration: a drill whose
    // keyframes end at 10s of a 15s duration would otherwise sit still for a
    // third of every loop.
    const runMs = Math.max(0, last.t - first.t) * 1000
    const cycleMs = HOLD_START_MS + runMs + HOLD_END_MS

    let raf = 0
    let started = 0
    let lastDrawn = -Infinity

    const tick = (now: number) => {
      if (!started) started = now
      if (now - lastDrawn >= FRAME_MS) {
        lastDrawn = now
        const inCycle = (now - started) % cycleMs
        let t: number
        if (inCycle < HOLD_START_MS) t = first.t
        else if (inCycle < HOLD_START_MS + runMs) t = first.t + (inCycle - HOLD_START_MS) / 1000
        else t = last.t
        setLive({ board, frame: frameAt(board.scene, board.keyframes, t) })
      }
      raf = window.requestAnimationFrame(tick)
    }

    const start = () => {
      if (!raf) raf = window.requestAnimationFrame(tick)
    }
    const stop = () => {
      if (raf) window.cancelAnimationFrame(raf)
      raf = 0
      // Restart from the top when the tab comes back rather than mid-run.
      started = 0
    }
    const onVisibility = () => (document.hidden ? stop() : start())

    document.addEventListener('visibilitychange', onVisibility)
    if (!document.hidden) start()
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      stop()
    }
  }, [board, enabled])

  // A live frame only counts for the board it was drawn from.
  return live && live.board === board ? live.frame : opening
}
