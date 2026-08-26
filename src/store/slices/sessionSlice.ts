import type { StateCreator } from 'zustand'
import { supabase } from '../../lib/supabase'
import { runSupabaseAction } from '../supabaseAction'
import { addDays, parseLocalDate, toISODate } from '../../lib/date'
import type { Session, Availability, SessionDrill, SessionTactic } from '../types'
import type { StoreState } from '../useStore'

export interface NewSessionInput {
  team_id: string
  date: string
  duration_minutes: number
  start_time?: string | null
  coaching_notes?: string | null
  season_label?: string | null
}

export interface SessionUpdateInput {
  date?: string
  duration_minutes?: number
  start_time?: string | null
  coaching_notes?: string | null
  season_label?: string | null
}

// A recurring schedule never exists as its own row/concept — it's a
// generator that creates ordinary, independent `session` rows (one per
// matching weekday in the range), each editable/duplicable/deletable
// afterward exactly like a one-off session. `weekdays` uses JS
// `Date.getDay()`'s convention (0 = Sunday … 6 = Saturday).
export interface RecurringSessionInput {
  team_id: string
  weekdays: number[]
  start_date: string
  end_date: string
  start_time: string
  duration_minutes: number
  season_label?: string | null
}

// Phase 1.5 — Weekly session planner (US-7, gaffer_mvp_build_steps.md) reads
// the week view via one embedded PostgREST select
// (`select=*, availability(*), session_drills(*)`) per the build guide's
// step 3, rather than a bare `select('*')` — even though availability
// (1.6) and session_drills (2d) had no real UI at the time, so that shape
// never has to be retrofitted later and the week view never grows an N+1
// request pattern per session row.
export interface SessionWithRelations extends Session {
  availability: Availability[]
  session_drills: SessionDrill[]
  // TACTICS_BOARD_REWORK_PLAN.md Stage 9.3, embedded the same way and for the
  // same reason. The two arrays are stored separately because they are two
  // tables; the coach sees ONE ordered line-up, merged in SessionItemsPanel
  // over a single `order_index` sequence shared across both.
  session_tactics: SessionTactic[]
}

const SESSION_SELECT = '*, availability(*), session_drills(*), session_tactics(*)'

// Calendar (cross-team weekly view) only needs the columns it actually
// renders — a lighter select than SESSION_SELECT, and deliberately a
// separate state field (calendarSessions, below) rather than reusing
// `sessions`, which must stay exactly "the currently selected team's
// sessions" for SessionPlanner and survive `selectTeam` calls unlike this
// cross-team data.
const CALENDAR_SESSION_SELECT = 'id, team_id, date, start_time, duration_minutes, season_label'

export type CalendarSession = Pick<
  Session,
  'id' | 'team_id' | 'date' | 'start_time' | 'duration_minutes' | 'season_label'
>

export interface SessionSlice {
  sessions: SessionWithRelations[]
  sessionsLoading: boolean
  sessionsError: string | null

  calendarSessions: CalendarSession[]
  calendarSessionsLoading: boolean
  calendarSessionsError: string | null

  fetchSessions: (teamId: string) => Promise<void>
  fetchSessionsForWeek: (teamIds: string[], weekStartISO: string, weekEndISO: string) => Promise<void>
  createSession: (input: NewSessionInput) => Promise<SessionWithRelations | null>
  // Sequential, not Promise.all — this reuses createSession's own
  // set()/get() read-modify-write of the `sessions` array per call, which
  // isn't safe to run concurrently against itself. A recurring schedule is
  // a handful to a few dozen sessions, not a scale where sequential await
  // matters for latency.
  createRecurringSessions: (input: RecurringSessionInput) => Promise<SessionWithRelations[]>
  updateSession: (id: string, patch: SessionUpdateInput) => Promise<SessionWithRelations | null>
  // Phase 3.2 — Duplicate a past session (US-16, gaffer_mvp_build_steps.md).
  // Copies the source session's `session_drills` line-up into a brand-new
  // session on `newDate`, atomically, via the `duplicate_session` Postgres
  // RPC — never a client-side loop of inserts, since a partial copy (new
  // session committed but drills only half-copied) would be worse than the
  // whole thing failing outright. Returns the new session (with its copied
  // drills and freshly-seeded availability already embedded), or null if
  // the RPC itself failed (e.g. the source session isn't one this coach has
  // access to).
  duplicateSession: (sourceSessionId: string, newDate: string) => Promise<SessionWithRelations | null>
}

