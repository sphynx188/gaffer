import type { StateCreator } from 'zustand'
import { supabase } from '../../lib/supabase'
import { runSupabaseAction } from '../supabaseAction'
import type { Player, PlayerPosition } from '../types'
import type { StoreState } from '../useStore'

export interface NewPlayerInput {
  team_id: string
  name: string
  positions?: PlayerPosition[]
  squad_number?: number | null
}

export interface PlayerUpdateInput {
  name?: string
  positions?: PlayerPosition[]
  squad_number?: number | null
}

export interface PlayerSlice {
  players: Player[]
  playersLoading: boolean
  playersError: string | null

  // Rosters of teams OTHER than the selected one, keyed by team id — the same
  // keyed-record shape playerNoteSlice uses. The tactics board's away side can
  // be bound to another team the coach coaches (TACTICS_BOARD_REWORK_PLAN.md
  // Stage 4.3), and it needs that team's players WITHOUT touching `players`
  // above, which is the selected team's roster and is what the roster,
  // attendance and session screens all read. Overwriting it to show an
  // opponent would empty the roster page behind the coach's back.
  rostersByTeam: Record<string, Player[]>
  rostersByTeamLoading: Record<string, boolean>
  // Kept per team rather than folded into `playersError`: a failure loading an
  // OPPONENT's roster is not the selected team's roster failing, and surfacing
  // it there would put an error banner on the roster page.
  rostersByTeamError: Record<string, string | null>

  fetchPlayers: (teamId: string) => Promise<void>
  // Cache-aware: a team already loaded is not re-fetched, because this is
  // called from a panel that re-renders on every side switch. Pass `force` to
  // pick up roster edits made since.
  fetchTeamRoster: (teamId: string, force?: boolean) => Promise<void>
  createPlayer: (input: NewPlayerInput) => Promise<Player | null>
  updatePlayer: (id: string, patch: PlayerUpdateInput) => Promise<Player | null>
  // `player_notes` and `availability` rows for this player cascade at the DB
  // level (schema.sql) — a past session's attendance record just loses its
  // row for this player rather than blocking the delete.
  deletePlayer: (id: string) => Promise<boolean>
}

// Phase 1.3 — Player roster CRUD (US-5, gaffer_mvp_build_steps.md). Same
// shape as teamSlice/sessionSlice/drillSlice: every write funnels through
// runSupabaseAction, and fetches are scoped by team_id (never a bare
// select-all) so switching teams (teamSlice's selectedTeamId) never bleeds
// one team's roster into another's view.
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
    rostersByTeam: {},
    rostersByTeamLoading: {},
    rostersByTeamError: {},

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

    fetchTeamRoster: async (teamId, force = false) => {
      if (!force && get().rostersByTeam[teamId]) return
      set((state) => ({
        rostersByTeamLoading: { ...state.rostersByTeamLoading, [teamId]: true },
        rostersByTeamError: { ...state.rostersByTeamError, [teamId]: null },
      }))
      const { data, error } = await runSupabaseAction<Player[]>(
        () =>
          supabase
            .from('player')
            .select('*')
            .eq('team_id', teamId)
            .order('squad_number', { ascending: true, nullsFirst: false })
            .order('name', { ascending: true }),
        "Couldn't load that team's players, try again."
      )
      set((state) => ({
        rostersByTeamLoading: { ...state.rostersByTeamLoading, [teamId]: false },
        rostersByTeamError: { ...state.rostersByTeamError, [teamId]: error },
        ...(data ? { rostersByTeam: { ...state.rostersByTeam, [teamId]: data } } : {}),
      }))
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

    deletePlayer: async (id) => {
      set({ playersLoading: true, playersError: null })
      const { error } = await runSupabaseAction<null>(
        () => supabase.from('player').delete().eq('id', id),
        "Couldn't delete player, try again."
      )
      if (error) {
        set({ playersLoading: false, playersError: error })
        return false
      }
      set((state) => ({
        playersLoading: false,
        playersError: null,
        players: state.players.filter((p) => p.id !== id),
      }))
      return true
    },
  }
}
