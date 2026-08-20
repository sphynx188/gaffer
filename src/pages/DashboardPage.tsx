import { useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { CalendarDays, Users } from 'lucide-react'
import { useStore } from '../store'
import { PageHeader } from '../components/ui/PageHeader'
import { Card } from '../components/ui/Card'
import { EmptyState } from '../components/ui/EmptyState'
import { teamAccentDotClass } from '../lib/teamColor'
import { addDays, formatDayLabel, formatTimeLabel, parseLocalDate, toISODate } from '../lib/date'

// Coach-level landing page — "what's coming up, and which team am I working
// on?" Deliberately not scoped to any one team (that's TeamOverviewPage.tsx,
// at /overview, reached by picking a team card below): the upcoming-sessions
// list is cross-team, reusing the same fetchSessionsForWeek/calendarSessions
// data CalendarGrid.tsx uses, just for a rolling 7-day window from today
// instead of a Monday-aligned calendar week — "what's on soon" reads better
// here than "what's on this calendar week" when today is, say, a Saturday.
export function DashboardPage() {
  const teams = useStore((s) => s.teams)
  const selectTeam = useStore((s) => s.selectTeam)
  const calendarSessions = useStore((s) => s.calendarSessions)
  const calendarSessionsLoading = useStore((s) => s.calendarSessionsLoading)
  const calendarSessionsError = useStore((s) => s.calendarSessionsError)
  const fetchSessionsForWeek = useStore((s) => s.fetchSessionsForWeek)
  const navigate = useNavigate()

  const teamIds = useMemo(() => teams.map((t) => t.id), [teams])
  const teamIdsKey = teamIds.join(',')
  const todayISO = toISODate(new Date())
  const weekEndISO = toISODate(addDays(new Date(), 6))

  useEffect(() => {
    if (teamIds.length > 0) fetchSessionsForWeek(teamIds, todayISO, weekEndISO)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- teamIds re-derived from teamIdsKey each render
  }, [teamIdsKey, todayISO, weekEndISO, fetchSessionsForWeek])

  const upcoming = useMemo(
    () =>
      calendarSessions
        .filter((s) => s.date >= todayISO)
        .sort((a, b) => a.date.localeCompare(b.date) || (a.start_time ?? '').localeCompare(b.start_time ?? '')),
    [calendarSessions, todayISO]
  )

  const handlePickTeam = (id: string) => {
    selectTeam(id)
    navigate('/overview')
  }

  // Jumps straight into SessionPlanner on the week the clicked session is
  // actually in (see SessionPlanner.tsx's focusDate handling), not just to
  // /sessions and whatever week happens to be current.
  const handleOpenSession = (teamId: string, date: string) => {
    selectTeam(teamId)
    navigate('/sessions', { state: { focusDate: date } })
  }

  if (teams.length === 0) {
    return (
      <div>
        <PageHeader title="Dashboard" />
        <EmptyState
          icon={Users}
          message="Create your first team to get started."
          action={{ to: '/teams', label: 'Create your first team →' }}
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Dashboard" description="What's coming up, across every team." />

      <Card>
        <h2 className="mb-4 text-sm font-semibold text-ink">Upcoming this week</h2>
        {calendarSessionsError && <p className="text-sm text-bad">{calendarSessionsError}</p>}
        {calendarSessionsLoading && upcoming.length === 0 && <p className="text-sm text-ink-muted">Loading…</p>}
        {!calendarSessionsLoading && upcoming.length === 0 ? (
          <EmptyState
            icon={CalendarDays}
            message="No sessions planned in the next 7 days."
            action={{ to: '/sessions', label: 'Plan one →' }}
          />
        ) : (
          <ul className="divide-y divide-line">
            {upcoming.map((s) => {
              const team = teams.find((t) => t.id === s.team_id)
              return (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => handleOpenSession(s.team_id, s.date)}
                    className="flex w-full flex-wrap items-center justify-between gap-2 rounded-md px-2 py-3 text-left transition-colors hover:bg-panel-raised"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className={`h-2 w-2 shrink-0 rounded-full ${teamAccentDotClass(s.team_id)}`} />
                      <div>
                        <p className="text-sm font-medium text-ink">
                          {formatDayLabel(parseLocalDate(s.date))}
                          {s.start_time && ` · ${formatTimeLabel(s.start_time)}`}
                        </p>
                        <p className="text-xs text-ink-muted">{team?.name ?? 'Unknown team'}</p>
                      </div>
                    </div>
                    <span className="text-xs text-ink-muted">{s.duration_minutes} min</span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </Card>

      <div>
        <h2 className="mb-3 text-sm font-semibold text-ink">Your teams</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {teams.map((team) => (
            <button key={team.id} type="button" onClick={() => handlePickTeam(team.id)} className="text-left">
              <Card className="transition-colors hover:border-accent/40 hover:bg-accent/5">
                <p className="text-base font-semibold text-ink">{team.name}</p>
              </Card>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
