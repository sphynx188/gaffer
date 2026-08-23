import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, ChevronsUpDown, Plus } from 'lucide-react'
import { useStore } from '../store'

// Phase 1.2 — Multi-team switching (US-4, gaffer_mvp_build_steps.md).
// Redesign (post-MVP): lives in the AppShell nav drawer, plain text with one
// team (nothing to switch between yet), a real dropdown once a second team
// exists. Every team-scoped view still reads `selectedTeamId` from the store
// (teamSlice) rather than defaulting to teams[0]; this is the one place
// that scope changes.
//
// FM-style top-bar redesign: `compact` renders a single-line variant (no
// stacked label line) for the slim desktop top bar, which has no room for
// the drawer's full block. The multi-team compact case (below) is a custom
// popover rather than a native `<select>` — asked for at review, with a
// reference screenshot of a project-switcher-style trigger+panel — a
// native select can't be given that trigger/panel look at all, so this is
// the one variant here that isn't just a styling pass on the same element.
function CompactTeamMenu({
  teams,
  selectedTeamId,
  selectTeam,
}: {
  teams: { id: string; name: string }[]
  selectedTeamId: string | null
  selectTeam: (id: string) => void
}) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  // `teams[0]` fallback (not just `selectedTeamId` lookup) covers 0 teams
  // too, where both sides are undefined — the trigger falls through to its
  // own placeholder text below rather than throwing on `.name`.
  const selected = teams.find((t) => t.id === selectedTeamId) ?? teams[0]

  // Standard popover dismissal: a click anywhere outside, or Escape, closes
  // it. Listening on the whole document rather than a blur handler because
  // this has to close when focus moves to a completely unrelated element
  // (clicking a page link, say), not just when it moves within the menu.
  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex items-center gap-1.5 rounded-md border border-line bg-panel-raised px-2 py-1 text-sm font-medium text-ink transition-colors hover:border-line-strong"
      >
        <span className={`max-w-28 truncate ${selected ? '' : 'text-ink-muted'}`}>
          {selected?.name ?? 'No team selected'}
        </span>
        <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-ink-faint" />
      </button>

      {open && (
        <div
          role="listbox"
          aria-label="Select team"
          className="absolute left-0 top-full z-40 mt-1.5 w-56 overflow-hidden rounded-md border border-line bg-panel shadow-xl"
        >
          {teams.length > 0 ? (
            <ul className="max-h-64 overflow-y-auto py-1">
              {teams.map((team) => (
                <li key={team.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={team.id === selectedTeamId}
                    onClick={() => {
                      selectTeam(team.id)
                      setOpen(false)
                    }}
                    className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm text-ink transition-colors hover:bg-panel-raised"
                  >
                    <span className="truncate">{team.name}</span>
                    {team.id === selectedTeamId && <Check className="h-4 w-4 shrink-0 text-accent" />}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-3 py-3 text-sm text-ink-faint">No teams yet</p>
          )}
          <div className="border-t border-line py-1">
            <Link
              to="/teams"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 px-3 py-2 text-sm text-ink-muted transition-colors hover:bg-panel-raised hover:text-ink"
            >
              <Plus className="h-4 w-4" />
              New team
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}

export function TeamSwitcher({ compact = false }: { compact?: boolean }) {
  const teams = useStore((s) => s.teams)
  const selectedTeamId = useStore((s) => s.selectedTeamId)
  const selectTeam = useStore((s) => s.selectTeam)

  // The compact popover handles every team count itself, 0 included — a
  // coach with no teams yet still gets the trigger, opens to an empty list
  // plus "+ New team", rather than the header silently showing nothing
  // until a second team justified a real widget. Only the non-compact
  // drawer block below still branches on count, since a plain `<select>`
  // has nothing meaningful to show for 0 or 1 option.
  if (compact) {
    return <CompactTeamMenu teams={teams} selectedTeamId={selectedTeamId} selectTeam={selectTeam} />
  }

  if (teams.length === 0) {
    return <p className="text-xs text-ink-faint">No teams yet</p>
  }

  if (teams.length === 1) {
    const team = teams[0]
    return (
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">Team</p>
        <p className="mt-0.5 truncate text-sm font-semibold text-ink">{team.name}</p>
      </div>
    )
  }

  return (
    <div>
      <label htmlFor="team-switcher" className="text-xs font-medium uppercase tracking-wide text-ink-faint">
        Team
      </label>
      <select
        id="team-switcher"
        value={selectedTeamId ?? ''}
        onChange={(e) => selectTeam(e.target.value)}
        className="mt-1 w-full rounded-md border border-line bg-panel-raised px-2 py-1.5 text-sm text-ink outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/30"
      >
        {teams.map((team) => (
          <option key={team.id} value={team.id}>
            {team.name}
          </option>
        ))}
      </select>
    </div>
  )
}
