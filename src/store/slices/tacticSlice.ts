import type { StateCreator } from 'zustand'
import { createClient } from '@supabase/supabase-js'
import { supabase, supabaseAnonKey, supabaseUrl } from '../../lib/supabase'
import { runSupabaseAction } from '../supabaseAction'
import { mintShareToken } from '../shareToken'
import * as scene from '../sceneActions'
import { assignToFormation, type FormationSlot } from '../../components/tactics/formations'
import type { NewEntityInput } from '../sceneActions'
// Type-only, so no runtime coupling between the slices: `SaveState` is a
// store-level concept both editors' save indicators read, and drillSlice is
// simply where it was first declared.
import type { SaveState } from './drillSlice'
import type {
  DrillScene,
  EntityKind,
  EntityState,
  Keyframe,
  Marking,
  PhasePoint,
  PitchConfig,
  PitchOrientation,
  Tactic,
  TacticPhase,
  TacticSide,
} from '../types'
import type { StoreState } from '../useStore'

// tacticSlice, rebuilt on entities and keyframes (TACTICS_BOARD_REWORK_PLAN.md
// Stage 2), with `drillSlice.ts` as the reference implementation: the same
// local-mutate-then-debounced-autosave split, the same bounded undo stack, and
// the same scene reducers — literally the same, via `sceneActions.ts` (2.4).
//
// ── On the action names ───────────────────────────────────────────────────
// The plan asks for "same action names" as drillSlice. That isn't available:
// there is exactly ONE Zustand store (CLAUDE.md — a second one must never be
// introduced), so `addEntity`, `undo` and `saveState` are already taken by
// drillSlice and a duplicate key would silently shadow it. Every action below
// therefore carries a `Tactic` infix, which is the convention this slice
// already used (`addTacticPlayer`). The signatures, semantics and structure
// are identical to drillSlice's, which is what 2.1 is actually asking for.
//
// ── On the two undo stacks (2.3) ──────────────────────────────────────────
// Teloframe keeps drawing undo and timeline undo separate, and so does this.
// A coach who clears their drawings must not be able to press Ctrl+Z twice
// and find themselves back inside the animation's history. See TacticStacks.

export interface NewTacticInput {
  team_id: string
  name: string
}

// Deliberately does NOT carry scene/keyframes/phases/duration_seconds/pitch/
// sides/view. Those are written by the autosave flush below and nothing else,
// so there is exactly one path a tactic's content can take to the database —
// a second one through here would be a way to bypass the undo stack and the
// debounce without noticing. Same rule, same reason, as DrillUpdateInput.
export interface TacticUpdateInput {
  name?: string
  // Written only by enableTacticSharing/disableTacticSharing, never typed into
  // a form — the same carve-out DrillUpdateInput makes. It is a real column
  // rather than editor content, so it does not go through the autosave flush
  // the comment above rules everything else out of.
  share_token?: string | null
}

// Which history a mutation belongs to. `drawing` covers markings — arrows,
// zones, notes; `timeline` covers everything else.
export type TacticUndoScope = 'timeline' | 'drawing'

// What the timeline stack snapshots: plan 2.3's list exactly. Note `view` is
// absent on purpose — single/dual is a way of LOOKING at a tactic, not part of
// it, so it saves like everything else but is not something Ctrl+Z steps back
// through.
interface TacticSnapshot {
  scene: DrillScene
  keyframes: Keyframe[]
  phases: TacticPhase[]
  duration_seconds: number
  pitch: PitchConfig
  sides: { home: TacticSide; away: TacticSide }
}

// What actually gets written. The snapshot plus `view`.
type TacticSave = TacticSnapshot & { view: 'single' | 'dual' }

interface TacticStacks {
  // Whole-document snapshots.
  timeline: { past: TacticSnapshot[]; future: TacticSnapshot[] }
  // Free-drawn markings only — see mergeMarkings for the partition.
  drawing: { past: Marking[][]; future: Marking[][] }
}

// ── How the two stacks divide the document (plan 2.3) ─────────────────────
// They own disjoint halves of it, and restoring one leaves the other's state
// exactly as it stands. The split runs through `scene.markings`:
//
//   * a marking BOUND to a keyframe (`keyframeId` set) lives and dies with
//     that keyframe — deleteKeyframe takes it — so it is part of the
//     animation and belongs to the TIMELINE scope.
//   * a free-drawn arrow, zone or note belongs to the DRAWING scope.
//
// Without this partition each stack would clobber the other: undoing a
// drawing edit would resurrect markings a keyframe deletion had removed, and
// undoing an animation step would silently wipe arrows the coach drew
// afterwards. The first is what 2.3 explicitly forbids; the second was
// observed in testing and is worse, because it looks like data loss.
//
// Restored markings lead the merged array, so a restore can reorder a bound
// marking relative to a free one. That is invisible unless two markings
// overlap, and is a far better trade than either kind disappearing.
function ownedBy(marking: Marking, scope: TacticUndoScope): boolean {
  return scope === 'drawing' ? !marking.keyframeId : !!marking.keyframeId
}

