import { useEffect, useMemo } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { Printer, Shield } from 'lucide-react'
import { useStore } from '../store'
import { selectMyRole } from '../store/slices/clubSlice'
import { useSession } from '../hooks/useSession'
import type { Tactic, TacticSide } from '../store'
import { DRILL_PHASE_OF_PLAY_LABELS } from '../store'
import { PitchCanvas } from '../components/design/PitchCanvas'
import { frameAt } from '../components/design/canvas/interpolate'
import { formatDimensions, presetLabel } from '../components/design/canvas/pitchPresets'
import { resolveFormation } from '../components/tactics/formations'
import { formatClock } from '../components/design/timeline/cursor'
import { EmptyState } from '../components/ui/EmptyState'
import { Skeleton } from '../components/ui/Skeleton'

// The Tactic Card (TACTICS_BOARD_REWORK_PLAN.md Stage 8.1) — "a print-styled
// Tactic Card (PDF): formation, both sides, phase list, drawn board".
//
// The drill's Coach's Card is the reference implementation, and this follows
// it exactly: a print-styled ROUTE rather than a PDF library, so there is no
// new dependency and it prints from any device, including the phone a coach
// has pitch-side (share sheet → Print → Save as PDF). Rendered OUTSIDE
// AppShell for the same reason too — see App.tsx.
//
// What differs is only the content, because a tactic's metadata is
// deliberately light (decided 2026-08-26): no equipment, intensity or age
// band to lay out, and two formations and a phase list that a drill has no
// equivalent of.
//
// The diagram is the tactic's FIRST keyframe. A printed card is a static
// artefact and the start of a tactic is the shape a coach sets up in, exactly
// as the drill card prints its setup. Both sides are drawn — this is the one
// place `view: 'single'` is ignored, because a piece of paper has no toggle.

const PRINT_STYLES = `
@page { size: A4 portrait; margin: 14mm; }
@media print {
  html, body { background: #ffffff !important; }
  .card-print-hide { display: none !important; }
  .card-sheet {
    max-width: none !important;
    margin: 0 !important;
    padding: 0 !important;
    border: 0 !important;
    background: #ffffff !important;
    color: #111111 !important;
  }
  .card-sheet * { color: #111111 !important; border-color: #cccccc !important; }
  .card-muted { color: #555555 !important; }
  .card-block { break-inside: avoid; page-break-inside: avoid; }
  /* A phase swatch is the one colour on this page that must survive the
     print, since it is the only thing tying a row to its band on screen.
     Everything else is forced to black ink by the rule above. */
  .card-swatch { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
}
`

export function TacticCardPage() {
  const { tacticId } = useParams<{ tacticId: string }>()
  const { session } = useSession()
  const myUserId = session?.user.id ?? null
  const isAdmin = useStore((s) => selectMyRole(s) === 'admin')
  const selectedClubId = useStore((s) => s.selectedClubId)
  const tactics = useStore((s) => s.tactics)
  const tacticsLoading = useStore((s) => s.tacticsLoading)
  const fetchTactics = useStore((s) => s.fetchTactics)
  const fetchCustomFormations = useStore((s) => s.fetchCustomFormations)

  // Same rule every other screen follows: fetch for itself rather than
  // assuming something else ran first, since this is a deep-linkable route.
  // Custom formations come too, or a side saved onto one prints as blank.
  // Club tenancy (2026-08-28): both un-gated per the plan's Task 6
  // call-site census — fetchTactics takes no scope argument any more (RLS
  // decides visibility), and fetchCustomFormations was wrongly gated on
  // selectedTeamId despite being owner_id-scoped, not team-scoped (same
  // fix as TacticEditorPage.tsx).
  useEffect(() => {
    void fetchTactics()
    void fetchCustomFormations()
  }, [fetchTactics, fetchCustomFormations])

  const tactic = tactics.find((t) => t.id === tacticId) ?? null

  // Same guard as DrillCardPage.tsx — see its comment.
  if (tactic && !(tactic.club_id === selectedClubId && (isAdmin || tactic.created_by === myUserId))) {
    return <Navigate to={`/tactics/${tactic.id}/view`} replace />
  }

  if (!tactic) {
    if (tacticsLoading) {
      return (
        <div role="status" aria-busy="true" className="mx-auto max-w-[820px] p-6">
          <span className="sr-only">Loading tactic…</span>
          <Skeleton className="aspect-[1/1.414] w-full rounded-lg" />
        </div>
      )
    }
    return (
      <div className="mx-auto max-w-[820px] space-y-3 p-6">
        <EmptyState icon={Shield} message="That tactic isn't in your library." />
        <Link to="/tactics" className="text-sm font-medium text-accent-ink hover:underline">
          Back to tactics
        </Link>
      </div>
    )
  }

  return <TacticCard tactic={tactic} />
}

