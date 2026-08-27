import { useEffect, useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Printer } from 'lucide-react'
import { useStore } from '../store'
import type { Drill } from '../store'
import {
  DRILL_DIFFICULTY_LABELS,
  DRILL_INTENSITY_LABELS,
  DRILL_PHASE_OF_PLAY_LABELS,
  SESSION_BLOCK_LABELS,
} from '../store'
import { PitchCanvas } from '../components/design/PitchCanvas'
import { frameAt } from '../components/design/canvas/interpolate'
import { formatDimensions, presetLabel } from '../components/design/canvas/pitchPresets'
import { equipmentSummary } from '../components/design/editor/equipmentSummary'
import { EmptyState } from '../components/ui/EmptyState'
import { Skeleton } from '../components/ui/Skeleton'
import { PenTool } from 'lucide-react'

// The Coach's Card (rework plan Stage 10.2) — "one printable A4/Letter page
// with the pitch diagram, name, objective, duration, players, equipment
// summary, setup instructions, coaching points and progressions/regressions".
//
// Built as a print-styled route rather than by adding a PDF library, exactly
// as the plan directs: no new dependency, and it prints from any device
// (including the phone a coach actually has pitch-side, via the OS share
// sheet's "Print" → "Save as PDF").
//
// Rendered OUTSIDE AppShell — see App.tsx. The nav rail, team switcher and
// theme toggle have no business on a page whose whole purpose is to become a
// sheet of paper, and keeping them off the DOM entirely beats hiding them in
// `@media print`.
//
// The diagram is the drill's FIRST keyframe, not the current playhead: a
// printed card is a static artefact, and the start of the drill is the setup
// a coach lays cones out to. `frameAt(scene, keyframes, 0)` is exactly that.