export const createSessionSlice: StateCreator<StoreState, [], [], SessionSlice> = (set, get) => {
  // Phase 1.2 — Multi-team switching (US-4): tracks which team the
  // in-flight fetch was for, so a fast team-switch can't let a slower,
  // now-stale response for the *previous* team overwrite the list after the
  // newer request already resolved. Plain closure state, not store state —
  // it's bookkeeping for this slice's own async calls, not UI-visible.
  let latestFetchTeamId: string | null = null
  // Same race-guard idea as latestFetchTeamId above, but keyed on the whole
  // query shape (team-id set + week) since fetchSessionsForWeek can be
  // re-triggered by either a team list change or a week-nav click.
  let latestCalendarFetchKey: string | null = null

  // Phase 1.6 — Availability per session (US-8, gaffer_mvp_build_steps.md
  // step 2): "default every player to unconfirmed when a session is
  // created (a trigger or a client-side insert loop on session creation
  // both work at this scale)". This is the client-side-insert-loop half of
  // that choice — the counterpart of schema.sql's on_team_created trigger,
  // just one layer up. `status` is left unset on each inserted row so
  // schema.sql's `default 'unconfirmed'` stays the single source of truth
  // for the default rather than duplicating 'unconfirmed' here.
  //
  // Shared by createSession (a brand-new session) and, as of Phase 3.2,
  // duplicateSession — the build guide's "fresh availability for the new
  // date" for a duplicated session is exactly this same seeding, not a copy
  // of the source session's player responses, so both paths funnel through
  // the one seeding routine rather than growing a second copy of it.
  const seedUnconfirmedAvailability = async (
    sessionId: string,
    teamId: string,
    failureMessage: string
  ): Promise<Availability[]> => {
    const teamPlayers = get().players.filter((p) => p.team_id === teamId)
    if (teamPlayers.length === 0) return []
    const { data: availabilityRows, error: availabilityError } = await runSupabaseAction<Availability[]>(
      () =>
        supabase
          .from('availability')
          .insert(teamPlayers.map((p) => ({ session_id: sessionId, player_id: p.id })))
          .select(),
      failureMessage
    )
    if (availabilityError) {
      // Don't fail session creation/duplication over this — the session row
      // is already committed. Log it rather than losing it silently; a
      // missing availability row just falls back to "no availability
      // record" in AvailabilityPanel instead of blocking the coach.
      console.error('[sessionSlice] availability seed failed', availabilityError)
    }
    return availabilityRows ?? []
  }

  return {
    sessions: [],
    sessionsLoading: false,
    sessionsError: null,

    calendarSessions: [],
    calendarSessionsLoading: false,
    calendarSessionsError: null,

    fetchSessionsForWeek: async (teamIds, weekStartISO, weekEndISO) => {
      const key = `${teamIds.slice().sort().join(',')}|${weekStartISO}`
      latestCalendarFetchKey = key
      if (teamIds.length === 0) {
        set({ calendarSessions: [], calendarSessionsLoading: false, calendarSessionsError: null })
        return
      }
      set({ calendarSessionsLoading: true, calendarSessionsError: null })
      const { data, error } = await runSupabaseAction<CalendarSession[]>(
        () =>
          supabase
            .from('session')
            .select(CALENDAR_SESSION_SELECT)
            .in('team_id', teamIds)
            .gte('date', weekStartISO)
            .lte('date', weekEndISO)
            .order('date', { ascending: true })
            .order('start_time', { ascending: true, nullsFirst: true }),
        "Couldn't load the calendar, try again."
      )
      if (latestCalendarFetchKey !== key) return // superseded by a newer week/team-list change
      set({
        calendarSessionsLoading: false,
        calendarSessionsError: error,
        ...(data ? { calendarSessions: data } : {}),
      })
    },

    fetchSessions: async (teamId) => {
      latestFetchTeamId = teamId
      set({ sessionsLoading: true, sessionsError: null })
      const { data, error } = await runSupabaseAction<SessionWithRelations[]>(
        () =>
          supabase
            .from('session')
            .select(SESSION_SELECT)
            .eq('team_id', teamId)
            .order('date', { ascending: true })
            // Phase 2d: order the embedded session_drills by order_index too
            // (foreignTable targets the nested resource, not the top-level
            // `session` rows) — SessionDrillsPanel renders this array
            // straight through as "the current running order," so it must
            // come back pre-sorted from the very first fetch, not only after
            // a later attach/reorder patches it client-side.
            .order('order_index', { ascending: true, referencedTable: 'session_drills' })
            .order('order_index', { ascending: true, referencedTable: 'session_tactics' }),
        "Couldn't load sessions, try again."
      )
      if (latestFetchTeamId !== teamId) return // superseded by a newer team switch
      set({
        sessionsLoading: false,
        sessionsError: error,
        ...(data ? { sessions: data } : {}),
      })
    },

    createSession: async (input) => {
      set({ sessionsLoading: true, sessionsError: null })
      // A plain insert().select() only returns session columns, never the
      // embedded relations the week view's fetch uses — a brand-new session
      // has no session_drills yet regardless, so that one is seeded empty
      // rather than re-fetched. availability is different: it's not empty by
      // definition (see below).
      const { data, error } = await runSupabaseAction<Session[]>(
        () => supabase.from('session').insert(input).select(),
        "Couldn't create session, try again."
      )
      const inserted = data?.[0] ?? null

      const availability = inserted
        ? await seedUnconfirmedAvailability(
            inserted.id,
            inserted.team_id,
            "Session created, but couldn't set up player availability."
          )
        : []

      const session: SessionWithRelations | null = inserted
        ? { ...inserted, availability, session_drills: [], session_tactics: [] }
        : null
      set({
        sessionsLoading: false,
        sessionsError: error,
        ...(session ? { sessions: [...get().sessions, session] } : {}),
      })
      return session
    },

    createRecurringSessions: async (input) => {
      const weekdaySet = new Set(input.weekdays)
      const created: SessionWithRelations[] = []
      let cursor = parseLocalDate(input.start_date)
      const end = parseLocalDate(input.end_date)
      while (toISODate(cursor) <= toISODate(end)) {
        if (weekdaySet.has(cursor.getDay())) {
          const session = await get().createSession({
            team_id: input.team_id,
            date: toISODate(cursor),
            duration_minutes: input.duration_minutes,
            start_time: input.start_time,
            season_label: input.season_label ?? null,
          })
          if (session) created.push(session)
        }
        cursor = addDays(cursor, 1)
      }
      return created
    },

    updateSession: async (id, patch) => {
      set({ sessionsLoading: true, sessionsError: null })
      // Same as createSession: the update response carries no embedded
      // relations, so the existing row's availability/session_drills are
      // preserved rather than clobbered with an empty array on every edit.
      const { data, error } = await runSupabaseAction<Session[]>(
        () => supabase.from('session').update(patch).eq('id', id).select(),
        "Couldn't save session, try again."
      )
      const updated = data?.[0] ?? null
      let session: SessionWithRelations | null = null
      set((state) => {
        if (!updated) {
          return { sessionsLoading: false, sessionsError: error }
        }
        const existing = state.sessions.find((s) => s.id === id)
        session = {
          ...updated,
          availability: existing?.availability ?? [],
          session_drills: existing?.session_drills ?? [],
          session_tactics: existing?.session_tactics ?? [],
        }
        return {
          sessionsLoading: false,
          sessionsError: error,
          sessions: state.sessions.map((s) => (s.id === id ? session! : s)),
        }
      })
      return session
    },

    duplicateSession: async (sourceSessionId, newDate) => {
      set({ sessionsLoading: true, sessionsError: null })
      // `duplicate_session` returns a single `session` row (not `setof
      // session`), so PostgREST hands back one object, not an array —
      // unlike every other call in this slice, there's no `data?.[0]` here.
      // Copying `session_drills` happens inside the RPC itself, in the same
      // Postgres transaction as the new session row (see
      // supabase/migrations/003_duplicate_session_rpc.sql) — this is the
      // "multi-row/atomic operation" gaffer_project_plan_final.md §4
      // flagged from the start as the one case that can't be a plain
      // supabase-js insert/loop.
      const { data: newSession, error: rpcError } = await runSupabaseAction<Session>(
        () =>
          supabase.rpc('duplicate_session', {
            source_session_id: sourceSessionId,
            new_date: newDate,
          }),
        "Couldn't duplicate session, try again."
      )

      if (!newSession) {
        set({ sessionsLoading: false, sessionsError: rpcError })
        return null
      }

      // Per build guide 3.2's Definition of Done — "availability data is
      // not copied (fresh availability for the new date)" — this is
      // deliberately the same seeding a brand-new session gets from
      // createSession, not a copy of the source session's player
      // responses; the RPC above never touches `availability` at all.
      const availability = await seedUnconfirmedAvailability(
        newSession.id,
        newSession.team_id,
        'Session duplicated, but availability could not be set up.'
      )

      // The RPC's return value carries plain session columns only, same as
      // createSession/updateSession's insert().select()/update().select()
      // responses — but unlike those, this new session's session_drills is
      // NOT empty (the RPC just copied them server-side), so re-fetching
      // this one row with the same embedded select every other session in
      // the store already uses is simpler and less error-prone than
      // hand-assembling an equivalent array of SessionDrill objects here.
      const { data: full, error: fullError } = await runSupabaseAction<SessionWithRelations[]>(
        () =>
          supabase
            .from('session')
            .select(SESSION_SELECT)
            .eq('id', newSession.id)
            .order('order_index', { ascending: true, referencedTable: 'session_drills' })
            .order('order_index', { ascending: true, referencedTable: 'session_tactics' }),
        "Session duplicated, but couldn't load it — refresh to see it."
      )
      const session = full?.[0] ?? { ...newSession, availability, session_drills: [], session_tactics: [] }

      set({
        sessionsLoading: false,
        sessionsError: fullError,
        sessions: [...get().sessions, session],
      })
      return session
    },
  }
}
