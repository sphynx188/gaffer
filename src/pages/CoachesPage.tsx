import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { Check, LibraryBig, Pencil, Plus, Shield, UserMinus, Users } from 'lucide-react'
import { useStore } from '../store'
import { selectMyRole } from '../store/slices/clubSlice'
import { useSession } from '../hooks/useSession'
import type { ClubMemberRow, Collection } from '../store'
import { PageHeader } from '../components/ui/PageHeader'
import { Badge } from '../components/ui/Badge'
import { Modal } from '../components/ui/Modal'
import { Skeleton } from '../components/ui/Skeleton'
import { EmptyState } from '../components/ui/EmptyState'
import { Checkbox } from '../components/library/Checkbox'
import { ConfirmDialog } from '../components/library/CollectionDialogs'

// The Coaches tab (2026-08-30) — admin-only, its own rail entry. Who is in
// the club and what each of them can see, on one screen: a list of members
// on the left, and for the selected one their name, the collections they've
// been granted, and the way out of the club.
//
// "What they can see" is collection grants and nothing else, because that
// IS the visibility model (028's drill_club_read): a coach sees what they
// made themselves, plus every board filed in a collection they've been
// granted. There is no per-drill switch to offer, so none is drawn. Admins
// see everything through RLS, so their row says so instead of listing
// toggles that would be no-ops.
//
// Removing a coach removes their membership row (and their grants) — the
// thing that decides access — not their login; see clubSlice.removeCoach.

const FIELD =
  'w-full rounded-md border border-line bg-panel-raised px-2.5 py-1.5 text-sm text-ink outline-none transition-colors placeholder:text-ink-faint focus:border-accent focus:ring-2 focus:ring-accent/30'

function memberName(member: ClubMemberRow): string {
  return member.display_name?.trim() || 'Unnamed coach'
}

export function CoachesPage() {
  const isAdmin = useStore((s) => selectMyRole(s) === 'admin')
  if (!isAdmin) return <Navigate to="/" replace />
  return <CoachesScreen />
}

