import { useStore } from '../store'

const formatLabel: Record<string, string> = {
  '11v11': '11-a-side',
  small_sided: 'Small-sided',
}

// Phase 1.2 — Multi-team switching (US-4, gaffer_mvp_build_steps.md). Per
// the build guide: "add a team switcher once more than one team exists" —
// with a single team there's nothing to switch between, so this renders
// nothing until a second team is created. Every team-scoped view reads
// `selectedTeamId` from the store (teamSlice) rather than defaulting to
// teams[0]; this is the one place that scope changes.
export function TeamSwitcher() {
  const teams = useStore((s) => s.teams)
  const selectedTeamId = useStore((s) => s.selectedTeamId)
  const selectTeam = useStore((s) => s.selectTeam)

  if (teams.length < 2) return null

  return (
    <div className="flex items-center gap-2">
      <label htmlFor="team-switcher" className="text-xs font-medium text-slate-500">
        Team
      </label>
      <select
        id="team-switcher"
        value={selectedTeamId ?? ''}
        onChange={(e) => selectTeam(e.target.value)}
        className="rounded-md border border-slate-300 px-2 py-1.5 text-sm text-slate-900 outline-none focus:border-slate-500"
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
