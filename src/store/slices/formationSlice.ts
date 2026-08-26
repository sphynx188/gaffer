import type { StateCreator } from 'zustand'
import { supabase } from '../../lib/supabase'
import { runSupabaseAction } from '../supabaseAction'
import type { CustomFormation, PlayerRole } from '../types'
import type { StoreState } from '../useStore'

// Custom formations (TACTICS_BOARD_REWORK_PLAN.md Stage 3.4, migration 022).
//
// Its own slice rather than part of tacticSlice, because the scope is
// different in a way that matters: tactics are team-scoped and cleared on
// every team switch (`clearTeamScopedState` in teamSlice), while a coach's
// saved shapes belong to the coach and must survive one. Folding them into
// tacticSlice would mean either exempting one field from that clear — a trap
// for the next person to add a field — or re-fetching them on every switch.

export interface NewFormationInput {
  name: string
  slots: { role: PlayerRole; x: number; y: number }[]
}

export interface FormationSlice {
  customFormations: CustomFormation[]
  customFormationsLoading: boolean
  customFormationsError: string | null

  // No team filter and no owner filter: RLS scopes this to the caller's own
  // rows (migration 022's `formation_all_owner`), so asking for everything is
  // asking for mine. Same reasoning as every other policy-scoped read here.
  fetchCustomFormations: () => Promise<void>
  // `owner_id` is set from the session rather than passed in — the RLS check
  // would reject anything else, and making it a parameter would invite a
  // caller to think it was theirs to choose.
  createCustomFormation: (input: NewFormationInput) => Promise<CustomFormation | null>
  renameCustomFormation: (id: string, name: string) => Promise<CustomFormation | null>
  deleteCustomFormation: (id: string) => Promise<boolean>
}

export const createFormationSlice: StateCreator<StoreState, [], [], FormationSlice> = (set, get) => ({
  customFormations: [],
  customFormationsLoading: false,
  customFormationsError: null,

  fetchCustomFormations: async () => {
    set({ customFormationsLoading: true, customFormationsError: null })
    const { data, error } = await runSupabaseAction<CustomFormation[]>(
      () => supabase.from('formation').select('*').order('created_at', { ascending: true }),
      "Couldn't load your saved formations, try again."
    )
    set({
      customFormationsLoading: false,
      customFormationsError: error,
      ...(data ? { customFormations: data } : {}),
    })
  },

  createCustomFormation: async ({ name, slots }) => {
    set({ customFormationsLoading: true, customFormationsError: null })
    const { data: auth } = await supabase.auth.getUser()
    const ownerId = auth.user?.id
    if (!ownerId) {
      set({ customFormationsLoading: false, customFormationsError: "You're signed out — sign in and try again." })
      return null
    }
    const { data, error } = await runSupabaseAction<CustomFormation[]>(
      () => supabase.from('formation').insert({ owner_id: ownerId, name, slots }).select(),
      "Couldn't save that formation, try again."
    )
    const formation = data?.[0] ?? null
    set({
      customFormationsLoading: false,
      customFormationsError: error,
      ...(formation ? { customFormations: [...get().customFormations, formation] } : {}),
    })
    return formation
  },

  renameCustomFormation: async (id, name) => {
    set({ customFormationsLoading: true, customFormationsError: null })
    const { data, error } = await runSupabaseAction<CustomFormation[]>(
      () => supabase.from('formation').update({ name }).eq('id', id).select(),
      "Couldn't rename that formation, try again."
    )
    const formation = data?.[0] ?? null
    set({
      customFormationsLoading: false,
      customFormationsError: error,
      ...(formation
        ? { customFormations: get().customFormations.map((f) => (f.id === id ? formation : f)) }
        : {}),
    })
    return formation
  },

  deleteCustomFormation: async (id) => {
    set({ customFormationsLoading: true, customFormationsError: null })
    const { error } = await runSupabaseAction<null>(
      () => supabase.from('formation').delete().eq('id', id),
      "Couldn't delete that formation, try again."
    )
    if (error) {
      set({ customFormationsLoading: false, customFormationsError: error })
      return false
    }
    set((state) => ({
      customFormationsLoading: false,
      customFormationsError: null,
      customFormations: state.customFormations.filter((f) => f.id !== id),
    }))
    return true
  },
})
