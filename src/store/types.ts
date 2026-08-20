// Domain types mirroring supabase/schema.sql — the schema is the source of
// truth (see gaffer_project_plan_final.md §5); this file just types it for
// the store and, later, every component that reads from it.

export type PitchFormat = '11v11' | 'small_sided'
export type CoachRole = 'owner' | 'coach'
// One status per (session, player) row, serving double duty: a coach can
// set it as a pre-session RSVP guess or as the actual post-session
// roll-call outcome — 'unconfirmed' is the seeded default either way. See
// supabase/migrations/010_attendance_roll_call_status.sql.
export type AvailabilityStatus = 'unconfirmed' | 'present' | 'injured' | 'away'

export const PITCH_FORMAT_LABELS: Record<PitchFormat, string> = {
  '11v11': '11-a-side',
  small_sided: 'Small-sided',
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

export interface PhaseCone extends PhasePoint {
  id: string
  color?: string
}

export interface PhaseBall extends PhasePoint {
  id: string
}

export interface PhaseArrow {
  id: string
  from: PhasePoint
  to: PhasePoint
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
  pitch_format: PitchFormat
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
