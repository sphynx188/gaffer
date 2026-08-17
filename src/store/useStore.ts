import { create } from 'zustand'
import { createTeamSlice, type TeamSlice } from './slices/teamSlice'
import { createSessionSlice, type SessionSlice } from './slices/sessionSlice'
import { createDrillSlice, type DrillSlice } from './slices/drillSlice'

// One store, combined from domain slices. Plan-side (team/session) and
// Design-side (drill) code both read from this same store — see
// gaffer_mvp_build_steps.md 0.4 step 3: two separate stores must never
// emerge, since that's the mistake the tech-stack discussion flagged.
export type StoreState = TeamSlice & SessionSlice & DrillSlice

export const useStore = create<StoreState>()((...args) => ({
  ...createTeamSlice(...args),
  ...createSessionSlice(...args),
  ...createDrillSlice(...args),
}))
