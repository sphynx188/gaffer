import type { StateCreator } from 'zustand'
import { supabase } from '../../lib/supabase'
import { runSupabaseAction } from '../supabaseAction'
import type { Drill, DrillPhase, PitchFormat } from '../types'
import type { StoreState } from '../useStore'

export interface NewDrillInput {
  team_id: string | null
  name: string
  pitch_format: PitchFormat
  phases?: DrillPhase[]
}

export interface DrillUpdateInput {
  name?: string
  pitch_format?: PitchFormat
  phases?: DrillPhase[]
}

export interface DrillSlice {
  drills: Drill[]
  drillsLoading: boolean
  drillsError: string | null

  // Coach-owned drills (team_id null) are reusable across every team, so a
  // drill fetch is always scoped to "this team OR nobody's team" — never a
  // plain team_id equality filter. See gaffer_project_plan_final.md §5.
  fetchDrills: (teamId: string) => Promise<void>
  createDrill: (input: NewDrillInput) => Promise<Drill | null>
  updateDrill: (id: string, patch: DrillUpdateInput) => Promise<Drill | null>
}

export const createDrillSlice: StateCreator<StoreState, [], [], DrillSlice> = (set, get) => ({
  drills: [],
  drillsLoading: false,
  drillsError: null,

  fetchDrills: async (teamId) => {
    set({ drillsLoading: true, drillsError: null })
    const { data, error } = await runSupabaseAction<Drill[]>(
      () =>
        supabase
          .from('drill')
          .select('*')
          .or(`team_id.eq.${teamId},team_id.is.null`)
          .order('created_at', { ascending: true }),
      "Couldn't load drills, try again."
    )
    set({
      drillsLoading: false,
      drillsError: error,
      ...(data ? { drills: data } : {}),
    })
  },

  createDrill: async (input) => {
    set({ drillsLoading: true, drillsError: null })
    const { data, error } = await runSupabaseAction<Drill[]>(
      () => supabase.from('drill').insert(input).select(),
      "Couldn't create drill, try again."
    )
    const drill = data?.[0] ?? null
    set({
      drillsLoading: false,
      drillsError: error,
      ...(drill ? { drills: [...get().drills, drill] } : {}),
    })
    return drill
  },

  // Used for every drill mutation, including canvas edits: the Design
  // phase (2b) fires this with just `{ phases }` on dragend, so the
  // Supabase write pattern is already centralized here before that UI exists.
  updateDrill: async (id, patch) => {
    set({ drillsLoading: true, drillsError: null })
    const { data, error } = await runSupabaseAction<Drill[]>(
      () => supabase.from('drill').update(patch).eq('id', id).select(),
      "Couldn't save drill, try again."
    )
    const drill = data?.[0] ?? null
    set({
      drillsLoading: false,
      drillsError: error,
      ...(drill ? { drills: get().drills.map((d) => (d.id === id ? drill : d)) } : {}),
    })
    return drill
  },
})
