import type { StateCreator } from 'zustand'
import { supabase } from '../../lib/supabase'
import { runSupabaseAction } from '../supabaseAction'
import type { ArrowKind, PhasePoint, Tactic, TacticBoard } from '../types'
import type { StoreState } from '../useStore'

export interface NewTacticInput {
  team_id: string
  name: string
  board?: TacticBoard
}

export interface TacticUpdateInput {
  name?: string
  board?: TacticBoard
}

// Same id-generation approach as drillSlice.ts — one place to swap the
// strategy later if crypto.randomUUID ever isn't available.
function generateId(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function makeBlankBoard(): TacticBoard {
  return { players: [], arrows: [], annotations: [] }
}

export interface TacticSlice {
  tactics: Tactic[]
  tacticsLoading: boolean
  tacticsError: string | null

  // Tactics are always team-scoped (no coach-owned/unscoped case like
  // drill has), so — unlike drillSlice.fetchDrills — this is a plain
  // team_id equality filter.
  fetchTactics: (teamId: string) => Promise<void>
  createTactic: (input: NewTacticInput) => Promise<Tactic | null>
  updateTactic: (id: string, patch: TacticUpdateInput) => Promise<Tactic | null>
  deleteTactic: (id: string) => Promise<boolean>

  // Local-only reposition of one placed player on the board — no Supabase
  // call. Same split as drillSlice.setPhaseElementPosition: called on every
  // Konva dragmove for a responsive canvas, and once more on dragend
  // immediately before the caller's single updateTactic write.
  setTacticPlayerPosition: (tacticId: string, tacticPlayerId: string, position: PhasePoint) => void

  // Local-only append of a roster player onto the board at `position` —
  // same local-mutate-then-one-write split as every drillSlice mutation.
  addTacticPlayer: (tacticId: string, playerId: string, position: PhasePoint) => void

  // Local-only removal of one placed player from the board — returns them
  // to the "unplaced" roster panel (TacticBoard.tsx derives that list by
  // filtering the roster against board.players, not via any state here).
  removeTacticPlayer: (tacticId: string, tacticPlayerId: string) => void

  // Local-only append of one arrow (from -> to, both normalized 0-1) —
  // same two-point shape as drillSlice.addArrow.
  addTacticArrow: (tacticId: string, from: PhasePoint, to: PhasePoint, kind: ArrowKind) => void
  removeTacticArrow: (tacticId: string, arrowId: string) => void

  addTacticAnnotation: (tacticId: string, position: PhasePoint, text: string) => void
  removeTacticAnnotation: (tacticId: string, annotationId: string) => void
}

export const createTacticSlice: StateCreator<StoreState, [], [], TacticSlice> = (set, get) => {
  // Same stale-response guard as drillSlice/sessionSlice — see the comment there.
  let latestFetchTeamId: string | null = null

  return {
    tactics: [],
    tacticsLoading: false,
    tacticsError: null,

    fetchTactics: async (teamId) => {
      latestFetchTeamId = teamId
      set({ tacticsLoading: true, tacticsError: null })
      const { data, error } = await runSupabaseAction<Tactic[]>(
        () => supabase.from('tactic').select('*').eq('team_id', teamId).order('created_at', { ascending: true }),
        "Couldn't load tactics, try again."
      )
      if (latestFetchTeamId !== teamId) return // superseded by a newer team switch
      set({
        tacticsLoading: false,
        tacticsError: error,
        ...(data ? { tactics: data } : {}),
      })
    },

    createTactic: async (input) => {
      set({ tacticsLoading: true, tacticsError: null })
      const withBoard = { ...input, board: input.board ?? makeBlankBoard() }
      const { data, error } = await runSupabaseAction<Tactic[]>(
        () => supabase.from('tactic').insert(withBoard).select(),
        "Couldn't create tactic, try again."
      )
      const tactic = data?.[0] ?? null
      set({
        tacticsLoading: false,
        tacticsError: error,
        ...(tactic ? { tactics: [...get().tactics, tactic] } : {}),
      })
      return tactic
    },

    updateTactic: async (id, patch) => {
      set({ tacticsLoading: true, tacticsError: null })
      const { data, error } = await runSupabaseAction<Tactic[]>(
        () => supabase.from('tactic').update(patch).eq('id', id).select(),
        "Couldn't save tactic, try again."
      )
      const tactic = data?.[0] ?? null
      set({
        tacticsLoading: false,
        tacticsError: error,
        ...(tactic ? { tactics: get().tactics.map((t) => (t.id === id ? tactic : t)) } : {}),
      })
      return tactic
    },

    deleteTactic: async (id) => {
      set({ tacticsLoading: true, tacticsError: null })
      const { error } = await runSupabaseAction<null>(
        () => supabase.from('tactic').delete().eq('id', id),
        "Couldn't delete tactic, try again."
      )
      if (error) {
        set({ tacticsLoading: false, tacticsError: error })
        return false
      }
      set((state) => ({
        tacticsLoading: false,
        tacticsError: null,
        tactics: state.tactics.filter((t) => t.id !== id),
      }))
      return true
    },

    setTacticPlayerPosition: (tacticId, tacticPlayerId, position) => {
      set({
        tactics: get().tactics.map((t) => {
          if (t.id !== tacticId) return t
          return {
            ...t,
            board: {
              ...t.board,
              players: t.board.players.map((p) => (p.id === tacticPlayerId ? { ...p, ...position } : p)),
            },
          }
        }),
      })
    },

    addTacticPlayer: (tacticId, playerId, position) => {
      set({
        tactics: get().tactics.map((t) => {
          if (t.id !== tacticId) return t
          return {
            ...t,
            board: {
              ...t.board,
              players: [...t.board.players, { id: generateId('tplayer'), player_id: playerId, ...position }],
            },
          }
        }),
      })
    },

    removeTacticPlayer: (tacticId, tacticPlayerId) => {
      set({
        tactics: get().tactics.map((t) => {
          if (t.id !== tacticId) return t
          return { ...t, board: { ...t.board, players: t.board.players.filter((p) => p.id !== tacticPlayerId) } }
        }),
      })
    },

    addTacticArrow: (tacticId, from, to, kind) => {
      set({
        tactics: get().tactics.map((t) => {
          if (t.id !== tacticId) return t
          return {
            ...t,
            board: { ...t.board, arrows: [...t.board.arrows, { id: generateId('arrow'), from, to, kind }] },
          }
        }),
      })
    },

    removeTacticArrow: (tacticId, arrowId) => {
      set({
        tactics: get().tactics.map((t) => {
          if (t.id !== tacticId) return t
          return { ...t, board: { ...t.board, arrows: t.board.arrows.filter((a) => a.id !== arrowId) } }
        }),
      })
    },

    addTacticAnnotation: (tacticId, position, text) => {
      set({
        tactics: get().tactics.map((t) => {
          if (t.id !== tacticId) return t
          return {
            ...t,
            board: {
              ...t.board,
              annotations: [...t.board.annotations, { id: generateId('note'), text, ...position }],
            },
          }
        }),
      })
    },

    removeTacticAnnotation: (tacticId, annotationId) => {
      set({
        tactics: get().tactics.map((t) => {
          if (t.id !== tacticId) return t
          return {
            ...t,
            board: { ...t.board, annotations: t.board.annotations.filter((a) => a.id !== annotationId) },
          }
        }),
      })
    },
  }
}
