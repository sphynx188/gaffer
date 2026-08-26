// Frames, at 30 fps (TACTICS_BOARD_REWORK_PLAN.md Stage 5.3).
//
// Teloframe's timeline is frame-based — its Add Phase dialog reads
// `END FRAME 150` for 5.00s — while Gaffer stores `Keyframe.t` as float
// SECONDS. The plan is explicit that seconds stay the stored unit: they are
// already load-bearing in interpolate.ts, speeds.ts and migration 013b, and
// changing the stored unit buys nothing that these two functions don't.
//
// So frames are a DISPLAY unit and nothing else. The only place they surface
// is the Add Phase dialog, where a coach who thinks in frames can type one.
export const FPS = 30

// One press of the left/right arrow keys, and the grid a keyframe drag snaps
// to. Not tied to the rAF rate — it's a scrubbing granularity, chosen fine
// enough to land on a moment between two keyframes and coarse enough that
// holding the key gets somewhere. The `,`/`.` shortcuts are the coarse
// movement.
export const FRAME_SECONDS = 1 / FPS

export function framesToSeconds(frames: number): number {
  return frames / FPS
}

export function secondsToFrames(seconds: number): number {
  return Math.round(seconds * FPS)
}

// Snaps a time onto the 1/30s grid. Applied when a keyframe is dragged, so a
// coach can't land on 1.63333333s and then wonder why two keyframes that look
// aligned aren't.
export function snapToFrame(seconds: number): number {
  return framesToSeconds(Math.round(seconds * FPS))
}
