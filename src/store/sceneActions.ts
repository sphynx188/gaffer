import { transposeKeyframes, transposeScene } from '../components/design/canvas/transposeScene'
import type {
  DrillScene,
  EntityKind,
  EntityState,
  Keyframe,
  Marking,
  PhasePoint,
  PitchConfig,
  PitchOrientation,
  SceneEntity,
} from './types'

// The shared scene reducers (TACTICS_BOARD_REWORK_PLAN.md Stage 2.4).
//
// `drillSlice` and `tacticSlice` operate on the same four columns — scene,
// keyframes, duration_seconds, pitch — so the logic for "add an entity",
// "retime a keyframe", "delete a marking" is identical in both. It lives here
// once. Two 400-line near-duplicates would drift within a month, and the
// drifting half would be the tactics one, because the drill editor is the one
// getting exercised daily.
//
// NOTHING IN THIS FILE KNOWS ABOUT ZUSTAND. No `set`, no `get`, no store
// state, no ids of documents — just `(document, args) => document`. That is
// what keeps it readable and testable, and it is why the extraction stops at
// the reducers: the slices' commit/undo/autosave machinery genuinely differs
// (a tactic keeps two undo stacks, a drill one), so hoisting that too would
// produce the unreadable generic "document slice" the plan warns against.
//
// ── The decline convention ────────────────────────────────────────────────
// Every reducer returns the SAME OBJECT REFERENCE it was handed when there is
// nothing to do — an entity that doesn't exist, a position that already
// matches, a keyframe time that's already occupied. Both slices' `commit()`
// tests `next === current` and skips the undo push and the write on that
// basis, so a press-and-release that moved nothing costs neither an undo slot
// nor a Supabase call. Never return a fresh object "just in case".

// The slice of a Drill or a Tactic these functions operate on. Both types
// structurally satisfy it, which is the whole reason one set of reducers can
// serve both — no adapter, no wrapper, no shared base interface to maintain.
export interface SceneDocument {
  scene: DrillScene
  keyframes: Keyframe[]
  duration_seconds: number
  pitch: PitchConfig
}

// Everything about a new entity except the two things `buildEntity` derives
// itself (its id, and its `number` when it's a player).
export type NewEntityInput = Partial<Omit<SceneEntity, 'id' | 'kind'>>

// ── Small shared helpers ──────────────────────────────────────────────────

