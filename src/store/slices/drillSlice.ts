import type { StateCreator } from 'zustand'
import { createClient } from '@supabase/supabase-js'
import { supabase, supabaseAnonKey, supabaseUrl } from '../../lib/supabase'
import { runSupabaseAction, type SupabaseCallResult } from '../supabaseAction'
import type {
  ArrowKind,
  Drill,
  DrillCoaching,
  DrillDifficulty,
  DrillIntensity,
  DrillPhase,
  DrillPhaseOfPlay,
  DrillScene,
  EntityKind,
  EntityState,
  EquipmentKind,
  Keyframe,
  Marking,
  PhasePoint,
  PitchConfig,
  PitchOrientation,
  PitchSize,
  SceneEntity,
  SessionBlock,
} from '../types'
import type { StoreState } from '../useStore'

export interface NewDrillInput {
  team_id: string | null
  name: string
  pitch_size: PitchSize
  orientation: PitchOrientation
  scene?: DrillScene
  keyframes?: Keyframe[]
  duration_seconds?: number
  pitch?: PitchConfig
  phases?: DrillPhase[]
}

// Deliberately does NOT carry scene/keyframes/duration_seconds/pitch. Those
// four are written by the autosave flush below and nothing else, so there's
// exactly one path a drill's content can take to the database — a second one
// through here would be a way to bypass the undo stack and the debounce
// without noticing.
export interface DrillUpdateInput {
  name?: string
  pitch_size?: PitchSize
  orientation?: PitchOrientation
  phases?: DrillPhase[]

  // Metadata (rework plan Stage 8.1). These *are* routed through here rather
  // than the autosave queue, deliberately: they're plain columns a coach types
  // into a form and commits field by field, not canvas content, so they don't
  // belong in the undo stack or the drag debounce. Every one of them is
  // nullable, and `null` is a meaningful patch — clearing a field.
  objective?: string | null
  description?: string | null
  category?: string | null
  subcategory?: string | null
  duration_minutes?: number | null
  players_recommended?: number | null
  min_players?: number | null
  max_players?: number | null
  age_min?: string | null
  age_max?: string | null
  difficulty?: DrillDifficulty | null
  intensity?: DrillIntensity | null
  phase_of_play?: DrillPhaseOfPlay | null
  session_block?: SessionBlock | null
  setup_minutes?: number | null
  learning_outcome?: string | null
  video_url?: string | null
  thumbnail_url?: string | null
  coaching?: DrillCoaching

  // Written only by enableDrillSharing/disableDrillSharing, never typed into a
  // form — a share token is minted or revoked, not edited (Stage 10.4).
  share_token?: string | null
}

// What the top-bar save indicator reads. 'dirty' means committed locally but
// not yet flushed; 'error' means a flush failed and the work is still queued
// for the next attempt, never that it was dropped.
export type SaveState = 'saved' | 'dirty' | 'saving' | 'error'

// Everything about a new entity except the two things addEntity derives
// itself (its id, and its `number` when it's a player).
export type NewEntityInput = Partial<Omit<SceneEntity, 'id' | 'kind'>>

// The four columns that make up a drill's editable content — the unit both
// the undo stack and the autosave queue work in.
interface DrillSnapshot {
  scene: DrillScene
  keyframes: Keyframe[]
  duration_seconds: number
  pitch: PitchConfig
}

interface UndoStack {
  past: DrillSnapshot[]
  future: DrillSnapshot[]
}

// Plan §2.2 — "a bounded snapshot stack (~50)".
const UNDO_LIMIT = 50

// Plan §2.3 — "a debounced flush (~800 ms idle)".
const AUTOSAVE_IDLE_MS = 800

// Created by migration 017, public-read, one PNG per drill named by id.
const THUMBNAIL_BUCKET = 'drill-thumbnails'

// 128 bits, per the plan's own warning about guessable-if-short share URLs
// (Stage 10.4). `crypto.getRandomValues` rather than `Math.random`: this is the
// only thing standing between a drill and the open internet once a coach opts
// in, and Math.random is not a CSPRNG in any engine.
function mintShareToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')
}

