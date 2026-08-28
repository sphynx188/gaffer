import { useMemo, useState, type FormEvent } from 'react'
import { Trash2 } from 'lucide-react'
import { useStore } from '../../store'
import type { CollectionKind } from '../../store'
import { Card } from '../ui/Card'
import { Badge } from '../ui/Badge'

// Collections management, folded into each Library tab (2026-08-28) —
// replaces the old unified /library/collections page. A collection is now
// always exactly one kind (migration 032), so there is no longer a "which
// type is this" question to answer in a shared page: the Drills tab only
// ever lists/creates/manages drill-kind collections, Tactics only
// tactic-kind, via this same component with `kind` fixed by the caller.
// Filing docs IN stays the multi-select "Select" + AddToCollectionBar flow
// on the main library view (search/filter across the whole tab beats a
// picker list here); this panel is what's left: create, rename, delete,
// remove a filed doc, and per-coach access grants — admin-only, gated by
// the caller (collection_drill/collection_tactic's own RLS requires
// is_club_admin regardless, so this is belt-and-braces, not the real gate).
export function CollectionManagerPanel({
  kind,
  docs,
  collectionDocIds,
  onRemoveDoc,
}: {
  kind: CollectionKind
  docs: { id: string; name: string }[]
  collectionDocIds: Record<string, string[]>
  onRemoveDoc: (collectionId: string, docId: string) => void
}) {
  const selectedClubId = useStore((s) => s.selectedClubId)
  const collections = useStore((s) => s.collections)
  const collectionAccess = useStore((s) => s.collectionAccess)
  const clubMembers = useStore((s) => s.clubMembers)
  const clubActionError = useStore((s) => s.clubDataError)
  const createCollection = useStore((s) => s.createCollection)
  const updateCollection = useStore((s) => s.updateCollection)
  const deleteCollection = useStore((s) => s.deleteCollection)
  const grantCollectionAccess = useStore((s) => s.grantCollectionAccess)
  const revokeCollectionAccess = useStore((s) => s.revokeCollectionAccess)

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [newName, setNewName] = useState('')
  const [creating, setCreating] = useState(false)
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null)

  // Only this club's own collections of this kind — a licensed-in
  // collection shows up read-only elsewhere (the library's "Licensed"
  // groups), not here.
  const ownCollections = useMemo(
    () =>
      collections
        .filter((c) => c.club_id === selectedClubId && c.kind === kind)
        .sort((a, b) => a.name.localeCompare(b.name)),
    [collections, selectedClubId, kind]
  )
  const selected = ownCollections.find((c) => c.id === selectedId) ?? null

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault()
    if (!newName.trim() || creating) return
    setCreating(true)
    const created = await createCollection(newName.trim(), null, kind)
    setCreating(false)
    if (created) {
      setNewName('')
      setSelectedId(created.id)
    }
  }

  const handleDelete = async (id: string) => {
    const deleted = await deleteCollection(id)
    if (deleted) {
      setConfirmingDeleteId(null)
      if (selectedId === id) setSelectedId(null)
    }
  }

  const docLabel = kind === 'drill' ? 'drills' : 'tactics'

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[16rem_1fr]">
      <Card>
        <h3 className="mb-3 text-sm font-semibold text-ink">Collections</h3>
        <form onSubmit={handleCreate} className="mb-3 flex gap-1.5">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="New collection"
            className="min-w-0 flex-1 rounded-md border border-line bg-panel-raised px-2 py-1.5 text-sm text-ink outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/30"
          />
          <button
            type="submit"
            disabled={!newName.trim() || creating}
            className="shrink-0 rounded-md bg-accent px-2.5 py-1.5 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50"
          >
            +
          </button>
        </form>
        {clubActionError && <p className="mb-2 text-xs text-bad">{clubActionError}</p>}
        <ul className="space-y-1">
          {ownCollections.map((c) => (
            <li key={c.id}>
              {confirmingDeleteId === c.id ? (
                <div className="rounded-md border border-bad/30 bg-bad/10 p-2">
                  <p className="text-xs text-bad">Delete "{c.name}"?</p>
                  <div className="mt-1.5 flex gap-2">
                    <button
                      type="button"
                      onClick={() => void handleDelete(c.id)}
                      className="rounded-md bg-bad px-2 py-1 text-xs font-medium text-white"
                    >
                      Delete
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmingDeleteId(null)}
                      className="px-2 py-1 text-xs text-ink-muted"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  className={
                    'flex items-center justify-between gap-1 rounded-md px-2 py-1.5 text-sm transition-colors ' +
                    (selectedId === c.id ? 'bg-accent/15 text-accent' : 'text-ink-muted hover:bg-panel-raised hover:text-ink')
                  }
                >
                  <button type="button" onClick={() => setSelectedId(c.id)} className="min-w-0 flex-1 truncate text-left">
                    {c.name}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmingDeleteId(c.id)}
                    aria-label={`Delete ${c.name}`}
                    className="shrink-0 rounded p-1 text-ink-faint hover:text-bad"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </li>
          ))}
          {ownCollections.length === 0 && <p className="px-2 text-sm text-ink-muted">No collections yet.</p>}
        </ul>
      </Card>

      {selected ? (
        <div className="space-y-4">
          <Card>
            <RenameField key={selected.id} collectionId={selected.id} name={selected.name} onRename={updateCollection} />
          </Card>
          <Card>
            <h3 className="mb-3 text-sm font-semibold text-ink">
              {docLabel[0].toUpperCase() + docLabel.slice(1)} in this collection
            </h3>
            <FiledList
              docs={docs}
              filedIds={collectionDocIds[selected.id] ?? []}
              onRemove={(docId) => onRemoveDoc(selected.id, docId)}
            />
          </Card>
          <Card>
            <h3 className="mb-3 text-sm font-semibold text-ink">Coach access</h3>
            <ul className="space-y-1.5">
              {clubMembers
                .filter((m) => m.role !== 'admin')
                .map((member) => {
                  const granted = (collectionAccess[selected.id] ?? []).includes(member.user_id)
                  return (
                    <li key={member.user_id} className="flex items-center justify-between gap-2 rounded-md border border-line px-2.5 py-1.5">
                      <span className="truncate text-sm text-ink">{member.display_name ?? 'Unnamed coach'}</span>
                      <button
                        type="button"
                        onClick={() =>
                          granted
                            ? revokeCollectionAccess(selected.id, member.user_id)
                            : grantCollectionAccess(selected.id, member.user_id)
                        }
                        aria-pressed={granted}
                        className={
                          'shrink-0 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ' +
                          (granted
                            ? 'border-accent bg-accent/15 text-accent'
                            : 'border-line text-ink-muted hover:border-line-strong hover:text-ink')
                        }
                      >
                        {granted ? 'Granted' : 'Grant'}
                      </button>
                    </li>
                  )
                })}
              {clubMembers.filter((m) => m.role !== 'admin').length === 0 && (
                <p className="text-sm text-ink-muted">No coaches yet — create one from Settings.</p>
              )}
            </ul>
          </Card>
        </div>
      ) : (
        <Card>
          <p className="text-sm text-ink-muted">
            Select a collection, or create one, to manage it. To file {docLabel} into one, select them above and use
            "Add to collection".
          </p>
        </Card>
      )}
    </div>
  )
}

