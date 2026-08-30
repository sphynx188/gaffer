import { useState } from 'react'
import { Check, Folder, FolderPlus } from 'lucide-react'
import type { Collection } from '../../store'
import { Modal } from '../ui/Modal'

// "Add to collection", as a picker dialog rather than the old inline bar's
// dropdown-plus-text-field pair (2026-08-28). Two inputs that were mutually
// exclusive — choose an existing collection OR type a new name, each
// clearing the other — are now one list you pick from, with "New
// collection…" as the first row of that list.
//
// The verb is "add", never "move". A drill can sit in any number of
// collections at once (collection_drill is a join table, not a parent
// pointer), so a folder here is really a label wearing a folder's clothes.
// Calling it "move" would promise that the drill leaves wherever it was —
// including, in a coach's head, the sessions built on it.
export function AddToCollectionDialog({
  open,
  onClose,
  collections,
  collectionDocIds,
  count,
  noun,
  onAdd,
  onCreateAndAdd,
}: {
  open: boolean
  onClose: () => void
  collections: Collection[]
  collectionDocIds: Record<string, string[]>
  count: number
  noun: string
  onAdd: (collectionId: string) => Promise<void>
  onCreateAndAdd: (name: string) => Promise<void>
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // No reset-on-open effect: the callers mount this only while it's open,
  // so a collection picked and then cancelled dies with the unmount rather
  // than being pre-armed the next time.
  const canSubmit = !submitting && (creating ? newName.trim() !== '' : selectedId !== null)

  const handleSubmit = async () => {
    if (!canSubmit) return
    setSubmitting(true)
    if (creating) await onCreateAndAdd(newName.trim())
    else if (selectedId) await onAdd(selectedId)
    setSubmitting(false)
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add to collection"
      description={`${count} ${noun}${count === 1 ? '' : 's'} selected`}
      footer={
        <>
          <button type="button" onClick={onClose} className="px-2 py-1.5 text-sm text-ink-muted hover:text-ink">
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:opacity-50"
          >
            {submitting ? 'Adding…' : `Add ${count} ${noun}${count === 1 ? '' : 's'}`}
          </button>
        </>
      }
    >
      <ul className="space-y-0.5">
        <li>
          {creating ? (
            <div className="flex items-center gap-2 rounded-md border border-accent/40 bg-accent/5 px-2 py-1.5">
              <FolderPlus className="h-4 w-4 shrink-0 text-accent-ink" />
              <input
                autoFocus
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void handleSubmit()
                }}
                placeholder="Collection name"
                aria-label="New collection name"
                className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-ink-faint"
              />
              <button
                type="button"
                onClick={() => {
                  setCreating(false)
                  setNewName('')
                }}
                className="shrink-0 text-xs text-ink-muted hover:text-ink"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                setCreating(true)
                setSelectedId(null)
              }}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-ink-muted transition-colors hover:bg-panel-raised hover:text-ink"
            >
              <FolderPlus className="h-4 w-4 shrink-0" />
              New collection…
            </button>
          )}
        </li>
        {collections.map((collection) => {
          const selected = !creating && selectedId === collection.id
          return (
            <li key={collection.id}>
              <button
                type="button"
                onClick={() => {
                  setSelectedId(collection.id)
                  setCreating(false)
                }}
                aria-pressed={selected}
                className={
                  'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors ' +
                  (selected ? 'bg-accent/15 text-accent-ink' : 'text-ink hover:bg-panel-raised')
                }
              >
                <Folder className="h-4 w-4 shrink-0" />
                <span className="min-w-0 flex-1 truncate">{collection.name}</span>
                <span className="shrink-0 text-xs text-ink-faint">
                  {(collectionDocIds[collection.id] ?? []).length}
                </span>
                {selected && <Check className="h-4 w-4 shrink-0" />}
              </button>
            </li>
          )
        })}
        {collections.length === 0 && !creating && (
          <li className="px-2 py-3 text-sm text-ink-faint">No collections yet — make one above.</li>
        )}
      </ul>
    </Modal>
  )
}
