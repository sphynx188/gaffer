import type { CalendarSession, Team } from '../../store'
import { teamAccentDotClass } from '../../lib/teamColor'
import { formatTimeLabel, isSameDay, toISODate } from '../../lib/date'

const MAX_VISIBLE_PER_DAY = 3

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

// 6-week grid (the maximum any month can span when aligned to a Monday
// start), each cell listing that day's sessions as compact team-dot + time
// chips rather than the full time-axis layout WeekView/DayView use — a
// month has too little vertical room per day for that.
export function CalendarMonthView({
  days,
  monthAnchor,
  teams,
  calendarSessions,
}: {
  days: Date[]
  monthAnchor: Date
  teams: Team[]
  calendarSessions: CalendarSession[]
}) {
  const today = new Date()

  return (
    <div>
      <div className="grid grid-cols-7 border-b border-line">
        {WEEKDAY_LABELS.map((label) => (
          <div key={label} className="border-r border-line px-2 py-2 text-[11px] font-medium text-ink-faint last:border-r-0">
            {label}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 auto-rows-fr">
        {days.map((day) => {
          const iso = toISODate(day)
          const inMonth = day.getMonth() === monthAnchor.getMonth()
          const daySessions = calendarSessions
            .filter((s) => s.date === iso)
            .sort((a, b) => (a.start_time ?? '').localeCompare(b.start_time ?? ''))
          const visible = daySessions.slice(0, MAX_VISIBLE_PER_DAY)
          const overflow = daySessions.length - visible.length
          return (
            <div
              key={iso}
              className={`min-h-24 border-r border-b border-line px-1.5 py-1.5 last:border-r-0 ${inMonth ? '' : 'bg-surface/50'}`}
            >
              <p
                className={`mb-1 text-[11px] ${
                  isSameDay(day, today)
                    ? 'inline-flex h-5 w-5 items-center justify-center rounded-full bg-accent font-semibold text-white'
                    : inMonth
                      ? 'text-ink-muted'
                      : 'text-ink-faint'
                }`}
              >
                {day.getDate()}
              </p>
              <div className="space-y-0.5">
                {visible.map((session) => {
                  const team = teams.find((t) => t.id === session.team_id)
                  return (
                    <div
                      key={session.id}
                      title={`${team?.name ?? 'Unknown team'}${session.start_time ? ` · ${formatTimeLabel(session.start_time)}` : ''}`}
                      className="flex items-center gap-1 truncate rounded bg-panel-raised px-1 py-0.5 text-[10px] text-ink-muted"
                    >
                      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${teamAccentDotClass(session.team_id)}`} />
                      <span className="truncate">
                        {session.start_time ? formatTimeLabel(session.start_time) : ''} {team?.name ?? 'Unknown team'}
                      </span>
                    </div>
                  )
                })}
                {overflow > 0 && <p className="px-1 text-[10px] text-ink-faint">+{overflow} more</p>}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
