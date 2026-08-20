import type { StateCreator } from 'zustand'
import { supabase } from '../../lib/supabase'
import { runSupabaseAction } from '../supabaseAction'
import type { Team } from '../types'
import type { StoreState } from '../useStore'

export interface NewTeamInput {
  name: string
}

export interface TeamUpdateInput {
  name?: string
}

// Phase 1.2 — Multi-team switching (US-4, gaffer_mvp_build_steps.md) persists
// the current selection to localStorage so it survives a reload, but every
// read is reconciled against the RLS-scoped `teams` list on the next
// fetchTeams — a stale id (another account's team on a shared machine, or a
// team that's since been removed) can never leak through as "selected".
const SELECTED_TEAM_STORAGE_KEY = 'gaffer:selectedTeamId'

function readStoredTeamId(): string | null {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage.getItem(SELECTED_TEAM_STORAGE_KEY)
  } catch {
    return null
  }
}

function writeStoredTeamId(id: string | null): void {
  if (typeof window === 'undefined') return
  try {
    if (id) window.localStorage.setItem(SELECTED_TEAM_STORAGE_KEY, id)
    else window.localStorage.removeItem(SELECTED_TEAM_STORAGE_KEY)
  } catch {
    // Private browsing / storage disabled — selection just won't persist.
  }
}

// Reset every other slice's team-scoped state the instant the selected team
// changes, rather than waiting for the new team's fetch to resolve. Without
// this, the old team's sessions/drills would stay on screen — stale but
// still rendered — for the brief window between selecting a new team and
// its fetch completing, which is exactly the "data bleeds together" failure
// mode US-4's Definition of Done rules out.
//
// Phase 2d: `sessions: []` is enough to also clear every attached
// session_drills row, now that they live nested inside `sessions[]` rather
// than the flat `sessionDrills` array this used to reset separately (that
// array — and its `sessionDrillsError` counterpart — no longer exist on
// StoreState; sessionDrillSlice's remaining state is all keyed by
// session/session_drill id, so a stale entry for a team no longer selected
// is inert, same as playerNoteSlice's and availabilitySlice's keyed state,
// neither of which this function clears either).
function clearTeamScopedState() {
  return {
    sessions: [],
    sessionsError: null,
    drills: [],
    drillsError: null,
  }
}

export interface TeamSlice {
  teams: Team[]
  teamsLoading: boolean
  teamsError: string | null
  // The team every other Phase 1/2 view (roster, planner, drill library,
  // the 0.5.1 spike) filters by. Never derive "current team" as teams[0]
  // anywhere else — this is the single source of truth for team scope.
  selectedTeamId: string | null

  fetchTeams: () => Promise<void>
  createTeam: (input: NewTeamInput) => Promise<Team | null>
  updateTeam: (id: string, patch: TeamUpdateInput) => Promise<Team | null>
  selectTeam: (id: string) => void
  // Deletes the team row itself. `on delete cascade` on every FK back to
  // `team` (players, sessions, drills scoped to it, etc. — see
  // supabase/schema.sql) means Postgres removes everything under it in the
  // same statement; RLS only allows this for the team's owner
  // (team_delete_owner policy, supabase/rls_policies.sql), so a plain member
  // coach never sees a delete option succeed here.
  deleteTeam: (id: string) => Promise<boolean>
}

export const createTeamSlice: StateCreator<StoreState, [], [], TeamSlice> = (set, get) => ({
  teams: [],
  teamsLoading: false,
  teamsError: null,
  selectedTeamId: readStoredTeamId(),

  fetchTeams: async () => {
    set({ teamsLoading: true, teamsError: null })
    const { data, error } = await runSupabaseAction<Team[]>(
      () => supabase.from('team').select('*').order('created_at', { ascending: true }),
      "Couldn't load teams, try again."
    )
    set((state) => {
      const teams = data ?? state.teams
      // Keep the current selection if it's still one of this coach's teams;
      // otherwise fall back to the first team so the app is never left
      // pointed at a team that no longer resolves to real data.
      const stillValid = Boolean(
        state.selectedTeamId && teams.some((t) => t.id === state.selectedTeamId)
      )
      const selectedTeamId = stillValid ? state.selectedTeamId : (teams[0]?.id ?? null)
      const changed = selectedTeamId !== state.selectedTeamId
      if (changed) writeStoredTeamId(selectedTeamId)
      return {
        teamsLoading: false,
        teamsError: error,
        ...(data ? { teams: data } : {}),
        selectedTeamId,
        ...(changed ? clearTeamScopedState() : {}),
      }
    })
  },

  createTeam: async (input) => {
    set({ teamsLoading: true, teamsError: null })
    // RLS's insert check is `owner_id = auth.uid()` (schema.sql has no
    // default for owner_id, and there's no team_coaches row yet at insert
    // time for a membership-based check to key off) — so owner_id has to be
    // set here explicitly, not left for the caller to pass in.
    const { data: userData, error: userError } = await supabase.auth.getUser()
    if (userError || !userData.user) {
      set({ teamsLoading: false, teamsError: "Couldn't create team, try again." })
      return null
    }
    const { data, error } = await runSupabaseAction<Team[]>(
      () => supabase.from('team').insert({ ...input, owner_id: userData.user.id }).select(),
      "Couldn't create team, try again."
    )
    const team = data?.[0] ?? null
    set((state) => {
      // First team created gets auto-selected so a brand-new coach doesn't
      // land on an empty "no team selected" state; a team created while
      // another is already selected doesn't steal focus.
      const selectedTeamId = state.selectedTeamId ?? team?.id ?? null
      if (team && selectedTeamId !== state.selectedTeamId) writeStoredTeamId(selectedTeamId)
      return {
        teamsLoading: false,
        teamsError: error,
        ...(team ? { teams: [...state.teams, team] } : {}),
        selectedTeamId,
      }
    })
    return team
  },

  selectTeam: (id) => {
    writeStoredTeamId(id)
    set((state) => ({
      selectedTeamId: id,
      ...(id !== state.selectedTeamId ? clearTeamScopedState() : {}),
    }))
  },

  updateTeam: async (id, patch) => {
    set({ teamsLoading: true, teamsError: null })
    const { data, error } = await runSupabaseAction<Team[]>(
      () => supabase.from('team').update(patch).eq('id', id).select(),
      "Couldn't save team, try again."
    )
    const team = data?.[0] ?? null
    set({
      teamsLoading: false,
      teamsError: error,
      ...(team ? { teams: get().teams.map((t) => (t.id === id ? team : t)) } : {}),
    })
    return team
  },

  deleteTeam: async (id) => {
    set({ teamsLoading: true, teamsError: null })
    const { error } = await runSupabaseAction<null>(
      () => supabase.from('team').delete().eq('id', id),
      "Couldn't delete team, try again."
    )
    if (error) {
      set({ teamsLoading: false, teamsError: error })
      return false
    }
    set((state) => {
      const teams = state.teams.filter((t) => t.id !== id)
      const wasSelected = state.selectedTeamId === id
      // Same fallback as fetchTeams: never leave selectedTeamId pointing at
      // a team that no longer exists — fall back to whatever's first, or
      // null if that was the last team.
      const selectedTeamId = wasSelected ? (teams[0]?.id ?? null) : state.selectedTeamId
      if (wasSelected) writeStoredTeamId(selectedTeamId)
      return {
        teamsLoading: false,
        teamsError: null,
        teams,
        selectedTeamId,
        ...(wasSelected ? clearTeamScopedState() : {}),
      }
    })
    return true
  },
})
