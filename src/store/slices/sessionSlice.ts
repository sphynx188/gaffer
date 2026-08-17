import type { StateCreator } from 'zustand'
import { supabase } from '../../lib/supabase'
import { runSupabaseAction } from '../supabaseAction'
import type { Session } from '../types'
import type { StoreState } from '../useStore'

export interface NewSessionInput {
  team_id: string
  date: string
  duration_minutes: number
  physical_load?: number | null
  equipment?: string | null
  coaching_notes?: string | null
  season_label?: string | null
}

export interface SessionUpdateInput {
  date?: string
  duration_minutes?: number
  physical_load?: number | null
  equipment?: string | null
  coaching_notes?: string | null
  season_label?: string | null
}

export interface SessionSlice {
  sessions: Session[]
  sessionsLoading: boolean
  sessionsError: string | null

  fetchSessions: (teamId: string) => Promise<void>
  createSession: (input: NewSessionInput) => Promise<Session | null>
  updateSession: (id: string, patch: SessionUpdateInput) => Promise<Session | null>
}

export const createSessionSlice: StateCreator<StoreState, [], [], SessionSlice> = (set, get) => ({
  sessions: [],
  sessionsLoading: false,
  sessionsError: null,

  fetchSessions: async (teamId) => {
    set({ sessionsLoading: true, sessionsError: null })
    const { data, error } = await runSupabaseAction<Session[]>(
      () =>
        supabase
          .from('session')
          .select('*')
          .eq('team_id', teamId)
          .order('date', { ascending: true }),
      "Couldn't load sessions, try again."
    )
    set({
      sessionsLoading: false,
      sessionsError: error,
      ...(data ? { sessions: data } : {}),
    })
  },

  createSession: async (input) => {
    set({ sessionsLoading: true, sessionsError: null })
    const { data, error } = await runSupabaseAction<Session[]>(
      () => supabase.from('session').insert(input).select(),
      "Couldn't create session, try again."
    )
    const session = data?.[0] ?? null
    set({
      sessionsLoading: false,
      sessionsError: error,
      ...(session ? { sessions: [...get().sessions, session] } : {}),
    })
    return session
  },

  updateSession: async (id, patch) => {
    set({ sessionsLoading: true, sessionsError: null })
    const { data, error } = await runSupabaseAction<Session[]>(
      () => supabase.from('session').update(patch).eq('id', id).select(),
      "Couldn't save session, try again."
    )
    const session = data?.[0] ?? null
    set({
      sessionsLoading: false,
      sessionsError: error,
      ...(session ? { sessions: get().sessions.map((s) => (s.id === id ? session : s)) } : {}),
    })
    return session
  },
})
