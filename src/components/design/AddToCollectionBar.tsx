import { useState } from 'react'
import { X } from 'lucide-react'
import type { Collection } from '../../store'
import { Dropdown } from '../ui/Dropdown'

// The bulk-file action bar for Library multi-select (2026-08-28) — shared by
// DrillLibrary and TacticsPage rather than duplicated, since the two only
// differ in which store action ends up called per id (addDrillToCollection
// vs addTacticToCollection) and the doc-count noun, both handled by the
// caller. Same two-step shape TransferPage/LicensesPage already use (pick
// from a Dropdown, then a separate confirm button) rather than "selecting
// fires the action immediately" — picking a collection here is one of two
// mutually exclusive inputs (existing vs. new-name), so an immediate-fire
// dropdown would need its own micro-confirm anyway.
export function AddToCollectionBar({
  count,
  docNoun,
  collections,
  onAddExisting,
  onCreateAndAdd,
  onCancel,
}: {
  count: number
  docNoun: string // singular, e.g. 'drill' / 'tactic'
  collections: Collection[]
  onAddExisting: (collectionId: string) => Promise<void>
  onCreateAndAdd: (name: string) => Promise<void>
  onCancel: () => void
}) {
  const [collectionId, setCollectionId] = useState('')
  const [newName, setNewName] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const canSubmit = (collectionId !== '' || newName.trim() !== '') && !submitting

  const handleAdd = async () => {
    if (!canSubmit) return
    setSubmitting(true)
    if (newName.trim()) {
      await onCreateAndAdd(newName.trim())
    } else {
      await onAddExisting(collectionId)
    }
    setSubmitting(false)
    setCollectionId('')
    setNewName('')
  }

  return (
    <div className="flex flex-wrap items-end gap-2 rounded-lg border border-accent/30 bg-accent/5 p-3">
      <p className="pb-2 text-sm font-medium text-ink">
        {count} {docNoun}
        {count === 1 ? '' : 's'} selected
      </p>
      <div className="min-w-44">
        <label className="block text-xs font-medium text-ink-muted">Add to collection</label>
        <div className="mt-1">
          <Dropdown
            value={collectionId}
            onChange={(v) => {
              setCollectionId(v)
              setNewName('')
            }}
            options={collections.map((c) => ({ value: c.id, label: c.name }))}
            placeholder="Choose a collection"
            emptyMessage="No collections yet"
            ariaLabel="Collection"
            triggerClassName="h-9 w-full"
          />
        </div>
      </div>
      <span className="pb-2 text-xs text-ink-faint">or</span>
      <div className="min-w-44">
        <label className="block text-xs font-medium text-ink-muted">New collection name</label>
        <input
          value={newName}
          onChange={(e) => {
            setNewName(e.target.value)
            setCollectionId('')
          }}
          placeholder="e.g. 3v2s"
          className="mt-1 h-9 w-full rounded-md border border-line bg-panel-raised px-2 text-sm text-ink outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/30"
        />
      </div>
      <button
        type="button"
        onClick={handleAdd}
        disabled={!canSubmit}
        className="h-9 rounded-md bg-accent px-3 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50"
      >
        {submitting ? 'Adding…' : 'Add'}
      </button>
      <button
        type="button"
        onClick={onCancel}
        aria-label="Cancel selection"
        title="Cancel"
        className="flex h-9 items-center gap-1 px-2 text-sm text-ink-muted hover:text-ink"
      >
        <X className="h-3.5 w-3.5" />
        Cancel
      </button>
    </div>
  )
}
