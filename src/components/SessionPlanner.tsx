import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useLocation } from 'react-router-dom'
import { useStore } from '../store'
import type { RecurringSessionInput, SessionWithRelations } from '../store'
import { AvailabilityPanel } from './AvailabilityPanel'
import { SessionDrillsPanel } from './SessionDrillsPanel'
import {
  addDays,
  formatDayLabel,
  formatTimeLabel,
  formatWeekLabel,
  parseLocalDate,
  startOfWeek,
  toISODate,
  toTimeInputValue,
} from '../lib/date'

const WEEKDAY_OPTIONS: { value: number; label: string }[] = [
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
  { value: 0, label: 'Sun' },
]

interface SessionFormValues {
  date: string
  duration_minutes: number
  start_time: string
  coaching_notes: string | null
  season_label: string | null
}

const EMPTY_SESSIONS: SessionWithRelations[] = []

// Phase 1.5 — Weekly session planner (US-7, gaffer_mvp_build_steps.md).
// Mirrors TeamManagement/PlayerRoster's create-form + inline-edit-row
// pattern. Definition of Done: a session holds date/duration/coaching
// notes; the week view shows all of a team's sessions for that week in one
// screen, from the single embedded fetch sessionSlice already does (see
// SessionWithRelations) rather than a per-row request. Scoped by the
// store's `selectedTeamId` (teamSlice), same as every other Phase 1 view,
// so switching teams never bleeds one team's sessions into another's.
// (physical_load/equipment fields dropped — see
// supabase/migrations/009_drop_player_dob_and_session_extras.sql — they
// went unused.)
//
// Recurring schedules (below, RecurringScheduleForm): not their own concept
// or table — generates one ordinary `session` row per matching weekday in
// a date range (sessionSlice.createRecurringSessions), each independently
// editable/deletable afterward exactly like a one-off session.
//
// Phase 1.7 — Season label tagging (US-9, gaffer_mvp_build_steps.md): adds
// an optional free-text `season_label` input to both the create and edit
// forms below. The column, store types, and sessionSlice read/write already
// carried `season_label` end-to-end (see store/types.ts, sessionSlice.ts,
// schema.sql) — this phase is purely the missing form field. Definition of
// Done: the field exists, saves, and reloads correctly; leaving it blank
// has no side effects anywhere else in the app (it's sent as `null`, not
// an empty string, so it round-trips cleanly through Postgres `text`).
//
// Phase 2d — Save as reusable / attach to session (US-14, US-15): adds a
// "Drills" toggle next to "Availability" on each SessionRow, mirroring that
// exact expandable-panel pattern, which mounts SessionDrillsPanel — pick a
// drill, attach it with a planned duration/notes for this session, reorder
// or remove it. `session.session_drills.length` in the summary line below
// updates the moment a drill is attached/detached (sessionDrillSlice patches
// the nested array directly), not just after the next full page reload.
//
// Phase 3.2 — Duplicate a past session (US-16): adds a "Duplicate" toggle
// next to Availability/Drills/Edit on each SessionRow, which opens a small
// inline form for the new date (defaulting to one week later) and calls
// sessionSlice.duplicateSession — the `duplicate_session` Postgres RPC
// (supabase/migrations/003_duplicate_session_rpc.sql) copies the session's
// drill line-up atomically; availability is deliberately NOT copied (the
// new session gets fresh unconfirmed rows, same as any new session). A
// successful duplicate jumps the week view to the new session's date, same
// as handleCreate already does for a session created outside the current
// week.
export function SessionPlanner() {
  const selectedTeamId = useStore((s) => s.selectedTeamId)
  const sessions = useStore((s) => s.sessions ?? EMPTY_SESSIONS)
  const sessionsLoading = useStore((s) => s.sessionsLoading)
  const sessionsError = useStore((s) => s.sessionsError)
  const fetchSessions = useStore((s) => s.fetchSessions)
  const createSession = useStore((s) => s.createSession)
  const createRecurringSessions = useStore((s) => s.createRecurringSessions)
  const updateSession = useStore((s) => s.updateSession)
  const duplicateSession = useStore((s) => s.duplicateSession)

  // Dashboard's "upcoming this week" list links here with the clicked
  // session's date in navigation state, so clicking a session lands on the
  // week it's actually in rather than always the current week.
  const location = useLocation()
  const focusDate = (location.state as { focusDate?: string } | null)?.focusDate
  const [weekStart, setWeekStart] = useState(() =>
    startOfWeek(focusDate ? parseLocalDate(focusDate) : new Date())
  )

  useEffect(() => {
    if (selectedTeamId) fetchSessions(selectedTeamId)
  }, [selectedTeamId, fetchSessions])

  const weekEnd = addDays(weekStart, 6)
  const weekStartISO = toISODate(weekStart)
  const weekEndISO = toISODate(weekEnd)

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart])

  const sessionsByDay = useMemo(() => {
    const map = new Map<string, SessionWithRelations[]>()
    for (const session of sessions) {
      if (session.date < weekStartISO || session.date > weekEndISO) continue
      const list = map.get(session.date) ?? []
      list.push(session)
      map.set(session.date, list)
    }
    return map
  }, [sessions, weekStartISO, weekEndISO])

  // A session created for a date outside the currently displayed week would
  // otherwise silently vanish from view the moment it's added — jump the
  // week view to wherever it landed instead.
  const handleCreate = async (input: { team_id: string } & SessionFormValues) => {
    const created = await createSession(input)
    if (created) {
      const createdWeekStart = startOfWeek(parseLocalDate(created.date))
      if (toISODate(createdWeekStart) !== weekStartISO) setWeekStart(createdWeekStart)
    }
    return created
  }

  // Phase 3.2 — Duplicate a past session (US-16): same "jump the week view
  // to wherever the new row landed" affordance handleCreate already has —
  // a coach duplicating last Tuesday's session onto next Tuesday would
  // otherwise have the new session silently created outside the currently
  // displayed week.
  const handleDuplicate = async (sourceSessionId: string, newDate: string) => {
    const created = await duplicateSession(sourceSessionId, newDate)
    if (created) {
      const createdWeekStart = startOfWeek(parseLocalDate(created.date))
      if (toISODate(createdWeekStart) !== weekStartISO) setWeekStart(createdWeekStart)
    }
    return created
  }

  // Same "jump to wherever it landed" affordance as handleCreate — a
  // recurring schedule starting next month would otherwise generate a
  // batch of sessions with no visible change on the currently displayed
  // week.
  const [recurringOpen, setRecurringOpen] = useState(false)
  const handleCreateRecurring = async (input: RecurringSessionInput) => {
    const created = await createRecurringSessions(input)
    if (created.length > 0) {
      const firstWeekStart = startOfWeek(parseLocalDate(created[0].date))
      if (toISODate(firstWeekStart) !== weekStartISO) setWeekStart(firstWeekStart)
    }
    return created
  }

  // Click-a-date-to-create: which day's inline create form (if any) is open.
  // Only one at a time — opening a new one implicitly closes any other, and
  // a successful create closes it again rather than leaving a stale empty
  // form sitting open under the newly-added session.
  const [creatingDate, setCreatingDate] = useState<string | null>(null)

  const handleCreateForDate = async (input: { team_id: string } & SessionFormValues) => {
    const created = await handleCreate(input)
    if (created) setCreatingDate(null)
    return created
  }

  if (!selectedTeamId) {
    return (
      <section className="space-y-4 text-left">
        <p className="text-sm text-ink-muted">Create a team first to start planning sessions.</p>
      </section>
    )
  }

  return (
    <section className="space-y-4 text-left">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-ink">
          Week of {formatWeekLabel(weekStart, weekEnd)}
        </h2>
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

      {sessionsError && <p className="text-sm text-bad">{sessionsError}</p>}
      {sessionsLoading && sessions.length === 0 && <p className="text-sm text-ink-muted">Loading…</p>}

      <ul className="space-y-2">
        {days.map((day) => {
          const iso = toISODate(day)
          const daySessions = sessionsByDay.get(iso) ?? EMPTY_SESSIONS
          const isCreating = creatingDate === iso
          return (
            <li key={iso} className="rounded-md border border-line px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                {/* Click the date to create a session on that day — opens
                    the inline form below, pre-filled with this day's date.
                    Toggles closed on a second click. */}
                <button
                  type="button"
                  onClick={() => setCreatingDate((d) => (d === iso ? null : iso))}
                  aria-expanded={isCreating}
                  className="text-xs font-medium text-ink-muted underline decoration-dotted underline-offset-2 hover:text-ink"
                >
                  {formatDayLabel(day)}
                </button>
                {!isCreating && (
                  <button
                    type="button"
                    onClick={() => setCreatingDate(iso)}
                    className="text-xs text-ink-faint underline underline-offset-2 hover:text-ink-muted"
                  >
                    + Add session
                  </button>
                )}
              </div>
              {daySessions.length === 0 && !isCreating && (
                <p className="mt-1 text-sm text-ink-faint">No session</p>
              )}
              {daySessions.length > 0 && (
                <ul className="mt-1.5 space-y-1.5">
                  {daySessions.map((session) => (
                    <SessionRow
                      key={session.id}
                      session={session}
                      onSave={updateSession}
                      onDuplicate={handleDuplicate}
                    />
                  ))}
                </ul>
              )}
              {isCreating && (
                <div className="mt-2 border-t border-line pt-2">
                  <CreateSessionForm
                    teamId={selectedTeamId}
                    onCreate={handleCreateForDate}
                    initialDate={iso}
                    onCancel={() => setCreatingDate(null)}
                    compact
                  />
                </div>
              )}
            </li>
          )
        })}
      </ul>

      <CreateSessionForm teamId={selectedTeamId} onCreate={handleCreate} />

      {recurringOpen ? (
        <RecurringScheduleForm
          teamId={selectedTeamId}
          onCreate={handleCreateRecurring}
          onCancel={() => setRecurringOpen(false)}
        />
      ) : (
        <button
          type="button"
          onClick={() => setRecurringOpen(true)}
          className="text-sm font-medium text-accent hover:text-accent-hover"
        >
          + Add a recurring schedule
        </button>
      )}
    </section>
  )
}

