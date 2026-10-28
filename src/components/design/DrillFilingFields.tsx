import { useEffect } from 'react'
import { useStore } from '../../store'
import { ChipPicker } from '../ui/ChipPicker'

// The two fields every drill is filed by (spec 2026-10-28): one required
// collection and any number of tags. Shared by the New drill form and the
// editor's Details drawer so they can't drift apart.
export function DrillFilingFields({
  collectionId,
  tagIds,
  onCollectionChange,
  onTagsChange,
}: {
  collectionId: string | null
  tagIds: string[]
  onCollectionChange: (id: string) => void
  onTagsChange: (ids: string[]) => void
}) {
  const selectedClubId = useStore((s) => s.selectedClubId)
  const options = useStore((s) => s.drillCollectionOptions)
  const tags = useStore((s) => s.clubTags)
  const fetchDrillCollectionOptions = useStore((s) => s.fetchDrillCollectionOptions)
  const fetchClubTags = useStore((s) => s.fetchClubTags)

  useEffect(() => {
    void fetchDrillCollectionOptions()
    void fetchClubTags()
  }, [fetchDrillCollectionOptions, fetchClubTags, selectedClubId])

  // Uncategorised is a holding pen for drills that predate this, never a
  // choice — a drill sitting there shows no chip picked.
  const collections = options.filter((o) => !o.is_uncategorised).map((o) => ({ id: o.id, label: o.name }))
  const inUncategorised = options.some((o) => o.is_uncategorised && o.id === collectionId)

  return (
    <div className="space-y-4">
      <fieldset className="space-y-2">
        <legend className="text-xs font-medium text-ink-muted">
          Collection <span className="text-bad">*</span>
        </legend>
        {inUncategorised && (
          <p className="text-xs text-warn">This drill is in Uncategorised — pick the collection it belongs to.</p>
        )}
        <ChipPicker
          options={collections}
          selected={collectionId ? [collectionId] : []}
          onToggle={(id) => onCollectionChange(id)}
          ariaLabel="Collection"
        />
      </fieldset>
      <fieldset className="space-y-2">
        <legend className="text-xs font-medium text-ink-muted">Tags</legend>
        <ChipPicker
          options={tags.map((t) => ({ id: t.id, label: t.name }))}
          selected={tagIds}
          onToggle={(id) => onTagsChange(tagIds.includes(id) ? tagIds.filter((t) => t !== id) : [...tagIds, id])}
          ariaLabel="Tags"
        />
      </fieldset>
    </div>
  )
}
