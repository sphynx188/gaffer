import type { StateCreator } from 'zustand'
import { supabase } from '../../lib/supabase'
import { runSupabaseAction } from '../supabaseAction'
import type { Player, PlayerPosition } from '../types'
import type { StoreState } from '../useStore'

export interface NewPlayerInput {
  team_id: string
  name: string
  positions?: PlayerPosition[]
  dob?: string | null
  squad_number?: number | null
}

export interface PlayerUpdateInput {
  name?: string
  positions?: PlayerPosition[]
  dob?: string | null
  squad_number?: number | null
}

export interface PlayerSlice {
  players: Player[]
  playersLoading: boolean
  playersError: string | null

  fetchPlayers: (teamId: string) => Promise<void>
  createPlayer: (input: NewPlayerInput) => Promise<Player | null>
  updatePlayer: (id: string, patch: PlayerUpdateInput) => Promise<Player | null>
}

// Phase 1.3 — Player roster CRUD (US-5, gaffer_mvp_build_steps.md). Same
// shape as teamSlice/sessionSlice/drillSlice: every write funnels through
// runSupabaseAction, and fetches are scoped by team_id (never a bare
// select-all) so switching teams (teamSlice's selectedTeamId) never bleeds
// one team's roster into another's view. No deletePlayer here — the build
// guide's DoD for 1.3 only calls for add + edit of all four fields, not
// removal; add it later if the roster actually needs it.
export const createPlayerSlice: StateCreator<StoreState, [], [], PlayerSlice> = (set, get) => {
  // Same stale-response guard as sessionSlice/drillSlice — see the comment
  // there: a fast team-switch can't let a slower, now-stale fetch for the
  // *previous* team overwrite the list after a newer request already
  // resolved.
  let latestFetchTeamId: string | null = null

  return {
    players: [],
    playersLoading: false,
    playersError: null,

    fetchPlayers: async (teamId) => {
      latestFetchTeamId = teamId
      set({ playersLoading: true, playersError: null })
      const { data, error } = await runSupabaseAction<Player[]>(
        () =>
          supabase
            .from('player')
            .select('*')
            .eq('team_id', teamId)
            .order('squad_number', { ascending: true, nullsFirst: false })
            .order('name', { ascending: true }),
        "Couldn't load players, try again."
      )
      if (latestFetchTeamId !== teamId) return // superseded by a newer team switch
      set({
        playersLoading: false,
        playersError: error,
        ...(data ? { players: data } : {}),
      })
    },

    createPlayer: async (input) => {
      set({ playersLoading: true, playersError: null })
      const { data, error } = await runSupabaseAction<Player[]>(
        () => supabase.from('player').insert(input).select(),
        "Couldn't add player, try again."
      )
      const player = data?.[0] ?? null
      set({
        playersLoading: false,
        playersError: error,
        ...(player ? { players: [...get().players, player] } : {}),
      })
      return player
    },

    updatePlayer: async (id, patch) => {
      set({ playersLoading: true, playersError: null })
      const { data, error } = await runSupabaseAction<Player[]>(
        () => supabase.from('player').update(patch).eq('id', id).select(),
        "Couldn't save player, try again."
      )
      const player = data?.[0] ?? null
      set({
        playersLoading: false,
        playersError: error,
        ...(player ? { players: get().players.map((p) => (p.id === id ? player : p)) } : {}),
      })
      return player
    },
  }
}