function mergeMarkings(restored: Marking[], current: Marking[], scope: TacticUndoScope): Marking[] {
  return [
    ...restored.filter((m) => ownedBy(m, scope)),
    ...current.filter((m) => !ownedBy(m, scope)),
  ]
}

function drawnMarkings(markings: Marking[]): Marking[] {
  return markings.filter((m) => ownedBy(m, 'drawing'))
}

// Restores a timeline snapshot while leaving the coach's free-drawn markings
// alone.
function restoreTimeline(tactic: Tactic, snapshot: TacticSnapshot): Tactic {
  const next = applySnapshot(tactic, snapshot)
  return {
    ...next,
    scene: {
      ...next.scene,
      markings: mergeMarkings(snapshot.scene.markings, tactic.scene.markings, 'timeline'),
    },
  }
}

// Restores the drawing layer while leaving every keyframe-bound marking alone.
function restoreDrawing(tactic: Tactic, drawn: Marking[]): Tactic {
  return {
    ...tactic,
    scene: { ...tactic.scene, markings: mergeMarkings(drawn, tactic.scene.markings, 'drawing') },
  }
}

const UNDO_LIMIT = 50
const AUTOSAVE_IDLE_MS = 800

function emptyStacks(): TacticStacks {
  return { timeline: { past: [], future: [] }, drawing: { past: [], future: [] } }
}

// A tactic always keeps at least one keyframe from creation — without one
// there is nowhere for addTacticEntity to record a position. Same rule as a
// drill's, and the same rule migration 020b's backfill followed for the four
// existing tactics.
function makeInitialKeyframe(): Keyframe {
  return { id: scene.generateId('keyframe'), t: 0, states: {} }
}

function snapshotOf(tactic: Tactic): TacticSnapshot {
  return {
    scene: tactic.scene,
    keyframes: tactic.keyframes,
    phases: tactic.phases,
    duration_seconds: tactic.duration_seconds,
    pitch: tactic.pitch,
    sides: tactic.sides,
  }
}

function saveOf(tactic: Tactic): TacticSave {
  return { ...snapshotOf(tactic), view: tactic.view }
}

function applySnapshot(tactic: Tactic, snapshot: TacticSnapshot): Tactic {
  return { ...tactic, ...snapshot }
}

// Reference equality is an exact "nothing changed" test here because every
// reducer in sceneActions rebuilds the objects it touches and never mutates
// in place — that is the decline convention documented at the top of it.
function snapshotsMatch(a: TacticSnapshot, b: TacticSnapshot): boolean {
  return (
    a.scene === b.scene &&
    a.keyframes === b.keyframes &&
    a.phases === b.phases &&
    a.duration_seconds === b.duration_seconds &&
    a.pitch === b.pitch &&
    a.sides === b.sides
  )
}

export interface TacticSlice {
  tactics: Tactic[]
  tacticsLoading: boolean
  tacticsError: string | null
  // Drives the tactics editor's save indicator. Separate from drillSlice's
  // `saveState` because a coach can have a drill mid-save and then navigate to
  // a tactic; one shared field would show the wrong document's status.
  tacticSaveState: SaveState
  // The copied keyframe (Ctrl+C / Ctrl+V, plan 2.2). In store state rather
  // than the closure — unlike the undo stacks — precisely because a Paste
  // control needs to disable itself when there is nothing to paste, and a
  // closure variable would never re-render it.
  tacticClipboard: Keyframe | null

  // Tactics are always team-scoped (no coach-owned/unscoped case like drill
  // has), so — unlike drillSlice.fetchDrills — this is a plain team_id
  // equality filter.
  fetchTactics: (teamId: string) => Promise<void>
  createTactic: (input: NewTacticInput) => Promise<Tactic | null>
  updateTactic: (id: string, patch: TacticUpdateInput) => Promise<Tactic | null>
  deleteTactic: (id: string) => Promise<boolean>

  // ---------------------------------------------------------------------
  // Entities, keyframes and markings. Every action here is *committed*: it
  // pushes an undo snapshot onto the stack named in its scope, marks the
  // tactic dirty and schedules the debounced write.
  // `setTacticEntityPosition` is the single exception — see its own note.
  // ---------------------------------------------------------------------

