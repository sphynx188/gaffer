import type { InputAudioTrack } from 'mediabunny'
import { DRILL_VIDEO_MAX_BYTES } from '../../store/slices/drillSlice'

// Shrinks a drill video in the browser before it uploads (2026-10-28). Phone
// footage runs at ~100-130 MB a minute at 1080p and ~350 MB at 4K, against a
// 50 MB bucket limit and a 1 GB free-plan total — so without this a coach
// could attach well under a minute of video. Re-encoded to 720p at a bitrate
// chosen from the clip's length, about five minutes fits.
//
// Mediabunny drives the browser's own WebCodecs encoders (hardware where the
// device has it). It is imported dynamically, only once a coach actually
// picks a file, so it never weighs on the main bundle or the offline cache —
// see vite.config.ts.
//
// Every way this can't help ends in `original`, never in an error: an old
// browser, a codec the device can't decode, a clip already small enough. The
// upload path behind it is unchanged and still enforces 50 MB itself, so the
// worst case is exactly the behaviour from before this existed.

// What the encode aims for, leaving headroom under the bucket's 50 MB for the
// MP4 container and for the encoder overshooting its target bitrate.
const TARGET_BYTES = 45 * 1024 * 1024
const HEADROOM = 0.92

// 720 on the short side: plenty to watch players move through a drill, on
// any screen a coach watches it on. Portrait clips stay portrait.
const SHORT_EDGE = 720

// Video bitrate bounds. A short clip gets the ceiling; a long one gets
// whatever fits the target, down to the floor — below it 720p footage of
// moving players turns to mush, so a clip that would need less is refused
// and the coach is asked to trim it instead.
const MAX_VIDEO_BPS = 2_500_000
const MIN_VIDEO_BPS = 1_000_000
// Enough for a coach talking over the clip; there's no music to protect.
const AUDIO_BPS = 96_000

// The longest clip that still fits at the floor bitrate, for the copy.
export const MAX_COMPRESSED_SECONDS = Math.floor((TARGET_BYTES * 8 * HEADROOM) / (MIN_VIDEO_BPS + AUDIO_BPS))

export type CompressResult =
  | { kind: 'compressed'; file: File }
  // Upload the file as the coach picked it — either nothing would be gained
  // or this device can't do the work.
  | { kind: 'original'; file: File }
  | { kind: 'too-long'; seconds: number }
  | { kind: 'canceled' }

// H.264 wants even dimensions.
const even = (n: number) => Math.max(2, Math.round(n / 2) * 2)

export async function compressVideo(
  file: File,
  { onProgress, signal }: { onProgress?: (fraction: number) => void; signal?: AbortSignal } = {}
): Promise<CompressResult> {
  const original: CompressResult = { kind: 'original', file }
  // No WebCodecs at all (older Safari): don't even fetch the library.
  if (typeof VideoEncoder === 'undefined' || typeof VideoDecoder === 'undefined') return original

  let mb: typeof import('mediabunny')
  try {
    mb = await import('mediabunny')
  } catch {
    // Offline, or a deploy swapped the chunk out from under this tab.
    return original
  }
  if (signal?.aborted) return { kind: 'canceled' }

  const input = new mb.Input({ source: new mb.BlobSource(file), formats: mb.ALL_FORMATS })
  try {
    const video = await input.getPrimaryVideoTrack()
    if (!video || !(await video.canDecode())) return original
    const duration = await input.computeDuration()
    if (!(duration > 0)) return original

    const audio: InputAudioTrack | null = await input.getPrimaryAudioTrack()
    const audioQuality = new mb.Quality({ bitrate: AUDIO_BPS })
    const keepAudio =
      audio !== null && (await audio.canDecode()) && (await mb.canEncodeAudio('aac', { quality: audioQuality }))

    // Display dimensions already account for a phone's rotation metadata, so
    // a portrait clip measures as portrait here.
    const scale = Math.min(1, SHORT_EDGE / Math.min(video.displayWidth, video.displayHeight))
    const width = even(video.displayWidth * scale)
    const height = even(video.displayHeight * scale)

    // Fit to size: spread the byte budget over the clip's length.
    const budget = (TARGET_BYTES * 8 * HEADROOM) / duration - (keepAudio ? AUDIO_BPS : 0)
    if (budget < MIN_VIDEO_BPS) {
      // Too long to fit at a watchable quality — unless the file already
      // fits as it is, in which case there's nothing to refuse.
      return file.size <= DRILL_VIDEO_MAX_BYTES ? original : { kind: 'too-long', seconds: duration }
    }
    // Whole bits per second — Quality rejects a fractional bitrate outright.
    const bitrate = Math.floor(Math.min(MAX_VIDEO_BPS, budget))

    // Already as small as the encode would make it — re-encoding would only
    // cost quality and the coach's time.
    const expectedBytes = ((bitrate + (keepAudio ? AUDIO_BPS : 0)) * duration) / 8
    if (file.size <= expectedBytes * 1.1) return original

    const videoQuality = new mb.Quality({ bitrate })
    if (!(await mb.canEncodeVideo('avc', { width, height, quality: videoQuality }))) return original

    const output = new mb.Output({
      // Moov atom up front, so playback starts before the whole file has
      // downloaded — this is watched over pitch-side mobile data.
      format: new mb.Mp4OutputFormat({ fastStart: 'in-memory' }),
      target: new mb.BufferTarget(),
    })
    const conversion = await mb.Conversion.init({
      input,
      output,
      tracks: 'primary',
      video: { width, height, fit: 'contain', codec: 'avc', quality: videoQuality, forceTranscode: true },
      audio: keepAudio ? { codec: 'aac', quality: audioQuality, forceTranscode: true } : { discard: true },
    })
    if (!conversion.isValid) return original

    conversion.onProgress = (fraction) => onProgress?.(fraction)
    const cancel = () => void conversion.cancel()
    signal?.addEventListener('abort', cancel)
    try {
      await conversion.execute()
    } finally {
      signal?.removeEventListener('abort', cancel)
    }

    const buffer = output.target.buffer
    if (!buffer || buffer.byteLength >= file.size) return original
    const name = file.name.replace(/\.[^.]+$/, '') + '.mp4'
    return { kind: 'compressed', file: new File([buffer], name, { type: 'video/mp4' }) }
  } catch (err) {
    if (err instanceof mb.ConversionCanceledError || signal?.aborted) return { kind: 'canceled' }
    // Anything else — a corrupt file, an encoder that failed mid-way — falls
    // back to the original rather than blocking the upload.
    console.error('[compressVideo]', err)
    return original
  } finally {
    input.dispose()
  }
}
