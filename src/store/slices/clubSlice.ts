import type { StateCreator } from 'zustand'
import { supabase } from '../../lib/supabase'
import { runSupabaseAction } from '../supabaseAction'
import type { Club, ClubLicense, ClubMemberRow, ClubMembership, ClubRole, Collection } from '../types'
import type { StoreState } from '../useStore'

export interface NewCoachInput {
  email: string
  password: string
  displayName: string
}

export interface CollectionUpdateInput {
  name?: string
  description?: string | null
}

// This repo has no generated DB types (src/store/types.ts is hand-written),
// so supabase-js can't infer embed cardinality from the club_member -> club
// foreign key and types a to-one embed as an array regardless. PostgREST's
// actual runtime response is a single object — these two row shapes exist
// only to type that honestly at the query boundary; the cast right after
// each query is the one place the mismatch is bridged.
interface ClubMemberJoinRow {
  club_id: string
  user_id: string
  role: ClubRole
  display_name: string | null
  created_at: string
  club: Club[]
}

// Club tenancy (migrations 027/028, spec docs/superpowers/specs/
// 2026-08-27-club-tenancy-design.md). Mirrors teamSlice.ts's exact idioms —
// every Supabase call through runSupabaseAction, one shared error field per
// concern area, selectedClubId persisted to localStorage and reconciled
// against the RLS-scoped membership list on every fetch.
const SELECTED_CLUB_STORAGE_KEY = 'gaffer-selected-club'

function readStoredClubId(): string | null {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage.getItem(SELECTED_CLUB_STORAGE_KEY)
  } catch {
    return null
  }
}

function writeStoredClubId(id: string | null): void {
  if (typeof window === 'undefined') return
  try {
    if (id) window.localStorage.setItem(SELECTED_CLUB_STORAGE_KEY, id)
    else window.localStorage.removeItem(SELECTED_CLUB_STORAGE_KEY)
  } catch {
    // Private browsing / storage disabled — selection just won't persist.
  }
}

// Reset every club-scoped array the instant the selected club changes,
// mirroring teamSlice's clearTeamScopedState — without this, the old
// club's admin-console data would stay on screen (stale but still
// rendered) for the window between selecting a new club and its fetch
// completing. drills/tactics are cleared too (plan Task 4 Step 1): their
// fetch is RLS-only with no club_id filter (Task 5/6 — the licensed-group
// visibility model needs that), so clearing here is what avoids a stale
// flash; DrillLibrary/TacticsPage's own effects (Task 5/6) re-trigger the
// refetch by depending on selectedClubId.
function clearClubScopedState() {
  return {
    clubMembers: [],
    collections: [],
    collectionDrillIds: {},
    collectionTacticIds: {},
    collectionAccess: {},
    licensesOut: [],
    licensesIn: [],
    drills: [],
    drillsError: null,
    tactics: [],
    tacticsError: null,
  }
}

export interface ClubSlice {
  memberships: ClubMembership[]
  membershipsLoading: boolean
  membershipsError: string | null
  selectedClubId: string | null

  clubMembers: ClubMemberRow[]
  collections: Collection[]
  // Both maps: collectionId -> the ids filed in it. Populated from every
  // collection_drill/collection_tactic row RLS lets the caller read — spans
  // every club they administer or are granted into, same as `collections`.
  collectionDrillIds: Record<string, string[]>
  collectionTacticIds: Record<string, string[]>
  collectionAccess: Record<string, string[]> // collectionId -> userIds
  licensesOut: ClubLicense[] // granted BY selectedClubId
  licensesIn: ClubLicense[] // granted TO selectedClubId
  // Names for clubs referenced by licensesOut/licensesIn that aren't
  // necessarily one of `memberships` (a license's other party needn't be a
  // club the caller belongs to) — club_member_read's RLS grants read access
  // to exactly the clubs a license relationship connects the caller to, so
  // this is populated from a real query, not assumed from `memberships`.
  licenseClubNames: Record<string, string>
  clubDataLoading: boolean
  clubDataError: string | null
  clubActionError: string | null

