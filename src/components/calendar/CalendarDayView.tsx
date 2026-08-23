import { useMemo } from 'react'
import type { CalendarSession, Team } from '../../store'
import { teamAccentBorderClass } from '../../lib/teamColor'
import { layoutDayColumn } from '../../lib/calendarLayout'
import { formatTimeLabel, minutesToTime, timeToMinutes } from '../../lib/date'
import { EmptyState } from '../ui/EmptyState'
import { CalendarClock } from 'lucide-react'

const GRID_HEIGHT_PX = 640
const DEFAULT_RANGE_START_MIN = 8 * 60 // 08:00
const DEFAULT_RANGE_END_MIN = 20 * 60 // 20:00
// Fixed px-per-minute — see the matching constant in CalendarWeekView.tsx
// for why this can't be derived from the visible range. Same constants
// here as there (640px / 08:00–20:00) so a session renders at the same
// height whether you're looking at it in Day or Week view.
const PX_PER_MIN = GRID_HEIGHT_PX / (DEFAULT_RANGE_END_MIN - DEFAULT_RANGE_START_MIN)
// See the matching constant/comment in CalendarWeekView.tsx — fixed 2-hour
// marks starting at 08:00, not the exact start times of whatever's
// scheduled, so the axis looks the same whether the day is empty or full.
const LABEL_INTERVAL_MIN = 2 * 60

// Single-day counterpart to CalendarWeekView — same time-axis math and lane
// layout (layoutDayColumn), just one column instead of seven, so a session
// card has room to show its full time range rather than just a start time.
export function CalendarDayView({ teams, calendarSessions }: { teams: Team[]; calendarSessions: CalendarSession[] }) {
  const scheduled = useMemo(() => calendarSessions.filter((s) => s.start_time != null), [calendarSessions])

  const { rangeStartMin, gridHeightPx, timeLabelMins } = useMemo(() => {
    const starts = scheduled.map((s) => timeToMinutes(s.start_time!))
    const ends = scheduled.map((s) => timeToMinutes(s.start_time!) + s.duration_minutes)
    const rangeStartMin = Math.min(DEFAULT_RANGE_START_MIN, ...(starts.length ? starts : [DEFAULT_RANGE_START_MIN]))
    const rangeEndMin = Math.max(DEFAULT_RANGE_END_MIN, ...(ends.length ? ends : [DEFAULT_RANGE_END_MIN]))
    const labelMins: number[] = []
    for (let m = DEFAULT_RANGE_START_MIN; m <= rangeEndMin; m += LABEL_INTERVAL_MIN) labelMins.push(m)
    return {
      rangeStartMin,
      gridHeightPx: (rangeEndMin - rangeStartMin) * PX_PER_MIN,
      timeLabelMins: labelMins,
    }
  }, [scheduled])

  const laidOut = useMemo(
    () => layoutDayColumn(calendarSessions, rangeStartMin, PX_PER_MIN),
    [calendarSessions, rangeStartMin]
  )

  return (
    <div className="flex">
      <div className="w-14 shrink-0 border-r border-line">
        <div className="relative" style={{ height: gridHeightPx }}>
          {timeLabelMins.map((m) => (
            <span
              key={m}
              className="absolute left-1 -translate-y-1/2 text-[11px] text-ink-faint"
              style={{ top: (m - rangeStartMin) * PX_PER_MIN }}
            >
              {formatTimeLabel(minutesToTime(m))}
            </span>
          ))}
        </div>
      </div>
      <div className="relative flex-1" style={{ height: gridHeightPx }}>
        {calendarSessions.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center">
            <EmptyState icon={CalendarClock} message="No sessions scheduled for this day." />
          </div>
        )}
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
