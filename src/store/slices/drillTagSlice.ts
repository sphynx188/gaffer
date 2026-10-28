import type { StateCreator } from 'zustand'
import { supabase } from '../../lib/supabase'
import { runSupabaseAction } from '../supabaseAction'
import type { ClubTag, DrillCollectionOption } from '../types'
import type { StoreState } from '../useStore'

// Club tags and the collection picker's options (migration 046, spec
// 2026-10-28). Both are scoped to selectedClubId and cleared on a club switch
// by clubSlice's clearClubScopedState.
export interface DrillTagSlice {
  clubTags: ClubTag[]
  // Every drill collection in the club — names only, including ones this
  // coach can't open, because a coach may file their own drill into any.
  drillCollectionOptions: DrillCollectionOption[]
  drillTagError: string | null

  fetchClubTags: () => Promise<void>
  fetchDrillCollectionOptions: () => Promise<void>
  createClubTag: (name: string) => Promise<ClubTag | null>
  renameClubTag: (id: string, name: string) => Promise<boolean>
  deleteClubTag: (id: string) => Promise<boolean>
}

const byName = (a: ClubTag, b: ClubTag) => a.name.localeCompare(b.name)

export const createDrillTagSlice: StateCreator<StoreState, [], [], DrillTagSlice> = (set, get) => ({
  clubTags: [],
  drillCollectionOptions: [],
  drillTagError: null,

  fetchClubTags: async () => {
    const clubId = get().selectedClubId
    if (!clubId) return
    const { data, error } = await runSupabaseAction<ClubTag[]>(
      () => supabase.from('club_tag').select('*').eq('club_id', clubId).order('name'),
      "Couldn't load tags, try again."
    )
    if (get().selectedClubId !== clubId) return
    set({ drillTagError: error, ...(data ? { clubTags: data } : {}) })
  },

  fetchDrillCollectionOptions: async () => {
    const clubId = get().selectedClubId
    if (!clubId) return
    const { data, error } = await runSupabaseAction<DrillCollectionOption[]>(
      () => supabase.rpc('club_drill_collections', { cid: clubId }),
      "Couldn't load collections, try again."
    )
    if (get().selectedClubId !== clubId) return
    set({ drillTagError: error, ...(data ? { drillCollectionOptions: data } : {}) })
  },

  createClubTag: async (name) => {
    const clubId = get().selectedClubId
    const trimmed = name.trim()
    if (!clubId || !trimmed) return null
    const { data, error } = await runSupabaseAction<ClubTag[]>(
      () => supabase.from('club_tag').insert({ club_id: clubId, name: trimmed }).select(),
      "Couldn't add the tag, try again."
    )
    const tag = data?.[0] ?? null
    set({ drillTagError: error, ...(tag ? { clubTags: [...get().clubTags, tag].sort(byName) } : {}) })
    return tag
  },

  renameClubTag: async (id, name) => {
    const trimmed = name.trim()
    if (!trimmed) return false
    const { data, error } = await runSupabaseAction<ClubTag[]>(
      () => supabase.from('club_tag').update({ name: trimmed }).eq('id', id).select(),
      "Couldn't rename the tag, try again."
    )
    const tag = data?.[0] ?? null
    set({
      drillTagError: error,
      ...(tag ? { clubTags: get().clubTags.map((t) => (t.id === id ? tag : t)).sort(byName) } : {}),
    })
    return Boolean(tag)
  },

  deleteClubTag: async (id) => {
    const { error } = await runSupabaseAction<null>(
      () => supabase.from('club_tag').delete().eq('id', id),
      "Couldn't delete the tag, try again."
    )
    if (error) {
      set({ drillTagError: error })
      return false
    }
    // drill_tag rows cascade in the database; mirror that locally.
    set({
      drillTagError: null,
      clubTags: get().clubTags.filter((t) => t.id !== id),
      drills: get().drills.map((d) =>
        d.tag_ids?.includes(id) ? { ...d, tag_ids: d.tag_ids.filter((t) => t !== id) } : d
      ),
    })
    return true
  },
})
