import { useCallback, useEffect, useRef, useState } from 'react'

// The drill clock (DRILL_CREATOR_REWORK_PLAN.md Stage 4.1).
//
// `currentTime` deliberately does NOT live in the Zustand store. It changes
// sixty times a second while a drill plays, and every component subscribed to
// that store would re-render with it — including the roster, the session
// planner and everything else that has nothing to do with the timeline. It
// belongs to whichever component owns the playhead, and nowhere else.

export const PLAYBACK_SPEEDS = [0.25, 0.5, 1, 2] as const
export type PlaybackSpeed = (typeof PLAYBACK_SPEEDS)[number]

// Re-exported from frames.ts, where it now lives alongside the frames<->seconds
// helpers that share its 30 fps basis (Stage 5.3). Kept exported here so every
// existing importer carries on working unchanged.
export { FRAME_SECONDS } from './frames'

export interface TimelinePlayback {
  currentTime: number
  playing: boolean
  speed: PlaybackSpeed
  loop: boolean
  play: () => void
  pause: () => void
  togglePlay: () => void
  /** Absolute, clamped to [0, duration]. */
  seek: (seconds: number) => void
  /** Relative to wherever the playhead is now. */
  step: (deltaSeconds: number) => void
  cycleSpeed: () => void
  /** Step one notch along PLAYBACK_SPEEDS; clamps at both ends. */
  stepSpeed: (delta: number) => void
  toggleLoop: () => void
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n))
}

export function useTimelinePlayback(duration: number): TimelinePlayback {
  const [storedTime, setStoredTime] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState<PlaybackSpeed>(1)
  const [loop, setLoop] = useState(false)

  // The clock's own copy of the time. The rAF loop reads and writes this
  // synchronously; `storedTime` is the mirror React renders from. Keeping both
  // avoids threading the current value through a state updater on every frame.
  const timeRef = useRef(0)

  // Shortening a drill can strand the playhead past the end. Clamping on read
  // rather than in an effect keeps it a derived value — there's no render
  // where the playhead is visibly out of bounds and no second pass to fix it.
  const currentTime = clamp(storedTime, 0, Math.max(0, duration))

  const commit = useCallback((seconds: number) => {
    timeRef.current = seconds
    setStoredTime(seconds)
  }, [])

  const seek = useCallback(
    (seconds: number) => commit(clamp(seconds, 0, Math.max(0, duration))),
    [commit, duration]
  )

  const step = useCallback((delta: number) => seek(timeRef.current + delta), [seek])

  const play = useCallback(() => {
    if (duration <= 0) return
    // Pressing play with the playhead parked at the end should start the drill
    // again rather than do nothing at all.
    if (timeRef.current >= duration) commit(0)
    setPlaying(true)
  }, [commit, duration])

  const pause = useCallback(() => setPlaying(false), [])

  const togglePlay = useCallback(() => {
    if (playing) pause()
    else play()
  }, [playing, play, pause])

  const cycleSpeed = useCallback(() => {
    setSpeed((current) => PLAYBACK_SPEEDS[(PLAYBACK_SPEEDS.indexOf(current) + 1) % PLAYBACK_SPEEDS.length])
  }, [])

  // Steps one notch along PLAYBACK_SPEEDS and STOPS at either end rather than
  // wrapping — this backs the Speed up / Slow down pair, where wrapping from
  // 2× straight back to 0.25× on one more press would read as a glitch. Only
  // ever changes how fast the coach watches; the stored keyframe times are a
  // fixed grid and nothing in the editor can retime them (scene.regrid).
  const stepSpeed = useCallback((delta: number) => {
    setSpeed((current) => {
      const next = PLAYBACK_SPEEDS.indexOf(current) + delta
      if (next < 0 || next >= PLAYBACK_SPEEDS.length) return current
      return PLAYBACK_SPEEDS[next]
    })
  }, [])

  const toggleLoop = useCallback(() => setLoop((on) => !on), [])

  useEffect(() => {
    if (!playing || duration <= 0) return
    let raf = 0
    // Wall-clock elapsed rather than a fixed per-frame increment, so playback
    // runs at the right speed on a 120Hz display and doesn't silently slow
    // down when a frame is dropped.
    let last = performance.now()

    const tick = (now: number) => {
      const elapsed = (now - last) / 1000
      last = now
      let next = timeRef.current + elapsed * speed

      if (next >= duration) {
        if (loop) {
          next = next % duration
        } else {
          timeRef.current = duration
          setStoredTime(duration)
          setPlaying(false)
          return
        }
      }

      timeRef.current = next
      setStoredTime(next)
      raf = requestAnimationFrame(tick)
    }

    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
    // Restarting the loop when speed/loop/duration change re-reads them
    // without a ref: `last` is re-seeded on every restart, so no time is lost
    // or double-counted across the change.
  }, [playing, speed, loop, duration])

  return { currentTime, playing, speed, loop, play, pause, togglePlay, seek, step, cycleSpeed, stepSpeed, toggleLoop }
}
