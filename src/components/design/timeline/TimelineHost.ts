import type {
  DrillScene,
  EntityState,
  Keyframe,
  Marking,
  PitchConfig,
  SceneEntity,
  TacticPhase,
} from '../../../store'

// What the timeline needs from whatever document it is editing
// (TACTICS_BOARD_REWORK_PLAN.md Stage 5.1).
//
// Before this existed, `TimelineEditor` and `useKeyframeToggle` reached into
// the store for `drill`-shaped actions, which made them drill-only for no
// reason other than which slice they happened to call. Everything else in this
// folder — TimelineBar, useTimelineKeys, useTimelinePlayback, onionSkin,
// speeds, cursor — was already pure props and needed no change at all. So the
// parameterisation is deliberately narrow: it is those two files, and nothing
// else in the timeline knows a drill from a tactic.
//
// Actions are PRE-BOUND to their document, so a consumer never handles an id
// and can't pass the wrong one. Each editor supplies its own adapter —
// `useDrillTimelineHost`, `useTacticTimelineHost` — which is also what keeps
// this folder from importing either domain.
//
// The name is historical: this started life in Stage 5.1 as the timeline's
// contract, and Stage 7.3 grew it into the shared "editable document" contract
// for the editor surfaces generally, so the inspector could be parameterised
// the same way rather than getting a second, near-identical host of its own.

export interface TimelineHost {
  scene: DrillScene
  keyframes: Keyframe[]
  duration: number
  pitch: PitchConfig

  // Entity and marking edits — the inspector's half of the contract (7.3).
  updateEntity: (entityId: string, patch: Partial<Omit<SceneEntity, 'id' | 'kind'>>) => void
  updateMarking: (markingId: string, patch: Partial<Omit<Marking, 'id'>>) => void

  addKeyframe: (t: number, states?: Record<string, EntityState>) => string | null
  updateKeyframeState: (keyframeId: string, states: Record<string, EntityState>) => void
  moveKeyframe: (keyframeId: string, t: number) => void
  deleteKeyframe: (keyframeId: string) => void
  clearKeyframes: () => void
  balanceTiming: () => void
  setDuration: (seconds: number) => void

  // ── Optional capabilities ───────────────────────────────────────────────
  // Absent on the drill host, and the timeline hides the controls that need
  // them rather than rendering something inert. Phases and keyframe
  // copy/paste are tactics concepts (plan 2.2, 5.2); giving drills their own
  // would be a change to a shipped editor that nothing has asked for.

  /** Named, coloured bands over the keyframe track. Never affects interpolation. */
  phases?: TacticPhase[]
  addPhase?: (phase: Omit<TacticPhase, 'id'>) => string | null
  updatePhase?: (phaseId: string, patch: Partial<Omit<TacticPhase, 'id'>>) => void
  removePhase?: (phaseId: string) => void

  /** Ctrl+C / Ctrl+V over a whole keyframe (plan 5.6). */
  copyKeyframe?: (keyframeId: string) => void
  pasteKeyframe?: (t: number) => string | null
  /** Whether there is anything on the clipboard to paste. */
  canPaste?: boolean
}
