import type { StateCreator } from 'zustand'
import { supabase } from '../../lib/supabase'
import { runSupabaseAction } from '../supabaseAction'
import type { Team, PitchFormat } from '../types'
import type { StoreState } from '../useStore'

export interface NewTeamInput {
  name: string
  format: PitchFormat
}

export interface TeamUpdateInput {
  name?: string
  format?: PitchFormat
}

export interface TeamSlice {
  teams: Team[]
  teamsLoading: boolean
  teamsError: string | null

  fetchTeams: () => Promise<void>
  createTeam: (input: NewTeamInput) => Promise<Team | null>
  updateTeam: (id: string, patch: TeamUpdateInput) => Promise<Team | null>
}

export const createTeamSlice: StateCreator<StoreState, [], [], TeamSlice> = (set, get) => ({
  teams: [],
  teamsLoading: false,
  teamsError: null,

  fetchTeams: async () => {
    set({ teamsLoading: true, teamsError: null })
    const { data, error } = await runSupabaseAction<Team[]>(
      () => supabase.from('team').select('*').order('created_at', { ascending: true }),
      "Couldn't load teams, try again."
    )
    set({
      teamsLoading: false,
      teamsError: error,
      ...(data ? { teams: data } : {}),
    })
  },

  createTeam: async (input) => {
    set({ teamsLoading: true, teamsError: null })
    const { data, error } = await runSupabaseAction<Team[]>(
      () => supabase.from('team').insert(input).select(),
      "Couldn't create team, try again."
    )
    const team = data?.[0] ?? null
    set({
      teamsLoading: false,
      teamsError: error,
      ...(team ? { teams: [...get().teams, team] } : {}),
    })
    return team
  },

  updateTeam: async (id, patch) => {
    set({ teamsLoading: true, teamsError: null })
    const { data, error } = await runSupabaseAction<Team[]>(
      () => supabase.from('team').update(patch).eq('id', id).select(),
      "Couldn't save team, try again."
    )
    const team = data?.[0] ?? null
    set({
      teamsLoading: false,
      teamsError: error,
      ...(team ? { teams: get().teams.map((t) => (t.id === id ? team : t)) } : {}),
    })
    return team
  },
})