function SessionRow({
  session,
  onSave,
  onDuplicate,
}: {
  session: SessionWithRelations
  onSave: (
    id: string,
    patch: Partial<SessionFormValues>
  ) => Promise<SessionWithRelations | null>
  onDuplicate: (sourceSessionId: string, newDate: string) => Promise<SessionWithRelations | null>
}) {
  const [editing, setEditing] = useState(false)
  const [availabilityOpen, setAvailabilityOpen] = useState(false)
  const [drillsOpen, setDrillsOpen] = useState(false)
  const [date, setDate] = useState(session.date)
  const [duration, setDuration] = useState(String(session.duration_minutes))
  const [startTime, setStartTime] = useState(session.start_time ? toTimeInputValue(session.start_time) : '')
  const [notes, setNotes] = useState(session.coaching_notes ?? '')
  const [seasonLabel, setSeasonLabel] = useState(session.season_label ?? '')
  const [saving, setSaving] = useState(false)

  // Phase 3.2 — Duplicate a past session (US-16). Mirrors the expandable-
  // panel-below-the-row pattern Availability/Drills already use, rather than
  // a bare `prompt()` for the new date — every other input in this app is a
  // controlled form field. Defaults to one week after the source session's
  // own date (the most common "repeat this session next week" case), still
  // editable before confirming.
  const [duplicating, setDuplicating] = useState(false)
  const [duplicateDate, setDuplicateDate] = useState(() => toISODate(addDays(parseLocalDate(session.date), 7)))
  const [duplicateSubmitting, setDuplicateSubmitting] = useState(false)

  const startEdit = () => {
    setDate(session.date)
    setDuration(String(session.duration_minutes))
    setStartTime(session.start_time ? toTimeInputValue(session.start_time) : '')
    setNotes(session.coaching_notes ?? '')
    setSeasonLabel(session.season_label ?? '')
    setEditing(true)
  }

  const handleSave = async (e: FormEvent) => {
    e.preventDefault()
    if (!date || !duration || !startTime || saving) return
    setSaving(true)
    const saved = await onSave(session.id, {
      date,
      duration_minutes: Number(duration),
      start_time: startTime,
      coaching_notes: notes.trim() || null,
      season_label: seasonLabel.trim() || null,
    })
    setSaving(false)
    if (saved) setEditing(false)
  }

  const toggleDuplicating = () => {
    if (!duplicating) setDuplicateDate(toISODate(addDays(parseLocalDate(session.date), 7)))
    setDuplicating((open) => !open)
  }

  const handleDuplicateSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!duplicateDate || duplicateSubmitting) return
    setDuplicateSubmitting(true)
    const created = await onDuplicate(session.id, duplicateDate)
    setDuplicateSubmitting(false)
    if (created) setDuplicating(false)
  }

  if (!editing) {
    // Phase 1.6 — Availability per session (US-8): every team player gets a
    // seeded row on session creation (sessionSlice.createSession), so
    // session.availability.length is the roster size, not a response count
    // — "responded" is whoever has moved off the unconfirmed default,
    // tracked by responded_at being set (availabilitySlice.updateAvailability
    // always stamps it).
    const respondedCount = session.availability.filter((a) => a.responded_at).length
    return (
      <li className="rounded-md border border-line bg-panel-raised px-3 py-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-40">
            <p className="flex flex-wrap items-center gap-1.5 text-sm font-medium text-ink">
              {session.start_time && `${formatTimeLabel(session.start_time)} · `}
              {session.duration_minutes} min
              {session.season_label && <span className="font-normal text-ink-muted">· {session.season_label}</span>}
            </p>
            <p className="text-xs text-ink-muted">{session.coaching_notes || '—'}</p>
            <p className="mt-1 text-xs text-ink-muted">
              {respondedCount}/{session.availability.length} attendance recorded ·{' '}
              {session.session_drills.length} drill(s) attached
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <button
              type="button"
              onClick={() => setAvailabilityOpen((open) => !open)}
              className="text-sm text-ink-muted underline underline-offset-2"
            >
              {availabilityOpen ? 'Hide attendance' : 'Attendance'}
            </button>
            <button
              type="button"
              onClick={() => setDrillsOpen((open) => !open)}
              className="text-sm text-ink-muted underline underline-offset-2"
            >
              {drillsOpen ? 'Hide drills' : 'Drills'}
            </button>
            <button
              type="button"
              onClick={toggleDuplicating}
              className="text-sm text-ink-muted underline underline-offset-2"
            >
              {duplicating ? 'Cancel duplicate' : 'Duplicate'}
            </button>
            <button
              type="button"
              onClick={startEdit}
              className="text-sm text-ink-muted underline underline-offset-2"
            >
              Edit
            </button>
          </div>
        </div>
        {availabilityOpen && <AvailabilityPanel session={session} />}
        {drillsOpen && <SessionDrillsPanel session={session} />}
        {duplicating && (
          <form
            onSubmit={handleDuplicateSubmit}
            className="mt-3 flex flex-wrap items-end gap-2 border-t border-line pt-3"
          >
            <div>
              <label className="block text-xs font-medium text-ink-muted">Duplicate to date</label>
              <input
                type="date"
                required
                value={duplicateDate}
                onChange={(e) => setDuplicateDate(e.target.value)}
                className="mt-1 rounded-md border border-line bg-panel-raised px-2 py-1.5 text-sm text-ink outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/30"
              />
            </div>
            <button
              type="submit"
              disabled={!duplicateDate || duplicateSubmitting}
              className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50"
            >
              {duplicateSubmitting ? 'Duplicating…' : 'Duplicate session'}
            </button>
            <button
              type="button"
              onClick={() => setDuplicating(false)}
              className="px-2 py-1.5 text-sm text-ink-muted"
            >
              Cancel
            </button>
            <p className="w-full text-xs text-ink-muted">
              Copies the drill line-up ({session.session_drills.length} drill(s)) to the new date. Attendance is
              not copied — the new session starts with fresh, unconfirmed attendance.
            </p>
          </form>
        )}
      </li>
    )
  }

  return (
    <li className="rounded-md border border-line-strong px-3 py-2">
      <form onSubmit={handleSave} className="flex flex-wrap items-end gap-2">
        <div>
          <label className="block text-xs font-medium text-ink-muted">Date</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="mt-1 rounded-md border border-line bg-panel-raised px-2 py-1.5 text-sm text-ink outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/30"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-ink-muted">Start time</label>
          <input
            type="time"
            required
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            className="mt-1 rounded-md border border-line bg-panel-raised px-2 py-1.5 text-sm text-ink outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/30"
          />
        </div>
        <div className="w-24">
          <label className="block text-xs font-medium text-ink-muted">Minutes</label>
          <input
            type="number"
            min={1}
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            className="mt-1 w-full rounded-md border border-line bg-panel-raised px-2 py-1.5 text-sm text-ink outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/30"
          />
        </div>
        <div className="w-full">
          <label className="block text-xs font-medium text-ink-muted">Coaching notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="mt-1 w-full rounded-md border border-line bg-panel-raised px-2 py-1.5 text-sm text-ink outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/30"
          />
        </div>
        <div className="min-w-32 flex-1">
          <label className="block text-xs font-medium text-ink-muted">Season label</label>
          <input
            value={seasonLabel}
            onChange={(e) => setSeasonLabel(e.target.value)}
            placeholder="e.g. Winter 2026"
            className="mt-1 w-full rounded-md border border-line bg-panel-raised px-2 py-1.5 text-sm text-ink outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/30"
          />
        </div>
        <button
          type="submit"
          disabled={saving || !date || !duration || !startTime}
          className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button type="button" onClick={() => setEditing(false)} className="px-2 py-1.5 text-sm text-ink-muted">
          Cancel
        </button>
      </form>
    </li>
  )
}

