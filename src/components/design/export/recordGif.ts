import { GIFEncoder, applyPalette, quantize } from 'gifenc'

// Animated GIF export (rework plan Stage 10.3): sample the drill across its
// whole duration and encode client-side.
//
// ── Two deliberate departures from the plan's wording, both toward less code
//
// 1. The plan says "sample `frameAt` at ~25 fps into an OFFSCREEN Konva
//    stage". This drives the LIVE stage instead — seeking the playhead frame
//    by frame and grabbing `stage.toCanvas()` after each render settles. An
//    offscreen stage would mean reimplementing every shape PitchCanvas draws
//    (~800 lines of pitch, entities, markings, overlays) against the
//    imperative Konva API and keeping the two copies in step forever. Reusing
//    the stage that already exists is one function instead of a second
//    renderer, and it can't drift from what the coach sees, because it IS what
//    the coach sees. The visible side effect — the board plays through while
//    recording — reads as progress rather than as a glitch.
//
// 2. The plan pairs this with "MP4 via WebCodecs + mp4-muxer where supported,
//    with a GIF fallback". Only the GIF half is built. It's the half that
//    works everywhere, it's the fallback the MP4 path would need anyway, and
//    the plan itself ranks this whole item last and most deferrable. See
//    HANDOFF.md for the note.
//
// The encoder is `gifenc`, not the plan's `gif.js`: same job, but gif.js needs
// a separate worker script copied into the build output and hasn't been
// touched in years, while gifenc is a single dependency-free module. A
// substitution within the dependency the plan already sanctions.

// 25 fps, as the plan specifies. GIF stores delay in hundredths of a second,
// so 25 fps is exactly 4 — no rounding drift accumulating over a long drill.
const FPS = 25
const FRAME_DELAY_MS = 40

// A GIF is a 256-colour format and every frame is a full quantise pass, so
// width is where the cost is. 480px keeps a phone-screen preview crisp while
// keeping a 15-second drill's encode to a few seconds and its file to a couple
// of megabytes.
const MAX_WIDTH = 480

// Guard against a pathological duration producing a gigabyte of frames. At 25
// fps this is two minutes, well beyond any drill (the editor's own default is
// 15 seconds).
const MAX_FRAMES = 3000

export interface RecordGifOptions {
  /** The live Konva stage, already rendering the drill. */
  stage: { toCanvas: (config?: { pixelRatio?: number }) => HTMLCanvasElement; width: () => number }
  durationSeconds: number
  /** Moves the playhead. The caller's React state drives the stage from this. */
  seek: (seconds: number) => void
  /** 0-1, called once per encoded frame. */
  onProgress?: (fraction: number) => void
  signal?: AbortSignal
}

/**
 * Waits for the seek to actually reach the screen.
 *
 * Two frames, not one: the first `requestAnimationFrame` callback runs after
 * React has committed the new playhead and react-konva has drawn it, and the
 * second guarantees that draw has been presented before we read pixels back.
 * Reading after a single rAF intermittently captures the *previous* frame,
 * which in a GIF shows up as the whole animation lagging one step behind.
 */
function nextPaint(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
  })
}

/**
 * Plays the drill through frame by frame, encoding each one, and returns a
 * GIF blob. The playhead is left wherever the last frame put it — the caller
 * is responsible for restoring it, since only the caller knows where the coach
 * had it before.
 */
export async function recordGif({
  stage,
  durationSeconds,
  seek,
  onProgress,
  signal,
}: RecordGifOptions): Promise<Blob | null> {
  const frameCount = Math.min(MAX_FRAMES, Math.max(1, Math.round(durationSeconds * FPS)))
  const pixelRatio = Math.min(1, MAX_WIDTH / Math.max(1, stage.width()))

  const gif = GIFEncoder()
  let width = 0
  let height = 0

  for (let i = 0; i < frameCount; i++) {
    if (signal?.aborted) return null

    seek((i / FPS))
    await nextPaint()

    const canvas = stage.toCanvas({ pixelRatio })
    const context = canvas.getContext('2d')
    if (!context) return null

    // Every frame must share one canvas size or the GIF is malformed. The
    // first frame fixes it; a later size change (a resize mid-record) is
    // treated as the end of the recording rather than corrupting the file.
    if (i === 0) {
      width = canvas.width
      height = canvas.height
    } else if (canvas.width !== width || canvas.height !== height) {
      break
    }

    const { data } = context.getImageData(0, 0, width, height)
    // Quantised per frame rather than once from frame 0: a drill's palette is
    // near-constant (turf, lines, two kit colours), but per-frame costs little
    // and stops a marker that only appears late from being mapped to the
    // nearest colour that happened to exist at the start.
    const palette = quantize(data, 256)
    const index = applyPalette(data, palette)
    gif.writeFrame(index, width, height, { palette, delay: FRAME_DELAY_MS })

    onProgress?.((i + 1) / frameCount)
  }

  gif.finish()
  // `bytes()` returns a copy that owns its buffer, unlike `bytesView()` —
  // which is what a Blob needs, since the encoder is reset on the next call.
  return new Blob([gif.bytes()], { type: 'image/gif' })
}
