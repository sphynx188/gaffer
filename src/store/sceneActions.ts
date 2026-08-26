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
// allowed to share a `t` (addKeyframe and moveKeyframe both refuse), and that
// guard is only reliable if float noise from balanceTiming's division can't
// produce a near-but-not-equal duplicate.
export function roundTime(seconds: number): number {
  return Math.round(seconds * 1000) / 1000
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

// Inserts a keyframe at `t` seconds, keeping `keyframes` sorted by time. A
// second keyframe at a time one already occupies is refused (returns the
// document unchanged) — interpolation across a zero-length segment isn't
// defined. `states` defaults to a copy of whichever keyframe holds at `t`.
export function addKeyframe<T extends SceneDocument>(
  doc: T,
  id: string,
  t: number,
  states?: Record<string, EntityState>
): T {
  const time = roundTime(clamp(t, 0, doc.duration_seconds))
  if (doc.keyframes.some((k) => k.t === time)) return doc
  const seeded = states ? { ...states } : statesHoldingAt(doc.keyframes, time)
  return { ...doc, keyframes: sortKeyframes([...doc.keyframes, { id, t: time, states: seeded }]) }
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

// Retimes one keyframe and re-sorts. Clamped to [0, duration_seconds];
// refused if another keyframe already sits on that exact time.
export function moveKeyframe<T extends SceneDocument>(doc: T, keyframeId: string, t: number): T {
  const time = roundTime(clamp(t, 0, doc.duration_seconds))
  if (doc.keyframes.some((k) => k.t === time && k.id !== keyframeId)) return doc
  const target = doc.keyframes.find((k) => k.id === keyframeId)
  if (!target || target.t === time) return doc
  return {
    ...doc,
    keyframes: sortKeyframes(doc.keyframes.map((k) => (k.id === keyframeId ? { ...k, t: time } : k))),
  }
}

// Deletes the keyframe and any marking bound to it. Keyframe-bound markings go
// with it because the phases model this replaced kept arrows and notes
// *inside* the phase, so deleting a phase always took them too; static
// markings (no keyframeId) are untouched.
export function deleteKeyframe<T extends SceneDocument>(doc: T, keyframeId: string): T {
  if (!doc.keyframes.some((k) => k.id === keyframeId)) return doc
  return {
    ...doc,
    keyframes: doc.keyframes.filter((k) => k.id !== keyframeId),
    scene: { ...doc.scene, markings: doc.scene.markings.filter((m) => m.keyframeId !== keyframeId) },
  }
}

// Drops every keyframe, and every marking bound to one. Entities survive —
// clearing the timing isn't the same as emptying the pitch.
export function clearKeyframes<T extends SceneDocument>(doc: T): T {
  if (doc.keyframes.length === 0) return doc
  return {
    ...doc,
    keyframes: [],
    scene: { ...doc.scene, markings: doc.scene.markings.filter((m) => !m.keyframeId) },
  }
}

// Spreads the existing keyframes evenly across `duration_seconds`, keeping
// their order.
export function balanceTiming<T extends SceneDocument>(doc: T): T {
  const count = doc.keyframes.length
  if (count === 0) return doc
  const spacing = count === 1 ? 0 : doc.duration_seconds / (count - 1)
  return {
    ...doc,
    keyframes: sortKeyframes(doc.keyframes).map((keyframe, index) => ({
      ...keyframe,
      t: roundTime(index * spacing),
    })),
  }
}

// Copy/paste of a whole keyframe (Stage 2.2, Ctrl+C / Ctrl+V). What travels is
// the `states` map — where everyone stood — not the id or the time, because
// pasting is "put the cast back in this shape at the playhead", not "make a
// second keyframe claiming to be the first". Returns null when the id doesn't
// resolve, so the caller can leave the clipboard alone.
export function copyKeyframe(doc: SceneDocument, keyframeId: string): Keyframe | null {
  const keyframe = doc.keyframes.find((k) => k.id === keyframeId)
  return keyframe ? { ...keyframe, states: { ...keyframe.states } } : null
}

// Pastes a copied shape in as a NEW keyframe at `t`. States are filtered to
// entities the document still has, so pasting a keyframe copied before a
// player was deleted doesn't resurrect a position for a cast member that no
// longer exists. Refused (unchanged) if `t` is already occupied, exactly as
// addKeyframe is.
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

// Existing keyframes are deliberately left where they are when the duration
// shrinks: silently dragging a coach's keyframes is worse than leaving one
// past the end, and `balanceTiming` is the tool for redistributing them.
export function setDuration<T extends SceneDocument>(doc: T, seconds: number): T {
  // Both columns are `integer`, so round here rather than letting Postgres do
  // it and leave local state disagreeing with the row.
  const value = Math.max(1, Math.round(seconds))
  return doc.duration_seconds === value ? doc : { ...doc, duration_seconds: value }
}
