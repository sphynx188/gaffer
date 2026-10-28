import { useMemo } from 'react'
import { useStore } from '../store'

// Which drills are in which collection, derived from `drill.collection_id`
// (migration 046) — the replacement for fetching the old drill membership
// join table. Drafts are left out: they aren't library items until first saved.
export function useCollectionDrillIds(): Record<string, string[]> {
  const drills = useStore((s) => s.drills)
  const isDrillDraft = useStore((s) => s.isDrillDraft)
  return useMemo(() => {
    const map: Record<string, string[]> = {}
    for (const d of drills) {
      if (!d.collection_id || isDrillDraft(d.id)) continue
      ;(map[d.collection_id] ??= []).push(d.id)
    }
    return map
  }, [drills, isDrillDraft])
}
