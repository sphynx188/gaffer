import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { runSupabaseAction } from '../store/supabaseAction'
import { toISODate } from '../lib/date'

export interface TeamSummary {
  playerCount: number
  upcomingSessionCount: number
}

const EMPTY_SUMMARY: TeamSummary = { playerCount: 0, upcomingSessionCount: 0 }

function countByTeam(rows: { team_id: string }[]): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const row of rows) counts[row.team_id] = (counts[row.team_id] ?? 0) + 1
  return counts
}

// Per-team stat cards on the Teams tab need player/upcoming-session counts
// across ALL of a coach's teams at once — the store's `players`/`sessions`
// arrays only ever hold the single currently-selected team's data (see
// teamSlice's clearTeamScopedState), so this is a small self-contained hook
// with its own local state rather than another store slice, and it never
// touches those single-team arrays.
export function useTeamSummaries(teamIds: string[]): {
  summaries: Record<string, TeamSummary>
  loading: boolean
  error: string | null
} {
  const [summaries, setSummaries] = useState<Record<string, TeamSummary>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const key = teamIds.slice().sort().join(',')

  useEffect(() => {
    if (teamIds.length === 0) {
      setSummaries({})
      return
    }
    let cancelled = false
    setLoading(true)
    setError(null)

    const todayISO = toISODate(new Date())

    Promise.all([
      runSupabaseAction<{ team_id: string }[]>(
        () => supabase.from('player').select('team_id').in('team_id', teamIds),
        "Couldn't load player counts."
      ),
      runSupabaseAction<{ team_id: string }[]>(
        () => supabase.from('session').select('team_id').in('team_id', teamIds).gte('date', todayISO),
        "Couldn't load session counts."
      ),
    ]).then(([playerResult, sessionResult]) => {
      if (cancelled) return
      const playerCounts = countByTeam(playerResult.data ?? [])
      const sessionCounts = countByTeam(sessionResult.data ?? [])
      const next: Record<string, TeamSummary> = {}
      for (const id of teamIds) {
        next[id] = {
          playerCount: playerCounts[id] ?? EMPTY_SUMMARY.playerCount,
          upcomingSessionCount: sessionCounts[id] ?? EMPTY_SUMMARY.upcomingSessionCount,
        }
      }
      setSummaries(next)
      setLoading(false)
      setError(playerResult.error ?? sessionResult.error ?? null)
    })

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on `key`, a stable join of teamIds
  }, [key])

  return { summaries, loading, error }
}