  fetchMemberships: () => Promise<void>
  selectClub: (clubId: string) => void
  createClub: (name: string) => Promise<boolean>
  fetchClubData: () => Promise<void>
  createCollection: (name: string, description: string | null) => Promise<Collection | null>
  updateCollection: (id: string, patch: CollectionUpdateInput) => Promise<boolean>
  deleteCollection: (id: string) => Promise<boolean>
  addDrillToCollection: (collectionId: string, drillId: string) => Promise<boolean>
  removeDrillFromCollection: (collectionId: string, drillId: string) => Promise<boolean>
  addTacticToCollection: (collectionId: string, tacticId: string) => Promise<boolean>
  removeTacticFromCollection: (collectionId: string, tacticId: string) => Promise<boolean>
  grantCollectionAccess: (collectionId: string, userId: string) => Promise<boolean>
  revokeCollectionAccess: (collectionId: string, userId: string) => Promise<boolean>
  createCoach: (input: NewCoachInput) => Promise<string | null>
  grantLicense: (collectionId: string, targetClubId: string) => Promise<boolean>
  revokeLicense: (licenseId: string) => Promise<boolean>
  copyCollectionToClub: (collectionId: string, targetClubId: string) => Promise<boolean>
}

// Derived helpers, not store fields — kept beside the slice they read
// rather than duplicated per caller.
export const selectMyRole = (s: StoreState): ClubRole | null =>
  s.memberships.find((m) => m.club_id === s.selectedClubId)?.role ?? null

export const canEditDoc = (
  s: StoreState,
  doc: { club_id: string; created_by: string },
  userId: string | null
): boolean => (selectMyRole(s) === 'admin' && doc.club_id === s.selectedClubId) || doc.created_by === userId

