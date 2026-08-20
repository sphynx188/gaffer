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

export interface Drill {
  id: string
  team_id: string | null // null = coach-owned, reusable across every team
  name: string
  pitch_size: PitchSize
  orientation: PitchOrientation
  phases: DrillPhase[]
  created_at: string
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
