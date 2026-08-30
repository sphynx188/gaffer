import type { StateCreator } from 'zustand'
import { createClient } from '@supabase/supabase-js'
import { supabase, supabaseAnonKey, supabaseUrl } from '../../lib/supabase'
import { runSupabaseAction, type SupabaseCallResult } from '../supabaseAction'
import { mintShareToken } from '../shareToken'
import * as scene from '../sceneActions'
import type { NewEntityInput } from '../sceneActions'
import type {
  Drill,
  DrillCoaching,
  DrillDifficulty,
  DrillIntensity,
  DrillPhaseOfPlay,
  DrillScene,
  EntityKind,
  EntityState,
  Keyframe,
  Marking,
  PhasePoint,
  PitchConfig,
  PitchOrientation,
  SessionBlock,
} from '../types'
import type { StoreState } from '../useStore'

// team_id dropped (club tenancy, 2026-08-28): createDrill now writes
// club_id from the caller's selectedClubId and never writes team_id —
// Drill.team_id stays on the read type (demoted, not dropped) but no new
// code writes or reads it. See clubSlice.ts / migration 027.
export interface NewDrillInput {
  name: string
  orientation: PitchOrientation
  // The pitch the coach picked at creation, seeded rather than left to the
  // column default so a new drill doesn't claim to be a full pitch when they
  // picked a rondo grid. Built by the caller from PITCH_PRESETS.
  pitch: PitchConfig
  scene?: DrillScene
  keyframes?: Keyframe[]
  duration_seconds?: number
}

// Deliberately does NOT carry scene/keyframes/duration_seconds/pitch. Those
// four are written by the autosave flush below and nothing else, so there's
// exactly one path a drill's content can take to the database — a second one
// through here would be a way to bypass the undo stack and the debounce
// without noticing.
export interface DrillUpdateInput {
  name?: string
  orientation?: PitchOrientation

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

// Re-exported from sceneActions, where it now lives alongside the reducers
// that consume it (Stage 2.4). Kept exported from here so every existing
// importer — and store/index.ts — carries on working unchanged.
export type { NewEntityInput }

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

// A drill always keeps at least one keyframe from creation — without one
// there's nowhere for addEntity to record a position.
function makeInitialKeyframe(): Keyframe {
  return { id: scene.generateId('keyframe'), t: 0, states: {} }
}

export interface DrillSlice {
  drills: Drill[]
  drillsLoading: boolean
  drillsError: string | null
  // Drives the top bar's save indicator (plan §2.3). One field for the whole
  // store rather than one per drill: only one drill is ever being edited.
  saveState: SaveState

  // Club tenancy (2026-08-28): visibility is entirely RLS's job now
  // (drill_club_read — admin of the club, own creation, or a readable
  // collection), so the fetch itself takes no scope argument. `_teamId?` is
  // kept, ignored, only so the two still-active-but-shelved callers
  // (TeamOverviewPage, SessionItemsPanel) keep compiling —
  // `noUnusedParameters` makes the leading underscore load-bearing, not
  // cosmetic. See plan Task 5 Step 0/1a.
  fetchDrills: (_teamId?: string) => Promise<void>
  createDrill: (input: NewDrillInput) => Promise<Drill | null>

  // A drill that exists only in local state until the coach actually edits it
  // (2026-08-30). `/design` used to INSERT on navigation, so every stray visit
  // — a mistyped URL, a back-button bounce — left a permanent "New drill" row
  // behind; 16 empty ones had accumulated by the time this was found. The
  // draft carries a real client-generated id so every store action, the URL
  // and undo all work on it unchanged; the first commit inserts it (see
  // runFlush), and leaving without editing discards it with nothing written.
  startDrillDraft: (input: NewDrillInput) => Drill | null
  discardDrillDraft: (drillId: string) => void
  isDrillDraft: (drillId: string) => boolean
  updateDrill: (id: string, patch: DrillUpdateInput) => Promise<Drill | null>

  // Whole-drill duplication (rework plan Stage 9.5) — the useful unit now
  // that a drill is one cast of entities plus keyframes rather than a list of
  // independent phases. Copies everything a coach would expect to survive a
  // "duplicate": scene, keyframes, pitch, duration and every Stage 8 metadata
  // field. The one deliberate omission is thumbnail_url — see the
  // implementation for why.
  duplicateDrill: (drillId: string) => Promise<Drill | null>