function CoachesScreen() {
  const { session } = useSession()
  const myUserId = session?.user.id ?? null
  const selectedClubId = useStore((s) => s.selectedClubId)
  const clubMembers = useStore((s) => s.clubMembers)
  const clubDataLoading = useStore((s) => s.clubDataLoading)
  const collections = useStore((s) => s.collections)
  const collectionAccess = useStore((s) => s.collectionAccess)
  const collectionDrillIds = useStore((s) => s.collectionDrillIds)
  const collectionTacticIds = useStore((s) => s.collectionTacticIds)
  const fetchClubData = useStore((s) => s.fetchClubData)
  const clubActionError = useStore((s) => s.clubActionError)

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)

  useEffect(() => {
    void fetchClubData()
  }, [fetchClubData, selectedClubId])

  // Coaches first (they are what this page is for), then admins; oldest
  // membership first within each, so the list doesn't reshuffle on rename.
  const members = useMemo(
    () =>
      [...clubMembers].sort(
        (a, b) => (a.role === 'admin' ? 1 : 0) - (b.role === 'admin' ? 1 : 0) || a.created_at.localeCompare(b.created_at)
      ),
    [clubMembers]
  )
  // Only this club's own collections can be granted — a licensed-in one
  // belongs to the club that granted it (collection_access RLS, 028).
  const ownCollections = useMemo(
    () =>
      collections
        .filter((c) => c.club_id === selectedClubId)
        .sort((a, b) => a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name)),
    [collections, selectedClubId]
  )
  const countIn = (collection: Collection) =>
    (collection.kind === 'drill' ? collectionDrillIds : collectionTacticIds)[collection.id]?.length ?? 0
  const grantedTo = (userId: string) => ownCollections.filter((c) => (collectionAccess[c.id] ?? []).includes(userId))

  const selected = members.find((m) => m.user_id === selectedId) ?? members[0] ?? null
  const loading = clubDataLoading && clubMembers.length === 0

  return (
    <div>
      <PageHeader
        title="Coaches"
        description="Who is in the club, and what each of them can see."
        actions={
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-md bg-accent px-3.5 text-sm font-medium text-white transition-colors hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
          >
            <Plus className="h-4 w-4" />
            Add coach
          </button>
        }
      />

      {clubActionError && (
        <p role="alert" className="mb-4 rounded-md border border-bad/40 bg-bad/10 px-3 py-2 text-sm text-bad">
          {clubActionError}
        </p>
      )}

      {loading ? (
        <div aria-busy="true" className="space-y-2">
          <span className="sr-only">Loading…</span>
          <Skeleton className="h-12 rounded-md" />
          <Skeleton className="h-12 rounded-md" />
          <Skeleton className="h-12 rounded-md" />
        </div>
      ) : members.length === 0 ? (
        <EmptyState icon={Users} message="No one in the club yet." />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[18rem_minmax(0,1fr)] lg:items-start">
          <ul className="overflow-hidden rounded-xl border border-line bg-panel">
            {members.map((member) => {
              const isSelected = selected?.user_id === member.user_id
              const granted = member.role === 'admin' ? null : grantedTo(member.user_id).length
              return (
                <li key={member.user_id} className="border-b border-line last:border-b-0">
                  <button
                    type="button"
                    onClick={() => setSelectedId(member.user_id)}
                    aria-current={isSelected ? 'true' : undefined}
                    className={
                      'flex min-h-12 w-full items-center gap-3 px-4 py-2.5 text-left transition-colors focus-visible:outline-none ' +
                      (isSelected ? 'bg-accent/10' : 'hover:bg-panel-raised focus-visible:bg-panel-raised')
                    }
                  >
                    <span className="min-w-0 flex-1">
                      <span className={'block truncate text-sm font-medium ' + (isSelected ? 'text-accent-ink' : 'text-ink')}>
                        {memberName(member)}
                        {member.user_id === myUserId && <span className="font-normal text-ink-faint"> · you</span>}
                      </span>
                      <span className="block truncate text-xs text-ink-faint">
                        {granted === null
                          ? 'Sees everything'
                          : `${granted} of ${ownCollections.length} ${ownCollections.length === 1 ? 'collection' : 'collections'}`}
                      </span>
                    </span>
                    <Badge tone={member.role === 'admin' ? 'ok' : 'neutral'}>{member.role}</Badge>
                  </button>
                </li>
              )
            })}
          </ul>

          {selected && (
            <MemberDetail
              key={selected.user_id}
              member={selected}
              isSelf={selected.user_id === myUserId}
              collections={ownCollections}
              countIn={countIn}
              granted={collectionAccess}
              onRemoved={() => setSelectedId(null)}
            />
          )}
        </div>
      )}

      <AddCoachDialog open={adding} onClose={() => setAdding(false)} onCreated={(id) => setSelectedId(id)} />
    </div>
  )
}

