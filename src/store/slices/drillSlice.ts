import type { StateCreator } from 'zustand'
import { supabase } from '../../lib/supabase'
import { runSupabaseAction } from '../supabaseAction'
import type { Drill, DrillPhase, PhasePoint, PitchFormat } from '../types'
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

// The three phase-element arrays a canvas element can belong to — arrows
// aren't draggable yet either (not required by any Phase 0-3 user story).
// Annotations are placed (2c, US-13) rather than dragged, so they're handled
// by `addAnnotation` below instead of this drag machinery.
export type DrillElementType = 'players' | 'cones' | 'balls'

// 'duplicate' deep-copies the currently-viewed phase as a starting point
// (build guide 2c, step 2); 'blank' starts a phase with empty element
// arrays.
export type NewPhaseMode = 'duplicate' | 'blank'

// Every generated id (new phase, new annotation) goes through here — one
// place to swap the id strategy later if `crypto.randomUUID` ever isn't
// available (it is in every browser this app targets: Vercel-hosted HTTPS,
// modern iOS/Android/desktop browsers).
function generateId(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

// Pure, local-only: moves one element within one phase and returns a new
// DrillPhase (never mutates). Shared by dragmove (local-only) and dragend
// (local update immediately followed by the one Supabase write) so both
// paths apply the exact same immutable-update logic.
function movePhaseElement(
  phase: DrillPhase,
  elementType: DrillElementType,
  elementId: string,
  position: PhasePoint
): DrillPhase {
  switch (elementType) {
    case 'players':
      return { ...phase, players: phase.players.map((p) => (p.id === elementId ? { ...p, ...position } : p)) }
    case 'cones':
      return { ...phase, cones: phase.cones.map((c) => (c.id === elementId ? { ...c, ...position } : c)) }
    case 'balls':
      return { ...phase, balls: phase.balls.map((b) => (b.id === elementId ? { ...b, ...position } : b)) }
  }
}

function makeBlankPhase(): DrillPhase {
  return { id: generateId('phase'), players: [], cones: [], balls: [], arrows: [], annotations: [] }
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

  // Phase 2b (US-11): local-only reposition of one player/cone/ball within
  // one phase — no Supabase call. Called on every Konva `dragmove` so the
  // canvas stays responsive, and once more on `dragend` immediately before
  // the single `updateDrill` write that persists it (see PitchCanvas.tsx /
  // DrillPreview.tsx).
  setPhaseElementPosition: (
    drillId: string,
    phaseIndex: number,
    elementType: DrillElementType,
    elementId: string,
    position: PhasePoint
  ) => void

  // Phase 2c (US-12): local-only insertion of a new phase immediately after
  // `afterIndex` — no Supabase call, same split as setPhaseElementPosition.
  // The caller (DrillPreview.tsx) reads the drill back out of the store
  // immediately afterward and fires one `updateDrill` to persist it.
  addPhase: (drillId: string, afterIndex: number, mode: NewPhaseMode) => void

  // Phase 2c (US-12): local-only removal of the phase at `phaseIndex`. A
  // drill always keeps at least one phase, so deleting the last remaining
  // one is a no-op rather than leaving `phases` empty.
  deletePhase: (drillId: string, phaseIndex: number) => void

  // Phase 2c (US-13): local-only append of one text annotation, positioned
  // at `position` (already normalized 0-1, same coordinate space every
  // other phase element uses), onto the phase at `phaseIndex`.
  addAnnotation: (drillId: string, phaseIndex: number, position: PhasePoint, text: string) => void
}

export const createDrillSlice: StateCreator<StoreState, [], [], DrillSlice> = (set, get) => {
  // Same stale-response guard as sessionSlice — see the comment there.
  let latestFetchTeamId: string | null = null

  return {
    drills: [],
    drillsLoading: false,
    drillsError: null,

    fetchDrills: async (teamId) => {
      latestFetchTeamId = teamId
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
      if (latestFetchTeamId !== teamId) return // superseded by a newer team switch
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

    setPhaseElementPosition: (drillId, phaseIndex, elementType, elementId, position) => {
      set({
        drills: get().drills.map((d) => {
          if (d.id !== drillId) return d
          return {
            ...d,
            phases: d.phases.map((ph, i) =>
              i === phaseIndex ? movePhaseElement(ph, elementType, elementId, position) : ph
            ),
          }
        }),
      })
    },

    addPhase: (drillId, afterIndex, mode) => {
      set({
        drills: get().drills.map((d) => {
          if (d.id !== drillId) return d
          const source = d.phases[afterIndex]
          // Deep-copy-by-value: a fresh phase id keeps it independently
          // steppable/deletable, but element ids are kept as-is — they only
          // ever need to be unique *within* their own phase (every lookup is
          // scoped by phaseIndex + elementId), so reusing them across phases
          // is safe and means a duplicated phase drags exactly like its
          // source until edited.
          const newPhase: DrillPhase =
            mode === 'duplicate' && source
              ? { ...source, id: generateId('phase'), label: source.label ? `${source.label} (copy)` : undefined }
              : makeBlankPhase()
          const phases = [...d.phases]
          phases.splice(afterIndex + 1, 0, newPhase)
          return { ...d, phases }
        }),
      })
    },

    deletePhase: (drillId, phaseIndex) => {
      set({
        drills: get().drills.map((d) => {
          if (d.id !== drillId) return d
          if (d.phases.length <= 1) return d // always keep at least one phase
          return { ...d, phases: d.phases.filter((_, i) => i !== phaseIndex) }
        }),
      })
    },

    addAnnotation: (drillId, phaseIndex, position, text) => {
      set({
        drills: get().drills.map((d) => {
          if (d.id !== drillId) return d
          return {
            ...d,
            phases: d.phases.map((ph, i) =>
              i === phaseIndex
                ? { ...ph, annotations: [...ph.annotations, { id: generateId('note'), text, ...position }] }
                : ph
            ),
          }
        }),
      })
    },
  }
}