  addTacticEntity: (
    tacticId: string,
    kind: EntityKind,
    position: PhasePoint,
    extra?: NewEntityInput
  ) => string | null
  updateTacticEntity: (tacticId: string, entityId: string, patch: NewEntityInput) => void
  removeTacticEntity: (tacticId: string, entityId: string) => void

  // The drag hot path. Called on every Konva `dragmove` with `commit` unset:
  // local state only, no undo snapshot, no write scheduled — which is what
  // makes a five-second drag cost exactly one Supabase call. Called once more
  // on `dragend` with `commit: true`, which pushes the position the entity
  // held when the drag *started* and schedules the write.
  setTacticEntityPosition: (
    tacticId: string,
    keyframeId: string,
    entityId: string,
    position: PhasePoint,
    commit?: boolean
  ) => void

  // Takes one entity off the pitch, or puts it back (Stage 4.2). Sets or
  // clears `{ hidden: true }` in THIS keyframe only, and never touches `x`/`y`
  // — that is the whole point: a player toggled off keeps the position they
  // were standing in, so toggling them back on returns them to it rather than
  // to some default. A player who has never BEEN on the pitch has no entity at
  // all; the panel creates one at the next free formation slot instead.
  setTacticEntityHidden: (tacticId: string, keyframeId: string, entityId: string, hidden: boolean) => void

  addTacticKeyframe: (tacticId: string, t: number, states?: Record<string, EntityState>) => string | null
  updateTacticKeyframeState: (tacticId: string, keyframeId: string, states: Record<string, EntityState>) => void
  moveTacticKeyframe: (tacticId: string, keyframeId: string, t: number) => void
  deleteTacticKeyframe: (tacticId: string, keyframeId: string) => void
  clearTacticKeyframes: (tacticId: string) => void
  balanceTacticTiming: (tacticId: string) => void

  // Ctrl+C / Ctrl+V over a whole keyframe (plan 2.2). Copy is not a mutation —
  // it neither commits nor saves, it only fills the clipboard.
  copyTacticKeyframe: (tacticId: string, keyframeId: string) => void
  pasteTacticKeyframe: (tacticId: string, t: number) => string | null

  addTacticMarking: (tacticId: string, marking: Omit<Marking, 'id'>) => string | null
  updateTacticMarking: (tacticId: string, markingId: string, patch: Partial<Omit<Marking, 'id'>>) => void
  removeTacticMarking: (tacticId: string, markingId: string) => void
  // Teloframe's "Clear drawings", listed in this stage's Verify step rather
  // than its action list. Empties the board of arrows, zones and notes and
  // leaves the animation completely alone — which is exactly the case the
  // two-stack design exists to protect.
  clearTacticDrawings: (tacticId: string) => void

  // Phases: named, coloured bands over the keyframe track. Organisational
  // only — they group keyframes for the coach and never affect interpolation,
  // which is why no reducer in sceneActions has heard of them.
  addTacticPhase: (tacticId: string, phase: Omit<TacticPhase, 'id'>) => string | null
  updateTacticPhase: (tacticId: string, phaseId: string, patch: Partial<Omit<TacticPhase, 'id'>>) => void
  removeTacticPhase: (tacticId: string, phaseId: string) => void

  // Sharing (Stage 8.2), mirroring drillSlice's three actions exactly. Opt-in
  // per tactic and revocable: the token is null until a coach turns sharing
  // on, and null again the moment they turn it off, which migration 023's
  // first conjunct turns into immediate revocation.
  enableTacticSharing: (tacticId: string) => Promise<string | null>
  disableTacticSharing: (tacticId: string) => Promise<boolean>
  /** Reads one tactic by token as an anonymous visitor would. */
  fetchSharedTactic: (token: string) => Promise<Tactic | null>

  setTacticSide: (tacticId: string, side: 'home' | 'away', patch: Partial<TacticSide>) => void

  // Re-shapes one side onto a formation's slots (Stage 3.2). Writes positions
  // into `keyframeId` ONLY — changing formation part-way through an animation
  // is a legitimate coaching move ("we start in a 4-4-2 and shift to a 4-2-4"),
  // not a reason to reset every other keyframe.
  //
  // Only that side's entities that are ON the pitch at this keyframe are
  // considered: a player toggled off (`hidden`) isn't in the shape, and
  // slotting them would silently put them back on it. Extra players beyond the
  // eleventh keep their current position rather than being stacked on a slot
  // someone else already has.
  //
  // Each assigned entity also takes its slot's `role`. That is what makes
  // "role affinity first" mean anything on the NEXT apply — every tactic
  // backfilled by 020b starts with no roles at all — and it is the per-tactic
  // role assignment Stage 4.4 describes. `sides[side].formation` is updated in
  // the same commit, so the picker and the pitch can never disagree.
  applyTacticFormation: (
    tacticId: string,
    side: 'home' | 'away',
    formationKey: string,
    slots: FormationSlot[],
    keyframeId: string
  ) => void
  setTacticView: (tacticId: string, view: 'single' | 'dual') => void
  setTacticPitch: (tacticId: string, pitch: PitchConfig) => void
  setTacticDuration: (tacticId: string, seconds: number) => void
  // The live orientation switcher (decided 2026-08-26). Transposes every
  // entity state, marking point and movement path in lockstep with the
  // markings — see canvas/transposeScene.ts, shared with the drill editor.
  setTacticOrientation: (tacticId: string, orientation: PitchOrientation) => void