// Exported so the print layout can be rendered against a fixture without a
// store or a signed-in session behind it, the same way DrillCard is. The route
// component above is the only caller in the app.
export function TacticCard({ tactic }: { tactic: Tactic }) {
  const customFormations = useStore((s) => s.customFormations)
  const frame = useMemo(() => frameAt(tactic.scene, tactic.keyframes, 0), [tactic.scene, tactic.keyframes])

  const phases = useMemo(
    () => [...tactic.phases].sort((a, b) => a.startSeconds - b.startSeconds),
    [tactic.phases]
  )

  const onPitch = (side: 'home' | 'away') =>
    tactic.scene.entities.filter((e) => e.kind === 'player' && e.team === side).length

  const facts = [
    { label: 'Phase of play', value: tactic.phase_of_play ? DRILL_PHASE_OF_PLAY_LABELS[tactic.phase_of_play] : null },
    { label: 'Length', value: formatClock(tactic.duration_seconds) },
    { label: 'Keyframes', value: String(tactic.keyframes.length) },
    { label: 'Phases', value: phases.length > 0 ? String(phases.length) : null },
    {
      label: 'Pitch',
      value: `${presetLabel(tactic.pitch.preset)} · ${formatDimensions(tactic.pitch.lengthMeters, tactic.pitch.widthMeters, tactic.pitch.units ?? 'm')}`,
    },
  ].filter((fact) => fact.value)

  return (
    <>
      <style>{PRINT_STYLES}</style>

      <div className="card-print-hide sticky top-0 z-10 flex items-center justify-between gap-2 border-b border-line bg-surface px-4 py-3">
        <Link to={`/tactics/${tactic.id}`} className="text-sm font-medium text-accent-ink hover:underline">
          ← Back to the editor
        </Link>
        <button
          type="button"
          onClick={() => window.print()}
          className="flex min-h-11 items-center gap-1.5 rounded-md bg-accent px-3 text-sm font-medium text-white hover:bg-accent-hover lg:min-h-9"
        >
          <Printer className="h-4 w-4" />
          Print
        </button>
      </div>

      <div className="card-sheet mx-auto my-6 max-w-[820px] rounded-xl border border-line bg-panel p-8 text-ink">
        <header className="card-block border-b border-line pb-4">
          <h1 className="text-2xl font-semibold tracking-tight">{tactic.name}</h1>
          {tactic.description && <p className="card-muted mt-1 text-sm text-ink-muted">{tactic.description}</p>}
        </header>

        {/* Board beside the facts, not above them — the same measurement the
            drill card's header records: stacking a portrait board over short
            facts wastes half the page width twice over. */}
        <div className="card-block mt-5 flex flex-col items-center gap-5 sm:flex-row sm:items-start">
          <PitchCanvas pitch={tactic.pitch} frame={frame} maxWidth={340} maxHeight={420} />
          <div className="w-full space-y-4 sm:flex-1">
            <div className="grid grid-cols-2 gap-3">
              <SideBlock label="Home" side={tactic.sides.home} count={onPitch('home')} custom={customFormations} />
              <SideBlock label="Away" side={tactic.sides.away} count={onPitch('away')} custom={customFormations} />
            </div>
            {facts.length > 0 && (
              <dl className="grid grid-cols-2 gap-x-5 gap-y-2">
                {facts.map((fact) => (
                  <div key={fact.label}>
                    <dt className="card-muted text-xs font-medium text-ink-muted">{fact.label}</dt>
                    <dd className="text-sm">{fact.value}</dd>
                  </div>
                ))}
              </dl>
            )}
          </div>
        </div>

        {phases.length > 0 && (
          <section className="card-block mt-5 border-t border-line pt-4">
            <h2 className="card-muted mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">Phases</h2>
            <ol className="space-y-1.5">
              {phases.map((phase) => (
                <li key={phase.id} className="flex items-center gap-2 text-sm">
                  <span
                    className="card-swatch h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: phase.color }}
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1 truncate">{phase.name}</span>
                  <span className="card-muted shrink-0 text-xs tabular-nums text-ink-muted">
                    {formatClock(phase.startSeconds)}–{formatClock(phase.endSeconds)}
                  </span>
                </li>
              ))}
            </ol>
          </section>
        )}
      </div>
    </>
  )
}

function SideBlock({
  label,
  side,
  count,
  custom,
}: {
  label: string
  side: TacticSide
  count: number
  custom: Parameters<typeof resolveFormation>[1]
}) {
  const formation = resolveFormation(side.formation, custom)
  return (
    <div>
      <p className="card-muted text-xs font-medium uppercase tracking-wide text-ink-muted">{label}</p>
      <p className="mt-0.5 flex items-center gap-1.5 text-sm font-semibold">
        <span
          className="card-swatch h-2.5 w-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: side.color }}
          aria-hidden
        />
        {formation?.label ?? side.formation}
      </p>
      <p className="card-muted text-xs text-ink-muted">
        {count} on the pitch
      </p>
    </div>
  )
}
