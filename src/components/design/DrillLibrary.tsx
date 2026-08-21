import { useEffect, useMemo, useState } from 'react'
import { LibraryBig, Pause, Play } from 'lucide-react'
import { useStore } from '../../store'
import { PITCH_ORIENTATION_LABELS, PITCH_SIZE_LABELS } from '../../store'
import { EmptyState } from '../ui/EmptyState'
import { PitchCanvas } from './PitchCanvas'

// Phase 3.1 — Drill library / browse & search (US-17, gaffer_mvp_build_steps.md).
// Reuses the exact same `drills` state DrillPreview already fetches via
// drillSlice.fetchDrills — that fetch is already scoped "this team OR
// nobody's team" (coach-owned drills, team_id null, are reusable across every
// team), so the library lists precisely the set the steps call for: "all
// drills (coach-owned + current-team-scoped)". This component fires its own
// fetchDrills call on mount/team-change too, same as every other screen here
// (PlayerRoster, SessionPlanner, DrillPreview) — each is independently
// responsible for making sure its own data is fresh rather than relying on
// some other screen having mounted first, and a second fetch for data
// that's already loaded is cheap and idempotent.
//
// The search box (build guide 2b: "filters client-side ... this scale
// doesn't need server-side search") matches against the drill name and its
// pitch size/orientation labels, so typing "half" surfaces every half-pitch
// drill even if none of their names mention it.
//
// Preview + auto-play (inspired by a Claude Design exploration of this
// screen): clicking a drill opens a read-only PitchCanvas below the list —
// PitchCanvas already supports non-interactive display with no props beyond
// pitchSize/orientation/phase, so this is a straight reuse, not a fork.
// "Play" steps through the drill's phases automatically on each phase's own
// duration_seconds (falling back to a flat default for phases that don't
// set one), looping back to the first phase after the last — lets a coach
// glance through a drill's shape before a session without opening the full
// Design editor. Deliberately just cuts between phases rather than tweening
// marker positions: phases aren't guaranteed to have matching elements
// (a coach can add/remove players between phases), so there's no general
// way to interpolate between two arbitrary phases' element sets.
const DEFAULT_PHASE_SECONDS = 3

export function DrillLibrary() {
  const selectedTeamId = useStore((s) => s.selectedTeamId)
  const drills = useStore((s) => s.drills)
  const drillsLoading = useStore((s) => s.drillsLoading)
  const drillsError = useStore((s) => s.drillsError)
  const fetchDrills = useStore((s) => s.fetchDrills)

  const [query, setQuery] = useState('')
  const [selectedDrillId, setSelectedDrillId] = useState<string | null>(null)
  const [previewPhaseIndex, setPreviewPhaseIndex] = useState(0)
  const [playing, setPlaying] = useState(false)

  useEffect(() => {
    if (selectedTeamId) fetchDrills(selectedTeamId)
  }, [selectedTeamId, fetchDrills])

  const filteredDrills = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return drills
    return drills.filter((d) => {
      const size = PITCH_SIZE_LABELS[d.pitch_size] ?? d.pitch_size
      const orientation = PITCH_ORIENTATION_LABELS[d.orientation] ?? d.orientation
      return (
        d.name.toLowerCase().includes(q) ||
        size.toLowerCase().includes(q) ||
        orientation.toLowerCase().includes(q)
      )
    })
  }, [drills, query])

  const selectedDrill = drills.find((d) => d.id === selectedDrillId) ?? null
  const previewPhase = selectedDrill?.phases[previewPhaseIndex] ?? null

  const handleSelectDrill = (id: string) => {
    setPlaying(false)
    setPreviewPhaseIndex(0)
    setSelectedDrillId((current) => (current === id ? null : id))
  }

  // Auto-advance through phases while playing — cleared on pause, drill
  // switch, or unmount so a stray timer never outlives the preview it was
  // driving.
  useEffect(() => {
    if (!playing || !selectedDrill || selectedDrill.phases.length <= 1) return
    const seconds = selectedDrill.phases[previewPhaseIndex]?.duration_seconds || DEFAULT_PHASE_SECONDS
    const timer = setTimeout(() => {
      setPreviewPhaseIndex((i) => (i + 1) % selectedDrill.phases.length)
    }, seconds * 1000)
    return () => clearTimeout(timer)
  }, [playing, selectedDrill, previewPhaseIndex])

  return (
    <div className="space-y-4">
      {!selectedTeamId && <p className="text-sm text-ink-muted">Select a team to browse its drills.</p>}
      {selectedTeamId && drillsLoading && drills.length === 0 && (
        <p className="text-sm text-ink-muted">Loading drills…</p>
      )}
      {drillsError && <p className="text-sm text-bad">{drillsError}</p>}
      {selectedTeamId && !drillsLoading && drills.length === 0 && !drillsError && (
        <EmptyState
          icon={LibraryBig}
          message="No drills yet."
          action={{ to: '/design', label: 'Build one in Design →' }}
        />
      )}

      {selectedTeamId && drills.length > 0 && (
        <>
          <div>
            <label htmlFor="drill-library-search" className="sr-only">
              Search drills
            </label>
            <input
              id="drill-library-search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name or pitch format…"
              className="w-full max-w-sm rounded-md border border-line bg-panel-raised px-2 py-1.5 text-sm text-ink outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/30"
            />
          </div>

          {filteredDrills.length === 0 ? (
            <p className="text-sm text-ink-muted">No drills match "{query}".</p>
          ) : (
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {filteredDrills.map((drill) => (
                <li key={drill.id}>
                  <button
                    type="button"
                    onClick={() => handleSelectDrill(drill.id)}
                    aria-pressed={selectedDrillId === drill.id}
                    className={
                      'flex w-full items-center justify-between rounded-lg border px-4 py-3 text-left transition-colors ' +
                      (selectedDrillId === drill.id
                        ? 'border-accent/40 bg-accent/5'
                        : 'border-line hover:border-accent/40 hover:bg-accent/5')
                    }
                  >
                    <p className="text-sm font-medium text-ink">{drill.name}</p>
                    <span className="shrink-0 rounded-full border border-line px-2 py-0.5 text-xs text-ink-muted">
                      {PITCH_SIZE_LABELS[drill.pitch_size] ?? drill.pitch_size} ·{' '}
                      {PITCH_ORIENTATION_LABELS[drill.orientation] ?? drill.orientation}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {selectedDrill && previewPhase && (
            <div className="panel-edge rounded-xl border border-line bg-panel p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium text-ink">{selectedDrill.name}</p>
                {selectedDrill.phases.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setPlaying((p) => !p)}
                    className="flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-xs font-semibold text-white hover:bg-accent-hover"
                  >
                    {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                    {playing ? 'Pause' : 'Play'}
                  </button>
                )}
              </div>

              {/* Keyed on the phase id so auto-play forces a full remount
                  each cycle rather than an in-place prop update — avoids
                  ever depending on Konva's diffing to catch a rapid,
                  timer-driven phase swap the way it already reliably
                  handles a human clicking between phase tabs. */}
              <PitchCanvas
                key={previewPhase.id}
                pitchSize={selectedDrill.pitch_size}
                orientation={selectedDrill.orientation}
                phase={previewPhase}
                maxWidth={340}
              />

              {selectedDrill.phases.length > 1 && (
                <p className="mt-2 text-xs text-ink-muted">
                  Phase {previewPhaseIndex + 1} of {selectedDrill.phases.length}
                  {previewPhase.label && ` · ${previewPhase.label}`}
                  {previewPhase.duration_seconds != null && ` · ${previewPhase.duration_seconds}s`}
                </p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