function RenameField({
  collectionId,
  name,
  onRename,
}: {
  collectionId: string
  name: string
  onRename: (id: string, patch: { name?: string }) => Promise<boolean>
}) {
  const [value, setValue] = useState(name)
  const [saving, setSaving] = useState(false)

  const handleBlur = async () => {
    const trimmed = value.trim()
    if (!trimmed || trimmed === name || saving) return
    setSaving(true)
    await onRename(collectionId, { name: trimmed })
    setSaving(false)
  }

  return (
    <div>
      <label htmlFor={`collection-name-${collectionId}`} className="block text-xs font-medium text-ink-muted">
        Collection name
      </label>
      <input
        id={`collection-name-${collectionId}`}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={handleBlur}
        disabled={saving}
        className="mt-1 w-full max-w-sm rounded-md border border-line bg-panel-raised px-2 py-1.5 text-sm text-ink outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/30"
      />
    </div>
  )
}

// Just the filed side of the old two-column filing panel — adding is the
// main library view's "Select" + AddToCollectionBar job now (it can search/
// filter across everything, a plain picker list here couldn't), so this
// only needs to show what's filed and let it be removed.
function FiledList({
  docs,
  filedIds,
  onRemove,
}: {
  docs: { id: string; name: string }[]
  filedIds: string[]
  onRemove: (docId: string) => void
}) {
  const filedSet = new Set(filedIds)
  const filed = docs.filter((d) => filedSet.has(d.id))

  return (
    <ul className="max-h-72 space-y-1 overflow-y-auto">
      {filed.map((d) => (
        <li key={d.id} className="flex items-center justify-between gap-2 rounded-md border border-line px-2 py-1.5">
          <span className="min-w-0 truncate text-sm text-ink">{d.name}</span>
          <button type="button" onClick={() => onRemove(d.id)} className="shrink-0 text-xs font-medium text-ink-muted hover:text-bad">
            Remove
          </button>
        </li>
      ))}
      {filed.length === 0 && (
        <p className="text-sm text-ink-muted">
          <Badge tone="neutral">0</Badge> Nothing filed yet.
        </p>
      )}
    </ul>
  )
}