  // Undo / redo, per scope. `canUndoTactic`/`canRedoTactic` take an id and a
  // scope because the stacks are per tactic and per scope. Subscribe to them
  // as `useStore((s) => s.canUndoTactic(id, 'timeline'))` — evaluating the
  // function inside the selector is what makes it reactive.
  undoTactic: (tacticId: string, scope: TacticUndoScope) => void
  redoTactic: (tacticId: string, scope: TacticUndoScope) => void
  canUndoTactic: (tacticId: string, scope: TacticUndoScope) => boolean
  canRedoTactic: (tacticId: string, scope: TacticUndoScope) => boolean

  // Writes any pending edit immediately instead of waiting out the debounce.
  // Call it on editor unmount and on route change.
  flushTacticSave: () => Promise<void>

}

export const createTacticSlice: StateCreator<StoreState, [], [], TacticSlice> = (set, get) => {
  // Same stale-response guard as drillSlice/sessionSlice — see the comment there.
  let latestFetchTeamId: string | null = null

  // Undo/redo stacks, keyed by tactic id. Held in the closure rather than in
  // `set` state for the reason drillSlice gives: nothing renders a stack
  // directly, and fifty snapshots per tactic sitting in reactive state would
  // be compared on every store update for no benefit. Every mutation that
  // touches a stack also calls `set`, so a `canUndoTactic` selector
  // re-evaluates at exactly the right moments.
  const history = new Map<string, TacticStacks>()

  // The autosave queue, holding the *content* rather than a tactic reference,
  // so a queued write survives `tactics` being emptied out from under it —
  // which is exactly what a team switch does (clearTeamScopedState).
  const pendingSaves = new Map<string, TacticSave>()

  // Pre-drag snapshots, one per tactic, captured on the first uncommitted
  // setTacticEntityPosition and consumed by the commit that follows.
  const pendingEdits = new Map<string, TacticSnapshot>()

  let saveTimer: ReturnType<typeof setTimeout> | null = null
  let flushing: Promise<void> | null = null

  const schedule = () => {
    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = setTimeout(() => {
      saveTimer = null
      void flush()
    }, AUTOSAVE_IDLE_MS)
  }

  const runFlush = async () => {
    if (saveTimer) {
      clearTimeout(saveTimer)
      saveTimer = null
    }
    if (pendingSaves.size === 0) return

    const batch = [...pendingSaves.entries()]
    pendingSaves.clear()
    set({ tacticSaveState: 'saving' })

    let failure: string | null = null
    for (const [tacticId, payload] of batch) {
      // The debounce sits above runSupabaseAction, never inside it — every
      // Supabase call in this app still funnels through that one wrapper
      // (CLAUDE.md).
      const { error } = await runSupabaseAction<Tactic[]>(
        () => supabase.from('tactic').update(payload).eq('id', tacticId).select(),
        "Couldn't save tactic, try again."
      )
      // Deliberately does not merge the response back into `tactics`: the
      // coach may well have edited again while this request was in flight.
      if (error) {
        failure = error
        if (!pendingSaves.has(tacticId)) pendingSaves.set(tacticId, payload)
      }
    }

    if (failure) {
      // No automatic retry: offline, that would spin. The next committed edit
      // schedules another attempt, and flushTacticSave forces one.
      set({ tacticSaveState: 'error', tacticsError: failure })
      return
    }
    if (pendingSaves.size > 0) {
      set({ tacticSaveState: 'dirty' })
      schedule()
      return
    }
    set({ tacticSaveState: 'saved' })
  }

  // Serialized: a forced flush arriving while a debounced one is still in
  // flight queues behind it instead of racing it into a double write.
  const flush = (): Promise<void> => {
    const next = (flushing ?? Promise.resolve()).then(runFlush).catch(() => {})
    flushing = next
    return next
  }

  const stacksFor = (tacticId: string): TacticStacks => history.get(tacticId) ?? emptyStacks()

  const pushTimeline = (tacticId: string, before: TacticSnapshot) => {
    const stacks = stacksFor(tacticId)
    history.set(tacticId, {
      ...stacks,
      // Any new edit abandons the redo branch, as undo/redo always does.
      timeline: { past: [...stacks.timeline.past, before].slice(-UNDO_LIMIT), future: [] },
    })
  }

  const pushDrawing = (tacticId: string, before: Marking[]) => {
    const stacks = stacksFor(tacticId)
    history.set(tacticId, {
      ...stacks,
      drawing: { past: [...stacks.drawing.past, before].slice(-UNDO_LIMIT), future: [] },
    })
  }

  const writeTactic = (tacticId: string, next: Tactic) => {
    set({
      tactics: get().tactics.map((t) => (t.id === tacticId ? next : t)),
      tacticSaveState: 'dirty',
    })
    pendingSaves.set(tacticId, saveOf(next))
    schedule()
  }

  // The one path a committed mutation takes: snapshot for undo (onto the stack
  // its scope names), apply, mark dirty, schedule the write. A mutator returns
  // the tactic it was handed to decline.
  const commit = (tacticId: string, scope: TacticUndoScope, mutate: (tactic: Tactic) => Tactic) => {
    const current = get().tactics.find((t) => t.id === tacticId)
    if (!current) return
    const next = mutate(current)
    if (next === current) return
    if (scope === 'drawing') {
      pushDrawing(tacticId, drawnMarkings(current.scene.markings))
    } else {
      // If a drag is in flight, its pre-drag snapshot is the right undo target
      // — the tactic's current state already includes the uncommitted movement.
      const before = pendingEdits.get(tacticId) ?? snapshotOf(current)
      pendingEdits.delete(tacticId)
      pushTimeline(tacticId, before)
    }
    writeTactic(tacticId, next)
  }

  // A mutation that saves but is deliberately outside both undo stacks —
  // `setTacticView` is the only one. See TacticSnapshot on why `view` isn't
  // document content.
  const commitUntracked = (tacticId: string, mutate: (tactic: Tactic) => Tactic) => {
    const current = get().tactics.find((t) => t.id === tacticId)
    if (!current) return
    const next = mutate(current)
    if (next === current) return
    writeTactic(tacticId, next)
  }

  // Promotes a drag that never received its `dragend` — a gesture interrupted
  // by navigation — into a real committed edit.
  const settlePendingEdits = () => {
    if (pendingEdits.size === 0) return
    let settled = false
    for (const [tacticId, before] of pendingEdits) {
      const tactic = get().tactics.find((t) => t.id === tacticId)
      if (!tactic || snapshotsMatch(before, snapshotOf(tactic))) continue
      pushTimeline(tacticId, before)
      pendingSaves.set(tacticId, saveOf(tactic))
      settled = true
    }
    pendingEdits.clear()
    if (settled) set({ tacticSaveState: 'dirty' })
  }

  if (typeof window !== 'undefined') {
    // Mirrors drillSlice's handler, guarding this slice's own queue. Both are
    // registered once when the store is created and never removed.
    window.addEventListener('beforeunload', (event) => {
      settlePendingEdits()
      if (pendingSaves.size === 0 && get().tacticSaveState !== 'error') return
      void flush()
      event.preventDefault()
      event.returnValue = ''
    })
  }

  return {
    tactics: [],
    tacticsLoading: false,
    tacticsError: null,
    tacticSaveState: 'saved',
    tacticClipboard: null,

    fetchTactics: async (teamId) => {
      latestFetchTeamId = teamId
      set({ tacticsLoading: true, tacticsError: null })
      const { data, error } = await runSupabaseAction<Tactic[]>(
        () => supabase.from('tactic').select('*').eq('team_id', teamId).order('created_at', { ascending: true }),
        "Couldn't load tactics, try again."
      )
      if (latestFetchTeamId !== teamId) return // superseded by a newer team switch
      let tactics = data
      if (data) {
        // A refetch must not roll back edits that haven't been flushed yet —
        // every screen refetches on mount, so this happens just by navigating
        // away from the editor and back inside the debounce window.
        tactics = data.map((tactic) => {
          const pending = pendingSaves.get(tactic.id)
          return pending ? { ...tactic, ...pending } : tactic
        })
        // Drop history for tactics this team can't see any more.
        const visible = new Set(data.map((t) => t.id))
        for (const tacticId of [...history.keys()]) {
          if (!visible.has(tacticId)) history.delete(tacticId)
        }
      }
      set({
        tacticsLoading: false,
        tacticsError: error,
        ...(tactics ? { tactics } : {}),
      })
    },

    createTactic: async (input) => {
      set({ tacticsLoading: true, tacticsError: null })
      // `keyframes` is seeded rather than left to the column's `[]` default,
      // for the reason makeInitialKeyframe gives. Everything else the row
      // needs (scene, phases, pitch, sides, view, duration) has a sensible
      // column default from migration 020, so it isn't restated here.
      const seeded = {
        ...input,
        keyframes: [makeInitialKeyframe()],
      }
      const { data, error } = await runSupabaseAction<Tactic[]>(
        () => supabase.from('tactic').insert(seeded).select(),
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
      const server = data?.[0] ?? null
      // Same guard fetchTactics applies: merging the server row in as-is would
      // roll back any content edit still sitting in the autosave queue.
      const pending = server ? pendingSaves.get(id) : undefined
      const tactic = server && pending ? { ...server, ...pending } : server
      set({
        tacticsLoading: false,
        tacticsError: error,
        ...(tactic ? { tactics: get().tactics.map((t) => (t.id === id ? tactic : t)) } : {}),
      })
      return tactic
    },

    enableTacticSharing: async (tacticId) => {
      const token = mintShareToken()
      const updated = await get().updateTactic(tacticId, { share_token: token })
      return updated ? token : null
    },

    disableTacticSharing: async (tacticId) => {
      const updated = await get().updateTactic(tacticId, { share_token: null })
      return updated !== null
    },

    fetchSharedTactic: async (token) => {
      // A second, short-lived client rather than the app-wide one, for the two
      // reasons drillSlice.fetchSharedDrill gives. It carries the
      // `x-share-token` header migration 023's policy matches against, which is
      // per-request data with no business being pinned onto the client every
      // signed-in coach uses. And it holds no auth session, so a coach who
      // happens to be signed in on this browser sees exactly what the person
      // they sent the link to sees — the only way this page can be trusted.
      const client = createClient(supabaseUrl, supabaseAnonKey, {
        auth: { persistSession: false, autoRefreshToken: false },
        global: { headers: { 'x-share-token': token } },
      })
      const { data, error } = await runSupabaseAction<Tactic[]>(
        () => client.from('tactic').select('*').eq('share_token', token).limit(1),
        "Couldn't load this tactic."
      )
      if (error) {
        set({ tacticsError: error })
        return null
      }
      return data?.[0] ?? null
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
      // Drop the queued write and the history too, or a debounced flush would
      // resurrect a PATCH against a row that no longer exists.
      pendingSaves.delete(id)
      pendingEdits.delete(id)
      history.delete(id)
      set((state) => ({
        tacticsLoading: false,
        tacticsError: null,
        tactics: state.tactics.filter((t) => t.id !== id),
      }))
      return true
    },

    // ── Entities ─────────────────────────────────────────────────────────

    addTacticEntity: (tacticId, kind, position, extra) => {
      const tactic = get().tactics.find((t) => t.id === tacticId)
      if (!tactic) return null
      const id = scene.generateId(kind)
      const entity = scene.buildEntity(tactic, id, kind, extra)
      commit(tacticId, 'timeline', (t) => scene.addEntity(t, entity, position))
      return id
    },

    updateTacticEntity: (tacticId, entityId, patch) => {
      commit(tacticId, 'timeline', (t) => scene.updateEntity(t, entityId, patch))
    },

    removeTacticEntity: (tacticId, entityId) => {
      commit(tacticId, 'timeline', (t) => scene.removeEntity(t, entityId))
    },

    setTacticEntityPosition: (tacticId, keyframeId, entityId, position, commitEdit = false) => {
      const current = get().tactics.find((t) => t.id === tacticId)
      if (!current) return
      // Captured before the first movement lands, so undo steps back to where
      // the drag began rather than to some point part-way through it.
      if (!pendingEdits.has(tacticId)) pendingEdits.set(tacticId, snapshotOf(current))
      const next = scene.setEntityPosition(current, keyframeId, entityId, position)

      if (!commitEdit) {
        if (next !== current) set({ tactics: get().tactics.map((t) => (t.id === tacticId ? next : t)) })
        return
      }

      const before = pendingEdits.get(tacticId) ?? snapshotOf(current)
      pendingEdits.delete(tacticId)
      // `next === current` here just means the last dragmove already applied
      // this position, so compare against the pre-drag snapshot instead — a
      // press-and-release that never moved anything shouldn't burn an undo
      // slot or a write.
      if (snapshotsMatch(before, snapshotOf(next))) return
      pushTimeline(tacticId, before)
      writeTactic(tacticId, next)
    },

    // ── Keyframes ────────────────────────────────────────────────────────

    setTacticEntityHidden: (tacticId, keyframeId, entityId, hidden) => {
      commit(tacticId, 'timeline', (t) => {
        const keyframe = t.keyframes.find((k) => k.id === keyframeId)
        if (!keyframe || !t.scene.entities.some((e) => e.id === entityId)) return t
        const current = keyframe.states[entityId]
        if (!!current?.hidden === hidden) return t
        const next: EntityState = { ...current }
        if (hidden) next.hidden = true
        else delete next.hidden
        return {
          ...t,
          keyframes: t.keyframes.map((k) =>
            k.id === keyframeId ? { ...k, states: { ...k.states, [entityId]: next } } : k
          ),
        }
      })
    },

    addTacticKeyframe: (tacticId, t, states) => {
      const id = scene.generateId('keyframe')
      let added = false
      commit(tacticId, 'timeline', (tactic) => {
        const next = scene.addKeyframe(tactic, id, t, states)
        added = next !== tactic
        return next
      })
      return added ? id : null
    },

    updateTacticKeyframeState: (tacticId, keyframeId, states) => {
      commit(tacticId, 'timeline', (t) => scene.updateKeyframeState(t, keyframeId, states))
    },

    moveTacticKeyframe: (tacticId, keyframeId, t) => {
      commit(tacticId, 'timeline', (tactic) => scene.moveKeyframe(tactic, keyframeId, t))
    },

    deleteTacticKeyframe: (tacticId, keyframeId) => {
      commit(tacticId, 'timeline', (t) => scene.deleteKeyframe(t, keyframeId))
    },

    clearTacticKeyframes: (tacticId) => {
      commit(tacticId, 'timeline', (t) => scene.clearKeyframes(t))
    },

    balanceTacticTiming: (tacticId) => {
      commit(tacticId, 'timeline', (t) => scene.balanceTiming(t))
    },

    copyTacticKeyframe: (tacticId, keyframeId) => {
      const tactic = get().tactics.find((t) => t.id === tacticId)
      if (!tactic) return
      const copied = scene.copyKeyframe(tactic, keyframeId)
      // Leave whatever was on the clipboard alone if the id didn't resolve —
      // a failed copy shouldn't also destroy the previous one.
      if (copied) set({ tacticClipboard: copied })
    },

    pasteTacticKeyframe: (tacticId, t) => {
      const clipboard = get().tacticClipboard
      if (!clipboard) return null
      const id = scene.generateId('keyframe')
      let added = false
      commit(tacticId, 'timeline', (tactic) => {
        const next = scene.pasteKeyframe(tactic, id, t, clipboard)
        added = next !== tactic
        return next
      })
      return added ? id : null
    },

    // ── Markings (the `drawing` undo scope) ──────────────────────────────

    addTacticMarking: (tacticId, marking) => {
      if (!get().tactics.some((t) => t.id === tacticId)) return null
      const id = scene.generateId('marking')
      commit(tacticId, 'drawing', (t) => scene.addMarking(t, marking, id))
      return id
    },

    updateTacticMarking: (tacticId, markingId, patch) => {
      commit(tacticId, 'drawing', (t) => scene.updateMarking(t, markingId, patch))
    },

    removeTacticMarking: (tacticId, markingId) => {
      commit(tacticId, 'drawing', (t) => scene.removeMarking(t, markingId))
    },

    clearTacticDrawings: (tacticId) => {
      commit(tacticId, 'drawing', (t) => scene.clearDrawnMarkings(t))
    },

    // ── Phases, sides, view, pitch, duration ─────────────────────────────

    addTacticPhase: (tacticId, phase) => {
      if (!get().tactics.some((t) => t.id === tacticId)) return null
      const id = scene.generateId('phase')
      commit(tacticId, 'timeline', (t) => ({ ...t, phases: [...t.phases, { ...phase, id }] }))
      return id
    },

    updateTacticPhase: (tacticId, phaseId, patch) => {
      commit(tacticId, 'timeline', (t) => {
        if (!t.phases.some((p) => p.id === phaseId)) return t
        return { ...t, phases: t.phases.map((p) => (p.id === phaseId ? { ...p, ...patch } : p)) }
      })
    },

    removeTacticPhase: (tacticId, phaseId) => {
      commit(tacticId, 'timeline', (t) => {
        if (!t.phases.some((p) => p.id === phaseId)) return t
        return { ...t, phases: t.phases.filter((p) => p.id !== phaseId) }
      })
    },

    setTacticSide: (tacticId, side, patch) => {
      commit(tacticId, 'timeline', (t) => ({
        ...t,
        sides: { ...t.sides, [side]: { ...t.sides[side], ...patch } },
      }))
    },

    applyTacticFormation: (tacticId, side, formationKey, slots, keyframeId) => {
      commit(tacticId, 'timeline', (t) => {
        const keyframe = t.keyframes.find((k) => k.id === keyframeId)
        if (!keyframe) return t
        const onPitch = t.scene.entities.filter(
          (e) => e.kind === 'player' && e.team === side && !keyframe.states[e.id]?.hidden
        )
        const assignments = assignToFormation(onPitch, keyframe.states, slots)
        if (assignments.length === 0) {
          // Nothing to re-shape, but the coach still picked a formation and
          // expects the panel to show it.
          return t.sides[side].formation === formationKey
            ? t
            : { ...t, sides: { ...t.sides, [side]: { ...t.sides[side], formation: formationKey } } }
        }
        const byEntity = new Map(assignments.map((a) => [a.entityId, a.slot]))
        return {
          ...t,
          sides: { ...t.sides, [side]: { ...t.sides[side], formation: formationKey } },
          scene: {
            ...t.scene,
            entities: t.scene.entities.map((e) => {
              const slot = byEntity.get(e.id)
              return slot ? { ...e, role: slot.role } : e
            }),
          },
          keyframes: t.keyframes.map((k) => {
            if (k.id !== keyframeId) return k
            const states = { ...k.states }
            for (const [entityId, slot] of byEntity) {
              states[entityId] = { ...states[entityId], x: slot.x, y: slot.y }
            }
            return { ...k, states }
          }),
        }
      })
    },

    setTacticView: (tacticId, view) => {
      commitUntracked(tacticId, (t) => (t.view === view ? t : { ...t, view }))
    },

    setTacticPitch: (tacticId, pitch) => {
      commit(tacticId, 'timeline', (t) => scene.setPitch(t, pitch))
    },

    setTacticDuration: (tacticId, seconds) => {
      commit(tacticId, 'timeline', (t) => scene.setDuration(t, seconds))
    },

    setTacticOrientation: (tacticId, orientation) => {
      commit(tacticId, 'timeline', (t) => scene.setOrientation(t, orientation))
    },

    // ── Undo / redo, per scope ───────────────────────────────────────────

    undoTactic: (tacticId, scopeName) => {
      const stacks = history.get(tacticId)
      const tactic = get().tactics.find((t) => t.id === tacticId)
      if (!stacks || !tactic) return
      // A half-finished drag has nothing to go back to any more.
      pendingEdits.delete(tacticId)

      if (scopeName === 'drawing') {
        const stack = stacks.drawing
        if (stack.past.length === 0) return
        const previous = stack.past[stack.past.length - 1]
        history.set(tacticId, {
          ...stacks,
          drawing: {
            past: stack.past.slice(0, -1),
            future: [...stack.future, drawnMarkings(tactic.scene.markings)].slice(-UNDO_LIMIT),
          },
        })
        writeTactic(tacticId, restoreDrawing(tactic, previous))
        return
      }

      const stack = stacks.timeline
      if (stack.past.length === 0) return
      const previous = stack.past[stack.past.length - 1]
      history.set(tacticId, {
        ...stacks,
        timeline: {
          past: stack.past.slice(0, -1),
          future: [...stack.future, snapshotOf(tactic)].slice(-UNDO_LIMIT),
        },
      })
      writeTactic(tacticId, restoreTimeline(tactic, previous))
    },

    redoTactic: (tacticId, scopeName) => {
      const stacks = history.get(tacticId)
      const tactic = get().tactics.find((t) => t.id === tacticId)
      if (!stacks || !tactic) return
      pendingEdits.delete(tacticId)

      if (scopeName === 'drawing') {
        const stack = stacks.drawing
        if (stack.future.length === 0) return
        const next = stack.future[stack.future.length - 1]
        history.set(tacticId, {
          ...stacks,
          drawing: {
            past: [...stack.past, drawnMarkings(tactic.scene.markings)].slice(-UNDO_LIMIT),
            future: stack.future.slice(0, -1),
          },
        })
        writeTactic(tacticId, restoreDrawing(tactic, next))
        return
      }

      const stack = stacks.timeline
      if (stack.future.length === 0) return
      const next = stack.future[stack.future.length - 1]
      history.set(tacticId, {
        ...stacks,
        timeline: {
          past: [...stack.past, snapshotOf(tactic)].slice(-UNDO_LIMIT),
          future: stack.future.slice(0, -1),
        },
      })
      writeTactic(tacticId, restoreTimeline(tactic, next))
    },

    canUndoTactic: (tacticId, scopeName) => (history.get(tacticId)?.[scopeName].past.length ?? 0) > 0,
    canRedoTactic: (tacticId, scopeName) => (history.get(tacticId)?.[scopeName].future.length ?? 0) > 0,

    flushTacticSave: async () => {
      settlePendingEdits()
      await flush()
    },
  }
}
