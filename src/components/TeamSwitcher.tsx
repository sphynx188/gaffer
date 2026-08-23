import { Link } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { useStore } from '../store'
import { Dropdown } from './ui/Dropdown'

// Phase 1.2 — Multi-team switching (US-4, gaffer_mvp_build_steps.md).
// Redesign (post-MVP): lives in the AppShell nav drawer, plain text with one
// team (nothing to switch between yet), a real dropdown once a second team
// exists. Every team-scoped view still reads `selectedTeamId` from the store
// (teamSlice) rather than defaulting to teams[0]; this is the one place
// that scope changes.
//
// FM-style top-bar redesign: `compact` renders a single-line variant (no
// stacked label line) for the slim desktop top bar, which has no room for
// the drawer's full block. Both cases now sit on the shared `Dropdown`
// primitive (ui/Dropdown.tsx) — this file used to hand-roll its own
// popover, which became the reference design.md now points every other
// dropdown at (2026-08-24); the compact case keeps a "+ New team" footer
// action, the drawer case doesn't need one since it already sits right
// above the Teams nav link.
function CompactTeamMenu({
  teams,
  selectedTeamId,
  selectTeam,
}: {
  teams: { id: string; name: string }[]
  selectedTeamId: string | null
  selectTeam: (id: string) => void
}) {
  return (
    <Dropdown
      value={selectedTeamId ?? ''}
      onChange={selectTeam}
      options={teams.map((t) => ({ value: t.id, label: t.name }))}
      placeholder="No team selected"
      searchable
      ariaLabel="Select team"
      emptyMessage="No teams yet"
      triggerClassName="w-auto max-w-40 font-medium"
      footer={
        <Link
          to="/teams"
          className="flex items-center gap-2 px-3 py-2 text-sm text-ink-muted transition-colors hover:bg-panel-raised hover:text-ink"
        >
          <Plus className="h-4 w-4" />
          New team
        </Link>
      }
    />
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
  // drawer block below still branches on count, since a dropdown has
  // nothing meaningful to show for 0 or 1 option.
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
      <div className="mt-1">
        <Dropdown
          id="team-switcher"
          value={selectedTeamId ?? ''}
          onChange={selectTeam}
          options={teams.map((t) => ({ value: t.id, label: t.name }))}
          ariaLabel="Select team"
          triggerClassName="w-full"
        />
      </div>
    </div>
  )
}