// Every generated id (new entity, new keyframe, new marking) goes through
// here — one place to swap the id strategy later if `crypto.randomUUID` ever
// isn't available (it is in every browser this app targets: Vercel-hosted
// HTTPS, modern iOS/Android/desktop browsers).
export function generateId(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

// Keyframe times are rounded to the millisecond. Two keyframes are never
// allowed to share a `t`, and since `regrid` below is now the ONLY thing that
// assigns a time, that guard reduces to "the grid never lands twice on the
// same multiple" — which it can't. Kept because `t` is still float seconds on
// the wire and in `interpolate.ts`.
export function roundTime(seconds: number): number {
  return Math.round(seconds * 1000) / 1000
}

// ── The fixed keyframe grid ───────────────────────────────────────────────
//
// Timing is not something a coach edits. Keyframe N sits at exactly
// N × KEYFRAME_GAP_SECONDS, there are at most MAX_KEYFRAMES of them, and
// `duration_seconds` is DERIVED from the count rather than typed in. A coach
// only ever adds, deletes or reorders keyframes; the seconds behind them are
// an implementation detail they never see or set.
//
// This replaced four separate controls that could each retime a document
// independently — a duration input, drag-to-retime on the track, "Balance
// timing", and a Speed up/Slow down pair that scaled every keyframe. They
// could disagree, and did: because `duration_seconds` was an integer and the
// scale step was ±10%, every duration ≤ 5s was a fixed point of `Math.round`,
// so the duration silently froze while the keyframes kept compressing. There
// is now exactly one rule and nothing to hold a second opinion.
//
// "Speed up / slow down" survives as a PLAYBACK speed (useTimelinePlayback's
// `speed`) — it changes how fast the coach watches the drill, never what is
// stored.
export const KEYFRAME_GAP_SECONDS = 1.5
export const MAX_KEYFRAMES = 10

// The derived duration for a given keyframe count. A single-keyframe document
// still gets one gap's worth of room rather than 0, so the playhead, the track
// and `percentOf` all have a non-zero span to divide by.
export function durationForCount(count: number): number {
  return roundTime(Math.max(1, count - 1) * KEYFRAME_GAP_SECONDS)
}

// Re-lays every keyframe onto the grid in its current order and derives the
// duration to match. Called after any structural change (add, delete, clear,
// paste) so the two can never drift apart. Order is taken from the array as
// given — callers that need a specific position splice it in first.
//
// Returns the SAME REFERENCE when everything is already on the grid, per this
// file's decline convention: a re-grid that changes nothing must not cost an
// undo slot or a Supabase write.
export function regrid<T extends SceneDocument>(doc: T): T {
  const duration = durationForCount(doc.keyframes.length)
  const alreadyGridded =
    doc.duration_seconds === duration &&
    doc.keyframes.every((k, i) => k.t === roundTime(i * KEYFRAME_GAP_SECONDS))
  if (alreadyGridded) return doc
  return {
    ...doc,
    duration_seconds: duration,
    keyframes: doc.keyframes.map((k, i) => ({ ...k, t: roundTime(i * KEYFRAME_GAP_SECONDS) })),
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

export function sortKeyframes(keyframes: Keyframe[]): Keyframe[] {
  return [...keyframes].sort((a, b) => a.t - b.t)
}

// Squad numbers are per team, so team A and team B both start at 1 — matching
// how a coach numbers two bibbed groups rather than one continuous run. For a
// tactic the same rule gives home and away independent numbering.
export function nextNumberFor(entities: SceneEntity[], team: string | undefined): number {
  let highest = 0
  for (const entity of entities) {
    if (entity.kind !== 'player' || entity.team !== team) continue
    if (typeof entity.number === 'number' && entity.number > highest) highest = entity.number
  }
  return highest + 1
}

// The states a new keyframe inherits when the caller doesn't supply any: a
// copy of whichever keyframe is in force at `t` under step semantics. Callers
// that have a playhead pass `frameAt`'s interpolated states instead.
export function statesHoldingAt(keyframes: Keyframe[], t: number): Record<string, EntityState> {
  if (keyframes.length === 0) return {}
  const ordered = sortKeyframes(keyframes)
  let holding = ordered[0]
  for (const keyframe of ordered) {
    if (keyframe.t <= t) holding = keyframe
    else break
  }
  return { ...holding.states }
}

// ── Entities ──────────────────────────────────────────────────────────────

// Assembles the entity `addEntity` will place. Split out from `addEntity` so
// the caller holds the id it generated (both slices return it, so the editor
// can select what it just placed) without this function having to return a
// tuple.
export function buildEntity(
  doc: SceneDocument,
  id: string,
  kind: EntityKind,
  extra?: NewEntityInput
): SceneEntity {
  const base: SceneEntity = { ...extra, id, kind }
  return kind === 'player' && base.number === undefined
    ? { ...base, number: nextNumberFor(doc.scene.entities, base.team) }
    : base
}

// Adds one cast member and stands it at `position` in EVERY keyframe. There's
// no keyframe parameter by design: an entity belongs to the document, not to a
// moment in it, and `EntityState.hidden` is how it comes off the pitch for
// part of the run.
export function addEntity<T extends SceneDocument>(doc: T, entity: SceneEntity, position: PhasePoint): T {
  return {
    ...doc,
    scene: { ...doc.scene, entities: [...doc.scene.entities, entity] },
    keyframes: doc.keyframes.map((keyframe) => ({
      ...keyframe,
      states: { ...keyframe.states, [entity.id]: { x: position.x, y: position.y } },
    })),
  }
}

export function updateEntity<T extends SceneDocument>(doc: T, entityId: string, patch: NewEntityInput): T {
  if (!doc.scene.entities.some((e) => e.id === entityId)) return doc
  return {
    ...doc,
    scene: {
      ...doc.scene,
      entities: doc.scene.entities.map((e) => (e.id === entityId ? { ...e, ...patch } : e)),
    },
  }
}

// Removes the entity from `scene.entities` AND from every keyframe's `states`,
// so no keyframe is left holding a position for a cast member that no longer
// exists.
export function removeEntity<T extends SceneDocument>(doc: T, entityId: string): T {
  if (!doc.scene.entities.some((e) => e.id === entityId)) return doc
  return {
    ...doc,
    scene: { ...doc.scene, entities: doc.scene.entities.filter((e) => e.id !== entityId) },
    keyframes: doc.keyframes.map((keyframe) => {
      if (!(entityId in keyframe.states)) return keyframe
      const states = { ...keyframe.states }
      delete states[entityId]
      return { ...keyframe, states }
    }),
  }
}

// Writes one entity's position into one keyframe. Returns the document
// unchanged when the position already matches — which is what lets a drag that
// ended where it started avoid burning an undo slot.
export function setEntityPosition<T extends SceneDocument>(
  doc: T,
  keyframeId: string,
  entityId: string,
  position: PhasePoint
): T {
  let changed = false
  const keyframes = doc.keyframes.map((keyframe) => {
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
  return changed ? { ...doc, keyframes } : doc
}

// ── Keyframes ─────────────────────────────────────────────────────────────

// Appends a keyframe to the end of the grid. `t` is no longer a position a
// caller chooses — it names the moment whose pose the new keyframe should
// START from (the playhead, typically), and the keyframe itself always lands
// in the next free slot. Refused once the document is at MAX_KEYFRAMES.
//
// `states` defaults to a copy of whatever holds at `t`, so "add a keyframe"
// means "carry on from what I'm looking at" rather than snapping the cast
// back to some other moment.
export function addKeyframe<T extends SceneDocument>(
  doc: T,
  id: string,
  t: number,
  states?: Record<string, EntityState>
): T {
  if (doc.keyframes.length >= MAX_KEYFRAMES) return doc
  const from = roundTime(clamp(t, 0, doc.duration_seconds))
  const seeded = states ? { ...states } : statesHoldingAt(doc.keyframes, from)
  return regrid({ ...doc, keyframes: [...doc.keyframes, { id, t: 0, states: seeded }] })
}

export function updateKeyframeState<T extends SceneDocument>(
  doc: T,
  keyframeId: string,
  states: Record<string, EntityState>
): T {
  if (!doc.keyframes.some((k) => k.id === keyframeId)) return doc
  return {
    ...doc,
    keyframes: doc.keyframes.map((k) => (k.id === keyframeId ? { ...k, states: { ...states } } : k)),
  }
}

// Moves a keyframe one slot earlier or later in the running order. This is
// what replaced drag-to-retime: the ORDER is the only thing a coach can
// change, and the grid re-derives the times from it. `delta` is -1 or +1;
// anything that would fall off either end is refused.
export function reorderKeyframe<T extends SceneDocument>(doc: T, keyframeId: string, delta: number): T {
  const from = doc.keyframes.findIndex((k) => k.id === keyframeId)
  if (from === -1) return doc
  const to = from + delta
  if (to < 0 || to >= doc.keyframes.length) return doc
  const keyframes = [...doc.keyframes]
  const [moved] = keyframes.splice(from, 1)
  keyframes.splice(to, 0, moved)
  return regrid({ ...doc, keyframes })
}

// Deletes the keyframe and any marking bound to it. Keyframe-bound markings go
// with it because the phases model this replaced kept arrows and notes
// *inside* the phase, so deleting a phase always took them too; static
// markings (no keyframeId) are untouched. Refuses to drop the last keyframe —
// a document always keeps at least one, the same invariant `makeInitialKeyframe`
// establishes at creation; without it `frameAt` has no bracket to interpolate
// from and every entity, including any placed afterward, renders nowhere.
export function deleteKeyframe<T extends SceneDocument>(doc: T, keyframeId: string): T {
  if (doc.keyframes.length <= 1) return doc
  if (!doc.keyframes.some((k) => k.id === keyframeId)) return doc
  // Regridded so the survivors close the gap the deleted one left, rather
  // than keeping a hole at its old time.
  return regrid({
    ...doc,
    keyframes: doc.keyframes.filter((k) => k.id !== keyframeId),
    scene: { ...doc.scene, markings: doc.scene.markings.filter((m) => m.keyframeId !== keyframeId) },
  })
}

// Collapses the timeline down to one keyframe at t=0, holding whatever was
// governing at that time, and drops every marking bound to one. Entities
// survive — clearing the timing isn't the same as emptying the pitch — and,
// per the same invariant `deleteKeyframe` enforces, the document never drops
// to zero keyframes: that would leave `frameAt` nothing to interpolate from,
// so every entity's position is silently lost rather than just its timing.
export function clearKeyframes<T extends SceneDocument>(doc: T): T {
  if (doc.keyframes.length <= 1) return doc
  return regrid({
    ...doc,
    keyframes: [{ id: generateId('keyframe'), t: 0, states: statesHoldingAt(doc.keyframes, 0) }],
    scene: { ...doc.scene, markings: doc.scene.markings.filter((m) => !m.keyframeId) },
  })
}

// `balanceTiming`, `scaleTiming` and `setDuration` used to live here. All
// three are gone: with the grid, keyframes are always already balanced, and
// there is no duration to set independently of them. See `regrid` above.

// Copy/paste of a whole keyframe (Stage 2.2, Ctrl+C / Ctrl+V). What travels is
// the `states` map — where everyone stood — not the id or the time, because
// pasting is "put the cast back in this shape at the playhead", not "make a
// second keyframe claiming to be the first". Returns null when the id doesn't
// resolve, so the caller can leave the clipboard alone.
export function copyKeyframe(doc: SceneDocument, keyframeId: string): Keyframe | null {
  const keyframe = doc.keyframes.find((k) => k.id === keyframeId)
  return keyframe ? { ...keyframe, states: { ...keyframe.states } } : null
}

// Pastes a copied shape in as a NEW keyframe at the end of the grid. States
// are filtered to entities the document still has, so pasting a keyframe
// copied before a player was deleted doesn't resurrect a position for a cast
// member that no longer exists. Refused (unchanged) at MAX_KEYFRAMES, exactly
// as addKeyframe is — `t` now only seeds the pose, not the position.
export function pasteKeyframe<T extends SceneDocument>(doc: T, id: string, t: number, clipboard: Keyframe): T {
  const live: Record<string, EntityState> = {}
  for (const entity of doc.scene.entities) {
    const state = clipboard.states[entity.id]
    if (state) live[entity.id] = { ...state }
  }
  return addKeyframe(doc, id, t, live)
}

// ── Markings ──────────────────────────────────────────────────────────────

export function addMarking<T extends SceneDocument>(doc: T, marking: Omit<Marking, 'id'>, id: string): T {
  return { ...doc, scene: { ...doc.scene, markings: [...doc.scene.markings, { ...marking, id }] } }
}

export function updateMarking<T extends SceneDocument>(
  doc: T,
  markingId: string,
  patch: Partial<Omit<Marking, 'id'>>
): T {
  if (!doc.scene.markings.some((m) => m.id === markingId)) return doc
  return {
    ...doc,
    scene: {
      ...doc.scene,
      markings: doc.scene.markings.map((m) => (m.id === markingId ? { ...m, ...patch } : m)),
    },
  }
}

export function removeMarking<T extends SceneDocument>(doc: T, markingId: string): T {
  if (!doc.scene.markings.some((m) => m.id === markingId)) return doc
  return { ...doc, scene: { ...doc.scene, markings: doc.scene.markings.filter((m) => m.id !== markingId) } }
}

// Teloframe's "Clear drawings", which is deliberately a different act from
// clearing keyframes: it empties the board of free-drawn arrows, zones and
// notes and leaves the animation completely alone.
//
// Markings BOUND to a keyframe are deliberately spared. They live and die with
// that keyframe (deleteKeyframe takes them), so they are part of the animation
// rather than part of the drawing layer — and clearing them here would put
// them beyond the reach of the drawing undo stack that is supposed to bring
// this action back.
export function clearDrawnMarkings<T extends SceneDocument>(doc: T): T {
  const kept = doc.scene.markings.filter((m) => !!m.keyframeId)
  if (kept.length === doc.scene.markings.length) return doc
  return { ...doc, scene: { ...doc.scene, markings: kept } }
}

// ── Pitch and duration ────────────────────────────────────────────────────

// Changing the pitch also transposes the CONTENT whenever orientation flips —
// see canvas/transposeScene.ts for the bug this fixes and why it is a diagonal
// mirror rather than a rotation. It lives in this reducer rather than in the
// PitchPanel component because the panel only ever sees `pitch`, and because
// putting it here means both editors get the fix from one place.
export function setPitch<T extends SceneDocument>(doc: T, pitch: PitchConfig): T {
  if (doc.pitch === pitch) return doc
  if (doc.pitch.orientation === pitch.orientation) return { ...doc, pitch }
  return {
    ...doc,
    pitch,
    scene: transposeScene(doc.scene),
    keyframes: transposeKeyframes(doc.keyframes),
  }
}

// The live orientation switcher (decided 2026-08-26; plan 1.6/2.2). Orientation
// is not a creation-time choice — a coach flips a board mid-thought — so this
// is its own action rather than something a caller has to remember to route
// through setPitch with a hand-built config.
export function setOrientation<T extends SceneDocument>(doc: T, orientation: PitchOrientation): T {
  if (doc.pitch.orientation === orientation) return doc
  return setPitch(doc, { ...doc.pitch, orientation })
}

// `setDuration` is gone. Duration is derived from the keyframe count by
// `regrid`/`durationForCount` and is not independently settable — migration
// 037 widened the column to numeric(4,1) to hold the half-seconds the 1.5s
// grid produces.
