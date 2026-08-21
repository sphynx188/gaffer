import { useEffect, useMemo, useState } from 'react'
import { CalendarDays } from 'lucide-react'
import { useStore } from '../store'
import type { Availability, AvailabilityStatus } from '../store'
import { PageHeader } from '../components/ui/PageHeader'
import { EmptyState } from '../components/ui/EmptyState'
import { addDays, formatDayLabel, formatTimeLabel, formatWeekLabel, parseLocalDate, startOfWeek, toISODate } from '../lib/date'

// Click-to-cycle order for a roll-call cell — unconfirmed is always the
// starting point (the seeded default from sessionSlice.createSession), then
// the three roll-call outcomes a coach actually marks during/after a
// session. Present is checked before Injured/Away since it's the by-far
// most common click.
const STATUS_CYCLE: AvailabilityStatus[] = ['unconfirmed', 'present', 'injured', 'away']

const STATUS_LABEL: Record<AvailabilityStatus, string> = {
  unconfirmed: 'Unconfirmed',
  present: 'Present',
  injured: 'Injured',
  away: 'Away',
}

const STATUS_CELL_LABEL: Record<AvailabilityStatus, string> = {
  unconfirmed: '–',
  present: 'P',
  injured: 'I',
  away: 'A',
}

// Same Tailwind-needs-static-class-names constraint as badgeTones.ts/
// teamColor.ts — spelled out per status rather than built from a tone name.
const STATUS_CELL_CLASS: Record<AvailabilityStatus, string> = {
  unconfirmed: 'bg-panel-raised text-ink-faint hover:bg-line',
  present: 'bg-ok/15 text-ok hover:bg-ok/25',
  injured: 'bg-bad/15 text-bad hover:bg-bad/25',
  away: 'bg-warn/15 text-warn hover:bg-warn/25',
}

function nextStatus(status: AvailabilityStatus): AvailabilityStatus {
  return STATUS_CYCLE[(STATUS_CYCLE.indexOf(status) + 1) % STATUS_CYCLE.length]
}