function MemberDetail({
  member,
  isSelf,
  collections,
  countIn,
  granted,
  onRemoved,
}: {
  member: ClubMemberRow
  isSelf: boolean
  collections: Collection[]
  countIn: (collection: Collection) => number
  granted: Record<string, string[]>
  onRemoved: () => void
}) {
  const updateCoach = useStore((s) => s.updateCoach)
  const removeCoach = useStore((s) => s.removeCoach)
  const grantCollectionAccess = useStore((s) => s.grantCollectionAccess)
  const revokeCollectionAccess = useStore((s) => s.revokeCollectionAccess)

  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(member.display_name ?? '')
  const [saving, setSaving] = useState(false)
  const [confirmRemove, setConfirmRemove] = useState(false)
  // Toggles in flight, so a double-tap can't fire grant and revoke at once.
  const [busy, setBusy] = useState<Set<string>>(new Set())

  const saveName = async (e: FormEvent) => {
    e.preventDefault()
    if (saving) return
    setSaving(true)
    const ok = await updateCoach(member.user_id, name.trim() || null)
    setSaving(false)
    if (ok) setEditing(false)
  }

  const toggle = async (collection: Collection, isGranted: boolean) => {
    if (busy.has(collection.id)) return
    setBusy((prev) => new Set(prev).add(collection.id))
    if (isGranted) await revokeCollectionAccess(collection.id, member.user_id)
    else await grantCollectionAccess(collection.id, member.user_id)
    setBusy((prev) => {
      const next = new Set(prev)
      next.delete(collection.id)
      return next
    })
  }

  const isAdmin = member.role === 'admin'
  const grantedCount = collections.filter((c) => (granted[c.id] ?? []).includes(member.user_id)).length
  const joined = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' }).format(
    new Date(member.created_at)
  )

  return (
    <div className="space-y-6">
      <section className="panel-edge rounded-xl border border-line bg-panel p-5">
        {editing ? (
          <form onSubmit={saveName} className="flex flex-wrap items-end gap-2">
            <div className="min-w-0 flex-1">
              <label htmlFor="member-name" className="block text-xs font-medium text-ink-muted">
                Display name
              </label>
              <input
                id="member-name"
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Sam Whitfield"
                className={`mt-1 ${FIELD}`}
              />
            </div>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-md bg-accent px-3 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50"
            >
              <Check className="h-4 w-4" />
              {saving ? 'Saving…' : 'Save name'}
            </button>
            <button
              type="button"
              onClick={() => {
                setName(member.display_name ?? '')
                setEditing(false)
              }}
              className="min-h-9 px-2 text-sm text-ink-muted hover:text-ink"
            >
              Cancel
            </button>
          </form>
        ) : (
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-lg font-semibold tracking-tight text-ink">{memberName(member)}</h2>
              <p className="mt-1 text-sm text-ink-muted">
                {isAdmin ? 'Admin' : 'Coach'} · joined {joined}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-line px-3 text-sm font-medium text-ink transition-colors hover:border-line-strong hover:bg-panel-raised"
            >
              <Pencil className="h-3.5 w-3.5" />
              Rename
            </button>
          </div>
        )}
      </section>

      <section aria-labelledby="member-access-title">
        <div className="mb-3 flex items-baseline justify-between gap-4">
          <h3 id="member-access-title" className="text-sm font-semibold text-ink">
            What {isSelf ? 'you' : memberName(member)} can see
          </h3>
          {!isAdmin && collections.length > 0 && (
            <span className="text-xs tabular-nums text-ink-faint">
              {grantedCount} of {collections.length} granted
            </span>
          )}
        </div>
        {isAdmin ? (
          <p className="rounded-xl border border-line bg-panel px-4 py-3 text-sm text-ink-muted">
            Admins see every drill, tactic and collection in the club. Access is only chosen for coaches.
          </p>
        ) : collections.length === 0 ? (
          <EmptyState
            icon={LibraryBig}
            message="No collections yet — file drills into one in the Library, then grant it here."
            action={{ to: '/library/drills', label: 'Open the Library' }}
          />
        ) : (
          <>
            <p className="mb-3 text-sm text-ink-muted">
              A coach always sees what they make themselves. Tick a collection to let them see everything filed in it.
            </p>
            <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-panel">
              {collections.map((collection) => {
                const isGranted = (granted[collection.id] ?? []).includes(member.user_id)
                const count = countIn(collection)
                const Icon = collection.kind === 'drill' ? LibraryBig : Shield
                return (
                  <li key={collection.id}>
                    <label
                      className={
                        'flex min-h-12 cursor-pointer items-center gap-3 px-4 py-2.5 transition-colors hover:bg-panel-raised ' +
                        (busy.has(collection.id) ? 'opacity-60' : '')
                      }
                    >
                      <Checkbox
                        checked={isGranted}
                        label={`${isGranted ? 'Revoke' : 'Grant'} ${collection.name}`}
                        onToggle={() => void toggle(collection, isGranted)}
                      />
                      <Icon className="h-4 w-4 shrink-0 text-ink-faint" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-ink">{collection.name}</span>
                        {collection.description && (
                          <span className="block truncate text-xs text-ink-faint">{collection.description}</span>
                        )}
                      </span>
                      <span className="shrink-0 text-sm tabular-nums text-ink-muted">
                        {count} {collection.kind === 'drill' ? (count === 1 ? 'drill' : 'drills') : count === 1 ? 'tactic' : 'tactics'}
                      </span>
                    </label>
                  </li>
                )
              })}
            </ul>
          </>
        )}
      </section>

      {!isSelf && (
        <section className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line px-4 py-3">
          <p className="text-sm text-ink-muted">
            Removing {memberName(member)} takes away every grant and their place in the club. Boards they made stay in the
            library.
          </p>
          <button
            type="button"
            onClick={() => setConfirmRemove(true)}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-bad/40 px-3 text-sm font-medium text-bad transition-colors hover:bg-bad/10"
          >
            <UserMinus className="h-4 w-4" />
            Remove from club
          </button>
        </section>
      )}

      <ConfirmDialog
        open={confirmRemove}
        onClose={() => setConfirmRemove(false)}
        title={`Remove ${memberName(member)}?`}
        message="They lose access to the club and every collection granted to them. Their login is kept, and boards they made stay in the library."
        confirmLabel="Remove from club"
        onConfirm={async () => {
          if (await removeCoach(member.user_id)) onRemoved()
        }}
      />
    </div>
  )
}

