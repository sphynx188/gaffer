import type { StateCreator } from 'zustand'
import { supabase } from '../../lib/supabase'
import { runSupabaseAction } from '../supabaseAction'
import type { SessionTactic } from '../types'
import type { StoreState } from '../useStore'

export interface NewSessionTacticInput {
  session_id: string
  tactic_id: string
  order_index: number
  planned_duration_minutes?: number | null
  notes?: string | null
}

export interface SessionTacticUpdateInput {
  order_index?: number
  planned_duration_minutes?: number | null
  notes?: string | null
}

// TACTICS_BOARD_REWORK_PLAN.md Stage 9.3 — "mirror `sessionDrillSlice.ts`
// exactly". It does: same three actions, same two pairs of keyed
// loading/error records, same nested-rows shape, same wording. Read the two
// side by side and the only differences are the table, the type and the
// noun.
//
// It is a separate slice rather than a generalisation of sessionDrillSlice
// because the two write different TABLES, and the store's one hard rule is
// that every action carries a name no other slice has taken. Generalising
// over the table name would buy fifty shared lines at the cost of a slice
// whose actions no longer say what they touch — and the UI generalisation
// Stage 9.4 asks for happens one layer up, in SessionItemsPanel, which is
// where the coach-facing "one ordered list" actually lives.
//
// Rows live nested inside `sessions[].session_tactics` (populated by
// sessionSlice's embedded select), never in a flat array of their own —
// sessionDrillSlice's header records why: a second flat copy is what let
// SessionPlanner's attached-count go stale until the next full fetch.
export interface SessionTacticSlice {
  // Keyed by session_id, so two sessions' attach forms can be in flight at
  // once without one blocking or bleeding into the other.
  sessionTacticAttachLoading: Record<string, boolean>
  sessionTacticAttachError: Record<string, string | null>
  // Keyed by session_tactics row id, for the per-row update/detach.
  sessionTacticRowLoading: Record<string, boolean>
  sessionTacticRowError: Record<string, string | null>

  // "Attach", not "create": a session_tactic is a join row between an
  // existing session and an existing tactic.
  attachTacticToSession: (input: NewSessionTacticInput) => Promise<SessionTactic | null>
  // Reorders and/or edits the per-attachment planned duration and notes —
  // never the tactic itself, so every other session it is attached to is
  // untouched.
  updateSessionTactic: (id: string, patch: SessionTacticUpdateInput) => Promise<SessionTactic | null>
  // Deletes the join row only; the tactic survives.
  detachTacticFromSession: (id: string) => Promise<boolean>
}

export const createSessionTacticSlice: StateCreator<StoreState, [], [], SessionTacticSlice> = (set) => ({
  sessionTacticAttachLoading: {},
  sessionTacticAttachError: {},
  sessionTacticRowLoading: {},
  sessionTacticRowError: {},

  attachTacticToSession: async (input) => {
    set((state) => ({
      sessionTacticAttachLoading: { ...state.sessionTacticAttachLoading, [input.session_id]: true },
      sessionTacticAttachError: { ...state.sessionTacticAttachError, [input.session_id]: null },
    }))
    const { data, error } = await runSupabaseAction<SessionTactic[]>(
      () => supabase.from('session_tactics').insert(input).select(),
      "Couldn't attach tactic to session, try again."
    )
    const attached = data?.[0] ?? null
    set((state) => ({
      sessionTacticAttachLoading: { ...state.sessionTacticAttachLoading, [input.session_id]: false },
      sessionTacticAttachError: { ...state.sessionTacticAttachError, [input.session_id]: error },
      ...(attached
        ? {
            sessions: state.sessions.map((s) =>
              s.id === attached.session_id
                ? {
                    ...s,
                    session_tactics: [...s.session_tactics, attached].sort((a, b) => a.order_index - b.order_index),
                  }
                : s
            ),
          }
        : {}),
    }))
    return attached
  },

  updateSessionTactic: async (id, patch) => {
    set((state) => ({
      sessionTacticRowLoading: { ...state.sessionTacticRowLoading, [id]: true },
      sessionTacticRowError: { ...state.sessionTacticRowError, [id]: null },
    }))
    const { data, error } = await runSupabaseAction<SessionTactic[]>(
      () => supabase.from('session_tactics').update(patch).eq('id', id).select(),
      "Couldn't save tactic attachment, try again."
    )
    const updated = data?.[0] ?? null
    set((state) => ({
      sessionTacticRowLoading: { ...state.sessionTacticRowLoading, [id]: false },
      sessionTacticRowError: { ...state.sessionTacticRowError, [id]: error },
      ...(updated
        ? {
            sessions: state.sessions.map((s) =>
              s.id === updated.session_id
                ? {
                    ...s,
                    session_tactics: s.session_tactics
                      .map((st) => (st.id === id ? updated : st))
                      .sort((a, b) => a.order_index - b.order_index),
                  }
                : s
            ),
          }
        : {}),
    }))
    return updated
  },

  detachTacticFromSession: async (id) => {
    set((state) => ({
      sessionTacticRowLoading: { ...state.sessionTacticRowLoading, [id]: true },
      sessionTacticRowError: { ...state.sessionTacticRowError, [id]: null },
    }))
    const { data, error } = await runSupabaseAction<SessionTactic[]>(
      () => supabase.from('session_tactics').delete().eq('id', id).select(),
      "Couldn't remove tactic from session, try again."
    )
    const removed = data?.[0] ?? null
    set((state) => ({
      sessionTacticRowLoading: { ...state.sessionTacticRowLoading, [id]: false },
      sessionTacticRowError: { ...state.sessionTacticRowError, [id]: error },
      ...(removed
        ? {
            sessions: state.sessions.map((s) =>
              s.id === removed.session_id
                ? { ...s, session_tactics: s.session_tactics.filter((st) => st.id !== id) }
                : s
            ),
          }
        : {}),
    }))
    return Boolean(removed)
  },
})
