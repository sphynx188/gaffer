import { useEffect, useState } from 'react'
import { useStore } from '../../store'
import { Card } from '../../components/ui/Card'
import { Dropdown } from '../../components/ui/Dropdown'

// Cross-club copy (spec §8) — pick a collection this club owns, pick
// another club I administer, copy. copyCollectionToClub (clubSlice, Task 4)
// calls copy_collection_to_club (migration 030) via runSupabaseAction.
export function TransferPage() {
  const selectedClubId = useStore((s) => s.selectedClubId)
  const memberships = useStore((s) => s.memberships)
  const collections = useStore((s) => s.collections)
  const clubDataLoading = useStore((s) => s.clubDataLoading)
  const clubDataError = useStore((s) => s.clubDataError)
  const fetchClubData = useStore((s) => s.fetchClubData)
  const copyCollectionToClub = useStore((s) => s.copyCollectionToClub)
  const selectClub = useStore((s) => s.selectClub)

  useEffect(() => {
    void fetchClubData()
  }, [fetchClubData, selectedClubId])

  const [collectionId, setCollectionId] = useState('')
  const [targetClubId, setTargetClubId] = useState('')
  const [copying, setCopying] = useState(false)
  const [successClub, setSuccessClub] = useState<{ id: string; name: string } | null>(null)

  const homeCollections = collections
    .filter((c) => c.club_id === selectedClubId)
    .sort((a, b) => a.name.localeCompare(b.name))
  const otherAdminClubs = memberships
    .filter((m) => m.role === 'admin' && m.club_id !== selectedClubId)
    .sort((a, b) => a.club.name.localeCompare(b.club.name))

  const handleCopy = async () => {
    if (!collectionId || !targetClubId || copying) return
    setCopying(true)
    const ok = await copyCollectionToClub(collectionId, targetClubId)
    setCopying(false)
    if (ok) {
      const target = otherAdminClubs.find((m) => m.club_id === targetClubId)
      setSuccessClub(target ? { id: target.club_id, name: target.club.name } : null)
      setCollectionId('')
      setTargetClubId('')
    }
  }

  if (otherAdminClubs.length === 0) {
    return (
      <Card>
        <p className="text-sm text-ink-muted">
          Transfer copies a collection to another club you administer. You're only an admin of this one club right
          now — join or create a second club to use this.
        </p>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <Card>
        <h2 className="mb-4 text-sm font-semibold text-ink">Copy a collection</h2>
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-56">
            <label className="block text-xs font-medium text-ink-muted">Collection</label>
            <div className="mt-1">
              <Dropdown
                value={collectionId}
                onChange={setCollectionId}
                options={homeCollections.map((c) => ({ value: c.id, label: c.name }))}
                ariaLabel="Collection to copy"
                placeholder="Choose a collection"
                emptyMessage="No collections yet"
              />
            </div>
          </div>
          <div className="w-56">
            <label className="block text-xs font-medium text-ink-muted">Copy to</label>
            <div className="mt-1">
              <Dropdown
                value={targetClubId}
                onChange={setTargetClubId}
                options={otherAdminClubs.map((m) => ({ value: m.club_id, label: m.club.name }))}
                ariaLabel="Target club"
                placeholder="Choose a club"
              />
            </div>
          </div>
          <button
            type="button"
            onClick={handleCopy}
            disabled={!collectionId || !targetClubId || copying}
            className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50"
          >
            {copying ? 'Copying…' : 'Copy'}
          </button>
        </div>
        {clubDataError && <p className="mt-2 text-sm text-bad">{clubDataError}</p>}
        {clubDataLoading && <p className="mt-2 text-sm text-ink-muted">Loading…</p>}
      </Card>

      {successClub && (
        <Card>
          <p className="text-sm text-ink">
            Copied into <span className="font-medium">{successClub.name}</span> — new, independent, editable
            documents, unlinked from the source.
          </p>
          <button
            type="button"
            onClick={() => selectClub(successClub.id)}
            className="mt-2 text-sm font-medium text-accent hover:underline"
          >
            Switch to {successClub.name} →
          </button>
        </Card>
      )}
    </div>
  )
}