  // Deletes the drill outright. `session_drills` rows referencing it cascade
  // at the DB level (schema.sql), so a session that had it in its line-up
  // just loses that row rather than blocking the delete.
  deleteDrill: (drillId: string) => Promise<boolean>

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

}

export const createDrillSlice: StateCreator<StoreState, [], [], DrillSlice> = (set, get) => {
  // Same stale-response guard as sessionSlice — see the comment there.
  // Monotonic call id (club tenancy, 2026-08-28) — fetchDrills no longer
  // takes a scope argument to key a "superseded by a newer call" check off
  // of, but the race it guarded (an in-flight fetch resolving after a newer
  // one already landed, e.g. a rapid remount) still exists, so this
  // generalizes the same guard rather than dropping it.
  let fetchDrillsCallId = 0

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
      // A draft's first save is its INSERT, carrying the id it has been using
      // locally all along so nothing — the URL, undo history, the open editor
      // — has to be repointed afterwards.
      //
      // It sends the WHOLE row, not `payload`: a snapshot is only the four
      // fields an edit can touch (scene/keyframes/duration_seconds/pitch), so
      // inserting it alone omits club_id and name, both NOT NULL, and the row
      // is rejected. `payload` still goes on top, since it is the newer copy
      // of those four if an edit landed while this was queued.
      const isDraft = unsavedDrafts.has(drillId)
      const draftRow = isDraft ? get().drills.find((d) => d.id === drillId) : undefined
      if (isDraft && !draftRow) continue
      const { error } = await runSupabaseAction<Drill[]>(
        () =>
          draftRow
            ? supabase.from('drill').insert({ ...draftRow, ...payload, id: drillId }).select()
            : supabase.from('drill').update(payload).eq('id', drillId).select(),
        isDraft ? "Couldn't create drill, try again." : "Couldn't save drill, try again."
      )
      if (isDraft && !error) unsavedDrafts.delete(drillId)
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
  // Ids of drills that exist locally but have never been written. Kept out of
  // the store object deliberately, like `pendingSaves` and `history` — it is
  // bookkeeping for the save path, not state any component renders.
  const unsavedDrafts = new Set<string>()

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

    fetchDrills: async () => {
      const callId = ++fetchDrillsCallId
      set({ drillsLoading: true, drillsError: null })
      const { data, error } = await runSupabaseAction<Drill[]>(
        () => supabase.from('drill').select('*').order('created_at', { ascending: true }),
        "Couldn't load drills, try again."
      )
      if (callId !== fetchDrillsCallId) return // superseded by a newer fetch
      let drills = data
      if (data) {
        // A refetch must not roll back edits that haven't been flushed yet —
        // every screen refetches on mount, so this happens just by navigating
        // away from the editor and back inside the debounce window.
        drills = data.map((drill) => {
          const pending = pendingSaves.get(drill.id)
          return pending ? { ...drill, ...pending } : drill
        })
        // Drop history for drills no longer visible (RLS-scoped now, not
        // team-scoped), so a club switch doesn't leave undo pointing at
        // content the coach can no longer see.
        // Drafts aren't on the server yet, so re-add them rather than letting
        // the server's list silently delete the drill the coach has open.
        const drafts = get().drills.filter((d) => unsavedDrafts.has(d.id))
        if (drafts.length) drills = [...drills!, ...drafts]
        const visible = new Set([...data.map((d) => d.id), ...unsavedDrafts])
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

    startDrillDraft: (input) => {
      const clubId = get().selectedClubId
      if (!clubId) return null
      // The id becomes a real uuid PRIMARY KEY on insert, so unlike an entity
      // id (which lives in jsonb and can be any string) it has to be a genuine
      // uuid. `scene.generateId` falls back to a non-uuid string where
      // crypto.randomUUID is missing, so bail here instead and let the caller
      // use the eager createDrill path rather than queue an insert that would
      // be rejected.
      if (typeof crypto === 'undefined' || typeof crypto.randomUUID !== 'function') return null
      // Same seeding as createDrill — a drill always keeps at least one
      // keyframe, or addEntity has nowhere to record a position — but built
      // here rather than round-tripped, so nothing is written yet.
      const draft = {
        id: crypto.randomUUID(),
        club_id: clubId,
        team_id: null,
        keyframes: input.keyframes ?? [makeInitialKeyframe()],
        scene: input.scene ?? { entities: [], markings: [] },
        duration_seconds: input.duration_seconds ?? 15,
        ...input,
      } as unknown as Drill
      unsavedDrafts.add(draft.id)
      set({ drills: [...get().drills, draft] })
      return draft
    },

    discardDrillDraft: (drillId) => {
      if (!unsavedDrafts.has(drillId)) return
      unsavedDrafts.delete(drillId)
      pendingSaves.delete(drillId)
      history.delete(drillId)
      set({ drills: get().drills.filter((d) => d.id !== drillId) })
    },

    isDrillDraft: (drillId) => unsavedDrafts.has(drillId),

    createDrill: async (input) => {
      const clubId = get().selectedClubId
      if (!clubId) return null
      set({ drillsLoading: true, drillsError: null })
      // A drill always keeps at least one keyframe — without one there's
      // nowhere for addEntity to record a position, so a freshly created
      // drill couldn't be edited at all. club_id comes from the caller's
      // selected club; team_id is never written (club tenancy, 2026-08-28 —
      // demoted, not dropped, see NewDrillInput above).
      const seeded = {
        ...input,
        club_id: clubId,
        keyframes: input.keyframes ?? [makeInitialKeyframe()],
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

    // Drill-level fields only (name, orientation and the Stage 8 metadata).
    // A drill's scene, keyframes, duration and pitch go through the autosave
    // flush instead — see DrillUpdateInput.
    updateDrill: async (id, patch) => {
      // Applied to local state immediately — the Details drawer's fields
      // otherwise waited on the round-trip before a chip so much as
      // highlighted, which read as unresponsive on anything but a fast
      // connection. The network write still happens below; on success it
      // reconciles with the server row exactly as before.
      const current = get().drills.find((d) => d.id === id)
      if (current) set({ drills: get().drills.map((d) => (d.id === id ? { ...d, ...patch } : d)) })
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
        name: `${source.name} (copy)`,
        orientation: source.orientation,
        pitch: source.pitch,
        scene: source.scene,
        keyframes: source.keyframes,
        duration_seconds: source.duration_seconds,
      })
      if (!created) return null
      // Metadata isn't part of NewDrillInput — createDrill's insert exists to
      // seed structural defaults (the initial keyframe) a plain column patch
      // must never fight with — so it goes through the same
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

    deleteDrill: async (drillId) => {
      set({ drillsLoading: true, drillsError: null })
      const { error } = await runSupabaseAction<null>(
        () => supabase.from('drill').delete().eq('id', drillId),
        "Couldn't delete drill, try again."
      )
      if (error) {
        set({ drillsLoading: false, drillsError: error })
        return false
      }
      // Drop the queued write and the history too, or a debounced flush would
      // resurrect a PATCH against a row that no longer exists.
      pendingSaves.delete(drillId)
      pendingEdits.delete(drillId)
      history.delete(drillId)
      set((state) => ({
        drillsLoading: false,
        drillsError: null,
        drills: state.drills.filter((d) => d.id !== drillId),
      }))
      return true
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
      const id = scene.generateId(kind)
      const entity = scene.buildEntity(drill, id, kind, extra)
      commit(drillId, (d) => scene.addEntity(d, entity, position))
      return id
    },

    updateEntity: (drillId, entityId, patch) => {
      commit(drillId, (d) => scene.updateEntity(d, entityId, patch))
    },

    removeEntity: (drillId, entityId) => {
      commit(drillId, (d) => scene.removeEntity(d, entityId))
    },

    setEntityPosition: (drillId, keyframeId, entityId, position, commitEdit = false) => {
      const current = get().drills.find((d) => d.id === drillId)
      if (!current) return
      // Captured before the first movement lands, so undo steps back to where
      // the drag began rather than to some point part-way through it.
      if (!pendingEdits.has(drillId)) pendingEdits.set(drillId, snapshotOf(current))
      const next = scene.setEntityPosition(current, keyframeId, entityId, position)

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
      const id = scene.generateId('keyframe')
      let added = false
      commit(drillId, (d) => {
        const next = scene.addKeyframe(d, id, t, states)
        added = next !== d
        return next
      })
      return added ? id : null
    },

    updateKeyframeState: (drillId, keyframeId, states) => {
      commit(drillId, (d) => scene.updateKeyframeState(d, keyframeId, states))
    },

    moveKeyframe: (drillId, keyframeId, t) => {
      commit(drillId, (d) => scene.moveKeyframe(d, keyframeId, t))
    },

    deleteKeyframe: (drillId, keyframeId) => {
      commit(drillId, (d) => scene.deleteKeyframe(d, keyframeId))
    },

    clearKeyframes: (drillId) => {
      commit(drillId, (d) => scene.clearKeyframes(d))
    },

    balanceTiming: (drillId) => {
      commit(drillId, (d) => scene.balanceTiming(d))
    },

    addMarking: (drillId, marking) => {
      if (!get().drills.some((d) => d.id === drillId)) return null
      const id = scene.generateId('marking')
      commit(drillId, (d) => scene.addMarking(d, marking, id))
      return id
    },

    updateMarking: (drillId, markingId, patch) => {
      commit(drillId, (d) => scene.updateMarking(d, markingId, patch))
    },

    removeMarking: (drillId, markingId) => {
      commit(drillId, (d) => scene.removeMarking(d, markingId))
    },

    setDrillPitch: (drillId, pitch) => {
      commit(drillId, (d) => scene.setPitch(d, pitch))
    },

    setDuration: (drillId, seconds) => {
      commit(drillId, (d) => scene.setDuration(d, seconds))
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
  }
}
