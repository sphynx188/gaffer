import { useState } from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import type { ClubTag } from '../../store'
import { Modal } from '../ui/Modal'

const FIELD =
  'min-w-0 flex-1 rounded-md border border-line bg-panel px-2 py-1.5 text-sm text-ink outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/30'

// Admin-only (club_tag's write policies). Deleting asks first and says how
// many drills lose the tag; renaming changes it on every drill at once.
export function ManageTagsDialog({
  open,
  onClose,
  tags,
  usage,
  onCreate,
  onRename,
  onDelete,
}: {
  open: boolean
  onClose: () => void
  tags: ClubTag[]
  usage: Record<string, number>
  onCreate: (name: string) => Promise<unknown>
  onRename: (id: string, name: string) => Promise<unknown>
  onDelete: (id: string) => Promise<unknown>
}) {
  const [newName, setNewName] = useState('')
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  const add = async () => {
    if (!newName.trim()) return
    await onCreate(newName)
    setNewName('')
  }

  const commitRename = async (tag: ClubTag, name: string) => {
    // An unchanged or emptied name is a cancel, not a write.
    if (name.trim() && name.trim() !== tag.name) await onRename(tag.id, name)
    setEditing(null)
  }

  return (
    <Modal open={open} onClose={onClose} title="Manage tags" description="Tags are shared by every drill in the club.">
      <div className="space-y-3">
        <div className="flex gap-2">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void add()
            }}
            placeholder="New tag, e.g. Back to goal"
            aria-label="New tag name"
            maxLength={40}
            className={FIELD}
          />
          <button
            type="button"
            onClick={() => void add()}
            disabled={!newName.trim()}
            className="flex items-center gap-1 rounded-md bg-accent px-3 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:opacity-50"
          >
            <Plus className="h-4 w-4" aria-hidden />
            Add
          </button>
        </div>
        <ul className="max-h-80 space-y-0.5 overflow-y-auto">
          {tags.map((tag) => (
            <li key={tag.id} className="flex min-h-9 items-center gap-2 rounded-md px-2 hover:bg-panel-raised">
              {editing?.id === tag.id ? (
                <input
                  autoFocus
                  value={editing.name}
                  maxLength={40}
                  onChange={(e) => setEditing({ id: tag.id, name: e.target.value })}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void commitRename(tag, editing.name)
                    // Escape would otherwise also reach Modal's window
                    // listener and close the whole dialog.
                    if (e.key === 'Escape') {
                      e.stopPropagation()
                      setEditing(null)
                    }
                  }}
                  onBlur={() => setEditing(null)}
                  aria-label={`Rename ${tag.name}`}
                  className={FIELD}
                />
              ) : confirmDelete === tag.id ? (
                <>
                  <span className="min-w-0 flex-1 text-sm text-ink">
                    Delete "{tag.name}"?{' '}
                    <span className="text-ink-muted">
                      {usage[tag.id]
                        ? `It comes off ${usage[tag.id]} drill${usage[tag.id] === 1 ? '' : 's'}.`
                        : 'No drills use it.'}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={async () => {
                      await onDelete(tag.id)
                      setConfirmDelete(null)
                    }}
                    className="text-sm font-medium text-bad"
                  >
                    Delete
                  </button>
                  <button type="button" onClick={() => setConfirmDelete(null)} className="text-sm text-ink-muted hover:text-ink">
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  <span className="min-w-0 flex-1 truncate text-sm text-ink">{tag.name}</span>
                  <span className="text-xs tabular-nums text-ink-faint">{usage[tag.id] ?? 0}</span>
                  <button
                    type="button"
                    onClick={() => setEditing({ id: tag.id, name: tag.name })}
                    aria-label={`Rename ${tag.name}`}
                    className="rounded p-1 text-ink-muted transition-colors hover:text-ink"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(tag.id)}
                    aria-label={`Delete ${tag.name}`}
                    className="rounded p-1 text-ink-muted transition-colors hover:text-bad"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </>
              )}
            </li>
          ))}
          {tags.length === 0 && <li className="px-2 py-3 text-sm text-ink-faint">No tags yet.</li>}
        </ul>
      </div>
    </Modal>
  )
}