export const createClubSlice: StateCreator<StoreState, [], [], ClubSlice> = (set, get) => ({
  memberships: [],
  membershipsLoading: false,
  membershipsError: null,
  selectedClubId: readStoredClubId(),

  clubMembers: [],
  collections: [],
  collectionDrillIds: {},
  collectionTacticIds: {},
  collectionAccess: {},
  licensesOut: [],
  licensesIn: [],
  licenseClubNames: {},
  clubDataLoading: false,
  clubDataError: null,
  clubActionError: null,

  fetchMemberships: async () => {
    set({ membershipsLoading: true, membershipsError: null })
    const { data: userData, error: userError } = await supabase.auth.getUser()
    if (userError || !userData.user) {
      set({ membershipsLoading: false, membershipsError: "Couldn't load your clubs, try again." })
      return
    }
    // Own rows only — club_member_rows_read's RLS is deliberately broader
    // (any member of a club can see every member row for it, for the
    // Coaches roster), so this needs an explicit user_id filter rather than
    // relying on RLS to scope it to "my memberships" the way fetchClubData
    // relies on RLS for collection visibility.
    const { data: rows, error } = await runSupabaseAction<ClubMemberJoinRow[]>(
      () =>
        supabase
          .from('club_member')
          .select('club_id, user_id, role, display_name, created_at, club:club_id (id, name, created_at)')
          .eq('user_id', userData.user.id)
          .order('created_at'),
      "Couldn't load your clubs, try again."
    )
    const data = rows ? (rows as unknown as ClubMembership[]) : null
    set((state) => {
      const memberships = data ?? state.memberships
      const stillValid = Boolean(state.selectedClubId && memberships.some((m) => m.club_id === state.selectedClubId))
      const selectedClubId = stillValid ? state.selectedClubId : (memberships[0]?.club_id ?? null)
      const changed = selectedClubId !== state.selectedClubId
      if (changed) writeStoredClubId(selectedClubId)
      return {
        membershipsLoading: false,
        membershipsError: error,
        ...(data ? { memberships: data } : {}),
        selectedClubId,
        ...(changed ? clearClubScopedState() : {}),
      }
    })
  },

  selectClub: (id) => {
    writeStoredClubId(id)
    set((state) => ({
      selectedClubId: id,
      ...(id !== state.selectedClubId ? clearClubScopedState() : {}),
    }))
  },

  createClub: async (name) => {
    set({ membershipsError: null })
    const { data: id, error } = await runSupabaseAction<string>(
      () => supabase.rpc('create_club', { club_name: name }),
      "Couldn't create club, try again."
    )
    if (!id) {
      set({ membershipsError: error })
      return false
    }
    await get().fetchMemberships()
    get().selectClub(id)
    return true
  },

  // Loads, for selectedClubId: club_member rows (filtered — "this club's
  // roster"); collection/collection_drill/collection_tactic/
  // collection_access rows (unfiltered — RLS alone decides visibility, home
  // + licensed-in, matching Task 5/6's LibraryGroup model, which tells
  // "home" from "licensed" by comparing collection.club_id to
  // selectedClubId rather than by a query-time filter); licensesOut/In
  // (explicitly split by source vs. target club).
  fetchClubData: async () => {
    const clubId = get().selectedClubId
    if (!clubId) return
    set({ clubDataLoading: true, clubDataError: null })

    // Collection ids this club owns, first — licensesOut below scopes off
    // it rather than embedding collection:club_id in the club_license
    // query (same generated-types gap as ClubMemberJoinRow above; a plain
    // `.in(...)` sidesteps it entirely instead of casting a second shape).
    const ownCollectionIdsRes = await runSupabaseAction<{ id: string }[]>(
      () => supabase.from('collection').select('id').eq('club_id', clubId),
      "Couldn't load collections, try again."
    )
    const ownCollectionIds = ownCollectionIdsRes.data?.map((c) => c.id) ?? []

    const [membersRes, collectionsRes, collectionDrillRes, collectionTacticRes, accessRes, outRes, inRes] =
      await Promise.all([
        runSupabaseAction<ClubMemberRow[]>(
          () =>
            supabase
              .from('club_member')
              .select('club_id, user_id, role, display_name, created_at')
              .eq('club_id', clubId)
              .order('created_at'),
          "Couldn't load club members, try again."
        ),
        runSupabaseAction<Collection[]>(
          () => supabase.from('collection').select('*').order('created_at'),
          "Couldn't load collections, try again."
        ),
        runSupabaseAction<{ collection_id: string; drill_id: string }[]>(
          () => supabase.from('collection_drill').select('collection_id, drill_id'),
          "Couldn't load collection contents, try again."
        ),
        runSupabaseAction<{ collection_id: string; tactic_id: string }[]>(
          () => supabase.from('collection_tactic').select('collection_id, tactic_id'),
          "Couldn't load collection contents, try again."
        ),
        runSupabaseAction<{ collection_id: string; user_id: string }[]>(
          () => supabase.from('collection_access').select('collection_id, user_id'),
          "Couldn't load collection access, try again."
        ),
        runSupabaseAction<ClubLicense[]>(
          () =>
            supabase
              .from('club_license')
              .select('id, collection_id, target_club_id, granted_by, created_at, revoked_at')
              .in('collection_id', ownCollectionIds.length > 0 ? ownCollectionIds : ['00000000-0000-0000-0000-000000000000'])
              .order('created_at', { ascending: false }),
          "Couldn't load outgoing licenses, try again."
        ),
        runSupabaseAction<ClubLicense[]>(
          () =>
            supabase
              .from('club_license')
              .select('id, collection_id, target_club_id, granted_by, created_at, revoked_at')
              .eq('target_club_id', clubId)
              .order('created_at', { ascending: false }),
          "Couldn't load incoming licenses, try again."
        ),
      ])

    const firstError =
      membersRes.error ||
      collectionsRes.error ||
      collectionDrillRes.error ||
      collectionTacticRes.error ||
      accessRes.error ||
      outRes.error ||
      inRes.error

    const collectionDrillIds: Record<string, string[]> = {}
    for (const row of collectionDrillRes.data ?? []) {
      ;(collectionDrillIds[row.collection_id] ??= []).push(row.drill_id)
    }
    const collectionTacticIds: Record<string, string[]> = {}
    for (const row of collectionTacticRes.data ?? []) {
      ;(collectionTacticIds[row.collection_id] ??= []).push(row.tactic_id)
    }
    const collectionAccess: Record<string, string[]> = {}
    for (const row of accessRes.data ?? []) {
      ;(collectionAccess[row.collection_id] ??= []).push(row.user_id)
    }

    // Club names for Task 11's Licenses page: outgoing licenses need the
    // TARGET club's name, incoming need the SOURCE club's (derived from the
    // licensed collection's club_id, found in `collections` — RLS already
    // returns a licensed-in collection to the receiving admin, so no extra
    // lookup for that half). Neither is guaranteed to be one of
    // `memberships` in general (a license's other party needn't be a club
    // the caller belongs to), so this is a real query, scoped by
    // club_member_read's own license-aware branch — it returns exactly the
    // clubs a license relationship connects the caller to.
    const collectionClubId = new Map((collectionsRes.data ?? []).map((c) => [c.id, c.club_id]))
    const neededClubIds = new Set<string>()
    for (const l of outRes.data ?? []) neededClubIds.add(l.target_club_id)
    for (const l of inRes.data ?? []) {
      const sourceClubId = collectionClubId.get(l.collection_id)
      if (sourceClubId) neededClubIds.add(sourceClubId)
    }
    const clubNamesRes =
      neededClubIds.size > 0
        ? await runSupabaseAction<{ id: string; name: string }[]>(
            () => supabase.from('club').select('id, name').in('id', [...neededClubIds]),
            "Couldn't load license club names, try again."
          )
        : { data: [] as { id: string; name: string }[], error: null }
    const licenseClubNames: Record<string, string> = {}
    for (const row of clubNamesRes.data ?? []) licenseClubNames[row.id] = row.name

    set({
      clubDataLoading: false,
      clubDataError: firstError,
      ...(membersRes.data ? { clubMembers: membersRes.data } : {}),
      ...(collectionsRes.data ? { collections: collectionsRes.data } : {}),
      collectionDrillIds,
      collectionTacticIds,
      collectionAccess,
      ...(outRes.data ? { licensesOut: outRes.data } : {}),
      ...(inRes.data ? { licensesIn: inRes.data } : {}),
      licenseClubNames,
    })
  },

  createCollection: async (name, description) => {
    const clubId = get().selectedClubId
    if (!clubId) return null
    set({ clubDataLoading: true, clubDataError: null })
    const { data, error } = await runSupabaseAction<Collection[]>(
      () => supabase.from('collection').insert({ club_id: clubId, name, description }).select(),
      "Couldn't create collection, try again."
    )
    const collection = data?.[0] ?? null
    set((state) => ({
      clubDataLoading: false,
      clubDataError: error,
      ...(collection ? { collections: [...state.collections, collection] } : {}),
    }))
    return collection
  },

  updateCollection: async (id, patch) => {
    set({ clubDataLoading: true, clubDataError: null })
    const { data, error } = await runSupabaseAction<Collection[]>(
      () => supabase.from('collection').update(patch).eq('id', id).select(),
      "Couldn't save collection, try again."
    )
    const collection = data?.[0] ?? null
    set((state) => ({
      clubDataLoading: false,
      clubDataError: error,
      ...(collection ? { collections: state.collections.map((c) => (c.id === id ? collection : c)) } : {}),
    }))
    return Boolean(collection)
  },

  deleteCollection: async (id) => {
    set({ clubDataLoading: true, clubDataError: null })
    const { error } = await runSupabaseAction<null>(
      () => supabase.from('collection').delete().eq('id', id),
      "Couldn't delete collection, try again."
    )
    if (error) {
      set({ clubDataLoading: false, clubDataError: error })
      return false
    }
    set((state) => {
      const { [id]: _drillIds, ...restDrillIds } = state.collectionDrillIds
      const { [id]: _tacticIds, ...restTacticIds } = state.collectionTacticIds
      const { [id]: _access, ...restAccess } = state.collectionAccess
      return {
        clubDataLoading: false,
        clubDataError: null,
        collections: state.collections.filter((c) => c.id !== id),
        collectionDrillIds: restDrillIds,
        collectionTacticIds: restTacticIds,
        collectionAccess: restAccess,
      }
    })
    return true
  },

  addDrillToCollection: async (collectionId, drillId) => {
    const { error } = await runSupabaseAction<null>(
      () => supabase.from('collection_drill').insert({ collection_id: collectionId, drill_id: drillId }),
      "Couldn't add drill to collection, try again."
    )
    if (error) {
      set({ clubDataError: error })
      return false
    }
    set((state) => ({
      collectionDrillIds: {
        ...state.collectionDrillIds,
        [collectionId]: [...(state.collectionDrillIds[collectionId] ?? []), drillId],
      },
    }))
    return true
  },

  removeDrillFromCollection: async (collectionId, drillId) => {
    const { error } = await runSupabaseAction<null>(
      () => supabase.from('collection_drill').delete().eq('collection_id', collectionId).eq('drill_id', drillId),
      "Couldn't remove drill from collection, try again."
    )
    if (error) {
      set({ clubDataError: error })
      return false
    }
    set((state) => ({
      collectionDrillIds: {
        ...state.collectionDrillIds,
        [collectionId]: (state.collectionDrillIds[collectionId] ?? []).filter((id) => id !== drillId),
      },
    }))
    return true
  },

  addTacticToCollection: async (collectionId, tacticId) => {
    const { error } = await runSupabaseAction<null>(
      () => supabase.from('collection_tactic').insert({ collection_id: collectionId, tactic_id: tacticId }),
      "Couldn't add tactic to collection, try again."
    )
    if (error) {
      set({ clubDataError: error })
      return false
    }
    set((state) => ({
      collectionTacticIds: {
        ...state.collectionTacticIds,
        [collectionId]: [...(state.collectionTacticIds[collectionId] ?? []), tacticId],
      },
    }))
    return true
  },

  removeTacticFromCollection: async (collectionId, tacticId) => {
    const { error } = await runSupabaseAction<null>(
      () => supabase.from('collection_tactic').delete().eq('collection_id', collectionId).eq('tactic_id', tacticId),
      "Couldn't remove tactic from collection, try again."
    )
    if (error) {
      set({ clubDataError: error })
      return false
    }
    set((state) => ({
      collectionTacticIds: {
        ...state.collectionTacticIds,
        [collectionId]: (state.collectionTacticIds[collectionId] ?? []).filter((id) => id !== tacticId),
      },
    }))
    return true
  },

  grantCollectionAccess: async (collectionId, userId) => {
    const { error } = await runSupabaseAction<null>(
      () => supabase.from('collection_access').insert({ collection_id: collectionId, user_id: userId }),
      "Couldn't grant access, try again."
    )
    if (error) {
      set({ clubDataError: error })
      return false
    }
    set((state) => ({
      collectionAccess: {
        ...state.collectionAccess,
        [collectionId]: [...(state.collectionAccess[collectionId] ?? []), userId],
      },
    }))
    return true
  },

  revokeCollectionAccess: async (collectionId, userId) => {
    const { error } = await runSupabaseAction<null>(
      () => supabase.from('collection_access').delete().eq('collection_id', collectionId).eq('user_id', userId),
      "Couldn't revoke access, try again."
    )
    if (error) {
      set({ clubDataError: error })
      return false
    }
    set((state) => ({
      collectionAccess: {
        ...state.collectionAccess,
        [collectionId]: (state.collectionAccess[collectionId] ?? []).filter((id) => id !== userId),
      },
    }))
    return true
  },

  // functions.invoke is not Postgrest — direct call, error handled here
  // rather than through runSupabaseAction (which expects a PostgrestError).
  createCoach: async ({ email, password, displayName }) => {
    const clubId = get().selectedClubId
    if (!clubId) return null
    set({ clubActionError: null })
    const { data, error } = await supabase.functions.invoke('create-coach', {
      body: { club_id: clubId, email, password, display_name: displayName },
    })
    if (error || data?.error) {
      set({ clubActionError: error?.message ?? data?.error ?? "Couldn't create coach, try again." })
      return null
    }
    await get().fetchClubData()
    return data.user_id as string
  },

  grantLicense: async (collectionId, targetClubId) => {
    set({ clubDataError: null })
    const { error } = await runSupabaseAction<null>(
      () => supabase.from('club_license').insert({ collection_id: collectionId, target_club_id: targetClubId }),
      "Couldn't grant license, try again."
    )
    if (error) {
      set({ clubDataError: error })
      return false
    }
    await get().fetchClubData()
    return true
  },

  revokeLicense: async (licenseId) => {
    set({ clubDataError: null })
    const { error } = await runSupabaseAction<null>(
      () => supabase.from('club_license').update({ revoked_at: new Date().toISOString() }).eq('id', licenseId),
      "Couldn't revoke license, try again."
    )
    if (error) {
      set({ clubDataError: error })
      return false
    }
    await get().fetchClubData()
    return true
  },

  // The RPC lands in migration 029 (Task 10) — this action is wired now per
  // the plan's slice API, unreachable from any UI until Task 10/11 add the
  // Transfer/Licenses pages that call it.
  copyCollectionToClub: async (collectionId, targetClubId) => {
    set({ clubDataLoading: true, clubDataError: null })
    const { error } = await runSupabaseAction<string>(
      () => supabase.rpc('copy_collection_to_club', { src_collection: collectionId, target_club: targetClubId }),
      "Couldn't copy collection, try again."
    )
    set({ clubDataLoading: false, clubDataError: error })
    return !error
  },
})
