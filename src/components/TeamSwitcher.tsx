import { useStore } from '../store'

const formatLabel: Record<string, string> = {
  '11v11': '11-a-side',
  small_sided: 'Small-sided',
}

// Phase 1.2 — Multi-team switching (US-4, gaffer_mvp_build_steps.md).
// Redesign (post-MVP): now lives permanently in the sidebar (AppShell)
// instead of the old single-column page, so it always shows the current
// team's context — plain text with one team (nothing to switch between yet),
// a real dropdown once a second team exists. Every team-scoped view still
// reads `selectedTeamId` from the store (teamSlice) rather than defaulting
// to teams[0]; this is the one place that scope changes.
export function TeamSwitcher() {
  const teams = useStore((s) => s.teams)
  const selectedTeamId = useStore((s) => s.selectedTeamId)
  const selectTeam = useStore((s) => s.selectTeam)

  if (teams.length === 0) {
    return <p className="text-xs text-slate-400">No teams yet</p>
  }

  if (teams.length === 1) {
    const team = teams[0]
    return (
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Team</p>
        <p className="mt-0.5 truncate text-sm font-semibold text-slate-900">{team.name}</p>
        <p className="text-xs text-slate-500">{formatLabel[team.format] ?? team.format}</p>
      </div>
    )
  }

  return (
    <div>
      <label htmlFor="team-switcher" className="text-xs font-medium uppercase tracking-wide text-slate-400">
        Team
      </label>
      <select
        id="team-switcher"
        value={selectedTeamId ?? ''}
        onChange={(e) => selectTeam(e.target.value)}
        className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm text-slate-900 outline-none focus:border-slate-500"
      >
        {teams.map((team) => (
          <option key={team.id} value={team.id}>
            {team.name} ({formatLabel[team.format] ?? team.format})
          </option>
        ))}
      </select>
    </div>
  )
}
