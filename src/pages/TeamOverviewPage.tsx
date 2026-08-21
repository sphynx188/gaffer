import { useEffect, useMemo, type ComponentType } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, CalendarDays, LibraryBig, Users } from 'lucide-react'
import { useStore } from '../store'
import { PageHeader } from '../components/ui/PageHeader'
import { Card } from '../components/ui/Card'
import { EmptyState } from '../components/ui/EmptyState'
import { formatDayLabel, parseLocalDate, toISODate } from '../lib/date'

// The team-level hub — landed on after picking a team from the coach-level
// Dashboard or Teams tab (see DashboardPage.tsx / TeamManagement.tsx). This
// carries over what used to be DashboardPage's entire body before the
// FM-style nav split coach-level ("which team?") from team-level ("what's
// going on with this team?") context; the data flow is unchanged, only the
// route it lives on.
export function TeamOverviewPage() {
  const teams = useStore((s) => s.teams)
  const selectedTeamId = useStore((s) => s.selectedTeamId)
  const players = useStore((s) => s.players)
  const sessions = useStore((s) => s.sessions)
  const drills = useStore((s) => s.drills)
  const fetchPlayers = useStore((s) => s.fetchPlayers)
  const fetchSessions = useStore((s) => s.fetchSessions)
  const fetchDrills = useStore((s) => s.fetchDrills)

  const team = teams.find((t) => t.id === selectedTeamId) ?? null

  useEffect(() => {
    if (!selectedTeamId) return
    fetchPlayers(selectedTeamId)
    fetchSessions(selectedTeamId)
    fetchDrills(selectedTeamId)
  }, [selectedTeamId, fetchPlayers, fetchSessions, fetchDrills])

  const todayISO = toISODate(new Date())
  const upcomingSessions = useMemo(
    () =>
      sessions
        .filter((s) => s.date >= todayISO)
        .sort((a, b) => a.date.localeCompare(b.date))
        .slice(0, 5),
    [sessions, todayISO]
  )

  if (!selectedTeamId) {
    return (
      <div>
        <PageHeader title="Overview" />
        <Card className="border-dashed text-center">
          <p className="text-sm text-ink-muted">Select a team to see its overview.</p>
          <Link
            to="/"
            className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-accent hover:text-accent-hover"
          >
            Go to Dashboard <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader title={team ? team.name : 'Overview'} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard icon={Users} label="Players on roster" value={players.length} to="/roster" />
        <StatCard icon={CalendarDays} label="Upcoming sessions" value={upcomingSessions.length} to="/sessions" />
        <StatCard icon={LibraryBig} label="Drills in library" value={drills.length} to="/drills" />
      </div>

      <Card>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-ink">Upcoming sessions</h2>
          <Link to="/sessions" className="text-sm font-medium text-accent hover:text-accent-hover">
            View all
          </Link>
        </div>
        {upcomingSessions.length === 0 ? (
          <EmptyState
            icon={CalendarDays}
            message="No upcoming sessions."
            action={{ to: '/sessions', label: 'Plan one to get started →' }}
          />
        ) : (
          <ul className="divide-y divide-line">
            {upcomingSessions.map((s) => {
              const responded = s.availability.filter((a) => a.responded_at).length
              return (
                <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                  <div>
                    <p className="text-sm font-medium text-ink">{formatDayLabel(parseLocalDate(s.date))}</p>
                    <p className="mt-0.5 text-xs text-ink-muted">
                      {s.duration_minutes} min · {s.session_drills.length} drill(s)
                    </p>
                  </div>
                  <span className="rounded-full bg-panel-raised px-2.5 py-1 text-xs font-medium text-ink-muted">
                    {responded}/{s.availability.length} attendance recorded
                  </span>
                </li>
              )
            })}
          </ul>
        )}
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <QuickAction to="/sessions" label="Plan a session" />
        <QuickAction to="/roster" label="Add a player" />
        <QuickAction to="/design" label="Build a drill" />
      </div>
    </div>
  )
}

function StatCard({
  icon: Icon,
  label,
  value,
  to,
}: {
  icon: ComponentType<{ className?: string }>
  label: string
  value: number
  to: string
}) {
  return (
    <Link
      to={to}
      className="rounded-xl border border-line bg-panel p-5 shadow-sm transition-colors hover:border-accent/40 hover:bg-accent/5"
    >
      <div className="flex items-center gap-3">
        <div className="rounded-lg bg-accent/15 p-2 text-accent">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-2xl font-semibold text-ink">{value}</p>
          <p className="text-xs text-ink-muted">{label}</p>
        </div>
      </div>
    </Link>
  )
}

function QuickAction({ to, label }: { to: string; label: string }) {
  return (
    <Link
      to={to}
      className="flex items-center justify-between rounded-xl border border-line bg-panel px-4 py-3 text-sm font-medium text-ink shadow-sm transition-colors hover:border-accent/40 hover:text-accent"
    >
      {label}
      <ArrowRight className="h-4 w-4" />
    </Link>
  )
}
