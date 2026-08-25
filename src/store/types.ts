// Domain types mirroring supabase/schema.sql — the schema is the source of
// truth (see gaffer_project_plan_final.md §5); this file just types it for
// the store and, later, every component that reads from it.

// Replaces the old 2-value PitchFormat ('11v11' | 'small_sided') — see
// supabase/migrations/011_drill_pitch_size_orientation.sql. Two independent
// dimensions instead of one fixed shape, so the Drill Creator can offer
// 4 sizes x 2 orientations.
export type PitchSize = 'full' | 'three_quarter' | 'half' | 'quarter'
export type PitchOrientation = 'portrait' | 'landscape'
export type CoachRole = 'owner' | 'coach'
// One status per (session, player) row, serving double duty: a coach can
// set it as a pre-session RSVP guess or as the actual post-session
// roll-call outcome — 'unconfirmed' is the seeded default either way. See
// supabase/migrations/010_attendance_roll_call_status.sql.
export type AvailabilityStatus = 'unconfirmed' | 'present' | 'injured' | 'away'

export const PITCH_SIZE_LABELS: Record<PitchSize, string> = {
  full: 'Full pitch',
  three_quarter: '¾ pitch',
  half: 'Half pitch',
  quarter: 'Quarter pitch',
}

export const PITCH_ORIENTATION_LABELS: Record<PitchOrientation, string> = {
  portrait: 'Portrait',
  landscape: 'Landscape',
}

// Phase 1 revision: position is a multi-select tag set, not freeform text —
// a player can hold more than one (e.g. winger + striker). Fixed list,
// mirrors the `player_position` Postgres enum (supabase/schema.sql) —
// keep the two in sync if this ever changes.
export const PLAYER_POSITIONS = ['goalkeeper', 'defender', 'midfielder', 'winger', 'striker'] as const
export type PlayerPosition = (typeof PLAYER_POSITIONS)[number]

export const PLAYER_POSITION_LABELS: Record<PlayerPosition, string> = {
  goalkeeper: 'Goalkeeper',
  defender: 'Defender',
  midfielder: 'Midfielder',
  winger: 'Winger',
  striker: 'Striker',
}

export interface Team {
  id: string
  name: string
  owner_id: string
  created_at: string
}

export interface TeamCoach {
  id: string
  team_id: string
  user_id: string
  role: CoachRole
  created_at: string
}

export interface Player {
  id: string
  team_id: string
  name: string
  positions: PlayerPosition[]
  squad_number: number | null
  created_at: string
}

export interface PlayerNote {
  id: string
  player_id: string
  author_id: string
  body: string
  created_at: string
}

export interface Session {
  id: string
  team_id: string
  date: string
  duration_minutes: number
  // Nullable only for rows created before the Calendar feature added this
  // column — every session created or edited since always sets it.
  start_time: string | null
  coaching_notes: string | null
  season_label: string | null
  created_at: string
}

export interface Availability {
  id: string
  session_id: string
  player_id: string
  status: AvailabilityStatus
  reason: string | null
  responded_at: string | null
}

// One entry in Drill.phases (jsonb array). Normalized 0-1 coordinates so the
// same phase renders correctly on both pitch formats — see
// gaffer_project_plan_final.md §5 for the canonical shape.
export interface PhasePoint {
  x: number
  y: number
}

export interface PhasePlayer extends PhasePoint {
  id: string
  team: string
  number?: number
  label?: string
}

// 'kind' absent/undefined means 'cone' — kept optional rather than adding
// separate witchesHats/mannequins arrays (Upgrade Phase 2B,
// UPGRADE_IMPLEMENTATION_PLAN.md) so every existing persisted drill (jsonb,
// no migration needed) stays valid without a backfill, and so a future
// equipment type is one more union member here, not a new array + new
// canvas-render block + new store methods everywhere.
export type EquipmentKind = 'cone' | 'witches_hat' | 'mannequin'

export interface PhaseCone extends PhasePoint {
  id: string
  kind?: EquipmentKind
  color?: string
}

export interface PhaseBall extends PhasePoint {
  id: string
}

// 'kind' distinguishes ball/pass movement from player movement (Upgrade
// Phase 2C, UPGRADE_IMPLEMENTATION_PLAN.md) — absent/undefined means
// 'player', matching every arrow that existed before this field did.
export type ArrowKind = 'ball' | 'player'

