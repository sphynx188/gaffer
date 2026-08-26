import { create } from 'zustand'
import { createTeamSlice, type TeamSlice } from './slices/teamSlice'
import { createPlayerSlice, type PlayerSlice } from './slices/playerSlice'
import { createPlayerNoteSlice, type PlayerNoteSlice } from './slices/playerNoteSlice'
import { createSessionSlice, type SessionSlice } from './slices/sessionSlice'
import { createDrillSlice, type DrillSlice } from './slices/drillSlice'
import { createSessionDrillSlice, type SessionDrillSlice } from './slices/sessionDrillSlice'
import { createSessionTacticSlice, type SessionTacticSlice } from './slices/sessionTacticSlice'
import { createAvailabilitySlice, type AvailabilitySlice } from './slices/availabilitySlice'
import { createTacticSlice, type TacticSlice } from './slices/tacticSlice'
import { createFormationSlice, type FormationSlice } from './slices/formationSlice'

// One store, combined from domain slices. Plan-side (team/player/session),
// Design-side (drill), and Tactics-side (tactic — Upgrade Phase 3) code all
// read from this same store — see gaffer_mvp_build_steps.md 0.4 step 3: two
// separate stores must never emerge, since that's the mistake the
// tech-stack discussion flagged.
export type StoreState = TeamSlice &
  PlayerSlice &
  PlayerNoteSlice &
  SessionSlice &
  DrillSlice &
  SessionDrillSlice &
  SessionTacticSlice &
  AvailabilitySlice &
  TacticSlice &
  FormationSlice

export const useStore = create<StoreState>()((...args) => ({
  ...createTeamSlice(...args),
  ...createPlayerSlice(...args),
  ...createPlayerNoteSlice(...args),
  ...createSessionSlice(...args),
  ...createDrillSlice(...args),
  ...createSessionDrillSlice(...args),
  ...createSessionTacticSlice(...args),
  ...createAvailabilitySlice(...args),
  ...createTacticSlice(...args),
  ...createFormationSlice(...args),
}))
