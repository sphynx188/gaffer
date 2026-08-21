import { useMemo } from 'react'
import type { CalendarSession, Team } from '../../store'
import { teamAccentBorderClass } from '../../lib/teamColor'
import { layoutDayColumn } from '../../lib/calendarLayout'
import { formatTimeLabel, timeToMinutes } from '../../lib/date'
import { EmptyState } from '../ui/EmptyState'
import { CalendarClock } from 'lucide-react'

const GRID_HEIGHT_PX = 640
const DEFAULT_RANGE_START_MIN = 8 * 60 // 08:00
const DEFAULT_RANGE_END_MIN = 20 * 60 // 20:00
const DEFAULT_TIME_LABELS = ['08:00', '12:00', '16:00', '20:00']

// Single-day counterpart to CalendarWeekView — same time-axis math and lane
// layout (layoutDayColumn), just one column instead of seven, so a session
// card has room to show its full time range rather than just a start time.
export function CalendarDayView({ teams, calendarSessions }: { teams: Team[]; calendarSessions: CalendarSession[] }) {
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

  const laidOut = useMemo(
    () => layoutDayColumn(calendarSessions, rangeStartMin, pxPerMin),
    [calendarSessions, rangeStartMin, pxPerMin]
  )

  if (calendarSessions.length === 0) {
    return <EmptyState icon={CalendarClock} message="No sessions scheduled for this day." />
  }

  return (
    <div className="flex">
      <div className="w-14 shrink-0 border-r border-line">
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
      <div className="relative flex-1" style={{ height: GRID_HEIGHT_PX }}>
        {laidOut.map(({ session, top, height, leftPct, widthPct }) => {
          const team = teams.find((t) => t.id === session.team_id)
          return (
            <div
              key={session.id}
              className={`absolute overflow-hidden rounded-md border-l-4 bg-panel-raised px-3 py-2 text-sm leading-tight ${teamAccentBorderClass(session.team_id)}`}
              style={{ top, height, left: `${leftPct}%`, width: `${widthPct}%` }}
            >
              <p className="truncate font-medium text-ink">{team?.name ?? 'Unknown team'}</p>
              <p className="truncate text-xs text-ink-muted">
                {formatTimeLabel(session.start_time!)} · {session.duration_minutes} min
              </p>
            </div>
          )
        })}
      </div>
    </div>
  )
}
