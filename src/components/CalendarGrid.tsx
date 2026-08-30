import { useEffect, useMemo, useState } from 'react'
import { useStore } from '../store'
import { EmptyState } from './ui/EmptyState'
import { Skeleton } from './ui/Skeleton'
import { teamAccentDotClass } from '../lib/teamColor'
import {
  addDays,
  addMonths,
  formatDayLabel,
  formatMonthLabel,
  formatWeekLabel,
  startOfMonth,
  startOfWeek,
  toISODate,
} from '../lib/date'
import { CalendarClock } from 'lucide-react'
import { CalendarWeekView } from './calendar/CalendarWeekView'
import { CalendarDayView } from './calendar/CalendarDayView'
import { CalendarMonthView } from './calendar/CalendarMonthView'

type CalendarView = 'day' | 'week' | 'month'

const VIEW_OPTIONS: { value: CalendarView; label: string }[] = [
  { value: 'day', label: 'Day' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
]

// Cross-team calendar — every team's sessions, in a day/week/month view the
// coach picks via the toggle below. `anchorDate` is the one date each view
// is computed relative to (the day itself in Day view, the containing week
// in Week view, the containing month in Month view); switching views keeps
// the same anchor so the coach doesn't lose their place.
export function CalendarGrid() {
  const teams = useStore((s) => s.teams)
  const calendarSessions = useStore((s) => s.calendarSessions)
  const calendarSessionsLoading = useStore((s) => s.calendarSessionsLoading)
  const calendarSessionsError = useStore((s) => s.calendarSessionsError)
  const fetchSessionsForWeek = useStore((s) => s.fetchSessionsForWeek)

  const [view, setView] = useState<CalendarView>('week')
  const [anchorDate, setAnchorDate] = useState(() => new Date())

  const weekStart = startOfWeek(anchorDate)
  const weekEnd = addDays(weekStart, 6)
  const monthGridStart = startOfWeek(startOfMonth(anchorDate))
  const monthGridEnd = addDays(monthGridStart, 41) // 6 full weeks, aligned to Monday

  const { rangeStartISO, rangeEndISO } = useMemo(() => {
    if (view === 'day') {
      const iso = toISODate(anchorDate)
      return { rangeStartISO: iso, rangeEndISO: iso }
    }
    if (view === 'month') {
      return { rangeStartISO: toISODate(monthGridStart), rangeEndISO: toISODate(monthGridEnd) }
    }
    return { rangeStartISO: toISODate(weekStart), rangeEndISO: toISODate(weekEnd) }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- weekStart/weekEnd/monthGridStart/monthGridEnd are derived from anchorDate each render
  }, [view, anchorDate])

  const days = useMemo(() => {
    if (view === 'week') return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
    if (view === 'month') return Array.from({ length: 42 }, (_, i) => addDays(monthGridStart, i))
    return []
    // eslint-disable-next-line react-hooks/exhaustive-deps -- weekStart/monthGridStart derived from anchorDate each render
  }, [view, anchorDate])

  const teamIds = useMemo(() => teams.map((t) => t.id), [teams])
  const teamIdsKey = teamIds.join(',')

  useEffect(() => {
    if (teamIds.length > 0) fetchSessionsForWeek(teamIds, rangeStartISO, rangeEndISO)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- teamIds re-derived from teamIdsKey each render
  }, [teamIdsKey, rangeStartISO, rangeEndISO, fetchSessionsForWeek])

  if (teams.length === 0) {
    return (
      <EmptyState
        icon={CalendarClock}
        message="Create a team first to see its sessions here."
        action={{ to: '/teams', label: 'Go to Teams →' }}
      />
    )
  }

  const title =
    view === 'day'
      ? formatDayLabel(anchorDate)
      : view === 'month'
        ? formatMonthLabel(anchorDate)
        : formatWeekLabel(weekStart, weekEnd)

  const step = (direction: 1 | -1) => {
    setAnchorDate((d) => {
      if (view === 'day') return addDays(d, direction)
      if (view === 'month') return addMonths(d, direction)
      return addDays(d, 7 * direction)
    })
  }

  return (
    <div className="rounded-lg border border-line bg-panel">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
        <h2 className="text-sm font-semibold text-ink">{title}</h2>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-0.5 rounded-md border border-line p-0.5">
            {VIEW_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setView(opt.value)}
                aria-pressed={view === opt.value}
                className={`rounded px-2 py-1 text-xs font-medium transition-colors ${
                  view === opt.value ? 'bg-accent/15 text-accent-ink' : 'text-ink-muted hover:text-ink'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => step(-1)}
              aria-label={`Previous ${view}`}
              className="rounded-md border border-line px-2 py-1 text-xs text-ink-muted"
            >
              ← Prev
            </button>
            <button
              type="button"
              onClick={() => setAnchorDate(new Date())}
              className="rounded-md border border-line px-2 py-1 text-xs text-ink-muted"
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => step(1)}
              aria-label={`Next ${view}`}
              className="rounded-md border border-line px-2 py-1 text-xs text-ink-muted"
            >
              Next →
            </button>
          </div>
        </div>
      </div>

      {calendarSessionsError && <p className="px-4 py-2 text-sm text-bad">{calendarSessionsError}</p>}
      {calendarSessionsLoading && calendarSessions.length === 0 && (
        <div role="status" aria-busy="true" className="flex items-center gap-2 px-4 py-2">
          <span className="sr-only">Loading calendar…</span>
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-20" />
        </div>
      )}

      {view === 'day' && <CalendarDayView teams={teams} calendarSessions={calendarSessions} />}
      {view === 'week' && <CalendarWeekView days={days} teams={teams} calendarSessions={calendarSessions} />}
      {view === 'month' && (
        <CalendarMonthView days={days} monthAnchor={anchorDate} teams={teams} calendarSessions={calendarSessions} />
      )}

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
