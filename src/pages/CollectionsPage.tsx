import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { Trash2 } from 'lucide-react'
import { useStore } from '../store'
import { selectMyRole } from '../store/slices/clubSlice'
import { Card } from '../components/ui/Card'
import { Badge } from '../components/ui/Badge'

// Admin collections console (spec §6.2(2)): CRUD on this club's
// collections, filing drills/tactics in and out, and per-coach grants —
// no new store API, every action here is Task 4's clubSlice as-is. Moved
// from /settings/collections into the Library (2026-08-28) — LibraryLayout
// only lists this tab for an admin, but the route itself was never gated by
// AdminLayout to begin with (that guard lived one level up), so the check
// below is new: it's what actually keeps a non-admin out now that this page
// isn't nested under AdminLayout's own guard any more.
export function CollectionsPage() {
  const isAdmin = useStore((s) => selectMyRole(s) === 'admin')
  const selectedClubId = useStore((s) => s.selectedClubId)
  const collections = useStore((s) => s.collections)
  const collectionDrillIds = useStore((s) => s.collectionDrillIds)
  const collectionTacticIds = useStore((s) => s.collectionTacticIds)
  const collectionAccess = useStore((s) => s.collectionAccess)
  const clubMembers = useStore((s) => s.clubMembers)
  const drills = useStore((s) => s.drills)
  const tactics = useStore((s) => s.tactics)
  const clubActionError = useStore((s) => s.clubDataError)

  const fetchClubData = useStore((s) => s.fetchClubData)
  const fetchDrills = useStore((s) => s.fetchDrills)
  const fetchTactics = useStore((s) => s.fetchTactics)
  const createCollection = useStore((s) => s.createCollection)
  const updateCollection = useStore((s) => s.updateCollection)
  const deleteCollection = useStore((s) => s.deleteCollection)
  const addDrillToCollection = useStore((s) => s.addDrillToCollection)
  const removeDrillFromCollection = useStore((s) => s.removeDrillFromCollection)
  const addTacticToCollection = useStore((s) => s.addTacticToCollection)
  const removeTacticFromCollection = useStore((s) => s.removeTacticFromCollection)
  const grantCollectionAccess = useStore((s) => s.grantCollectionAccess)
  const revokeCollectionAccess = useStore((s) => s.revokeCollectionAccess)

  useEffect(() => {
    void fetchClubData()
    void fetchDrills()
    void fetchTactics()
  }, [fetchClubData, fetchDrills, fetchTactics, selectedClubId])

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [newName, setNewName] = useState('')
  const [creating, setCreating] = useState(false)
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null)

  // Only this club's own collections are manageable here — collections
  // reached via a license show up read-only elsewhere (the library's
  // "Licensed" groups, Task 11's incoming-license dispersal panel).
  const homeCollections = useMemo(
    () => collections.filter((c) => c.club_id === selectedClubId).sort((a, b) => a.name.localeCompare(b.name)),
    [collections, selectedClubId]
  )
  const selected = homeCollections.find((c) => c.id === selectedId) ?? null

  if (!isAdmin) return <Navigate to="/library/drills" replace />

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault()
    if (!newName.trim() || creating) return
    setCreating(true)
    const created = await createCollection(newName.trim(), null)
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

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[16rem_1fr]">
      <Card>
        <h2 className="mb-3 text-sm font-semibold text-ink">Collections</h2>
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
          {homeCollections.map((c) => (
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
          {homeCollections.length === 0 && <p className="px-2 text-sm text-ink-muted">No collections yet.</p>}
        </ul>
      </Card>

      {selected ? (
        <div className="space-y-4">
          <Card>
            {/* Keyed on the collection id so switching which collection is
                selected remounts this with a fresh initial value — avoids a
                setState-in-effect just to reset local state when `name`
                changes out from under an unrelated prop update. */}
            <RenameField key={selected.id} collectionId={selected.id} name={selected.name} onRename={updateCollection} />
          </Card>
          <Card>
            <FilingPanel
              title="Drills"
              allDocs={drills}
              filedIds={collectionDrillIds[selected.id] ?? []}
              onAdd={(docId) => addDrillToCollection(selected.id, docId)}
              onRemove={(docId) => removeDrillFromCollection(selected.id, docId)}
            />
          </Card>
          <Card>
            <FilingPanel
              title="Tactics"
              allDocs={tactics}
              filedIds={collectionTacticIds[selected.id] ?? []}
              onAdd={(docId) => addTacticToCollection(selected.id, docId)}
              onRemove={(docId) => removeTacticFromCollection(selected.id, docId)}
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
                <p className="text-sm text-ink-muted">No coaches yet — create one on the Coaches tab.</p>
              )}
            </ul>
          </Card>
        </div>
      ) : (
        <Card>
          <p className="text-sm text-ink-muted">Select a collection, or create one, to manage its contents.</p>
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
      <label htmlFor="collection-name" className="block text-xs font-medium text-ink-muted">
        Collection name
      </label>
      <input
        id="collection-name"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={handleBlur}
        disabled={saving}
        className="mt-1 w-full max-w-sm rounded-md border border-line bg-panel-raised px-2 py-1.5 text-sm text-ink outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/30"
      />
    </div>
  )
}

// Two lists — filed / available — shared shape for drills and tactics
// (both just need id + name to render here).
function FilingPanel({
  title,
  allDocs,
  filedIds,
  onAdd,
  onRemove,
}: {
  title: string
  allDocs: { id: string; name: string }[]
  filedIds: string[]
  onAdd: (docId: string) => void
  onRemove: (docId: string) => void
}) {
  const filedSet = new Set(filedIds)
  const filed = allDocs.filter((d) => filedSet.has(d.id))
  const available = allDocs.filter((d) => !filedSet.has(d.id))

  return (
    <div>
      <h3 className="mb-3 text-sm font-semibold text-ink">{title}</h3>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-ink-muted">
            In collection <Badge tone="neutral">{filed.length}</Badge>
          </p>
          <ul className="max-h-56 space-y-1 overflow-y-auto">
            {filed.map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-2 rounded-md border border-line px-2 py-1.5">
                <span className="min-w-0 truncate text-sm text-ink">{d.name}</span>
                <button
                  type="button"
                  onClick={() => onRemove(d.id)}
                  className="shrink-0 text-xs font-medium text-ink-muted hover:text-bad"
                >
                  Remove
                </button>
              </li>
            ))}
            {filed.length === 0 && <p className="text-sm text-ink-muted">Nothing filed yet.</p>}
          </ul>
        </div>
        <div>
          <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-ink-muted">Available</p>
          <ul className="max-h-56 space-y-1 overflow-y-auto">
            {available.map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-2 rounded-md border border-line px-2 py-1.5">
                <span className="min-w-0 truncate text-sm text-ink">{d.name}</span>
                <button
                  type="button"
                  onClick={() => onAdd(d.id)}
                  className="shrink-0 text-xs font-medium text-accent hover:text-accent-hover"
                >
                  Add
                </button>
              </li>
            ))}
            {available.length === 0 && <p className="text-sm text-ink-muted">Nothing else to file.</p>}
          </ul>
        </div>
      </div>
    </div>
  )
}
