import { useEffect, useMemo, useState } from 'react'
import { LibraryBig } from 'lucide-react'
import { useStore } from '../../store'
import { EmptyState } from '../ui/EmptyState'

const formatLabel: Record<string, string> = {
  '11v11': '11-a-side',
  small_sided: 'Small-sided',
}

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
// doesn't need server-side search") matches against both the drill name and
// its pitch format label, so typing "small" surfaces every small-sided drill
// even if none of their names mention it.
export function DrillLibrary() {
  const selectedTeamId = useStore((s) => s.selectedTeamId)
  const drills = useStore((s) => s.drills)
  const drillsLoading = useStore((s) => s.drillsLoading)
  const drillsError = useStore((s) => s.drillsError)
  const fetchDrills = useStore((s) => s.fetchDrills)

  const [query, setQuery] = useState('')

  useEffect(() => {
    if (selectedTeamId) fetchDrills(selectedTeamId)
  }, [selectedTeamId, fetchDrills])

  const filteredDrills = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return drills
    return drills.filter((d) => {
      const format = formatLabel[d.pitch_format] ?? d.pitch_format
      return d.name.toLowerCase().includes(q) || format.toLowerCase().includes(q)
    })
  }, [drills, query])

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
              className="w-full max-w-sm rounded-md border border-line bg-panel-raised px-2 py-1.5 text-sm text-ink outline-none focus:border-accent"
            />
          </div>

          {filteredDrills.length === 0 ? (
            <p className="text-sm text-ink-muted">No drills match "{query}".</p>
          ) : (
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {filteredDrills.map((drill) => (
                <li
                  key={drill.id}
                  className="flex items-center justify-between rounded-lg border border-line px-4 py-3 transition-colors hover:border-accent/40 hover:bg-accent/5"
                >
                  <p className="text-sm font-medium text-ink">{drill.name}</p>
                  <span className="shrink-0 rounded-full border border-line px-2 py-0.5 text-xs text-ink-muted">
                    {formatLabel[drill.pitch_format] ?? drill.pitch_format}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  )
}