export interface PhaseArrow {
  id: string
  from: PhasePoint
  to: PhasePoint
  kind?: ArrowKind
  style?: string
}

export interface PhaseAnnotation extends PhasePoint {
  id: string
  text: string
}

export interface DrillPhase {
  id: string
  label?: string
  duration_seconds?: number
  players: PhasePlayer[]
  cones: PhaseCone[]
  balls: PhaseBall[]
  arrows: PhaseArrow[]
  annotations: PhaseAnnotation[]
}

// ---------------------------------------------------------------------------
// Entities + keyframes (DRILL_CREATOR_REWORK_PLAN.md Stage 1)
//
// Replaces the phases[] model above. The difference that matters: a drill now
// has ONE cast of entities with ids stable for the whole drill, plus keyframes
// that say where each of them is at a given time. Under phases[], "the same"
// player in two phases was two unrelated objects that happened to share an id,
// which is why nothing could ever tween between phases (see DrillLibrary.tsx's
// comment on why its preview cuts rather than interpolates). Everything the
// rework adds downstream — interpolation, onion skin, movement paths, the
// per-segment speed readout — is undefined without that identity.
//
// Coordinates stay normalized 0-1 exactly as phases[] used them, so a drill
// still renders correctly on any pitch shape.
// ---------------------------------------------------------------------------

export type EntityKind = 'player' | 'ball' | 'equipment'
export type PlayerDisplay = 'compact' | 'standard' | 'presentation' | 'dot'
export type BodyShape = 'auto' | 'backpedal' | 'shuffle_left' | 'shuffle_right'

// The full equipment set (rework plan Stage 6.1). jsonb, so widening this
// never needed a schema migration — the same extensibility EquipmentKind was
// given.
//
// Note the one rename this brought with it: the phases-era 'cone' value was
// *drawn* as an agility pole (see pitchTheme.ts's own comment about keeping
// the stored value 'cone' for backward compatibility). Now that the set has a
// real `cone` and a real `pole`, migration 015 remaps the stored values so the
// names and the shapes finally agree — existing equipment keeps the silhouette
// it always had.
export const EQUIPMENT_TYPES = [
  'cone',
  'marker',
  'pole',
  'mannequin',
  'mini_goal',
  'agility_ring',
  'full_goal',
  'ladder',
  'hurdle',
  'rebounder',
  'passing_gate',
] as const
export type EquipmentType = (typeof EQUIPMENT_TYPES)[number]

export const EQUIPMENT_LABELS: Record<EquipmentType, string> = {
  cone: 'Cone',
  marker: 'Flat marker',
  pole: 'Agility pole',
  mannequin: 'Mannequin',
  mini_goal: 'Mini goal',
  agility_ring: 'Agility ring',
  full_goal: 'Full goal',
  ladder: 'Ladder',
  hurdle: 'Hurdle',
  rebounder: 'Rebounder',
  passing_gate: 'Passing gate',
}

// The Core/Advanced split the target app groups its equipment library by.
export const EQUIPMENT_CORE: EquipmentType[] = ['cone', 'marker', 'pole', 'mannequin', 'mini_goal']
export const EQUIPMENT_ADVANCED: EquipmentType[] = [
  'agility_ring',
  'full_goal',
  'ladder',
  'hurdle',
  'rebounder',
  'passing_gate',
]

// A cast member. Stable id for the entire life of the drill — this is the
// property phases[] never had, and the one every animation feature needs.
// Position is deliberately NOT here: where an entity is depends on which
// keyframe you're asking about (see EntityState).
export interface SceneEntity {
  id: string
  kind: EntityKind
  // players
  team?: string // 'A' | 'B' — drives color, as PhasePlayer.team does today
  number?: number // auto-assigned per team on create
  label?: string
  color?: string // per-entity override of the team color
  goalkeeper?: boolean
  display?: PlayerDisplay
  // equipment
  equipment?: EquipmentType
  // Degrees clockwise. Only equipment carries one — a goal or a ladder has an
  // orientation on the pitch, while a player's heading is per-keyframe and
  // lives on EntityState.facing instead.
  rotation?: number
}

