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
// the drawer's full block.
export function TeamSwitcher({ compact = false }: { compact?: boolean }) {
  const teams = useStore((s) => s.teams)
  const selectedTeamId = useStore((s) => s.selectedTeamId)
  const selectTeam = useStore((s) => s.selectTeam)

  if (teams.length === 0) {
    return compact ? null : <p className="text-xs text-ink-faint">No teams yet</p>
  }

  if (teams.length === 1) {
    const team = teams[0]
    if (compact) {
      return <span className="truncate text-sm font-medium text-ink">{team.name}</span>
    }
    return (
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">Team</p>
        <p className="mt-0.5 truncate text-sm font-semibold text-ink">{team.name}</p>
      </div>
    )
  }

  if (compact) {
    return (
      <select
        id="team-switcher"
        value={selectedTeamId ?? ''}
        onChange={(e) => selectTeam(e.target.value)}
        className="w-full rounded-md border border-line bg-panel-raised px-2 py-1 text-sm text-ink outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/30"
      >
        {teams.map((team) => (
          <option key={team.id} value={team.id}>
            {team.name}
          </option>
        ))}
      </select>
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