function CreateSessionForm({
  teamId,
  onCreate,
  initialDate,
  onCancel,
  compact,
}: {
  teamId: string
  onCreate: (input: { team_id: string } & SessionFormValues) => Promise<SessionWithRelations | null>
  // Pre-fills the date field — used by the per-day "click the date to
  // create a session" affordance above, so the coach doesn't have to
  // re-pick the date they just clicked. Still editable in case they change
  // their mind about which day.
  initialDate?: string
  // Present only for the inline per-day form (opened by clicking a date);
  // the standing bottom-of-page form has no cancel affordance since there's
  // nothing to close.
  onCancel?: () => void
  // Drops the top border/padding that separates the standing form from the
  // week list above it — the inline per-day form already sits inside a
  // bordered day card, so that same divider would look like a stray line.
  compact?: boolean
}) {
  const [date, setDate] = useState(initialDate ?? '')
  const [duration, setDuration] = useState('60')
  const [startTime, setStartTime] = useState('')
  const [notes, setNotes] = useState('')
  const [seasonLabel, setSeasonLabel] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!date || !duration || !startTime || submitting) return
    setSubmitting(true)
    const created = await onCreate({
      team_id: teamId,
      date,
      duration_minutes: Number(duration),
      start_time: startTime,
      coaching_notes: notes.trim() || null,
      season_label: seasonLabel.trim() || null,
    })
    setSubmitting(false)
    if (created) {
      setDate(initialDate ?? '')
      setDuration('60')
      setStartTime('')
      setNotes('')
      setSeasonLabel('')
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={
        compact ? 'flex flex-wrap items-end gap-2' : 'flex flex-wrap items-end gap-2 border-t border-line pt-4'
      }
    >
      <div>
        <label htmlFor="new-session-date" className="block text-xs font-medium text-ink-muted">
          Date
        </label>
        <input
          id="new-session-date"
          type="date"
          required
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="mt-1 rounded-md border border-line bg-panel-raised px-2 py-1.5 text-sm text-ink outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/30"
        />
      </div>
      <div>
        <label htmlFor="new-session-start-time" className="block text-xs font-medium text-ink-muted">
          Start time
        </label>
        <input
          id="new-session-start-time"
          type="time"
          required
          value={startTime}
          onChange={(e) => setStartTime(e.target.value)}
          className="mt-1 rounded-md border border-line bg-panel-raised px-2 py-1.5 text-sm text-ink outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/30"
        />
      </div>
      <div className="w-24">
        <label htmlFor="new-session-duration" className="block text-xs font-medium text-ink-muted">
          Minutes
        </label>
        <input
          id="new-session-duration"
          type="number"
          min={1}
          value={duration}
          onChange={(e) => setDuration(e.target.value)}
          className="mt-1 w-full rounded-md border border-line bg-panel-raised px-2 py-1.5 text-sm text-ink outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/30"
        />
      </div>
      <div className="w-full">
        <label htmlFor="new-session-notes" className="block text-xs font-medium text-ink-muted">
          Coaching notes
        </label>
        <textarea
          id="new-session-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          placeholder="e.g. Focus on pressing triggers in the middle third."
          className="mt-1 w-full rounded-md border border-line bg-panel-raised px-2 py-1.5 text-sm text-ink outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/30"
        />
      </div>
      <div className="min-w-32 flex-1">
        <label htmlFor="new-session-season-label" className="block text-xs font-medium text-ink-muted">
          Season label
        </label>
        <input
          id="new-session-season-label"
          value={seasonLabel}
          onChange={(e) => setSeasonLabel(e.target.value)}
          placeholder="e.g. Winter 2026"
          className="mt-1 w-full rounded-md border border-line bg-panel-raised px-2 py-1.5 text-sm text-ink outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/30"
        />
      </div>
      <button
        type="submit"
        disabled={submitting || !date || !duration || !startTime}
        className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50"
      >
        {submitting ? 'Creating…' : 'Create session'}
      </button>
      {onCancel && (
        <button type="button" onClick={onCancel} className="px-2 py-1.5 text-sm text-ink-muted">
          Cancel
        </button>
      )}
    </form>
  )
}