// Keyframe times are rounded to the millisecond. Two keyframes are never
// allowed to share a `t` (addKeyframe and moveKeyframe both refuse), and
// that guard is only reliable if float noise from balanceTiming's division
// can't produce a near-but-not-equal duplicate.
function roundTime(seconds: number): number {
  return Math.round(seconds * 1000) / 1000
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

// Every generated id (new phase, new annotation, new entity, new keyframe,
// new marking) goes through here — one place to swap the id strategy later if
// `crypto.randomUUID` ever isn't available (it is in every browser this app
// targets: Vercel-hosted HTTPS, modern iOS/Android/desktop browsers).
function generateId(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function snapshotOf(drill: Drill): DrillSnapshot {
  return {
    scene: drill.scene,
    keyframes: drill.keyframes,
    duration_seconds: drill.duration_seconds,
    pitch: drill.pitch,
  }
}

function applySnapshot(drill: Drill, snapshot: DrillSnapshot): Drill {
  return { ...drill, ...snapshot }
}

// Reference equality is an exact "nothing changed" test here because every
// mutation below rebuilds the objects it touches and never mutates in place.
function snapshotsMatch(a: DrillSnapshot, b: DrillSnapshot): boolean {
  return (
    a.scene === b.scene &&
    a.keyframes === b.keyframes &&
    a.duration_seconds === b.duration_seconds &&
    a.pitch === b.pitch
  )
}

function sortKeyframes(keyframes: Keyframe[]): Keyframe[] {
  return [...keyframes].sort((a, b) => a.t - b.t)
}

// Squad numbers are per team, so team A and team B both start at 1 — matching
// how a coach numbers two bibbed groups rather than one continuous run.
function nextNumberFor(entities: SceneEntity[], team: string | undefined): number {
  let highest = 0
  for (const entity of entities) {
    if (entity.kind !== 'player' || entity.team !== team) continue
    if (typeof entity.number === 'number' && entity.number > highest) highest = entity.number
  }
  return highest + 1
}

// The states a new keyframe inherits when the caller doesn't supply any: a
// copy of whichever keyframe is in force at `t` under step semantics. Stage 3
// introduces `frameAt` and real interpolation; until then this is the honest
// answer, and `addKeyframe`'s optional `states` argument is how Stage 4 hands
// in an interpolated frame instead of having this guess.
function statesHoldingAt(keyframes: Keyframe[], t: number): Record<string, EntityState> {
  if (keyframes.length === 0) return {}
  const ordered = sortKeyframes(keyframes)
  let holding = ordered[0]
  for (const keyframe of ordered) {
    if (keyframe.t <= t) holding = keyframe
    else break
  }
  return { ...holding.states }
}

// Pure, local-only: writes one entity's position into one keyframe and
// returns a new Drill (never mutates). Returns the drill unchanged when the
// position already matches, which is what lets a drag that ended where it
// started avoid burning an undo slot.
function withEntityPosition(
  drill: Drill,
  keyframeId: string,
  entityId: string,
  position: PhasePoint
): Drill {
  let changed = false
  const keyframes = drill.keyframes.map((keyframe) => {
    if (keyframe.id !== keyframeId) return keyframe
    const previous = keyframe.states[entityId]
    if (previous && previous.x === position.x && previous.y === position.y) return keyframe
    changed = true
    const next: EntityState = { ...previous, x: position.x, y: position.y }
    // A hidden entity has no position (see EntityState in types.ts), so
    // giving it one necessarily puts it back on the pitch.
    if (next.hidden) delete next.hidden
    return { ...keyframe, states: { ...keyframe.states, [entityId]: next } }
  })
  return changed ? { ...drill, keyframes } : drill
}

// Provisional. Stage 7 of the rework plan owns the real ~35-preset table;
// these four are the metre dimensions migration 013b used to convert the old
// pitch_size values, repeated here so a drill created in the app and a drill
// backfilled by that migration describe the same pitch rather than drifting
// apart.
const PRESET_LENGTH_METERS: Record<PitchSize, number> = {
  full: 105,
  three_quarter: 79,
  half: 53,
  quarter: 35,
}

function derivePitch(size: PitchSize, orientation: PitchOrientation): PitchConfig {
  return {
    preset: size,
    widthMeters: 68,
    lengthMeters: PRESET_LENGTH_METERS[size],
    orientation,
    overlays: [],
  }
}

// A drill always keeps at least one keyframe from creation, the same way it
// always kept at least one phase — without one there's nowhere for addEntity
// to record a position.
function makeInitialKeyframe(): Keyframe {
  return { id: generateId('keyframe'), t: 0, states: {} }
}

// ---------------------------------------------------------------------------
// Deprecated: the phases[] helpers. Dropped along with the column by
// migration 014, once the editor has moved onto scene/keyframes (Stage 5).
// ---------------------------------------------------------------------------

// The three phase-element arrays a canvas element can belong to — arrows
// aren't draggable (each has two points, not one, so "drag to reposition"
// doesn't map cleanly onto this single-point machinery; placed via
// addArrow/removeArrow instead, Upgrade Phase 2C). Annotations are placed
// (2c, US-13) rather than dragged either, handled by `addAnnotation` below.
export type DrillElementType = 'players' | 'cones' | 'balls'

// 'duplicate' deep-copies the currently-viewed phase as a starting point
// (build guide 2c, step 2); 'blank' starts a phase with empty element
// arrays.
export type NewPhaseMode = 'duplicate' | 'blank'

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
  // Drives the top bar's save indicator (plan §2.3). One field for the whole
  // store rather than one per drill: only one drill is ever being edited.
  saveState: SaveState

  // Coach-owned drills (team_id null) are reusable across every team, so a
  // drill fetch is always scoped to "this team OR nobody's team" — never a
  // plain team_id equality filter. See gaffer_project_plan_final.md §5.
  fetchDrills: (teamId: string) => Promise<void>
  createDrill: (input: NewDrillInput) => Promise<Drill | null>
  updateDrill: (id: string, patch: DrillUpdateInput) => Promise<Drill | null>

  // Whole-drill duplication (rework plan Stage 9.5) — the useful unit now
  // that a drill is one cast of entities plus keyframes rather than a list of
  // independent phases. Copies everything a coach would expect to survive a
  // "duplicate": scene, keyframes, pitch, duration and every Stage 8 metadata
  // field, following the same "copy everything, mark the name" precedent
  // addPhase's own 'duplicate' mode already sets for a single phase. The one
  // deliberate omission is thumbnail_url — see the implementation for why.
  duplicateDrill: (drillId: string) => Promise<Drill | null>

  // Public share links (rework plan Stage 10.4). Turning sharing on mints a
  // fresh 128-bit token; turning it off nulls the column, which revokes every
  // link already handed out — there is no separate revoke, because "stop
  // sharing" and "invalidate the link" are the same act. Re-enabling mints a
  // NEW token rather than restoring the old one, so a link a coach thought
  // they had killed never comes back to life.
  enableDrillSharing: (drillId: string) => Promise<string | null>
  disableDrillSharing: (drillId: string) => Promise<boolean>

  // Reads one shared drill as an unauthenticated visitor. Deliberately not
  // part of `drills` state: this is the public `/d/:token` page's own data,
  // fetched by a token rather than by team scope, and folding it into the
  // team-scoped array a signed-in coach edits would be a category error.
  fetchSharedDrill: (token: string) => Promise<Drill | null>

  // Stores a PNG data URL — `stage.toDataURL()` off the Konva stage (rework
  // plan Stage 8.5) — in the `drill-thumbnails` bucket and records its public
  // URL on the drill. One object per drill, named by id and upserted, so a
  // re-capture replaces the old image rather than accumulating orphans.
  // Returns the stored URL, or null if either half failed.
  uploadDrillThumbnail: (drillId: string, dataUrl: string) => Promise<string | null>

  // -------------------------------------------------------------------------
  // Entities, keyframes and markings (rework plan Stage 2.1).
  //
  // Every action here is *committed*: it pushes an undo snapshot, marks the
  // drill dirty and schedules the debounced write. `setEntityPosition` is the
  // single exception — see its own note.
  // -------------------------------------------------------------------------

  // Adds one cast member and stands it at `position` in every keyframe.
  // There's no keyframe parameter by design: an entity belongs to the drill,
  // not to a moment in it, and `EntityState.hidden` is how it comes off the
  // pitch for part of the run. Players get the next free number within their
  // own team unless `extra` sets one. Returns the new entity's id.
  addEntity: (
    drillId: string,
    kind: EntityKind,
    position: PhasePoint,
    extra?: NewEntityInput
  ) => string | null

  updateEntity: (drillId: string, entityId: string, patch: NewEntityInput) => void

  // Removes the entity from `scene.entities` and from every keyframe's
  // `states`, so no keyframe is left holding a position for a cast member
  // that no longer exists.
  removeEntity: (drillId: string, entityId: string) => void

  // The drag hot path. Called on every Konva `dragmove` with `commit` unset:
  // local state only, no undo snapshot, no write scheduled — which is what
  // makes a five-second drag cost exactly one Supabase call. Called once more
  // on `dragend` with `commit: true`, which pushes the position the entity
  // held when the drag *started* (captured on the first uncommitted call, not
  // at drag-end, or Ctrl+Z would step back to a point mid-gesture) and
  // schedules the write.
  setEntityPosition: (
    drillId: string,
    keyframeId: string,
    entityId: string,
    position: PhasePoint,
    commit?: boolean
  ) => void

  // Inserts a keyframe at `t` seconds, keeping `keyframes` sorted by time. A
  // second keyframe at a time one already occupies is refused (returns null)
  // — interpolation across a zero-length segment isn't defined. `states`
  // defaults to a copy of whichever keyframe holds at `t`; Stage 4 passes an
  // interpolated frame instead once `frameAt` exists. Returns the new id.
  addKeyframe: (drillId: string, t: number, states?: Record<string, EntityState>) => string | null

  // Teloframe's "Update Keyframe State — captures current pitch positions to
  // this keyframe". `states` is a parameter rather than something this action
  // recaptures itself because "current pitch positions" is a function of the
  // playhead, and the playhead deliberately does not live in this store
  // (plan §4.1: it changes 60x/sec and would thrash every subscriber).
  updateKeyframeState: (drillId: string, keyframeId: string, states: Record<string, EntityState>) => void

  // Retimes one keyframe and re-sorts. Clamped to [0, duration_seconds];
  // refused if another keyframe already sits on that exact time.
  moveKeyframe: (drillId: string, keyframeId: string, t: number) => void

  // Deletes the keyframe and any marking bound to it. Keyframe-bound markings
  // go with it because the phases model this replaced kept arrows and notes
  // *inside* the phase, so deleting a phase always took them too; static
  // markings (no keyframeId) are untouched.
  deleteKeyframe: (drillId: string, keyframeId: string) => void

  // Drops every keyframe, and every marking bound to one. Entities survive —
  // clearing the timing of a drill isn't the same as emptying the pitch.
  clearKeyframes: (drillId: string) => void

  // Spreads the existing keyframes evenly across `duration_seconds`, keeping
  // their order.
  balanceTiming: (drillId: string) => void

  addMarking: (drillId: string, marking: Omit<Marking, 'id'>) => string | null
  updateMarking: (drillId: string, markingId: string, patch: Partial<Omit<Marking, 'id'>>) => void
  removeMarking: (drillId: string, markingId: string) => void

  setDrillPitch: (drillId: string, pitch: PitchConfig) => void

  // Existing keyframes are deliberately left where they are when the duration
  // shrinks: silently dragging a coach's keyframes is worse than leaving one
  // past the end, and `balanceTiming` is the tool for redistributing them.
  setDuration: (drillId: string, seconds: number) => void

  // -------------------------------------------------------------------------
  // Undo / redo (plan §2.2). Bounded at UNDO_LIMIT committed edits per drill.
  // Lives here rather than in a component because the top bar and the
  // keyboard shortcuts both need it.
  //
  // `canUndo`/`canRedo` take a drill id because the stacks are per drill.
  // Subscribe to them as `useStore((s) => s.canUndo(drillId))` — evaluating
  // the function inside the selector is what makes it reactive; reading
  // `s.canUndo` and calling it later is not.
  // -------------------------------------------------------------------------
  undo: (drillId: string) => void
  redo: (drillId: string) => void
  canUndo: (drillId: string) => boolean
  canRedo: (drillId: string) => boolean

  // Writes any pending edit immediately instead of waiting out the debounce.
  // Call it on editor unmount and on route change; `beforeunload` is already
  // wired up below. Also settles a drag that never received its `dragend`, so
  // an interrupted gesture isn't left in local state only.
  flushDrillSave: () => Promise<void>

  // -------------------------------------------------------------------------
  // Deprecated: phases[] mutations, kept until the editor moves onto
  // scene/keyframes (Stage 5) and migration 014 drops the column. These still
  // follow the old contract — local mutation, then the caller fires exactly
  // one `updateDrill` — and are NOT part of the undo stack or the autosave
  // queue. Don't wire anything new to them.
  // -------------------------------------------------------------------------

  setPhaseElementPosition: (
    drillId: string,
    phaseIndex: number,
    elementType: DrillElementType,
    elementId: string,
    position: PhasePoint
  ) => void
  addPhase: (drillId: string, afterIndex: number, mode: NewPhaseMode) => void
  deletePhase: (drillId: string, phaseIndex: number) => void
  addAnnotation: (drillId: string, phaseIndex: number, position: PhasePoint, text: string) => void
  addElement: (
    drillId: string,
    phaseIndex: number,
    elementType: DrillElementType,
    position: PhasePoint,
    extra?: { team?: string; color?: string; kind?: EquipmentKind }
  ) => void
  removeElement: (drillId: string, phaseIndex: number, elementType: DrillElementType, elementId: string) => void
  removeAnnotation: (drillId: string, phaseIndex: number, annotationId: string) => void
  addArrow: (drillId: string, phaseIndex: number, from: PhasePoint, to: PhasePoint, kind: ArrowKind) => void
  removeArrow: (drillId: string, phaseIndex: number, arrowId: string) => void
  updatePhaseMeta: (drillId: string, phaseIndex: number, patch: { label?: string; duration_seconds?: number }) => void
}

export const createDrillSlice: StateCreator<StoreState, [], [], DrillSlice> = (set, get) => {
  // Same stale-response guard as sessionSlice — see the comment there.
  let latestFetchTeamId: string | null = null

  // Undo/redo stacks, keyed by drill id. Held in the closure rather than in
  // `set` state: nothing renders a stack directly, and fifty snapshots per
  // drill sitting in reactive state would be compared on every store update
  // for no benefit. Every mutation that touches a stack also calls `set`, so
  // a `useStore((s) => s.canUndo(id))` selector re-evaluates at exactly the
  // right moments.
  const history = new Map<string, UndoStack>()

  // The autosave queue. Keyed by drill id, holding the *content* rather than
  // a drill reference, so a queued write survives `drills` being emptied out
  // from under it — which is exactly what a team switch does
  // (clearTeamScopedState in teamSlice.ts).
  const pendingSaves = new Map<string, DrillSnapshot>()

  // Pre-drag snapshots, one per drill, captured on the first uncommitted
  // `setEntityPosition` and consumed by the commit that follows.
  const pendingEdits = new Map<string, DrillSnapshot>()

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
    set({ saveState: 'saving' })

    let failure: string | null = null
    for (const [drillId, payload] of batch) {
      // The debounce sits above runSupabaseAction, never inside it — every
      // Supabase call in this app still funnels through that one wrapper
      // (CLAUDE.md).
      const { error } = await runSupabaseAction<Drill[]>(
        () => supabase.from('drill').update(payload).eq('id', drillId).select(),
        "Couldn't save drill, try again."
      )
      // Deliberately does not merge the response back into `drills`. The
      // coach may well have edited again while this request was in flight,
      // and overwriting local state with the server's copy would discard
      // those edits without a trace.
      if (error) {
        failure = error
        // Keep the work queued rather than dropping it, unless something
        // newer already superseded it mid-flush.
        if (!pendingSaves.has(drillId)) pendingSaves.set(drillId, payload)
      }
    }

    if (failure) {
      // No automatic retry: offline, that would spin. The next committed edit
      // schedules another attempt, and flushDrillSave forces one.
      set({ saveState: 'error', drillsError: failure })
      return
    }
    if (pendingSaves.size > 0) {
      // An edit landed while the request was in flight; don't claim saved.
      set({ saveState: 'dirty' })
      schedule()
      return
    }
    set({ saveState: 'saved' })
  }

  // Serialized: a forced flush arriving while a debounced one is still in
  // flight queues behind it instead of racing it into a double write.
  const flush = (): Promise<void> => {
    const next = (flushing ?? Promise.resolve()).then(runFlush).catch(() => {})
    flushing = next
    return next
  }

  const pushHistory = (drillId: string, before: DrillSnapshot) => {
    const stack = history.get(drillId) ?? { past: [], future: [] }
    history.set(drillId, {
      past: [...stack.past, before].slice(-UNDO_LIMIT),
      // Any new edit abandons the redo branch, as undo/redo always does.
      future: [],
    })
  }

  const writeDrill = (drillId: string, next: Drill) => {
    set({
      drills: get().drills.map((d) => (d.id === drillId ? next : d)),
      saveState: 'dirty',
    })
    pendingSaves.set(drillId, snapshotOf(next))
    schedule()
  }

  // The one path a committed mutation takes: snapshot for undo, apply, mark
  // dirty, schedule the write. A mutator returns the drill it was handed to
  // decline (nothing to record, nothing to save).
  const commit = (drillId: string, mutate: (drill: Drill) => Drill) => {
    const current = get().drills.find((d) => d.id === drillId)
    if (!current) return
    const next = mutate(current)
    if (next === current) return
    // If a drag is in flight, its pre-drag snapshot is the right undo target —
    // the drill's current state already includes the uncommitted movement.
    const before = pendingEdits.get(drillId) ?? snapshotOf(current)
    pendingEdits.delete(drillId)
    pushHistory(drillId, before)
    writeDrill(drillId, next)
  }

  // Promotes a drag that never received its `dragend` — a gesture interrupted
  // by navigation — into a real committed edit, so it can't be left sitting in
  // local state only.
  const settlePendingEdits = () => {
    if (pendingEdits.size === 0) return
    let settled = false
    for (const [drillId, before] of pendingEdits) {
      const drill = get().drills.find((d) => d.id === drillId)
      if (!drill || snapshotsMatch(before, snapshotOf(drill))) continue
      pushHistory(drillId, before)
      pendingSaves.set(drillId, snapshotOf(drill))
      settled = true
    }
    pendingEdits.clear()
    if (settled) set({ saveState: 'dirty' })
  }

  if (typeof window !== 'undefined') {
    // Registered once, when the store is created, and never removed — this is
    // the only place that both knows `saveState` and outlives every editor
    // mount. The flush is best-effort (the tab may die first), so the dialog
    // is what actually protects the work.
    window.addEventListener('beforeunload', (event) => {
      settlePendingEdits()
      if (pendingSaves.size === 0 && get().saveState !== 'error') return
      void flush()
      event.preventDefault()
      event.returnValue = ''
    })
  }

  return {
    drills: [],
    drillsLoading: false,
    drillsError: null,
    saveState: 'saved',

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
      let drills = data
      if (data) {
        // A refetch must not roll back edits that haven't been flushed yet —
        // every screen refetches on mount, so this happens just by navigating
        // away from the editor and back inside the debounce window.
        drills = data.map((drill) => {
          const pending = pendingSaves.get(drill.id)
          return pending ? { ...drill, ...pending } : drill
        })
        // Drop history for drills this team can't see any more, so a team
        // switch doesn't leave undo pointing at another team's content.
        const visible = new Set(data.map((d) => d.id))
        for (const drillId of [...history.keys()]) {
          if (!visible.has(drillId)) history.delete(drillId)
        }
      }
      set({
        drillsLoading: false,
        drillsError: error,
        ...(drills ? { drills } : {}),
      })
    },

    createDrill: async (input) => {
      set({ drillsLoading: true, drillsError: null })
      // A drill always keeps at least one keyframe, the same way it always
      // kept at least one phase — without one there's nowhere for addEntity
      // to record a position, so a freshly created drill couldn't be edited
      // at all. `pitch` is seeded rather than left to the column default so a
      // new drill doesn't claim to be a full pitch when the coach picked a
      // quarter one.
      const seeded = {
        ...input,
        phases: input.phases ?? [makeBlankPhase()],
        keyframes: input.keyframes ?? [makeInitialKeyframe()],
        pitch: input.pitch ?? derivePitch(input.pitch_size, input.orientation),
      }
      const { data, error } = await runSupabaseAction<Drill[]>(
        () => supabase.from('drill').insert(seeded).select(),
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

    // Drill-level fields only (name, and the deprecated phases/pitch columns).
    // A drill's scene, keyframes, duration and pitch go through the autosave
    // flush instead — see DrillUpdateInput.
    updateDrill: async (id, patch) => {
      set({ drillsLoading: true, drillsError: null })
      const { data, error } = await runSupabaseAction<Drill[]>(
        () => supabase.from('drill').update(patch).eq('id', id).select(),
        "Couldn't save drill, try again."
      )
      const server = data?.[0] ?? null
      // The response is the server's whole row, so merging it in as-is would
      // roll back any content edit still sitting in the autosave queue — which
      // is routine now that Stage 8's metadata fields commit from a drawer
      // open over the same canvas the coach was just dragging cones on. Same
      // guard, and the same reason, as the one fetchDrills applies to a
      // refetch.
      const pending = server ? pendingSaves.get(id) : undefined
      const drill = server && pending ? { ...server, ...pending } : server
      set({
        drillsLoading: false,
        drillsError: error,
        ...(drill ? { drills: get().drills.map((d) => (d.id === id ? drill : d)) } : {}),
      })
      return drill
    },

    duplicateDrill: async (drillId) => {
      const source = get().drills.find((d) => d.id === drillId)
      if (!source) return null
      const created = await get().createDrill({
        team_id: source.team_id,
        name: `${source.name} (copy)`,
        pitch_size: source.pitch_size,
        orientation: source.orientation,
        scene: source.scene,
        keyframes: source.keyframes,
        duration_seconds: source.duration_seconds,
        pitch: source.pitch,
        phases: source.phases,
      })
      if (!created) return null
      // Metadata isn't part of NewDrillInput — createDrill's insert exists to
      // seed structural defaults (a blank phase, a derived pitch) a plain
      // column patch must never fight with — so it goes through the same
      // updateDrill path a coach's own edit in Details would use, exactly
      // like uploadDrillThumbnail does below for the one field it sets.
      //
      // thumbnail_url is deliberately left out. It's a rendering of THIS
      // drill's board, stored at a path keyed by ITS id (`${drillId}.png`,
      // see uploadDrillThumbnail) — copying the URL string would point the
      // duplicate at the source's own image file, and since the auto-capture
      // rule only fires when a drill has none yet, the duplicate would never
      // get one of its own and would silently start showing the source's
      // *current* board the next time the source re-captures. Leaving it
      // null lets the duplicate pick up a correctly-pathed thumbnail the
      // first time it's edited, the same as any other new drill.
      return get().updateDrill(created.id, {
        objective: source.objective,
        description: source.description,
        category: source.category,
        subcategory: source.subcategory,
        duration_minutes: source.duration_minutes,
        players_recommended: source.players_recommended,
        min_players: source.min_players,
        max_players: source.max_players,
        age_min: source.age_min,
        age_max: source.age_max,
        difficulty: source.difficulty,
        intensity: source.intensity,
        phase_of_play: source.phase_of_play,
        session_block: source.session_block,
        setup_minutes: source.setup_minutes,
        learning_outcome: source.learning_outcome,
        video_url: source.video_url,
        coaching: source.coaching,
      })
    },

    enableDrillSharing: async (drillId) => {
      const token = mintShareToken()
      const updated = await get().updateDrill(drillId, { share_token: token })
      return updated ? token : null
    },

    disableDrillSharing: async (drillId) => {
      const updated = await get().updateDrill(drillId, { share_token: null })
      return updated !== null
    },

    fetchSharedDrill: async (token) => {
      // A second, short-lived client rather than the app-wide one, for two
      // reasons. It carries the `x-share-token` header the RLS policy matches
      // against (migration 018), which is per-request data and has no business
      // being pinned onto the client every signed-in coach uses. And it's
      // created with no persisted auth session, so a coach who happens to be
      // signed in on the same browser reads this page as a visitor would —
      // which is the only way the page can be trusted to look the same to the
      // teammate it was sent to.
      const client = createClient(supabaseUrl, supabaseAnonKey, {
        auth: { persistSession: false, autoRefreshToken: false },
        global: { headers: { 'x-share-token': token } },
      })
      const { data, error } = await runSupabaseAction<Drill[]>(
        () => client.from('drill').select('*').eq('share_token', token).limit(1),
        "Couldn't load this drill."
      )
      if (error) {
        set({ drillsError: error })
        return null
      }
      return data?.[0] ?? null
    },

    uploadDrillThumbnail: async (drillId, dataUrl) => {
      const path = `${drillId}.png`
      const upload = async () => {
        const blob = await (await fetch(dataUrl)).blob()
        // Storage errors aren't PostgrestErrors, but they carry the same
        // `message`, which is all runSupabaseAction reads — funnelling the
        // call through the one wrapper anyway keeps CLAUDE.md's rule intact
        // rather than opening a second path to Supabase.
        const result = await supabase.storage
          .from(THUMBNAIL_BUCKET)
          .upload(path, blob, { contentType: 'image/png', upsert: true })
        return result as unknown as SupabaseCallResult<{ path: string }>
      }
      const { error } = await runSupabaseAction(upload, "Couldn't save the drill thumbnail, try again.")
      if (error) {
        set({ drillsError: error })
        return null
      }
      const { data: publicData } = supabase.storage.from(THUMBNAIL_BUCKET).getPublicUrl(path)
      // The object lives at a stable path and is upserted, so without a
      // cache-buster a re-capture would keep showing the browser's copy of the
      // old image.
      const url = `${publicData.publicUrl}?v=${Date.now()}`
      const updated = await get().updateDrill(drillId, { thumbnail_url: url })
      return updated ? url : null
    },

    addEntity: (drillId, kind, position, extra) => {
      const drill = get().drills.find((d) => d.id === drillId)
      if (!drill) return null
      const id = generateId(kind)
      const base: SceneEntity = { ...extra, id, kind }
      const entity: SceneEntity =
        kind === 'player' && base.number === undefined
          ? { ...base, number: nextNumberFor(drill.scene.entities, base.team) }
          : base
      commit(drillId, (d) => ({
        ...d,
        scene: { ...d.scene, entities: [...d.scene.entities, entity] },
        keyframes: d.keyframes.map((keyframe) => ({
          ...keyframe,
          states: { ...keyframe.states, [id]: { x: position.x, y: position.y } },
        })),
      }))
      return id
    },

    updateEntity: (drillId, entityId, patch) => {
      commit(drillId, (d) => {
        if (!d.scene.entities.some((e) => e.id === entityId)) return d
        return {
          ...d,
          scene: {
            ...d.scene,
            entities: d.scene.entities.map((e) => (e.id === entityId ? { ...e, ...patch } : e)),
          },
        }
      })
    },

    removeEntity: (drillId, entityId) => {
      commit(drillId, (d) => {
        if (!d.scene.entities.some((e) => e.id === entityId)) return d
        return {
          ...d,
          scene: { ...d.scene, entities: d.scene.entities.filter((e) => e.id !== entityId) },
          keyframes: d.keyframes.map((keyframe) => {
            if (!(entityId in keyframe.states)) return keyframe
            const states = { ...keyframe.states }
            delete states[entityId]
            return { ...keyframe, states }
          }),
        }
      })
    },

    setEntityPosition: (drillId, keyframeId, entityId, position, commitEdit = false) => {
      const current = get().drills.find((d) => d.id === drillId)
      if (!current) return
      // Captured before the first movement lands, so undo steps back to where
      // the drag began rather than to some point part-way through it.
      if (!pendingEdits.has(drillId)) pendingEdits.set(drillId, snapshotOf(current))
      const next = withEntityPosition(current, keyframeId, entityId, position)

      if (!commitEdit) {
        if (next !== current) set({ drills: get().drills.map((d) => (d.id === drillId ? next : d)) })
        return
      }

      const before = pendingEdits.get(drillId) ?? snapshotOf(current)
      pendingEdits.delete(drillId)
      // `next === current` here just means the last dragmove already applied
      // this position, so compare against the pre-drag snapshot instead — a
      // press-and-release that never moved anything shouldn't burn an undo
      // slot or a write.
      if (snapshotsMatch(before, snapshotOf(next))) return
      pushHistory(drillId, before)
      writeDrill(drillId, next)
    },

    addKeyframe: (drillId, t, states) => {
      const drill = get().drills.find((d) => d.id === drillId)
      if (!drill) return null
      const time = roundTime(clamp(t, 0, drill.duration_seconds))
      if (drill.keyframes.some((k) => k.t === time)) return null
      const id = generateId('keyframe')
      const seeded = states ? { ...states } : statesHoldingAt(drill.keyframes, time)
      commit(drillId, (d) => ({
        ...d,
        keyframes: sortKeyframes([...d.keyframes, { id, t: time, states: seeded }]),
      }))
      return id
    },

    updateKeyframeState: (drillId, keyframeId, states) => {
      commit(drillId, (d) => {
        if (!d.keyframes.some((k) => k.id === keyframeId)) return d
        return {
          ...d,
          keyframes: d.keyframes.map((k) => (k.id === keyframeId ? { ...k, states: { ...states } } : k)),
        }
      })
    },

    moveKeyframe: (drillId, keyframeId, t) => {
      const drill = get().drills.find((d) => d.id === drillId)
      if (!drill) return
      const time = roundTime(clamp(t, 0, drill.duration_seconds))
      if (drill.keyframes.some((k) => k.t === time && k.id !== keyframeId)) return
      commit(drillId, (d) => {
        const target = d.keyframes.find((k) => k.id === keyframeId)
        if (!target || target.t === time) return d
        return {
          ...d,
          keyframes: sortKeyframes(d.keyframes.map((k) => (k.id === keyframeId ? { ...k, t: time } : k))),
        }
      })
    },

    deleteKeyframe: (drillId, keyframeId) => {
      commit(drillId, (d) => {
        if (!d.keyframes.some((k) => k.id === keyframeId)) return d
        return {
          ...d,
          keyframes: d.keyframes.filter((k) => k.id !== keyframeId),
          scene: { ...d.scene, markings: d.scene.markings.filter((m) => m.keyframeId !== keyframeId) },
        }
      })
    },

    clearKeyframes: (drillId) => {
      commit(drillId, (d) => {
        if (d.keyframes.length === 0) return d
        return {
          ...d,
          keyframes: [],
          scene: { ...d.scene, markings: d.scene.markings.filter((m) => !m.keyframeId) },
        }
      })
    },

    balanceTiming: (drillId) => {
      commit(drillId, (d) => {
        const count = d.keyframes.length
        if (count === 0) return d
        const spacing = count === 1 ? 0 : d.duration_seconds / (count - 1)
        return {
          ...d,
          keyframes: sortKeyframes(d.keyframes).map((keyframe, index) => ({
            ...keyframe,
            t: roundTime(index * spacing),
          })),
        }
      })
    },

    addMarking: (drillId, marking) => {
      if (!get().drills.some((d) => d.id === drillId)) return null
      const id = generateId('marking')
      commit(drillId, (d) => ({
        ...d,
        scene: { ...d.scene, markings: [...d.scene.markings, { ...marking, id }] },
      }))
      return id
    },

    updateMarking: (drillId, markingId, patch) => {
      commit(drillId, (d) => {
        if (!d.scene.markings.some((m) => m.id === markingId)) return d
        return {
          ...d,
          scene: {
            ...d.scene,
            markings: d.scene.markings.map((m) => (m.id === markingId ? { ...m, ...patch } : m)),
          },
        }
      })
    },

    removeMarking: (drillId, markingId) => {
      commit(drillId, (d) => {
        if (!d.scene.markings.some((m) => m.id === markingId)) return d
        return {
          ...d,
          scene: { ...d.scene, markings: d.scene.markings.filter((m) => m.id !== markingId) },
        }
      })
    },

    setDrillPitch: (drillId, pitch) => {
      commit(drillId, (d) => (d.pitch === pitch ? d : { ...d, pitch }))
    },

    setDuration: (drillId, seconds) => {
      // drill.duration_seconds is an integer column, so round here rather than
      // letting Postgres do it and leave local state disagreeing with the row.
      const value = Math.max(1, Math.round(seconds))
      commit(drillId, (d) => (d.duration_seconds === value ? d : { ...d, duration_seconds: value }))
    },

    undo: (drillId) => {
      const stack = history.get(drillId)
      const drill = get().drills.find((d) => d.id === drillId)
      if (!stack || !drill || stack.past.length === 0) return
      // A half-finished drag has nothing to go back to any more.
      pendingEdits.delete(drillId)
      const previous = stack.past[stack.past.length - 1]
      history.set(drillId, {
        past: stack.past.slice(0, -1),
        future: [...stack.future, snapshotOf(drill)].slice(-UNDO_LIMIT),
      })
      writeDrill(drillId, applySnapshot(drill, previous))
    },

    redo: (drillId) => {
      const stack = history.get(drillId)
      const drill = get().drills.find((d) => d.id === drillId)
      if (!stack || !drill || stack.future.length === 0) return
      pendingEdits.delete(drillId)
      const next = stack.future[stack.future.length - 1]
      history.set(drillId, {
        past: [...stack.past, snapshotOf(drill)].slice(-UNDO_LIMIT),
        future: stack.future.slice(0, -1),
      })
      writeDrill(drillId, applySnapshot(drill, next))
    },

    canUndo: (drillId) => (history.get(drillId)?.past.length ?? 0) > 0,
    canRedo: (drillId) => (history.get(drillId)?.future.length ?? 0) > 0,

    flushDrillSave: async () => {
      settlePendingEdits()
      await flush()
    },

    // ---------------------------------------------------------------------
    // Deprecated: phases[] mutations. See the note on DrillSlice above.
    // ---------------------------------------------------------------------

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

    addArrow: (drillId, phaseIndex, from, to, kind) => {
      set({
        drills: get().drills.map((d) => {
          if (d.id !== drillId) return d
          return {
            ...d,
            phases: d.phases.map((ph, i) =>
              i === phaseIndex ? { ...ph, arrows: [...ph.arrows, { id: generateId('arrow'), from, to, kind }] } : ph
            ),
          }
        }),
      })
    },

    removeArrow: (drillId, phaseIndex, arrowId) => {
      set({
        drills: get().drills.map((d) => {
          if (d.id !== drillId) return d
          return {
            ...d,
            phases: d.phases.map((ph, i) =>
              i === phaseIndex ? { ...ph, arrows: ph.arrows.filter((a) => a.id !== arrowId) } : ph
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