// Print colours are fixed light — a card is printed on white paper, so the
// app's dark theme would either waste a cartridge or (with "print
// backgrounds" off, the default) render pale-grey ink on white. These are
// scoped to this page only and never leave it; design.md's token rule governs
// on-screen chrome, and this page's on-screen half still uses tokens.
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
  /* A section must not be split across the page break — a coaching-points
     list with its heading orphaned on page 1 is worse than a shorter page 1. */
  .card-block { break-inside: avoid; page-break-inside: avoid; }
  /* Two columns for the written sections. Stacked full-width they ran a
     fully-filled drill onto a second page for no reason: a coaching point is
     six or seven words, so a 688px-wide line wastes most of itself. Measured
     at A4 — see HANDOFF.md. */
  .card-columns { column-count: 2; column-gap: 10mm; }
  .card-columns > * { margin-top: 0 !important; padding-top: 0 !important; border-top: 0 !important; }
  .card-columns > * + * { margin-top: 4mm !important; }
}
`

export function DrillCardPage() {
  const { drillId } = useParams<{ drillId: string }>()
  const drills = useStore((s) => s.drills)
  const drillsLoading = useStore((s) => s.drillsLoading)
  const fetchDrills = useStore((s) => s.fetchDrills)

  // Same rule every other screen follows: fetch for itself rather than
  // assuming something else ran first, since this is a deep-linkable route.
  // Club tenancy (2026-08-28): no scope argument any more (RLS decides
  // visibility) — un-gated per the plan's Task 5 call-site census, or the
  // print card would silently render empty for every drill.
  useEffect(() => {
    void fetchDrills()
  }, [fetchDrills])

  const drill = drills.find((d) => d.id === drillId) ?? null

  if (!drill) {
    if (drillsLoading) {
      return (
        <div role="status" aria-busy="true" className="mx-auto max-w-[820px] p-6">
          <span className="sr-only">Loading drill…</span>
          <Skeleton className="aspect-[1/1.414] w-full rounded-lg" />
        </div>
      )
    }
    return (
      <div className="mx-auto max-w-[820px] space-y-3 p-6">
        <EmptyState icon={PenTool} message="That drill isn't in your library." />
        <Link to="/drills" className="text-sm font-medium text-accent hover:underline">
          Back to the drill library
        </Link>
      </div>
    )
  }

  return <DrillCard drill={drill} />
}

// Exported so the print layout can be rendered and measured directly against
// a fixture drill, without a store or a signed-in session behind it — see the
// A4 verification in HANDOFF.md. The route component above is the only caller
// in the app.
export function DrillCard({ drill }: { drill: Drill }) {
  const frame = useMemo(() => frameAt(drill.scene, drill.keyframes, 0), [drill.scene, drill.keyframes])
  const coaching = drill.coaching ?? {}
  const equipment = coaching.equipment ?? equipmentSummary(drill.scene)

  const facts = [
    { label: 'Duration', value: drill.duration_minutes != null ? `${drill.duration_minutes} min` : null },
    { label: 'Players', value: playerCount(drill) },
    { label: 'Age', value: ageBand(drill) },
    { label: 'Level', value: drill.difficulty ? DRILL_DIFFICULTY_LABELS[drill.difficulty] : null },
    { label: 'Intensity', value: drill.intensity ? DRILL_INTENSITY_LABELS[drill.intensity] : null },
    { label: 'Block', value: drill.session_block ? SESSION_BLOCK_LABELS[drill.session_block] : null },
    { label: 'Phase', value: drill.phase_of_play ? DRILL_PHASE_OF_PLAY_LABELS[drill.phase_of_play] : null },
    { label: 'Setup', value: drill.setup_minutes != null ? `${drill.setup_minutes} min` : null },
    {
      label: 'Pitch',
      value: `${presetLabel(drill.pitch.preset)} · ${formatDimensions(drill.pitch.lengthMeters, drill.pitch.widthMeters, drill.pitch.units ?? 'm')}`,
    },
    { label: 'Equipment', value: equipment || null },
  ].filter((fact) => fact.value)

  return (
    <>
      <style>{PRINT_STYLES}</style>

      <div className="card-print-hide sticky top-0 z-10 flex items-center justify-between gap-2 border-b border-line bg-surface px-4 py-3">
        <Link to={`/design/${drill.id}`} className="text-sm font-medium text-accent hover:underline">
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
          <h1 className="text-2xl font-semibold tracking-tight">{drill.name}</h1>
          {drill.objective && <p className="card-muted mt-1 text-sm text-ink-muted">{drill.objective}</p>}
          {drill.category && (
            <p className="card-muted mt-1 text-xs uppercase tracking-wide text-ink-faint">
              {drill.category}
              {drill.subcategory ? ` · ${drill.subcategory}` : ''}
            </p>
          )}
        </header>

        {/* Diagram beside the facts, not above them — the board is portrait
            and the facts are short, so stacking them wasted half the page
            width twice over. */}
        <div className="card-block mt-5 flex flex-col items-center gap-5 sm:flex-row sm:items-start">
          <PitchCanvas pitch={drill.pitch} frame={frame} maxWidth={340} maxHeight={420} />
          {facts.length > 0 && (
            <dl className="grid w-full grid-cols-2 gap-x-5 gap-y-2 sm:flex-1">
              {facts.map((fact) => (
                <div key={fact.label}>
                  <dt className="card-muted text-xs font-medium text-ink-muted">{fact.label}</dt>
                  <dd className="text-sm">{fact.value}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>

        <div className="card-columns mt-1">
          {drill.description && (
            <Section title="Description">
              <p className="whitespace-pre-wrap text-sm">{drill.description}</p>
            </Section>
          )}

          {coaching.setup && (
            <Section title="Setup">
              <p className="whitespace-pre-wrap text-sm">{coaching.setup}</p>
            </Section>
          )}

          <ListSection title="Coaching points" items={coaching.points} />
          <ListSection title="Progressions — make it harder" items={coaching.progressions} />
          <ListSection title="Regressions — make it easier" items={coaching.regressions} />
          <ListSection title="Common mistakes" items={coaching.mistakes} />

          {drill.learning_outcome && (
            <Section title="Learning outcome">
              <p className="whitespace-pre-wrap text-sm">{drill.learning_outcome}</p>
            </Section>
          )}
        </div>
      </div>
    </>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="card-block mt-5 border-t border-line pt-4">
      <h2 className="card-muted mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-muted">{title}</h2>
      {children}
    </section>
  )
}

function ListSection({ title, items }: { title: string; items: string[] | undefined }) {
  if (!items || items.length === 0) return null
  return (
    <Section title={title}>
      <ul className="list-disc space-y-1 pl-5 text-sm">
        {items.map((item, index) => (
          <li key={`${index}-${item}`}>{item}</li>
        ))}
      </ul>
    </Section>
  )
}

function playerCount(drill: Drill): string | null {
  if (drill.min_players != null && drill.max_players != null) {
    return drill.min_players === drill.max_players
      ? `${drill.min_players}`
      : `${drill.min_players}–${drill.max_players}`
  }
  if (drill.players_recommended != null) return `${drill.players_recommended}`
  return drill.min_players != null ? `${drill.min_players}+` : null
}

function ageBand(drill: Drill): string | null {
  if (drill.age_min && drill.age_max) return `${drill.age_min}–${drill.age_max}`
  return drill.age_min ?? drill.age_max ?? null
}
