import { useEffect, useMemo, useState } from 'react'
import { useStore } from '../store'
import { PageHeader } from '../components/ui/PageHeader'
import { Card } from '../components/ui/Card'
import { AvailabilityPanel } from '../components/AvailabilityPanel'

function toISODate(d: Date): string {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function formatDateLabel(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

// New — promotes availability from a toggle buried inside each session row
// (SessionPlanner) to its own page. Reuses AvailabilityPanel exactly as-is
// (it only needs a `session` prop) so the actual save/update logic isn't
// duplicated — this page is purely "pick a session, see/edit its full
// attendance grid at a glance" instead of expanding one row at a time.
export function AttendancePage() {
  const selectedTeamId = useStore((s) => s.selectedTeamId)
  const sessions = useStore((s) => s.sessions)
  const sessionsLoading = useStore((s) => s.sessionsLoading)
  const fetchSessions = useStore((s) => s.fetchSessions)
  const fetchPlayers = useStore((s) => s.fetchPlayers)

  const [sessionId, setSessionId] = useState<string | null>(null)

  useEffect(() => {
    if (!selectedTeamId) return
    fetchSessions(selectedTeamId)
    fetchPlayers(selectedTeamId)
  }, [selectedTeamId, fetchSessions, fetchPlayers])

  const sortedSessions = useMemo(() => [...sessions].sort((a, b) => a.date.localeCompare(b.date)), [sessions])

  const todayISO = toISODate(new Date())

  // Default to the next upcoming session (falling back to the most recent
  // past one if there's nothing ahead) — same "land somewhere useful, not
  // an empty picker" reasoning SessionPlanner uses for the current week.
  useEffect(() => {
    if (sessionId && sortedSessions.some((s) => s.id === sessionId)) return
    const nextUpcoming = sortedSessions.find((s) => s.date >= todayISO)
    setSessionId(nextUpcoming?.id ?? sortedSessions[sortedSessions.length - 1]?.id ?? null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortedSessions])

  const session = sortedSessions.find((s) => s.id === sessionId) ?? null

  if (!selectedTeamId) {
    return (
      <div>
        <PageHeader title="Attendance" />
        <p className="text-sm text-slate-400">Create a team first to track attendance.</p>
      </div>
    )
  }

  return (
    <div>
      <PageHeader title="Attendance" description="See who's confirmed for a session, and chase the rest." />

      {sessionsLoading && sortedSessions.length === 0 && <p className="text-sm text-slate-400">Loading sessions…</p>}
      {!sessionsLoading && sortedSessions.length === 0 && (
        <Card className="border-dashed text-center">
          <p className="text-sm text-slate-400">No sessions yet — plan one first.</p>
        </Card>
      )}

      {sortedSessions.length > 0 && (
        <Card>
          <div className="mb-2 flex flex-wrap items-center gap-3">
            <label htmlFor="attendance-session" className="text-xs font-medium text-slate-500">
              Session
            </label>
            <select
              id="attendance-session"
              value={sessionId ?? ''}
              onChange={(e) => setSessionId(e.target.value)}
              className="rounded-md border border-slate-300 px-2 py-1.5 text-sm text-slate-900 outline-none focus:border-slate-500"
            >
              {sortedSessions.map((s) => (
                <option key={s.id} value={s.id}>
                  {formatDateLabel(s.date)} · {s.duration_minutes} min
                </option>
              ))}
            </select>
            {session && (
              <span className="text-xs text-slate-400">
                {session.availability.filter((a) => a.status === 'available').length} available ·{' '}
                {session.availability.filter((a) => a.status === 'unavailable').length} unavailable ·{' '}
                {session.availability.filter((a) => a.status === 'unconfirmed').length} unconfirmed
              </span>
            )}
          </div>

          {session && <AvailabilityPanel session={session} />}
        </Card>
      )}
    </div>
  )
}
