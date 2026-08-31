import { useState } from 'react'
import { useStore } from '../../store'
import { Card } from '../../components/ui/Card'
import { Badge } from '../../components/ui/Badge'
import { Dropdown } from '../../components/ui/Dropdown'

// Licensing (spec §9) — outgoing: grant a collection to another club I
// administer, revoke; incoming: collections licensed to this club, with
// the same per-coach dispersal toggles CollectionsPage uses for home
// grants (collection_access serves both — one grant mechanism).
//
// Doesn't fetch its own data — see TransferPage's comment; SettingsPage
// owns the one fetchClubData() call this and its sibling sections share.
export function LicensesPage() {
  const selectedClubId = useStore((s) => s.selectedClubId)
  const memberships = useStore((s) => s.memberships)
  const collections = useStore((s) => s.collections)
  const licensesOut = useStore((s) => s.licensesOut)
  const licensesIn = useStore((s) => s.licensesIn)
  const licenseClubNames = useStore((s) => s.licenseClubNames)
  const collectionAccess = useStore((s) => s.collectionAccess)
  const clubMembers = useStore((s) => s.clubMembers)
  const clubDataError = useStore((s) => s.clubDataError)

  const grantLicense = useStore((s) => s.grantLicense)
  const revokeLicense = useStore((s) => s.revokeLicense)
  const grantCollectionAccess = useStore((s) => s.grantCollectionAccess)
  const revokeCollectionAccess = useStore((s) => s.revokeCollectionAccess)

  const [collectionId, setCollectionId] = useState('')
  const [targetClubId, setTargetClubId] = useState('')
  const [granting, setGranting] = useState(false)
  const [revokingId, setRevokingId] = useState<string | null>(null)

  const collectionName = (id: string) => collections.find((c) => c.id === id)?.name ?? 'Unknown collection'
  const sourceClubName = (collectionId: string) => {
    const sourceClubId = collections.find((c) => c.id === collectionId)?.club_id
    return (sourceClubId && licenseClubNames[sourceClubId]) || 'another club'
  }

  const homeCollections = collections
    .filter((c) => c.club_id === selectedClubId)
    .sort((a, b) => a.name.localeCompare(b.name))
  const otherAdminClubs = memberships
    .filter((m) => m.role === 'admin' && m.club_id !== selectedClubId)
    .sort((a, b) => a.club.name.localeCompare(b.club.name))

  const handleGrant = async () => {
    if (!collectionId || !targetClubId || granting) return
    setGranting(true)
    const ok = await grantLicense(collectionId, targetClubId)
    setGranting(false)
    if (ok) {
      setCollectionId('')
      setTargetClubId('')
    }
  }

  const handleRevoke = async (licenseId: string) => {
    setRevokingId(licenseId)
    await revokeLicense(licenseId)
    setRevokingId(null)
  }

  const activeIncoming = licensesIn.filter((l) => !l.revoked_at)

  return (
    <div className="space-y-6">
      <Card>
        <h3 className="mb-4 text-sm font-semibold text-ink">Outgoing licenses</h3>
        {otherAdminClubs.length === 0 ? (
          <p className="text-sm text-ink-muted">
            Licensing needs a second club you administer. Join or create one to grant licenses.
          </p>
        ) : (
          <div className="flex flex-wrap items-end gap-3">
            <div className="w-56">
              <label className="block text-xs font-medium text-ink-muted">Collection</label>
              <div className="mt-1">
                <Dropdown
                  value={collectionId}
                  onChange={setCollectionId}
                  options={homeCollections.map((c) => ({ value: c.id, label: c.name }))}
                  ariaLabel="Collection to license"
                  placeholder="Choose a collection"
                  emptyMessage="No collections yet"
                />
              </div>
            </div>
            <div className="w-56">
              <label className="block text-xs font-medium text-ink-muted">License to</label>
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
              onClick={handleGrant}
              disabled={!collectionId || !targetClubId || granting}
              className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50"
            >
              {granting ? 'Granting…' : 'Grant license'}
            </button>
          </div>
        )}
        {clubDataError && <p className="mt-2 text-sm text-bad">{clubDataError}</p>}

        {licensesOut.length > 0 && (
          <ul className="mt-4 space-y-1.5">
            {licensesOut.map((license) => (
              <li
                key={license.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-line px-3 py-2"
              >
                <span className="min-w-0 truncate text-sm text-ink">
                  {collectionName(license.collection_id)} →{' '}
                  {licenseClubNames[license.target_club_id] ?? 'Unknown club'}
                </span>
                <span className="flex items-center gap-2">
                  <span className="text-xs text-ink-muted">
                    {new Date(license.created_at).toLocaleDateString()}
                  </span>
                  {license.revoked_at ? (
                    <Badge tone="neutral">Revoked</Badge>
                  ) : (
                    <button
                      type="button"
                      onClick={() => void handleRevoke(license.id)}
                      disabled={revokingId === license.id}
                      className="rounded-md border border-line px-2.5 py-1 text-xs font-medium text-bad transition-colors hover:border-bad/40 hover:bg-bad/5 disabled:opacity-50"
                    >
                      {revokingId === license.id ? 'Revoking…' : 'Revoke'}
                    </button>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <h3 className="mb-4 text-sm font-semibold text-ink">Incoming licenses</h3>
        {activeIncoming.length === 0 ? (
          <p className="text-sm text-ink-muted">No collections have been licensed to this club.</p>
        ) : (
          <div className="space-y-4">
            {activeIncoming.map((license) => (
              <div key={license.id} className="rounded-lg border border-line p-3">
                <p className="text-sm font-medium text-ink">
                  {collectionName(license.collection_id)}{' '}
                  <span className="font-normal text-ink-muted">from {sourceClubName(license.collection_id)}</span>
                </p>
                <ul className="mt-2 space-y-1.5">
                  {clubMembers
                    .filter((m) => m.role !== 'admin')
                    .map((member) => {
                      const granted = (collectionAccess[license.collection_id] ?? []).includes(member.user_id)
                      return (
                        <li
                          key={member.user_id}
                          className="flex items-center justify-between gap-2 rounded-md border border-line px-2.5 py-1.5"
                        >
                          <span className="truncate text-sm text-ink">{member.display_name ?? 'Unnamed coach'}</span>
                          <button
                            type="button"
                            onClick={() =>
                              granted
                                ? revokeCollectionAccess(license.collection_id, member.user_id)
                                : grantCollectionAccess(license.collection_id, member.user_id)
                            }
                            aria-pressed={granted}
                            className={
                              'shrink-0 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ' +
                              (granted
                                ? 'border-accent bg-accent/15 text-accent-ink'
                                : 'border-line text-ink-muted hover:border-line-strong hover:text-ink')
                            }
                          >
                            {granted ? 'Dispersed' : 'Disperse'}
                          </button>
                        </li>
                      )
                    })}
                  {clubMembers.filter((m) => m.role !== 'admin').length === 0 && (
                    <p className="text-sm text-ink-muted">No coaches yet — create one on the Coaches tab.</p>
                  )}
                </ul>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
