import { useMemo } from 'react'
import type { CalendarSession, Team } from '../../store'
import { teamAccentBorderClass } from '../../lib/teamColor'
import { layoutDayColumn } from '../../lib/calendarLayout'
import { formatTimeLabel, minutesToTime, timeToMinutes, toISODate } from '../../lib/date'

const GRID_HEIGHT_PX = 640
const DEFAULT_RANGE_START_MIN = 8 * 60 // 08:00
const DEFAULT_RANGE_END_MIN = 20 * 60 // 20:00
// Fixed px-per-minute, derived once from the default 08:00–20:00/640px
// grid — never recomputed from whatever sessions happen to be on screen.
// It used to be `GRID_HEIGHT_PX / (rangeEnd - rangeStart)`, which meant an
// outlier session (a 07:00 start, a 21:00 finish) shrank every session's
// rendered height that week to keep the grid at a fixed 640px — so the same
// 60-minute session could render at a different height depending on what
// else was scheduled that week. Now the range grows to fit outliers instead
// of the scale shrinking to fit the range: an early/late session makes the
// grid taller (more to scroll), not the time axis denser.
const PX_PER_MIN = GRID_HEIGHT_PX / (DEFAULT_RANGE_END_MIN - DEFAULT_RANGE_START_MIN)
// Y-axis labels sit at fixed 2-hour marks starting at 08:00 (08:00, 10:00,
// 12:00, ...) rather than at wherever sessions happen to start. They used
// to switch to the exact start times of whatever was scheduled once any
// session existed — so the axis read completely differently with sessions
// on it than without, which was the real "scale is off" complaint: not
// just pixel height, but the labels themselves changing. Anchoring to a
// fixed start and interval means the axis looks the same whether the day
// is empty or full; an early outlier session can extend the grid earlier
// than 08:00, but labels still only start at 08:00 and step forward from
// there, however far the range now extends.
const LABEL_INTERVAL_MIN = 2 * 60
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

  return (
    <div className="overflow-x-auto">
      <div className="flex min-w-[720px]">
        <div className="w-14 shrink-0 border-r border-line">
          <div style={{ height: HEADER_ROW_HEIGHT_PX }} className="border-b border-line" />
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

        {days.map((day) => {
          const iso = toISODate(day)
          const daySessions = calendarSessions.filter((s) => s.date === iso)
          const laidOut = layoutDayColumn(daySessions, rangeStartMin, PX_PER_MIN)
          return (
            <div key={iso} className="flex-1 border-r border-line last:border-r-0">
              <div
                style={{ height: HEADER_ROW_HEIGHT_PX }}
                className="flex flex-col justify-center border-b border-line px-2"
              >
                <p className="truncate text-xs font-medium text-ink">{WEEKDAY_FORMATTER.format(day)}</p>
                <p className="text-[11px] text-ink-faint">{day.getDate()}</p>
              </div>
              <div className="relative" style={{ height: gridHeightPx }}>
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
