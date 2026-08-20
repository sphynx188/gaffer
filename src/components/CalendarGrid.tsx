import { useEffect, useMemo, useState } from 'react'
import { useStore } from '../store'
import { EmptyState } from './ui/EmptyState'
import { teamAccentBorderClass, teamAccentDotClass } from '../lib/teamColor'
import { layoutDayColumn } from '../lib/calendarLayout'
import { addDays, formatTimeLabel, formatWeekLabel, startOfWeek, timeToMinutes, toISODate } from '../lib/date'
import { CalendarClock } from 'lucide-react'

const GRID_HEIGHT_PX = 640
const DEFAULT_RANGE_START_MIN = 8 * 60 // 08:00
const DEFAULT_RANGE_END_MIN = 20 * 60 // 20:00
const DEFAULT_TIME_LABELS = ['08:00', '12:00', '16:00', '20:00']
const HEADER_ROW_HEIGHT_PX = 40

const WEEKDAY_FORMATTER = new Intl.DateTimeFormat(undefined, { weekday: 'long' })

// Cross-team weekly time grid — the coach-level counterpart to
// SessionPlanner's single-team week list. Every team's sessions for the
// week, positioned/sized on a shared time axis and split into side-by-side
// lanes where two teams' sessions overlap (see layoutDayColumn).
export function CalendarGrid() {
  const teams = useStore((s) => s.teams)
  const calendarSessions = useStore((s) => s.calendarSessions)
  const calendarSessionsLoading = useStore((s) => s.calendarSessionsLoading)
  const calendarSessionsError = useStore((s) => s.calendarSessionsError)
  const fetchSessionsForWeek = useStore((s) => s.fetchSessionsForWeek)

  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()))
  const weekEnd = addDays(weekStart, 6)
  const weekStartISO = toISODate(weekStart)
  const weekEndISO = toISODate(weekEnd)
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart])

  const teamIds = useMemo(() => teams.map((t) => t.id), [teams])
  const teamIdsKey = teamIds.join(',')

  useEffect(() => {
    if (teamIds.length > 0) fetchSessionsForWeek(teamIds, weekStartISO, weekEndISO)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- teamIds re-derived from teamIdsKey each render
  }, [teamIdsKey, weekStartISO, weekEndISO, fetchSessionsForWeek])

  const scheduled = useMemo(() => calendarSessions.filter((s) => s.start_time != null), [calendarSessions])

  const { rangeStartMin, pxPerMin, timeLabels } = useMemo(() => {
    const starts = scheduled.map((s) => timeToMinutes(s.start_time!))
    const ends = scheduled.map((s) => timeToMinutes(s.start_time!) + s.duration_minutes)
    const rangeStartMin = Math.min(DEFAULT_RANGE_START_MIN, ...(starts.length ? starts : [DEFAULT_RANGE_START_MIN]))
    const rangeEndMin = Math.max(DEFAULT_RANGE_END_MIN, ...(ends.length ? ends : [DEFAULT_RANGE_END_MIN]))
    const pxPerMin = GRID_HEIGHT_PX / (rangeEndMin - rangeStartMin)
    const presentTimes = Array.from(new Set(scheduled.map((s) => s.start_time!))).sort()
    return {
      rangeStartMin,
      pxPerMin,
      timeLabels: presentTimes.length > 0 ? presentTimes : DEFAULT_TIME_LABELS,
    }
  }, [scheduled])

  if (teams.length === 0) {
    return (
      <EmptyState
        icon={CalendarClock}
        message="Create a team first to see its sessions here."
        action={{ to: '/teams', label: 'Go to Teams →' }}
      />
    )
  }

  return (
    <div className="rounded-xl border border-line bg-panel">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
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

      {calendarSessionsError && <p className="px-4 py-2 text-sm text-bad">{calendarSessionsError}</p>}
      {calendarSessionsLoading && calendarSessions.length === 0 && (
        <p className="px-4 py-2 text-sm text-ink-muted">Loading…</p>
      )}

      <div className="overflow-x-auto">
        <div className="flex min-w-[720px]">
          <div className="w-14 shrink-0 border-r border-line">
            <div style={{ height: HEADER_ROW_HEIGHT_PX }} className="border-b border-line" />
            <div className="relative" style={{ height: GRID_HEIGHT_PX }}>
              {timeLabels.map((t) => (
                <span
                  key={t}
                  className="absolute left-1 -translate-y-1/2 text-[11px] text-ink-faint"
                  style={{ top: (timeToMinutes(t) - rangeStartMin) * pxPerMin }}
                >
                  {formatTimeLabel(t)}
                </span>
              ))}
            </div>
          </div>

          {days.map((day) => {
            const iso = toISODate(day)
            const daySessions = calendarSessions.filter((s) => s.date === iso)
            const laidOut = layoutDayColumn(daySessions, rangeStartMin, pxPerMin)
            return (
              <div key={iso} className="flex-1 border-r border-line last:border-r-0">
                <div
                  style={{ height: HEADER_ROW_HEIGHT_PX }}
                  className="flex flex-col justify-center border-b border-line px-2"
                >
                  <p className="truncate text-xs font-medium text-ink">{WEEKDAY_FORMATTER.format(day)}</p>
                  <p className="text-[11px] text-ink-faint">{day.getDate()}</p>
                </div>
                <div className="relative" style={{ height: GRID_HEIGHT_PX }}>
                  {laidOut.map(({ session, top, height, leftPct, widthPct }) => {
                    const team = teams.find((t) => t.id === session.team_id)
                    return (
                      <div
                        key={session.id}
                        title={`${team?.name ?? 'Unknown team'} · ${formatTimeLabel(session.start_time!)} · ${session.duration_minutes} min`}
                        className={`absolute overflow-hidden rounded-md border-l-4 bg-panel-raised px-1.5 py-1 text-[11px] leading-tight ${teamAccentBorderClass(session.team_id)}`}
                        style={{ top, height, left: `${leftPct}%`, width: `${widthPct}%` }}
                      >
                        <p className="truncate font-medium text-ink">{team?.name ?? 'Unknown team'}</p>
                        <p className="truncate text-ink-muted">{formatTimeLabel(session.start_time!)}</p>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {teams.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 border-t border-line px-4 py-3">
          {teams.map((team) => (
            <span key={team.id} className="flex items-center gap-1.5 text-xs text-ink-muted">
              <span className={`h-2 w-2 rounded-full ${teamAccentDotClass(team.id)}`} />
              {team.name}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
