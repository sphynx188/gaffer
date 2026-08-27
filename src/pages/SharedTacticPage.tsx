import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Pause, Play, Share2 } from 'lucide-react'
import { useStore } from '../store'
import type { Tactic, TacticSide } from '../store'
import { DRILL_PHASE_OF_PLAY_LABELS } from '../store'
import { PitchCanvas } from '../components/design/PitchCanvas'
import { frameAt } from '../components/design/canvas/interpolate'
import { formatClock } from '../components/design/timeline/cursor'
import { useTimelinePlayback } from '../components/design/timeline/useTimelinePlayback'
import { formatDimensions, presetLabel } from '../components/design/canvas/pitchPresets'
import { FORMATIONS } from '../components/tactics/formations'
import { EmptyState } from '../components/ui/EmptyState'
import { Skeleton } from '../components/ui/Skeleton'
import { Badge } from '../components/ui/Badge'

// The public share page for a tactic (TACTICS_BOARD_REWORK_PLAN.md Stage 8.2)
// — `/t/:token`, readable with no account. `SharedDrillPage` is the reference
// implementation and this mirrors it structurally, including the settled-state
// trick that keeps "are we loading" a derived value.
//
// Rendered above the auth gate in App.tsx, so a signed-out visitor reaches it
// directly. It reads through `fetchSharedTactic`, which builds its own
// session-less client carrying the `x-share-token` header — so a coach signed
// in on this browser sees exactly what the person they sent it to sees, rather
// than a version their own credentials unlocked.
//
// ── What this page can and cannot show ────────────────────────────────────
// Everything here comes off the ONE tactic row the token unlocked. Migration
// 023 grants anon nothing else — not `player`, not `team` — so the roster
// names behind `entity.player_id` are unreachable from here by construction,
// not by omission. A shared tactic shows squad numbers, roles, the shape and
// the drawings. That is deliberate: the plan flags a shared tactic as exposing
// real squad information, and the narrowest thing that still answers "what is
// the shape" is the right amount to publish.
//
// Custom formations are the same story — they live on a table anon can't read
// — so a side saved onto one falls back to printing its stored key rather than
// a label. `FORMATIONS` alone is enough for the 29 built-ins, which is what
// any tactic worth sharing is almost always on.
export function SharedTacticPage() {
  const { token } = useParams<{ token: string }>()
  const fetchSharedTactic = useStore((s) => s.fetchSharedTactic)

  // One piece of state holding the result AND the token it belongs to, rather
  // than a separate `loading` flag — a token the result doesn't match yet IS
  // the loading state. Same shape SharedDrillPage uses.
  const [result, setResult] = useState<{ token: string | undefined; tactic: Tactic | null } | null>(null)

  useEffect(() => {
    let live = true
    void (async () => {
      const found = token ? await fetchSharedTactic(token) : null
      if (live) setResult({ token, tactic: found })
    })()
    return () => {
      live = false
    }
  }, [token, fetchSharedTactic])

  const settled = result && result.token === token ? result : null
  const loading = settled === null
  const tactic = settled?.tactic ?? null

  if (loading) {
    return (
      <Frame>
        <div role="status" aria-busy="true">
          <span className="sr-only">Loading tactic…</span>
          <Skeleton className="aspect-[3/4] w-full rounded-lg" />
        </div>
      </Frame>
    )
  }

  // One message for "no such token", "token revoked" and "token mistyped"
  // alike — deliberately. Telling an anonymous visitor which of those it was
  // would confirm that some other token exists, which is the one thing a
  // guessing attempt wants to learn.
  if (!tactic) {
    return (
      <Frame>
        <EmptyState icon={Share2} message="This link isn't active. Ask the coach who sent it for a new one." />
      </Frame>
    )
  }

  return (
    <Frame>
      <SharedTactic tactic={tactic} />
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

// Exported for TacticViewPage.tsx (club tenancy, Task 6) — the in-app
// read-only viewer for a licensed/collection tactic reuses the exact same
// presentational component the public share page renders, fed a Tactic
// from the store instead of a token fetch.
export function SharedTactic({ tactic }: { tactic: Tactic }) {
  const playback = useTimelinePlayback(tactic.duration_seconds)
  const frame = useMemo(
    () => frameAt(tactic.scene, tactic.keyframes, playback.currentTime),
    [tactic.scene, tactic.keyframes, playback.currentTime]
  )
  const phases = useMemo(
    () => [...tactic.phases].sort((a, b) => a.startSeconds - b.startSeconds),
    [tactic.phases]
  )

  // Loops, like the drill share page: someone watching a shape they're about
  // to be asked to play wants it to keep going round.
  useEffect(() => {
    playback.toggleLoop()
    // Once per mount — this page renders exactly one tactic for its lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Both sides always, ignoring `view: 'single'`, for the same reason the
  // printed card does: a viewer has no toggle, so showing them half the board
  // with no way to reach the rest would just look broken.
  const chips = [
    formationLabel(tactic.sides.home),
    formationLabel(tactic.sides.away),
    tactic.phase_of_play ? DRILL_PHASE_OF_PLAY_LABELS[tactic.phase_of_play] : null,
  ].filter((chip): chip is string => chip != null)

  return (
    <>
      <header>
        <h1 className="text-xl font-semibold tracking-tight text-ink">{tactic.name}</h1>
        {tactic.description && <p className="mt-1 text-sm text-ink-muted">{tactic.description}</p>}
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
        <PitchCanvas pitch={tactic.pitch} frame={frame} maxWidth={480} />
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs tabular-nums text-ink-muted">
            {formatClock(playback.currentTime)} / {formatClock(tactic.duration_seconds)}
          </p>
          {tactic.keyframes.length > 1 && (
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
          {presetLabel(tactic.pitch.preset)} ·{' '}
          {formatDimensions(tactic.pitch.lengthMeters, tactic.pitch.widthMeters, tactic.pitch.units ?? 'm')}
        </p>
      </div>

      {phases.length > 0 && (
        <section className="rounded-xl border border-line bg-panel p-4">
          <h2 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-muted">Phases</h2>
          <ol className="space-y-1.5">
            {phases.map((phase) => (
              <li key={phase.id}>
                {/* Seeks rather than just listing: a phase list you can't jump
                    to is a table of contents with no page numbers. */}
                <button
                  type="button"
                  onClick={() => playback.seek(phase.startSeconds)}
                  className="flex min-h-11 w-full items-center gap-2 rounded-md px-1 text-left text-sm text-ink transition-colors hover:bg-panel-raised lg:min-h-9"
                >
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: phase.color }}
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1 truncate">{phase.name}</span>
                  <span className="shrink-0 text-xs tabular-nums text-ink-muted">
                    {formatClock(phase.startSeconds)}
                  </span>
                </button>
              </li>
            ))}
          </ol>
        </section>
      )}
    </>
  )
}

/** A built-in formation's label, or the stored key for a custom one. */
function formationLabel(side: TacticSide): string {
  return FORMATIONS.find((f) => f.key === side.formation)?.label ?? side.formation
}
