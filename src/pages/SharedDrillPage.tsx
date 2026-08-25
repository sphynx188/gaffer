import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Pause, Play, Share2 } from 'lucide-react'
import { useStore } from '../store'
import type { Drill } from '../store'
import { DRILL_DIFFICULTY_LABELS, DRILL_INTENSITY_LABELS, SESSION_BLOCK_LABELS } from '../store'
import { PitchCanvas } from '../components/design/PitchCanvas'
import { frameAt } from '../components/design/canvas/interpolate'
import { formatClock } from '../components/design/timeline/cursor'
import { useTimelinePlayback } from '../components/design/timeline/useTimelinePlayback'
import { formatDimensions, presetLabel } from '../components/design/canvas/pitchPresets'
import { equipmentSummary } from '../components/design/editor/equipmentSummary'
import { EmptyState } from '../components/ui/EmptyState'
import { Skeleton } from '../components/ui/Skeleton'
import { Badge } from '../components/ui/Badge'

// The public share page (rework plan Stage 10.4) — `/d/:token`, readable with
// no account, mirroring Teloframe's Player Explanation. This is the app's ONLY
// unauthenticated surface.
//
// Rendered above the auth gate in App.tsx, so a signed-out visitor reaches it
// directly. It also deliberately reads through `fetchSharedDrill`, which
// builds its own session-less Supabase client — so a coach who happens to be
// signed in on this browser sees exactly what the teammate they sent it to
// sees, rather than a version their own credentials unlocked. A share page
// that only works for its author is worse than no share page.
//
// Read-only throughout: no editor, no store mutation, no link back into the
// app. Everything here comes off the one drill row the token unlocked.
export function SharedDrillPage() {
  const { token } = useParams<{ token: string }>()
  const fetchSharedDrill = useStore((s) => s.fetchSharedDrill)

  // One piece of state holding the result AND the token it belongs to, rather
  // than a separate `loading` flag flipped at the top of the effect. That
  // keeps "are we still loading" a value derived during render — a token the
  // result doesn't match yet IS the loading state — instead of a synchronous
  // setState inside an effect, which starts a second render for nothing.
  const [result, setResult] = useState<{ token: string | undefined; drill: Drill | null } | null>(null)

  useEffect(() => {
    let live = true
    void (async () => {
      const found = token ? await fetchSharedDrill(token) : null
      if (live) setResult({ token, drill: found })
    })()
    return () => {
      live = false
    }
  }, [token, fetchSharedDrill])

  const settled = result && result.token === token ? result : null
  const loading = settled === null
  const drill = settled?.drill ?? null

  if (loading) {
    return (
      <Frame>
        <div role="status" aria-busy="true">
          <span className="sr-only">Loading drill…</span>
          <Skeleton className="aspect-[3/4] w-full rounded-lg" />
        </div>
      </Frame>
    )
  }

  // One message for "no such token", "token revoked" and "token mistyped"
  // alike — deliberately. Telling an anonymous visitor which of those it was
  // would confirm that some other token exists, which is the one thing a
  // guessing attempt wants to learn.
  if (!drill) {
    return (
      <Frame>
        <EmptyState icon={Share2} message="This link isn't active. Ask the coach who sent it for a new one." />
      </Frame>
    )
  }

  return (
    <Frame>
      <SharedDrill drill={drill} />
    </Frame>
  )
}

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-svh bg-surface px-4 py-6">
      <div className="mx-auto max-w-[560px] space-y-4">
        {children}
        <p className="pt-2 text-center text-xs text-ink-faint">Shared from Gaffer</p>
      </div>
    </div>
  )
}

function SharedDrill({ drill }: { drill: Drill }) {
  const playback = useTimelinePlayback(drill.duration_seconds)
  const frame = useMemo(
    () => frameAt(drill.scene, drill.keyframes, playback.currentTime),
    [drill.scene, drill.keyframes, playback.currentTime]
  )
  const coaching = drill.coaching ?? {}
  const equipment = coaching.equipment ?? equipmentSummary(drill.scene)

  // Loops, like the library's preview: someone watching a drill they're about
  // to run wants it to keep going round, not stop after one pass.
  useEffect(() => {
    playback.toggleLoop()
    // Once per mount — this page renders exactly one drill for its lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const chips = [
    drill.duration_minutes != null ? `${drill.duration_minutes} min` : null,
    drill.session_block ? SESSION_BLOCK_LABELS[drill.session_block] : null,
    drill.difficulty ? DRILL_DIFFICULTY_LABELS[drill.difficulty] : null,
    drill.intensity ? DRILL_INTENSITY_LABELS[drill.intensity] : null,
  ].filter((chip): chip is string => chip != null)

  return (
    <>
      <header>
        <h1 className="text-xl font-semibold tracking-tight text-ink">{drill.name}</h1>
        {drill.objective && <p className="mt-1 text-sm text-ink-muted">{drill.objective}</p>}
        {chips.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {chips.map((chip) => (
              <Badge key={chip} tone="neutral">
                {chip}
              </Badge>
            ))}
          </div>
        )}
      </header>

      <div className="panel-edge space-y-3 rounded-xl border border-line bg-panel p-4">
        <PitchCanvas pitch={drill.pitch} frame={frame} maxWidth={480} />
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs tabular-nums text-ink-muted">
            {formatClock(playback.currentTime)} / {formatClock(drill.duration_seconds)}
          </p>
          {drill.keyframes.length > 1 && (
            <button
              type="button"
              onClick={playback.togglePlay}
              className="flex min-h-11 items-center gap-1.5 rounded-md bg-accent px-3 text-sm font-semibold text-white hover:bg-accent-hover lg:min-h-9"
            >
              {playback.playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              {playback.playing ? 'Pause' : 'Play'}
            </button>
          )}
        </div>
        <p className="text-xs text-ink-faint">
          {presetLabel(drill.pitch.preset)} ·{' '}
          {formatDimensions(drill.pitch.lengthMeters, drill.pitch.widthMeters, drill.pitch.units ?? 'm')}
          {equipment ? ` · ${equipment}` : ''}
        </p>
      </div>

      {coaching.setup && <Block title="Setup">{coaching.setup}</Block>}
      <ListBlock title="Coaching points" items={coaching.points} />
      <ListBlock title="Make it harder" items={coaching.progressions} />
      <ListBlock title="Make it easier" items={coaching.regressions} />
      <ListBlock title="Common mistakes" items={coaching.mistakes} />
    </>
  )
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-line bg-panel p-4">
      <h2 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-muted">{title}</h2>
      <p className="whitespace-pre-wrap text-sm text-ink">{children}</p>
    </section>
  )
}

function ListBlock({ title, items }: { title: string; items: string[] | undefined }) {
  if (!items || items.length === 0) return null
  return (
    <section className="rounded-xl border border-line bg-panel p-4">
      <h2 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-muted">{title}</h2>
      <ul className="list-disc space-y-1 pl-5 text-sm text-ink">
        {items.map((item, index) => (
          <li key={`${index}-${item}`}>{item}</li>
        ))}
      </ul>
    </section>
  )
}
