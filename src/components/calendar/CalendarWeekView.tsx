import { useMemo } from 'react'
import type { CalendarSession, Team } from '../../store'
import { teamAccentBorderClass } from '../../lib/teamColor'
import { layoutDayColumn } from '../../lib/calendarLayout'
import { formatTimeLabel, timeToMinutes, toISODate } from '../../lib/date'

const GRID_HEIGHT_PX = 640
const DEFAULT_RANGE_START_MIN = 8 * 60 // 08:00
const DEFAULT_RANGE_END_MIN = 20 * 60 // 20:00
const DEFAULT_TIME_LABELS = ['08:00', '12:00', '16:00', '20:00']
const HEADER_ROW_HEIGHT_PX = 40

const WEEKDAY_FORMATTER = new Intl.DateTimeFormat(undefined, { weekday: 'long' })

// The original Calendar layout (see CalendarGrid.tsx's history) — every
// team's sessions for a 7-day span, positioned/sized on a shared time axis
// and split into side-by-side lanes where two teams' sessions overlap (see
// layoutDayColumn).
export function CalendarWeekView({
  days,
  teams,
  calendarSessions,
}: {
  days: Date[]
  teams: Team[]
  calendarSessions: CalendarSession[]
}) {
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

  return (
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
  )
}
