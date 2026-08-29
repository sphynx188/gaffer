// Domain types mirroring supabase/schema.sql — the schema is the source of
// truth (see gaffer_project_plan_final.md §5); this file just types it for
// the store and, later, every component that reads from it.

// Replaces the old 2-value PitchFormat ('11v11' | 'small_sided') — see
// supabase/migrations/011_drill_pitch_size_orientation.sql. The `pitch_size`
// half of that pair is gone (migration 014); real metre dimensions live in
// PitchConfig instead.
export type PitchOrientation = 'portrait' | 'landscape'
export type CoachRole = 'owner' | 'coach'
// One status per (session, player) row, serving double duty: a coach can
// set it as a pre-session RSVP guess or as the actual post-session
// roll-call outcome — 'unconfirmed' is the seeded default either way. See
// supabase/migrations/010_attendance_roll_call_status.sql.
export type AvailabilityStatus = 'unconfirmed' | 'present' | 'injured' | 'away'

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

// The normalized 0-1 pitch coordinate every piece of drill and tactic content
// is authored in, so the same content renders correctly on any pitch shape —
// see gaffer_project_plan_final.md §5. Named after the phases[] model it
// arrived with (dropped by migration 014); it now underpins Marking.points
// and EntityState.path.
export interface PhasePoint {
  x: number
  y: number
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

// Tactics vocabularies (TACTICS_BOARD_REWORK_PLAN.md Stage 1.1). Granular
// pitch roles, unlike Player.positions' five broad buckets
// (goalkeeper/defender/midfielder/winger/striker) — a formation needs to know
// a right-back from a left-back, which a roster tag deliberately doesn't.
// The two are independent: PlayerPosition describes a person, PlayerRole
// describes the slot they're filling on this particular board.
export type PlayerRole = 'GK' | 'RB' | 'CB' | 'LB' | 'CDM' | 'CM' | 'CAM' | 'LW' | 'RW' | 'ST'
export type MarkerStyle = 'circle' | 'square' | 'shield' | 'jersey'
export type StatusRing = 'none' | 'captain' | 'booked' | 'injured' | 'sub'

// The full equipment set (rework plan Stage 6.1). jsonb, so widening this
// never needed a schema migration.
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
  team?: string // 'A' | 'B' — drives color
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

  // Tactics-only, and deliberately on the SHARED entity rather than a forked
  // TacticEntity (rework plan Stage 1.1): one canvas, one interpolator, one
  // export path. Drills leave every one of them unset, and because scene is
  // jsonb none of them needed a migration.
  //
  // Note what is NOT here: a `side` field. A tactic puts 'home'/'away' in
  // `team` above, the same field a drill puts 'A'/'B' in, because the canvas
  // already colours by `team` — a parallel field would mean two things to
  // keep in step and two colour paths.
  player_id?: string // roster binding — which real Player this marker is
  role?: PlayerRole // the slot on the board, not the person's roster tag
  scale?: number // marker size multiplier; 1.0 when unset
  markerStyle?: MarkerStyle
  roleTag?: string | null // short text drawn on the marker, e.g. 'RB'
  highlight?: string | null
  statusRing?: StatusRing
  statusColor?: string | null
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
// The 13 drawable kinds (TACTICS_BOARD_REWORK_PLAN.md Stage 6.1 takes the set
// to parity with Teloframe's tool rail). Every kind stores its geometry in the
// same `points` array, which is what lets selection, the Transformer and
// deletion work on all of them without knowing which is which.
//
//   arrow line curve freehand   open strokes
//   arc                          a bowed connector between two points
//   circle rect                  bounding box, two opposite corners
//   zone shape                   closed polygons — zone shades, shape outlines
//   multi                        multi-segment arrow, head on the last leg
//   text                         a placed note
//   spotlight highlight          presentational, NOT geometry — see below
//
// `spotlight` and `highlight` are the odd two out: they are emphasis rather
// than diagram, so they composite ABOVE the entities rather than under them
// (Stage 6.4). Everything else renders beneath, where a marking belongs.
export interface Marking {
  id: string
  kind:
    | 'arrow'
    | 'line'
    | 'curve'
    | 'arc'
    | 'circle'
    | 'rect'
    | 'freehand'
    | 'zone'
    | 'shape'
    | 'multi'
    | 'text'
    | 'spotlight'
    | 'highlight'
  points: PhasePoint[]
  style?: { stroke?: string; dash?: boolean; fill?: string; width?: number }
  text?: string
  keyframeId?: string | null
}

// The two kinds that render above the entities instead of below them. Exported
// so the canvas and anything that partitions markings agree on the split.
export const OVERLAY_MARKING_KINDS = ['spotlight', 'highlight'] as const

export function isOverlayMarking(marking: Marking): boolean {
  return marking.kind === 'spotlight' || marking.kind === 'highlight'
}

export interface DrillScene {
  entities: SceneEntity[]
  markings: Marking[]
}

// Pitch overlays (rework plan Stage 7.4) — grid systems drawn over the pitch
// rather than markings of it.
export type OverlayKind = 'thirds' | 'channels' | 'lanes' | 'half_spaces' | 'pep_zones' | 'training_grid' | 'coaching_zones'

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
  // 0-1. The plan's interface has nowhere to put the value its overlay
  // opacity slider produces, so it lives here — jsonb, no migration.
  overlayOpacity?: number
  surface?: string
  units?: 'm' | 'yd'
}

