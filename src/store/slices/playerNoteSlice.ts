import type { StateCreator } from 'zustand'
import { supabase } from '../../lib/supabase'
import { runSupabaseAction } from '../supabaseAction'
import type { PlayerNote } from '../types'
import type { StoreState } from '../useStore'

export interface NewPlayerNoteInput {
  player_id: string
  body: string
}

export interface PlayerNoteSlice {
  // Keyed by player_id — a coach can have more than one player's notes
  // panel expanded (or previously fetched) at once, and one player's notes
  // must never bleed into another's, same guarantee as every other
  // team-scoped slice (see teamSlice's clearTeamScopedState comment).
  playerNotes: Record<string, PlayerNote[]>
  playerNotesLoading: Record<string, boolean>
  playerNotesError: Record<string, string | null>

  fetchPlayerNotes: (playerId: string) => Promise<void>
  addPlayerNote: (input: NewPlayerNoteInput) => Promise<PlayerNote | null>
}

// Phase 1.4 — Player development notes (US-6, gaffer_mvp_build_steps.md).
// Deliberately append-only: there is no updatePlayerNote/deletePlayerNote
// here, because the Definition of Done requires a full, unedited note
// history — "never overwritten" — so the only mutation this slice exposes
// is insert. Notes are fetched newest-first (order by created_at desc) so
// the latest entry is always what a coach sees first when opening a
// player's panel.
export const createPlayerNoteSlice: StateCreator<StoreState, [], [], PlayerNoteSlice> = (set) => ({
  playerNotes: {},
  playerNotesLoading: {},
  playerNotesError: {},

  fetchPlayerNotes: async (playerId) => {
    set((state) => ({
      playerNotesLoading: { ...state.playerNotesLoading, [playerId]: true },
      playerNotesError: { ...state.playerNotesError, [playerId]: null },
    }))
    const { data, error } = await runSupabaseAction<PlayerNote[]>(
      () =>
        supabase
          .from('player_notes')
          .select('*')
          .eq('player_id', playerId)
          .order('created_at', { ascending: false }),
      "Couldn't load notes, try again."
    )
    set((state) => ({
      playerNotesLoading: { ...state.playerNotesLoading, [playerId]: false },
      playerNotesError: { ...state.playerNotesError, [playerId]: error },
      ...(data ? { playerNotes: { ...state.playerNotes, [playerId]: data } } : {}),
    }))
  },

  addPlayerNote: async ({ player_id, body }) => {
    set((state) => ({
      playerNotesLoading: { ...state.playerNotesLoading, [player_id]: true },
      playerNotesError: { ...state.playerNotesError, [player_id]: null },
    }))
    // author_id has no default in schema.sql (mirrors teamSlice.createTeam's
    // owner_id handling) — resolve the current user explicitly rather than
    // relying on a caller to pass it in, so a note can never be attributed
    // to the wrong coach.
    const { data: userData, error: userError } = await supabase.auth.getUser()
    if (userError || !userData.user) {
      set((state) => ({
        playerNotesLoading: { ...state.playerNotesLoading, [player_id]: false },
        playerNotesError: {
          ...state.playerNotesError,
          [player_id]: "Couldn't add note, try again.",
        },
      }))
      return null
    }
    const { data, error } = await runSupabaseAction<PlayerNote[]>(
      () =>
        supabase
          .from('player_notes')
          .insert({ player_id, body, author_id: userData.user.id })
          .select(),
      "Couldn't add note, try again."
    )
    const note = data?.[0] ?? null
    set((state) => ({
      playerNotesLoading: { ...state.playerNotesLoading, [player_id]: false },
      playerNotesError: { ...state.playerNotesError, [player_id]: error },
      ...(note
        ? {
            playerNotes: {
              ...state.playerNotes,
              [player_id]: [note, ...(state.playerNotes[player_id] ?? [])],
            },
          }
        : {}),
    }))
    return note
  },
})
