import type { StateCreator } from 'zustand'
import { supabase } from '../../lib/supabase'
import { runSupabaseAction } from '../supabaseAction'
import type { Drill, DrillPhase, EquipmentKind, PhasePoint, PitchOrientation, PitchSize } from '../types'
import type { StoreState } from '../useStore'

export interface NewDrillInput {
  team_id: string | null
  name: string
  pitch_size: PitchSize
  orientation: PitchOrientation
  phases?: DrillPhase[]
}

export interface DrillUpdateInput {
  name?: string
  pitch_size?: PitchSize
  orientation?: PitchOrientation
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

  // Local-only append of a new player/cone/ball onto the phase at
  // `phaseIndex`, positioned at `position` — same split as every other
  // phases-array mutation here (local update now, caller fires one
  // `updateDrill` write). `extra` carries the one or two fields each
  // element type needs beyond position: players need a `team` label (drives
  // color assignment — see pitchTheme.ts), cones optionally take a `color`
  // and/or `kind` (cone/witches_hat/mannequin — Upgrade Phase 2B), balls
  // take nothing.
  addElement: (
    drillId: string,
    phaseIndex: number,
    elementType: DrillElementType,
    position: PhasePoint,
    extra?: { team?: string; color?: string; kind?: EquipmentKind }
  ) => void

  // Local-only removal of one player/cone/ball from the phase at
  // `phaseIndex`, by element id.
  removeElement: (drillId: string, phaseIndex: number, elementType: DrillElementType, elementId: string) => void

  // Local-only removal of one annotation from the phase at `phaseIndex`.
  removeAnnotation: (drillId: string, phaseIndex: number, annotationId: string) => void

  // Local-only patch of a phase's own metadata (label, duration) — same
  // local-mutate-then-one-write split as every other phases mutation here.
  updatePhaseMeta: (drillId: string, phaseIndex: number, patch: { label?: string; duration_seconds?: number }) => void
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
      // A drill always keeps at least one phase (see deletePhase) — enforce
      // that from creation too, rather than only once something tries to
      // delete down to zero. Without this, a freshly created drill would
      // have no phase to view/edit/place elements on at all.
      const withPhase = { ...input, phases: input.phases ?? [makeBlankPhase()] }
      const { data, error } = await runSupabaseAction<Drill[]>(
        () => supabase.from('drill').insert(withPhase).select(),
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

    addElement: (drillId, phaseIndex, elementType, position, extra) => {
      set({
        drills: get().drills.map((d) => {
          if (d.id !== drillId) return d
          return {
            ...d,
            phases: d.phases.map((ph, i) => {
              if (i !== phaseIndex) return ph
              switch (elementType) {
                case 'players':
                  return {
                    ...ph,
                    players: [...ph.players, { id: generateId('player'), team: extra?.team ?? 'A', ...position }],
                  }
                case 'cones':
                  return {
                    ...ph,
                    cones: [...ph.cones, { id: generateId('cone'), color: extra?.color, kind: extra?.kind, ...position }],
                  }
                case 'balls':
                  return { ...ph, balls: [...ph.balls, { id: generateId('ball'), ...position }] }
              }
            }),
          }
        }),
      })
    },

    removeElement: (drillId, phaseIndex, elementType, elementId) => {
      set({
        drills: get().drills.map((d) => {
          if (d.id !== drillId) return d
          return {
            ...d,
            phases: d.phases.map((ph, i) => {
              if (i !== phaseIndex) return ph
              switch (elementType) {
                case 'players':
                  return { ...ph, players: ph.players.filter((p) => p.id !== elementId) }
                case 'cones':
                  return { ...ph, cones: ph.cones.filter((c) => c.id !== elementId) }
                case 'balls':
                  return { ...ph, balls: ph.balls.filter((b) => b.id !== elementId) }
              }
            }),
          }
        }),
      })
    },

    removeAnnotation: (drillId, phaseIndex, annotationId) => {
      set({
        drills: get().drills.map((d) => {
          if (d.id !== drillId) return d
          return {
            ...d,
            phases: d.phases.map((ph, i) =>
              i === phaseIndex ? { ...ph, annotations: ph.annotations.filter((a) => a.id !== annotationId) } : ph
            ),
          }
        }),
      })
    },

    updatePhaseMeta: (drillId, phaseIndex, patch) => {
      set({
        drills: get().drills.map((d) => {
          if (d.id !== drillId) return d
          return {
            ...d,
            phases: d.phases.map((ph, i) => (i === phaseIndex ? { ...ph, ...patch } : ph)),
          }
        }),
      })
    },
  }
}