// Drill metadata (rework plan Stage 8.1). The four short vocabularies below
// are unions rather than free text because Stage 9's library filters on them:
// "a 12-minute technical rondo for 8 players" only works if every technical
// drill spells `technical` the same way. `category`/`subcategory` are
// deliberately NOT unions — a coach's own naming for what a drill is about
// shouldn't be frozen into a type here.
export const DRILL_DIFFICULTIES = ['beginner', 'intermediate', 'advanced'] as const
export type DrillDifficulty = (typeof DRILL_DIFFICULTIES)[number]

export const DRILL_INTENSITIES = ['low', 'medium', 'high'] as const
export type DrillIntensity = (typeof DRILL_INTENSITIES)[number]

export const DRILL_PHASES_OF_PLAY = ['in_possession', 'out_of_possession', 'transition', 'set_piece'] as const
export type DrillPhaseOfPlay = (typeof DRILL_PHASES_OF_PLAY)[number]

// The five blocks a session is built from — the one metadata field this
// stage's definition of done names outright.
export const SESSION_BLOCKS = ['activation', 'technical', 'tactical', 'game', 'recovery'] as const
export type SessionBlock = (typeof SESSION_BLOCKS)[number]

export const DRILL_DIFFICULTY_LABELS: Record<DrillDifficulty, string> = {
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
}

export const DRILL_INTENSITY_LABELS: Record<DrillIntensity, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
}

export const DRILL_PHASE_OF_PLAY_LABELS: Record<DrillPhaseOfPlay, string> = {
  in_possession: 'In possession',
  out_of_possession: 'Out of possession',
  transition: 'Transition',
  set_piece: 'Set piece',
}

export const SESSION_BLOCK_LABELS: Record<SessionBlock, string> = {
  activation: 'Activation',
  technical: 'Technical',
  tactical: 'Tactical',
  game: 'Game',
  recovery: 'Recovery',
}

// The coaching lists, in one jsonb column rather than five more. Nothing
// filters or sorts on them — they're read as a set with the drill — and jsonb
// means the set can grow without a migration (CLAUDE.md's data-model note),
// which `equipment` below already takes advantage of.
export interface DrillCoaching {
  setup?: string
  points?: string[]
  progressions?: string[]
  regressions?: string[]
  mistakes?: string[]
  /**
   * Manual override of the equipment summary derived from `scene.entities`
   * (Stage 8.3). Absent means "use whatever is actually on the board", which
   * is right for every drill nobody has overridden.
   */
  equipment?: string
}

export interface Drill {
  id: string
  team_id: string | null // demoted (club tenancy, 2026-08-28): vestigial, no new code writes or reads it — kept for the shelved team module
  club_id: string
  created_by: string
  name: string
  scene: DrillScene
  keyframes: Keyframe[]
  duration_seconds: number
  pitch: PitchConfig
  orientation: PitchOrientation
  created_at: string

  // Metadata (rework plan Stage 8.1, migration 016). Null throughout means
  // "not recorded", which is a different thing from an empty string — the
  // eleven drills that predate the migration carry none of this, and neither
  // does a drill created and never opened in Details.
  objective: string | null
  description: string | null
  category: string | null
  subcategory: string | null
  duration_minutes: number | null
  players_recommended: number | null
  min_players: number | null
  max_players: number | null
  age_min: string | null
  age_max: string | null
  difficulty: DrillDifficulty | null
  intensity: DrillIntensity | null
  phase_of_play: DrillPhaseOfPlay | null
  session_block: SessionBlock | null
  setup_minutes: number | null
  learning_outcome: string | null
  video_url: string | null
  thumbnail_url: string | null
  coaching: DrillCoaching

  // Public share link (rework plan Stage 10.4, migration 018). Null until a
  // coach explicitly turns sharing on, and null again the moment they turn it
  // off — sharing is opt-in per drill and revocable, never a property a drill
  // has by default. 32 hex characters, 128 bits from `crypto.getRandomValues`.
  //
  // A non-null token is the ONLY thing that makes a drill readable by an
  // unauthenticated caller, and even then only to a reader who presents the
  // token itself — see the policy in migration 018.
  share_token: string | null
}

export interface SessionDrill {
  id: string
  session_id: string
  drill_id: string
  order_index: number
  planned_duration_minutes: number | null
  notes: string | null
}