// Redesign — attendance as a roll call: a week-of-sessions × roster grid
// (like a classroom attendance sheet), replacing the old one-session-at-a-
// time picker (which just re-showed AvailabilityPanel). Each cell is the
// same `availability` row every other view reads/writes
// (sessionSlice/availabilitySlice) — clicking one cycles its `status`
// through unconfirmed -> present -> injured -> away -> unconfirmed via the
// existing updateAvailability action, no new table or column. Scoped to the
// selected team, same as SessionPlanner/PlayerRoster.
export function AttendancePage() {
  const selectedTeamId = useStore((s) => s.selectedTeamId)
  const players = useStore((s) => s.players)
  const sessions = useStore((s) => s.sessions)
  const sessionsLoading = useStore((s) => s.sessionsLoading)
  const fetchSessions = useStore((s) => s.fetchSessions)
  const fetchPlayers = useStore((s) => s.fetchPlayers)
  const updateAvailability = useStore((s) => s.updateAvailability)

  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()))
  const [pendingId, setPendingId] = useState<string | null>(null)

  useEffect(() => {
    if (!selectedTeamId) return
    fetchSessions(selectedTeamId)
    fetchPlayers(selectedTeamId)
  }, [selectedTeamId, fetchSessions, fetchPlayers])

  const weekEnd = addDays(weekStart, 6)
  const weekStartISO = toISODate(weekStart)
  const weekEndISO = toISODate(weekEnd)

  const weekSessions = useMemo(
    () =>
      sessions
        .filter((s) => s.date >= weekStartISO && s.date <= weekEndISO)
        .sort((a, b) => a.date.localeCompare(b.date) || (a.start_time ?? '').localeCompare(b.start_time ?? '')),
    [sessions, weekStartISO, weekEndISO]
  )

  const handleCycle = async (availability: Availability) => {
    if (pendingId) return
    setPendingId(availability.id)
    await updateAvailability(availability.id, { status: nextStatus(availability.status), reason: availability.reason })
    setPendingId(null)
  }

  if (!selectedTeamId) {
    return (
      <div>
        <PageHeader title="Attendance" />
        <p className="text-sm text-ink-muted">Create a team first to track attendance.</p>
      </div>
    )
  }

  return (
    <div>
      <PageHeader title="Attendance" />

      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-ink">Week of {formatWeekLabel(weekStart, weekEnd)}</h2>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setWeekStart((w) => addDays(w, -7))}
            className="rounded-md border border-line px-2 py-1 text-xs text-ink-muted"
          >
            ← Prev
          </button>
          <button
            type="button"
            onClick={() => setWeekStart(startOfWeek(new Date()))}
            className="rounded-md border border-line px-2 py-1 text-xs text-ink-muted"
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => setWeekStart((w) => addDays(w, 7))}
            className="rounded-md border border-line px-2 py-1 text-xs text-ink-muted"
          >
            Next →
          </button>
        </div>
      </div>

      {sessionsLoading && weekSessions.length === 0 && <p className="text-sm text-ink-muted">Loading…</p>}

      {players.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          message="No players on the roster yet."
          action={{ to: '/roster', label: 'Add players →' }}
        />
      ) : weekSessions.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          message="No sessions this week."
          action={{ to: '/sessions', label: 'Plan one →' }}
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-line bg-panel">
          <table className="w-full min-w-max border-collapse text-sm">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 min-w-36 border-b border-r border-line bg-panel px-3 py-2 text-left text-xs font-medium text-ink-muted">
                  Player
                </th>
                {weekSessions.map((s) => (
                  <th
                    key={s.id}
                    className="min-w-20 border-b border-line px-2 py-2 text-center text-xs font-medium text-ink-muted"
                  >
                    <p>{formatDayLabel(parseLocalDate(s.date))}</p>
                    {s.start_time && <p className="font-normal text-ink-faint">{formatTimeLabel(s.start_time)}</p>}
                  </th>
                ))}
                <th className="min-w-16 border-b border-l border-line px-2 py-2 text-center text-xs font-medium text-ink-muted">
                  Attended
                </th>
              </tr>
            </thead>
            <tbody>
              {players.map((player) => {
                const attendedCount = weekSessions.filter(
                  (s) => s.availability.find((a) => a.player_id === player.id)?.status === 'present'
                ).length
                return (
                  <tr key={player.id}>
                    <td className="sticky left-0 z-10 border-b border-r border-line bg-panel px-3 py-2 text-left">
                      <span className="text-sm text-ink">
                        {player.squad_number != null && (
                          <span className="mr-1 text-ink-muted">#{player.squad_number}</span>
                        )}
                        {player.name}
                      </span>
                    </td>
                    {weekSessions.map((s) => {
                      const availability = s.availability.find((a) => a.player_id === player.id)
                      return (
                        <td key={s.id} className="border-b border-line px-2 py-2 text-center">
                          {availability ? (
                            <button
                              type="button"
                              onClick={() => handleCycle(availability)}
                              disabled={pendingId === availability.id}
                              title={STATUS_LABEL[availability.status]}
                              className={`inline-flex h-7 w-7 items-center justify-center rounded-md text-xs font-semibold transition-colors disabled:opacity-50 ${STATUS_CELL_CLASS[availability.status]}`}
                            >
                              {STATUS_CELL_LABEL[availability.status]}
                            </button>
                          ) : (
                            <span className="text-xs text-ink-faint">—</span>
                          )}
                        </td>
                      )
                    })}
                    <td className="border-b border-l border-line px-2 py-2 text-center text-xs font-medium text-ink-muted">
                      {attendedCount}/{weekSessions.length}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-4 text-xs text-ink-muted">
        {STATUS_CYCLE.map((status) => (
          <span key={status} className="flex items-center gap-1.5">
            <span className={`inline-flex h-5 w-5 items-center justify-center rounded ${STATUS_CELL_CLASS[status]}`}>
              {STATUS_CELL_LABEL[status]}
            </span>
            {STATUS_LABEL[status]}
          </span>
        ))}
      </div>
    </div>
  )
}
