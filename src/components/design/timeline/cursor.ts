import type { Keyframe } from '../../../store'

// How close the playhead has to be to a keyframe's time to count as sitting
// on it. Keyframe times are rounded to the millisecond by the store, but the
// playhead is a free-running float, so an exact comparison would only ever
// match when a transport button seeked there. At the durations this app deals
// in (5-60s across a few hundred pixels of track) 50ms is a couple of pixels —
// close enough to read as "on the diamond" without swallowing a deliberate
// scrub to just beside it.
export const ON_KEYFRAME_SECONDS = 0.05

function byTime(keyframes: Keyframe[]): Keyframe[] {
  for (let i = 1; i < keyframes.length; i++) {
    if (keyframes[i].t < keyframes[i - 1].t) return [...keyframes].sort((a, b) => a.t - b.t)
  }
  return keyframes
}

// The keyframe the playhead is parked on, if any. This is what makes the
// timeline's primary button context-aware — "Update Keyframe" when there's one
// here, "Add Keyframe" when there isn't.
export function keyframeAt(keyframes: Keyframe[], t: number): Keyframe | null {
  let closest: Keyframe | null = null
  let smallest = ON_KEYFRAME_SECONDS
  for (const keyframe of keyframes) {
    const distance = Math.abs(keyframe.t - t)
    if (distance <= smallest) {
      smallest = distance
      closest = keyframe
    }
  }
  return closest
}

// The next keyframe strictly after `t`, or the previous one strictly before —
// what the transport's prev/next buttons and the `,`/`.` shortcuts step
// through. Deliberately strict, so repeatedly pressing "next" walks forward
// instead of sticking on whichever keyframe the playhead already sits on.
export function stepKeyframe(keyframes: Keyframe[], t: number, direction: -1 | 1): Keyframe | null {
  const ordered = byTime(keyframes)
  if (direction === 1) {
    for (const keyframe of ordered) {
      if (keyframe.t > t + ON_KEYFRAME_SECONDS) return keyframe
    }
    return null
  }
  for (let i = ordered.length - 1; i >= 0; i--) {
    if (ordered[i].t < t - ON_KEYFRAME_SECONDS) return ordered[i]
  }
  return null
}

// mm:ss, the format the transport clock reads in. Negative and NaN times
// can't reach here from the playback hook, but the clamp keeps a bad duration
// from rendering "NaN:NaN" in the one place a coach always looks.
export function formatClock(seconds: number): string {
  const safe = Number.isFinite(seconds) ? Math.max(0, seconds) : 0
  const whole = Math.floor(safe)
  const minutes = Math.floor(whole / 60)
  return `${String(minutes).padStart(2, '0')}:${String(whole % 60).padStart(2, '0')}`
}
