import { useEffect, useMemo, type ComponentType } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, CalendarDays, LibraryBig, Users } from 'lucide-react'
import { useStore } from '../store'
import { PageHeader } from '../components/ui/PageHeader'
import { Card } from '../components/ui/Card'
import { EmptyState } from '../components/ui/EmptyState'
import { Badge } from '../components/ui/Badge'
import { loadTone } from '../components/ui/badgeTones'

const formatLabel: Record<string, string> = {
  '11v11': '11-a-side',
  small_sided: 'Small-sided',
}

function toISODate(d: Date): string {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function formatDayLabel(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
}

// New — the landing page a coach now sees instead of the top of the old
// single scrolling column. Pulls together the same team-scoped data every
// other page already fetches (players/sessions/drills) into a quick-glance
// summary — roster size, what's coming up this week/next, and the library
// size — plus shortcuts into the workflow a coach is most likely doing next.
export function DashboardPage() {
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
        <PageHeader title="Dashboard" />
        <Card className="border-dashed text-center">
          <p className="text-sm text-ink-muted">Create your first team to get started.</p>
          <Link
            to="/teams"
            className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-accent hover:text-accent-hover"
          >
            Go to Teams <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={team ? team.name : 'Dashboard'}
        description={team ? `${formatLabel[team.format] ?? team.format} · squad overview` : undefined}
      />

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
                    <p className="text-sm font-medium text-ink">{formatDayLabel(s.date)}</p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-ink-muted">
                      {s.duration_minutes} min · {s.session_drills.length} drill(s)
                      {s.physical_load != null && <Badge tone={loadTone(s.physical_load)}>load {s.physical_load}/5</Badge>}
                    </p>
                  </div>
                  <span className="rounded-full bg-panel-raised px-2.5 py-1 text-xs font-medium text-ink-muted">
                    {responded}/{s.availability.length} responded
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
