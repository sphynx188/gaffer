import { useEffect, useRef, useState, type DragEvent } from 'react'
import { Loader2, Upload, Video } from 'lucide-react'
import { useStore } from '../../store'
import type { Drill } from '../../store'
import { MAX_COMPRESSED_SECONDS, compressVideo } from './compressVideo'

// The real-life video attached to a drill (migration 045, 2026-10-28): a clip
// of the drill actually being run, uploaded from the box under the editor's
// pitch and played back wherever the drill is shown — the editor, the
// read-only viewer and the public share page. The file lives in a private
// bucket, so every playback goes through a signed URL fetched here; nothing
// stores or caches one.

// Phone cameras record .mov as often as .mp4, and refusing an iPhone clip a
// coach just filmed pitch-side would make the feature useless to them.
const ACCEPT = 'video/mp4,video/quicktime,.mp4,.mov'

const minutes = (seconds: number) => Math.max(1, Math.round(seconds / 60))

// Holds the screen awake while a clip is shrunk and sent: a phone that locks
// mid-way suspends the page and the work stops. Best effort — a browser
// without the API, or one that refuses, just behaves as it did before.
async function keepAwake(): Promise<() => void> {
  try {
    const lock = await navigator.wakeLock?.request('screen')
    return () => void lock?.release().catch(() => {})
  } catch {
    return () => {}
  }
}

// Plays the video at `path`. Pass `shareToken` on the public share page — it
// is what lets an anonymous visitor's request past the bucket's read policy.
export function DrillVideoPlayer({ path, shareToken }: { path: string; shareToken?: string }) {
  const drillVideoUrl = useStore((s) => s.drillVideoUrl)
  // Keyed by the path it was fetched for, like SharedDrillPage's result: a
  // path the result doesn't match yet IS the loading state, with no
  // synchronous setState inside the effect.
  const [result, setResult] = useState<{ path: string; url: string | null } | null>(null)

  useEffect(() => {
    let live = true
    void drillVideoUrl(path, shareToken).then((url) => {
      if (live) setResult({ path, url })
    })
    return () => {
      live = false
    }
  }, [path, shareToken, drillVideoUrl])

  const settled = result && result.path === path ? result : null

  if (!settled) {
    return (
      <div className="flex aspect-video w-full items-center justify-center rounded-lg bg-panel-raised" role="status">
        <Loader2 className="h-5 w-5 animate-spin text-ink-faint" aria-hidden />
        <span className="sr-only">Loading video…</span>
      </div>
    )
  }
  if (!settled.url) {
    return (
      <p className="rounded-lg bg-panel-raised px-3 py-6 text-center text-sm text-ink-muted">
        This video couldn't be loaded. Try refreshing the page.
      </p>
    )
  }
  return (
    // Black behind the frame, not panel grey: a portrait phone clip
    // letterboxes inside the box, and black bars read as part of the video.
    <video
      key={settled.url}
      src={settled.url}
      controls
      playsInline
      preload="metadata"
      className="max-h-[480px] w-full rounded-lg bg-black object-contain"
    />
  )
}