// Same form the old Settings page carried, in a dialog so the list stays put.
// The password is set by the admin and handed over out of band — there is no
// invite email on this project (see supabase/functions/create-coach).
function AddCoachDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean
  onClose: () => void
  onCreated: (userId: string) => void
}) {
  const createCoach = useStore((s) => s.createCoach)
  const clubActionError = useStore((s) => s.clubActionError)
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const canSubmit = email.trim().length > 0 && password.length >= 6 && !submitting

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!canSubmit) return
    setSubmitting(true)
    const userId = await createCoach({ email: email.trim(), password, displayName: displayName.trim() })
    setSubmitting(false)
    if (userId) {
      setDisplayName('')
      setEmail('')
      setPassword('')
      onCreated(userId)
      onClose()
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add a coach"
      description="They can sign in straight away with the email and password you set."
      footer={
        <>
          <button type="button" onClick={onClose} className="px-2 py-1.5 text-sm text-ink-muted hover:text-ink">
            Cancel
          </button>
          <button
            type="submit"
            form="add-coach-form"
            disabled={!canSubmit}
            className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50"
          >
            {submitting ? 'Adding…' : 'Add coach'}
          </button>
        </>
      }
    >
      <form id="add-coach-form" onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label htmlFor="coach-name" className="block text-xs font-medium text-ink-muted">
            Display name
          </label>
          <input
            id="coach-name"
            autoFocus
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="e.g. Sam Whitfield"
            className={`mt-1 ${FIELD}`}
          />
        </div>
        <div>
          <label htmlFor="coach-email" className="block text-xs font-medium text-ink-muted">
            Email
          </label>
          <input
            id="coach-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="coach@example.com"
            className={`mt-1 ${FIELD}`}
          />
        </div>
        <div>
          <label htmlFor="coach-password" className="block text-xs font-medium text-ink-muted">
            Password
          </label>
          <input
            id="coach-password"
            type="password"
            minLength={6}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 6 characters"
            className={`mt-1 ${FIELD}`}
          />
        </div>
        {clubActionError && <p className="text-sm text-bad">{clubActionError}</p>}
      </form>
    </Modal>
  )
}