// ---------------------------------------------------------------------------
// Tactics (TACTICS_BOARD_REWORK_PLAN.md Stage 1)
//
// A tactic is now the SAME entities+keyframes model a drill is — `scene` +
// `keyframes` + `pitch`, all the types above — so `frameAt`, PitchCanvas, the
// timeline and the export path work on a tactic unchanged. Only three things
// here are genuinely new: two sides with formations, phases over the keyframe
// track, and the roster binding (SceneEntity.player_id).
// ---------------------------------------------------------------------------

// A named, coloured band over the keyframe track — "Build-up", "Press",
// "Transition". Purely organisational: it groups keyframes for the coach and
// has NO effect on interpolation, which is why `frameAt` never needs to know
// phases exist. Not to be confused with the drill `phases[]` model migration
// 014 dropped; that was geometry, this is only a label over a time range.
export interface TacticPhase {
  id: string
  name: string
  startSeconds: number
  endSeconds: number
  color: string
}

export interface TacticSide {
  formation: string // key into FORMATIONS (Stage 3), e.g. '4-3-3'
  color: string
  teamId: string | null // null = placeholder opposition, not a real team
}

export interface Tactic {
  id: string
  // Nullable as of club tenancy (2026-08-28, migration 027): rosters are
  // shelved, so new/copied/licensed tactics are always created with
  // team_id null (formation-driven generic squads). Existing tactics keep
  // their dormant team_id value; the roster-binding UI gates on it.
  team_id: string | null
  club_id: string
  created_by: string
  name: string
  scene: DrillScene // the same shape drills use, entity for entity
  keyframes: Keyframe[]
  phases: TacticPhase[]
  duration_seconds: number
  // Orientation is live-switchable from the editor, not fixed at creation
  // (decided 2026-08-26) — and switching it must transpose the content too,
  // which is what canvas/transposeScene.ts is for.
  pitch: PitchConfig
  sides: { home: TacticSide; away: TacticSide }
  view: 'single' | 'dual'

  // Light metadata only (decided 2026-08-26). Enough to find a tactic and to
  // put it in a session; deliberately NOT drill's ~19 columns — a tactic is a
  // thinking tool a coach works through, not a 15-minute pitch activity with
  // equipment, intensity and an age band.
  description: string | null
  phase_of_play: DrillPhaseOfPlay | null // reuses the drill vocabulary
  thumbnail_url: string | null
  share_token: string | null
  created_at: string
}

// ---------------------------------------------------------------------------
// Club tenancy (migrations 027/028, spec docs/superpowers/specs/
// 2026-08-27-club-tenancy-design.md). A club owns a permanent library of
// drills/tactics; an admin curates named collections and grants them per
// coach; collections can be copied or licensed (read-only, revocable) to
// another club. See clubSlice.ts for the store API.
// ---------------------------------------------------------------------------

export type ClubRole = 'admin' | 'coach'

export interface Club {
  id: string
  name: string
  created_at: string
}

// A club_member row joined with its club — what fetchMemberships returns.
export interface ClubMembership {
  club_id: string
  user_id: string
  role: ClubRole
  display_name: string | null
  created_at: string
  club: Club
}

// The bare club_member row shape (no join) — what fetchClubData's member
// list uses for the currently selected club.
export interface ClubMemberRow {
  club_id: string
  user_id: string
  role: ClubRole
  display_name: string | null
  created_at: string
}

// Enforced, not a convention (migration 032): a collection is always
// exactly one kind, never both — collection_drill/collection_tactic's own
// RLS refuses filing the wrong content type into it. Immutable after
// creation; there is no rename-kind path, since that would mean silently
// orphaning whatever's already filed under the old kind.
export type CollectionKind = 'drill' | 'tactic'

export interface Collection {
  id: string
  club_id: string
  name: string
  description: string | null
  kind: CollectionKind
  created_by: string
  created_at: string
}

export interface ClubLicense {
  id: string
  collection_id: string
  target_club_id: string
  granted_by: string
  created_at: string
  revoked_at: string | null
}

// A shape a coach saved for themselves (Stage 3.4, migration 022). Per coach
// rather than per team — a shape is a way of thinking about the game, not a
// property of one squad. `slots` is the same FormationSlot[] the 29 built-ins
// use (see components/tactics/formations.ts), so a custom formation and a
// built-in are interchangeable everywhere downstream.
export interface CustomFormation {
  id: string
  owner_id: string
  name: string
  slots: { role: PlayerRole; x: number; y: number }[]
  created_at: string
}

// Mirrors SessionDrill exactly, so the session planner can hold both kinds of
// item in one list (Stage 9.4) rather than growing a parallel panel.
export interface SessionTactic {
  id: string
  session_id: string
  tactic_id: string
  order_index: number
  planned_duration_minutes: number | null
  notes: string | null
}
