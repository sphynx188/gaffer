import type { StateCreator } from 'zustand'
import { supabase } from '../../lib/supabase'
import { runSupabaseAction } from '../supabaseAction'
import type { SessionDrill } from '../types'
import type { StoreState } from '../useStore'

export interface NewSessionDrillInput {
  session_id: string
  drill_id: string
  order_index: number
  planned_duration_minutes?: number | null
  notes?: string | null
}

export interface SessionDrillUpdateInput {
  order_index?: number
  planned_duration_minutes?: number | null
  notes?: string | null
}

// Phase 2d — Save as reusable / attach to session (US-14, US-15,
// gaffer_mvp_build_steps.md). US-14 needs no code here: every drill built
// via 2a-2c is already reusable by virtue of being a `drill` row (no
// separate "save as template" step exists anywhere in this app to remove).
// This slice is the US-15 half — attach/reorder/detach a `session_drills`
// join row.
//
// `session_drills` rows live nested inside `sessions[].session_drills`
// (populated by sessionSlice's embedded `select=*, availability(*),
// session_drills(*)`), not in a flat array of their own — same call
// availabilitySlice made for `availability`, and exactly the fix its own
// comment flagged this slice for ("same as sessionDrillSlice would if it
// kept its rows nested instead of flat"). Keeping a second, flat copy was
// what let SessionPlanner's "N drill(s) attached" count go stale after an
// attach until the next full fetchSessions — nesting closes that gap.
export interface SessionDrillSlice {
  // Keyed by session_id: a coach can have more than one session's "attach a
  // drill" form in flight at once (two SessionDrillsPanel instances open),
  // and one session's in-flight attach must never block or bleed into
  // another's — same per-parent-id keying playerNoteSlice uses.
  sessionDrillAttachLoading: Record<string, boolean>
  sessionDrillAttachError: Record<string, string | null>
  // Keyed by session_drills row id: update/detach act on one already-
  // attached row, same "keyed record" shape availabilitySlice uses for its
  // per-row loading/error.
  sessionDrillRowLoading: Record<string, boolean>
  sessionDrillRowError: Record<string, string | null>

  // "Attach", not "create": a session_drill is a join row between an
  // existing session and an existing drill (build guide 0.5.1 step 4 / 2d).
  attachDrillToSession: (input: NewSessionDrillInput) => Promise<SessionDrill | null>
  // Reorders (order_index) and/or edits the per-attachment planned duration
  // / notes — never touches the underlying drill itself, only this one
  // join row (build guide 2d step 3: "order_index and planned_duration_minutes
  // are per-attachment, not per-drill").
  updateSessionDrill: (id: string, patch: SessionDrillUpdateInput) => Promise<SessionDrill | null>
  // Detaches a drill from a session — deletes the join row only; the drill
  // itself (and its use in every other session) is untouched.
  detachDrillFromSession: (id: string) => Promise<boolean>
}

export const createSessionDrillSlice: StateCreator<StoreState, [], [], SessionDrillSlice> = (set) => ({
  sessionDrillAttachLoading: {},
  sessionDrillAttachError: {},
  sessionDrillRowLoading: {},
  sessionDrillRowError: {},

  attachDrillToSession: async (input) => {
    set((state) => ({
      sessionDrillAttachLoading: { ...state.sessionDrillAttachLoading, [input.session_id]: true },
      sessionDrillAttachError: { ...state.sessionDrillAttachError, [input.session_id]: null },
    }))
    const { data, error } = await runSupabaseAction<SessionDrill[]>(
      () => supabase.from('session_drills').insert(input).select(),
      "Couldn't attach drill to session, try again."
    )
    const attached = data?.[0] ?? null
    set((state) => ({
      sessionDrillAttachLoading: { ...state.sessionDrillAttachLoading, [input.session_id]: false },
      sessionDrillAttachError: { ...state.sessionDrillAttachError, [input.session_id]: error },
      ...(attached
        ? {
            sessions: state.sessions.map((s) =>
              s.id === attached.session_id
                ? {
                    ...s,
                    session_drills: [...s.session_drills, attached].sort((a, b) => a.order_index - b.order_index),
                  }
                : s
            ),
          }
        : {}),
    }))
    return attached
  },

  updateSessionDrill: async (id, patch) => {
    set((state) => ({
      sessionDrillRowLoading: { ...state.sessionDrillRowLoading, [id]: true },
      sessionDrillRowError: { ...state.sessionDrillRowError, [id]: null },
    }))
    const { data, error } = await runSupabaseAction<SessionDrill[]>(
      () => supabase.from('session_drills').update(patch).eq('id', id).select(),
      "Couldn't save drill attachment, try again."
    )
    const updated = data?.[0] ?? null
    set((state) => ({
      sessionDrillRowLoading: { ...state.sessionDrillRowLoading, [id]: false },
      sessionDrillRowError: { ...state.sessionDrillRowError, [id]: error },
      ...(updated
        ? {
            sessions: state.sessions.map((s) =>
              s.id === updated.session_id
                ? {
                    ...s,
                    session_drills: s.session_drills
                      .map((sd) => (sd.id === id ? updated : sd))
                      .sort((a, b) => a.order_index - b.order_index),
                  }
                : s
            ),
          }
        : {}),
    }))
    return updated
  },

  detachDrillFromSession: async (id) => {
    set((state) => ({
      sessionDrillRowLoading: { ...state.sessionDrillRowLoading, [id]: true },
      sessionDrillRowError: { ...state.sessionDrillRowError, [id]: null },
    }))
    const { data, error } = await runSupabaseAction<SessionDrill[]>(
      () => supabase.from('session_drills').delete().eq('id', id).select(),
      "Couldn't remove drill from session, try again."
    )
    const removed = data?.[0] ?? null
    set((state) => ({
      sessionDrillRowLoading: { ...state.sessionDrillRowLoading, [id]: false },
      sessionDrillRowError: { ...state.sessionDrillRowError, [id]: error },
      ...(removed
        ? {
            sessions: state.sessions.map((s) =>
              s.id === removed.session_id
                ? { ...s, session_drills: s.session_drills.filter((sd) => sd.id !== id) }
                : s
            ),
          }
        : {}),
    }))
    return Boolean(removed)
  },
})
