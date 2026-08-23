// Sessions are plain Postgres `date` columns (no time component) and are
// always handled as 'YYYY-MM-DD' strings — comparing/sorting them
// lexicographically is safe and avoids the timezone footguns of `new
// Date(iso)` (which parses as UTC midnight and can land on the wrong local
// day). `parseLocalDate` is the one place an ISO date string becomes a
// `Date`, and it always does so in local time. Originally lived in
// SessionPlanner.tsx; moved here once the Calendar view needed the same
// week-math too.
export function parseLocalDate(iso: string): Date {
  const [year, month, day] = iso.split('-').map(Number)
  return new Date(year, month - 1, day)
}

export function toISODate(d: Date): string {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function addDays(d: Date, days: number): Date {
  const date = new Date(d)
  date.setDate(date.getDate() + days)
  return date
}

// Monday-start week — matches how a coach thinks about a training week
// (Mon–Sun), not the calendar-week default.
export function startOfWeek(d: Date): Date {
  const date = new Date(d)
  const day = date.getDay() // 0 = Sun, 1 = Mon, ... 6 = Sat
  const diff = (day === 0 ? -6 : 1) - day
  date.setDate(date.getDate() + diff)
  date.setHours(0, 0, 0, 0)
  return date
}

export function formatWeekLabel(start: Date, end: Date): string {
  const startLabel = start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  const endLabel = end.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
  return `${startLabel} – ${endLabel}`
}

export function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

export function addMonths(d: Date, months: number): Date {
  const date = new Date(d)
  date.setMonth(date.getMonth() + months)
  return date
}

export function formatMonthLabel(d: Date): string {
  return d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
}

export function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

export function formatDayLabel(d: Date): string {
  return d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })
}

// Postgres `time` columns round-trip through PostgREST as "HH:MM:SS" —
// <input type="time"> only accepts/emits "HH:MM".
export function toTimeInputValue(t: string): string {
  return t.slice(0, 5)
}

export function formatTimeLabel(t: string): string {
  const [h, m] = t.split(':').map(Number)
  const date = new Date(2000, 0, 1, h, m)
  return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}

// Minutes-since-midnight, for the Calendar grid's time-axis math.
export function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

// Inverse of timeToMinutes — used to generate the Calendar grid's y-axis
// labels at fixed clock marks (see CalendarWeekView/DayView) rather than
// deriving them from whatever sessions happen to exist.
export function minutesToTime(min: number): string {
  const h = Math.floor(min / 60)
  const m = min % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}