// Where one entity is at one keyframe. `x`/`y` are optional only because a
// hidden entity has no position to record — an entity that isn't on the pitch
// at this keyframe is stored as `{ hidden: true }` alone (the shape migration
// 013b's rule 3 writes). Every visible state always carries both.
export interface EntityState {
  x?: number // normalized 0-1, unchanged convention
  y?: number
  facing?: number // degrees; omitted = derive from travel direction
  bodyShape?: BodyShape
  path?: PhasePoint[] // custom multi-point route to the NEXT keyframe
  hidden?: boolean // entity not on the pitch at this keyframe
}

export interface Keyframe {
  id: string
  t: number // seconds from drill start
  name?: string
  description?: string
  states: Record<string, EntityState> // entityId -> state
}

// Arrows, lines, shapes, zones, freehand, text. Static by default;
// `keyframeId` binds a marking to one keyframe — which is what lets the
// migration carry today's per-phase arrows and annotations across losslessly.
export interface Marking {
  id: string
  kind: 'arrow' | 'line' | 'curve' | 'circle' | 'rect' | 'freehand' | 'zone' | 'text'
  points: PhasePoint[]
  style?: { stroke?: string; dash?: boolean; fill?: string; width?: number }
  text?: string
  keyframeId?: string | null
}

export interface DrillScene {
  entities: SceneEntity[]
  markings: Marking[]
}

// Pitch overlays (rework plan Stage 7.4) — grid systems drawn over the pitch
// rather than markings of it.
export type OverlayKind = 'thirds' | 'channels' | 'lanes' | 'half_spaces' | 'pep_zones' | 'training_grid'

// Real metre dimensions rather than a 4-value size enum, which is what makes
// the Stage 4 speed readout meaningful. `widthMeters`/`lengthMeters` are the
// canonical *portrait* authoring (width = the lateral/goal-width axis) with
// `orientation` applied on top, exactly the convention pitchGeometry.ts
// already uses — see its header comment on transpose().
//
// Stage 7 owns the preset table and populates `preset`, so it's typed as a
// plain string here rather than a union frozen too early; migration 013b
// carries the four old pitch_size values through as preset keys. `markings`
// is optional until Stage 7 decides whether it's derived from the dimensions
// or stored.
export interface PitchConfig {
  preset: string // 'full' | 'rondo_20' | 'guardiola_4v4_3' | 'custom' | …
  widthMeters: number
  lengthMeters: number
  orientation: PitchOrientation
  markings?: 'full' | 'grid' | 'none'
  overlays: OverlayKind[]
  surface?: string
  units?: 'm' | 'yd'
}

export interface Drill {
  id: string
  team_id: string | null // null = coach-owned, reusable across every team
  name: string
  scene: DrillScene
  keyframes: Keyframe[]
  duration_seconds: number
  pitch: PitchConfig
  orientation: PitchOrientation
  created_at: string

  // Deprecated by migration 013 (scene/keyframes) and dropped by 014 once the
  // backfill has been read back in the new editor — see
  // DRILL_CREATOR_REWORK_PLAN.md Stage 1.4. Still the authoritative copy of a
  // drill's content until then, which is what keeps 013b re-runnable, so
  // don't write new code against either of them.
  /** @deprecated use `scene` + `keyframes`; dropped by migration 014. */
  phases: DrillPhase[]
  /** @deprecated use `pitch`; dropped by migration 014. */
  pitch_size: PitchSize
}

export interface SessionDrill {
  id: string
  session_id: string
  drill_id: string
  order_index: number
  planned_duration_minutes: number | null
  notes: string | null
}

// Upgrade Phase 3 (UPGRADE_IMPLEMENTATION_PLAN.md): the Tactic Creator.
// Unlike a drill's PhasePlayer (a freeform team label — "attack"/"A"/"B"),
// a tactic player is always a real roster player, referenced by id — a
// tactic shows this team's own actual squad, not a generic two-team drill
// setup. No cones/balls: v1 tactics are players + arrows + annotations
// only, per the roadmap's "static tactical diagram" scope.
export interface TacticPlayer extends PhasePoint {
  id: string
  player_id: string
}

export interface TacticBoard {
  players: TacticPlayer[]
  arrows: PhaseArrow[]
  annotations: PhaseAnnotation[]
}

export interface Tactic {
  id: string
  team_id: string // always team-scoped, unlike Drill.team_id — see migrations/012_tactic_table.sql
  name: string
  board: TacticBoard
  created_at: string
}
