import type { StateCreator } from 'zustand'
import { supabase } from '../../lib/supabase'
import { runSupabaseAction } from '../supabaseAction'
import type { Availability, AvailabilityStatus } from '../types'
import type { StoreState } from '../useStore'

export interface AvailabilityUpdateInput {
  status: AvailabilityStatus
  reason?: string | null
}

// Phase 1.6 — Availability per session (US-8, gaffer_mvp_build_steps.md).
// The default `unconfirmed` row for every (session, player) pair is seeded
// by sessionSlice.createSession at session-creation time (see the comment
// there), and every session fetch already embeds its availability rows via
// SessionWithRelations (sessionSlice's `select=*, availability(*), ...`) —
// so this slice doesn't duplicate that storage with its own top-level
// `availability` array. Its only job is the one write a coach makes from
// the availability panel: change a player's status/reason for a session,
// which is also the one point `responded_at` gets stamped. Loading/error
// state is keyed by availability row id (same "keyed record" shape as
// playerNoteSlice, sized for however many rows are being edited at once
// rather than one flag for the whole slice).
export interface AvailabilitySlice {
  availabilityLoading: Record<string, boolean>
  availabilityError: Record<string, string | null>

  updateAvailability: (id: string, patch: AvailabilityUpdateInput) => Promise<Availability | null>
}

export const createAvailabilitySlice: StateCreator<StoreState, [], [], AvailabilitySlice> = (set) => ({
  availabilityLoading: {},
  availabilityError: {},

  updateAvailability: async (id, patch) => {
    set((state) => ({
      availabilityLoading: { ...state.availabilityLoading, [id]: true },
      availabilityError: { ...state.availabilityError, [id]: null },
    }))
    // Definition of Done: "responded_at is recorded on change" — this action
    // is only ever fired by an explicit coach edit (the seeded default row
    // never calls it), so unconditionally stamping responded_at here is
    // exactly "on change", not "on every possible write to this table".
    const { data, error } = await runSupabaseAction<Availability[]>(
      () =>
        supabase
          .from('availability')
          .update({
            status: patch.status,
            reason: patch.reason ?? null,
            responded_at: new Date().toISOString(),
          })
          .eq('id', id)
          .select(),
      "Couldn't save availability, try again."
    )
    const updated = data?.[0] ?? null
    set((state) => ({
      availabilityLoading: { ...state.availabilityLoading, [id]: false },
      availabilityError: { ...state.availabilityError, [id]: error },
      // Availability lives nested inside `sessions[].availability`, not in a
      // top-level array of its own — patch the one row inside the one
      // session it belongs to, same as sessionDrillSlice would if it kept
      // its rows nested instead of flat.
      ...(updated
        ? {
            sessions: state.sessions.map((s) =>
              s.id === updated.session_id
                ? { ...s, availability: s.availability.map((a) => (a.id === id ? updated : a)) }
                : s
            ),
          }
        : {}),
    }))
    return updated
  },
})