// The editor's box under the pitch: an upload target while the drill has no
// video, the player plus Replace / Remove once it has one.
export function DrillVideoPanel({ drill }: { drill: Drill }) {
  const uploadDrillVideo = useStore((s) => s.uploadDrillVideo)
  const removeDrillVideo = useStore((s) => s.removeDrillVideo)
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState<'preparing' | 'uploading' | 'removing' | null>(null)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [confirmRemove, setConfirmRemove] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  // Leaving the editor mid-way stops the encode rather than leaving it
  // running in the background for a box nobody can see.
  useEffect(() => () => abortRef.current?.abort(), [])

  const upload = async (picked: File | undefined) => {
    if (!picked || busy) return
    setError(null)
    setProgress(0)
    setBusy('preparing')
    const release = await keepAwake()
    try {
      const abort = new AbortController()
      abortRef.current = abort
      const result = await compressVideo(picked, { onProgress: setProgress, signal: abort.signal })
      abortRef.current = null
      if (result.kind === 'canceled') return
      if (result.kind === 'too-long') {
        setError(
          `This clip is about ${minutes(result.seconds)} minutes long — up to about ${minutes(MAX_COMPRESSED_SECONDS)} fits. Trim it on your phone, then try again.`
        )
        return
      }
      setBusy('uploading')
      const ok = await uploadDrillVideo(drill.id, result.file)
      if (!ok) setError(useStore.getState().drillsError ?? "Couldn't upload the video, try again.")
    } finally {
      release()
      setBusy(null)
    }
  }

  const remove = async () => {
    setConfirmRemove(false)
    setError(null)
    setBusy('removing')
    const ok = await removeDrillVideo(drill.id)
    setBusy(null)
    if (!ok) setError(useStore.getState().drillsError ?? "Couldn't remove the video, try again.")
  }

  const onDrop = (event: DragEvent<HTMLElement>) => {
    event.preventDefault()
    setDragOver(false)
    void upload(event.dataTransfer.files[0])
  }

  const picker = (
    <input
      ref={inputRef}
      type="file"
      accept={ACCEPT}
      className="hidden"
      onChange={(event) => {
        void upload(event.target.files?.[0])
        // Cleared so picking the same file again after an error still fires.
        event.target.value = ''
      }}
    />
  )

  const secondaryButton =
    'min-h-11 rounded-md border border-line px-3 text-sm font-medium text-ink-muted transition-colors hover:border-line-strong hover:text-ink disabled:opacity-50 lg:min-h-9'

  return (
    <section
      aria-labelledby="drill-video-heading"
      className="panel-edge w-full rounded-xl border border-line bg-panel p-4"
      onDragOver={(event) => {
        event.preventDefault()
        setDragOver(true)
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={onDrop}
    >
      {picker}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 id="drill-video-heading" className="text-sm font-semibold text-ink">
            Drill video
          </h2>
          <p className="text-xs text-ink-muted">Footage of this drill being run. It goes wherever the drill goes.</p>
        </div>
        {drill.video_path && !busy && (
          <div className="flex items-center gap-2">
            {confirmRemove ? (
              <>
                <span className="text-sm text-ink-muted">Remove the video?</span>
                <button type="button" onClick={() => void remove()} className={`${secondaryButton} text-bad hover:text-bad`}>
                  Remove
                </button>
                <button type="button" onClick={() => setConfirmRemove(false)} className={secondaryButton}>
                  Cancel
                </button>
              </>
            ) : (
              <>
                <button type="button" onClick={() => inputRef.current?.click()} className={secondaryButton}>
                  Replace
                </button>
                <button type="button" onClick={() => setConfirmRemove(true)} className={secondaryButton}>
                  Remove
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {busy === 'preparing' || busy === 'uploading' ? (
        // Shrinking and sending read to the coach as ONE step, "Uploading
        // video": the shrink fills the bar to 90% and the send holds it there,
        // pulsing, because Storage reports no upload progress to show. Cancel
        // only exists while shrinking — an upload in flight can't be stopped.
        <div className="flex flex-col items-center gap-3 rounded-lg bg-panel-raised px-4 py-8" role="status">
          <p className="text-sm text-ink-muted">
            Uploading video…
            {busy === 'preparing' && <span className="tabular-nums"> {Math.round(progress * 90)}%</span>}
          </p>
          <div className="h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-line">
            <div
              className={`h-full rounded-full bg-accent transition-[width] ${busy === 'uploading' ? 'animate-pulse' : ''}`}
              style={{ width: `${busy === 'preparing' ? progress * 90 : 90}%` }}
            />
          </div>
          <p className="text-xs text-ink-faint">Keep this page open until it finishes.</p>
          {busy === 'preparing' && (
            <button type="button" onClick={() => abortRef.current?.abort()} className={secondaryButton}>
              Cancel
            </button>
          )}
        </div>
      ) : busy ? (
        <div className="flex items-center justify-center gap-2 rounded-lg bg-panel-raised px-3 py-10 text-sm text-ink-muted" role="status">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Removing video…
        </div>
      ) : drill.video_path ? (
        <DrillVideoPlayer path={drill.video_path} />
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className={`flex w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-4 py-10 text-center transition-colors ${
            dragOver ? 'border-accent bg-panel-raised' : 'border-line-strong hover:border-ink-faint hover:bg-panel-raised'
          }`}
        >
          <Video className="h-6 w-6 text-ink-faint" aria-hidden />
          <span className="text-sm font-medium text-ink">Add a video of this drill</span>
          <span className="text-xs text-ink-muted">Drop a file here or choose one — MP4 or phone video, up to about {minutes(MAX_COMPRESSED_SECONDS)} minutes</span>
          <span className="mt-1 inline-flex min-h-9 items-center gap-1.5 rounded-md bg-accent px-3 text-sm font-semibold text-white">
            <Upload className="h-4 w-4" aria-hidden />
            Choose video
          </span>
        </button>
      )}

      {error && (
        <p role="alert" className="mt-2 text-sm text-bad">
          {error}
        </p>
      )}
    </section>
  )
}