function RecurringScheduleForm({
  teamId,
  onCreate,
  onCancel,
}: {
  teamId: string
  onCreate: (input: RecurringSessionInput) => Promise<SessionWithRelations[]>
  onCancel: () => void
}) {
  const [weekdays, setWeekdays] = useState<number[]>([])
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [startTime, setStartTime] = useState('')
  const [duration, setDuration] = useState('60')
  const [seasonLabel, setSeasonLabel] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<string | null>(null)

  const toggleWeekday = (day: number) => {
    setResult(null)
    setWeekdays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]))
  }

  const valid = weekdays.length > 0 && Boolean(startDate) && Boolean(endDate) && startDate <= endDate && Boolean(startTime) && Boolean(duration)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!valid || submitting) return
    setSubmitting(true)
    setResult(null)
    const created = await onCreate({
      team_id: teamId,
      weekdays,
      start_date: startDate,
      end_date: endDate,
      start_time: startTime,
      duration_minutes: Number(duration),
      season_label: seasonLabel.trim() || null,
    })
    setSubmitting(false)
    setResult(`Created ${created.length} session${created.length === 1 ? '' : 's'}.`)
    if (created.length > 0) {
      setWeekdays([])
      setStartDate('')
      setEndDate('')
      setStartTime('')
      setDuration('60')
      setSeasonLabel('')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 border-t border-line pt-4">
      <div>
        <span className="block text-xs font-medium text-ink-muted">Repeats on</span>
        <div className="mt-1 flex flex-wrap gap-1" role="group" aria-label="Weekdays">
          {WEEKDAY_OPTIONS.map(({ value, label }) => {
            const selected = weekdays.includes(value)
            return (
              <button
                key={value}
                type="button"
                aria-pressed={selected}
                onClick={() => toggleWeekday(value)}
                className={
                  'rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ' +
                  (selected
                    ? 'border-accent bg-accent text-white'
                    : 'border-line bg-panel-raised text-ink-muted hover:border-line-strong')
                }
              >
                {label}
              </button>
            )
          })}
        </div>
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <div>
          <label htmlFor="recurring-start-date" className="block text-xs font-medium text-ink-muted">
            From
          </label>
          <input
            id="recurring-start-date"
            type="date"
            required
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="mt-1 rounded-md border border-line bg-panel-raised px-2 py-1.5 text-sm text-ink outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/30"
          />
        </div>
        <div>
          <label htmlFor="recurring-end-date" className="block text-xs font-medium text-ink-muted">
            Until
          </label>
          <input
            id="recurring-end-date"
            type="date"
            required
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="mt-1 rounded-md border border-line bg-panel-raised px-2 py-1.5 text-sm text-ink outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/30"
          />
        </div>
        <div>
          <label htmlFor="recurring-start-time" className="block text-xs font-medium text-ink-muted">
            Start time
          </label>
          <input
            id="recurring-start-time"
            type="time"
            required
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            className="mt-1 rounded-md border border-line bg-panel-raised px-2 py-1.5 text-sm text-ink outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/30"
          />
        </div>
        <div className="w-24">
          <label htmlFor="recurring-duration" className="block text-xs font-medium text-ink-muted">
            Minutes
          </label>
          <input
            id="recurring-duration"
            type="number"
            min={1}
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            className="mt-1 w-full rounded-md border border-line bg-panel-raised px-2 py-1.5 text-sm text-ink outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/30"
          />
        </div>
        <div className="min-w-32 flex-1">
          <label htmlFor="recurring-season-label" className="block text-xs font-medium text-ink-muted">
            Season label
          </label>
          <input
            id="recurring-season-label"
            value={seasonLabel}
            onChange={(e) => setSeasonLabel(e.target.value)}
            placeholder="e.g. Winter 2026"
            className="mt-1 w-full rounded-md border border-line bg-panel-raised px-2 py-1.5 text-sm text-ink outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/30"
          />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="submit"
          disabled={!valid || submitting}
          className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50"
        >
          {submitting ? 'Creating…' : 'Create schedule'}
        </button>
        <button type="button" onClick={onCancel} className="px-2 py-1.5 text-sm text-ink-muted">
          Cancel
        </button>
        {result && <p className="text-xs text-ink-muted">{result}</p>}
      </div>
      <p className="text-xs text-ink-muted">
        Creates one independent session for every selected weekday between the two dates — each is fully editable
        afterward (time, drills, notes) the same as a session created one at a time.
      </p>
    </form>
  )
}
