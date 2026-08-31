import { useEffect, useRef, useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { Check, Pencil, Shield, Trash2 } from 'lucide-react'
import { useStore } from '../../store'
import { selectMyRole } from '../../store/slices/clubSlice'
import { useSession } from '../../hooks/useSession'
import { PageHeader } from '../../components/ui/PageHeader'
import { Card } from '../../components/ui/Card'
import { Modal } from '../../components/ui/Modal'
import { Skeleton } from '../../components/ui/Skeleton'
import { TransferPage } from './TransferPage'
import { LicensesPage } from './LicensesPage'

// Settings, redesigned (2026-08-30) as one continuous page with a jump-nav
// instead of the old AdminLayout + per-tab routes (Task 8/9/10/11). Chosen
// over the alternatives it was rolled against — grouped disclosure rows,
// an in-page sidebar — because with five sections total there's nothing to
// switch away from: a coach can see everything Settings holds by scrolling,
// which a route-per-section forces them to click through one at a time to
// even discover.
//
// The old /settings/transfer and /settings/licenses routes redirect here
// with a hash (see App.tsx) — the anchors below are what they land on.
//
// fetchClubData() is called ONCE here rather than by Transfer/Licenses
// themselves (each used to own that call back when they were separate
// routed pages, so only one was ever mounted at a time). Now that all three
// data-dependent sections (this, Transfer, Licenses) mount together, two
// independent calls fired the same ~8-request waterfall twice on every
// load — caught live via a network trace during /impeccable audit.
const SECTIONS = [
  { id: 'profile', label: 'Your profile' },
  { id: 'club', label: 'Club' },
  { id: 'transfer', label: 'Transfer' },
  { id: 'licenses', label: 'Licenses' },
  { id: 'danger', label: 'Danger zone' },
]

const FIELD =
  'w-full rounded-md border border-line bg-panel-raised px-2.5 py-1.5 text-sm text-ink outline-none transition-colors placeholder:text-ink-faint focus:border-accent focus:ring-2 focus:ring-accent/30'

export function SettingsPage() {
  const isAdmin = useStore((s) => selectMyRole(s) === 'admin')
  if (!isAdmin) return <Navigate to="/" replace />
  return <SettingsScreen />
}

// Anchor navigation moves the viewport but not focus — a `<section>` isn't
// natively focusable, so a keyboard or screen-reader user who clicks (or
// lands via the old-route redirects in App.tsx) a jump-nav link gets the
// visual scroll everyone sees, but their actual reading/tab position never
// moves. `tabIndex={-1}` on each Section makes it a valid, if silent, focus
// target; this is what actually moves it there — on click, and on mount for
// a link that already carries a hash.
function focusSection(id: string) {
  document.getElementById(id)?.focus()
}

function SettingsScreen() {
  const selectedClubId = useStore((s) => s.selectedClubId)
  const fetchClubData = useStore((s) => s.fetchClubData)

  useEffect(() => {
    void fetchClubData()
  }, [fetchClubData, selectedClubId])

  useEffect(() => {
    const id = window.location.hash.slice(1)
    if (id) focusSection(id)
  }, [])

  return (
    <div>
      <PageHeader title="Settings" description="Your profile, this club, and how it shares with others." />

      <nav className="mb-8 flex flex-wrap gap-1 border-b border-line pb-3">
        {SECTIONS.map((s) => (
          <a
            key={s.id}
            href={`#${s.id}`}
            onClick={() => focusSection(s.id)}
            className="rounded-md px-3 py-1.5 text-sm font-medium text-ink-muted transition-colors hover:bg-panel-raised hover:text-ink"
          >
            {s.label}
          </a>
        ))}
      </nav>

      <div className="space-y-10">
        <Section id="profile" title="Your profile">
          <YourProfileCard />
        </Section>

        <Section id="club" title="Club">
          <ClubProfileCard />
        </Section>

        <Section id="transfer" title="Transfer" description="Copy a collection you own to another club you administer.">
          <TransferPage />
        </Section>

        <Section
          id="licenses"
          title="Licenses"
          description="Share a collection with another club without copying it, or see what's been shared with you."
        >
          <LicensesPage />
        </Section>

        <Section id="danger" title="Danger zone">
          <DangerZoneCard />
        </Section>
      </div>
    </div>
  )
}

function Section({
  id,
  title,
  description,
  children,
}: {
  id: string
  title: string
  description?: string
  children: ReactNode
}) {
  return (
    <section id={id} tabIndex={-1} aria-labelledby={`${id}-heading`} className="scroll-mt-6 outline-none">
      <h2 id={`${id}-heading`} className="text-sm font-semibold text-ink">
        {title}
      </h2>
      {description && <p className="mt-1 text-sm text-ink-muted">{description}</p>}
      <div className="mt-3">{children}</div>
    </section>
  )
}

function YourProfileCard() {
  const { session } = useSession()
  const myUserId = session?.user.id ?? null
  const clubMembers = useStore((s) => s.clubMembers)
  const clubDataLoading = useStore((s) => s.clubDataLoading)
  const updateCoach = useStore((s) => s.updateCoach)
  const clubActionError = useStore((s) => s.clubActionError)

  const me = clubMembers.find((m) => m.user_id === myUserId)
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(me?.display_name ?? '')
  const [saving, setSaving] = useState(false)

  if (!myUserId) return null

  // clubMembers comes from SettingsScreen's fetchClubData, not from
  // fetchMemberships (already resolved before this page can even mount) —
  // there's a real window before it arrives, and "Unnamed coach" would be a
  // false claim about a name that just hasn't loaded yet, not one that was
  // never set.
  if (clubDataLoading && !me) {
    return (
      <Card>
        <div aria-busy="true" className="flex items-center justify-between gap-3">
          <span className="sr-only">Loading…</span>
          <Skeleton className="h-9 w-48 rounded-md" />
          <Skeleton className="h-9 w-24 rounded-md" />
        </div>
      </Card>
    )
  }

  const displayName = me?.display_name?.trim() || 'Unnamed coach'

  const handleSave = async (e: FormEvent) => {
    e.preventDefault()
    if (saving) return
    setSaving(true)
    const ok = await updateCoach(myUserId, name.trim() || null)
    setSaving(false)
    if (ok) setEditing(false)
  }

  return (
    <Card>
      {editing ? (
        <form onSubmit={handleSave} className="flex flex-wrap items-end gap-2">
          <div className="min-w-0 flex-1">
            <label htmlFor="my-name" className="block text-xs font-medium text-ink-muted">
              Display name
            </label>
            <input
              id="my-name"
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
              setName(me?.display_name ?? '')
              setEditing(false)
            }}
            className="min-h-9 px-2 text-sm text-ink-muted hover:text-ink"
          >
            Cancel
          </button>
        </form>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-ink">{displayName}</p>
            <p className="mt-0.5 text-xs text-ink-muted">This is the name other coaches at your club see.</p>
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
      {clubActionError && <p className="mt-2 text-sm text-bad">{clubActionError}</p>}
    </Card>
  )
}

function ClubProfileCard() {
  const selectedClubId = useStore((s) => s.selectedClubId)
  const memberships = useStore((s) => s.memberships)
  const updateClubName = useStore((s) => s.updateClubName)
  const clubActionError = useStore((s) => s.clubActionError)

  const club = memberships.find((m) => m.club_id === selectedClubId)?.club ?? null
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(club?.name ?? '')
  const [saving, setSaving] = useState(false)

  if (!club) return null

  const handleSave = async (e: FormEvent) => {
    e.preventDefault()
    if (!name.trim() || saving) return
    setSaving(true)
    const ok = await updateClubName(name.trim())
    setSaving(false)
    if (ok) setEditing(false)
  }

  return (
    <Card>
      <div className="flex items-start gap-4">
        <CrestUploader crestUrl={club.crest_url} />
        <div className="min-w-0 flex-1">
          {editing ? (
            <form onSubmit={handleSave} className="flex flex-wrap items-end gap-2">
              <div className="min-w-0 flex-1">
                <label htmlFor="club-name" className="block text-xs font-medium text-ink-muted">
                  Club name
                </label>
                <input
                  id="club-name"
                  autoFocus
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={`mt-1 ${FIELD}`}
                />
              </div>
              <button
                type="submit"
                disabled={!name.trim() || saving}
                className="inline-flex min-h-9 items-center gap-1.5 rounded-md bg-accent px-3 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50"
              >
                <Check className="h-4 w-4" />
                {saving ? 'Saving…' : 'Save name'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setName(club.name)
                  setEditing(false)
                }}
                className="min-h-9 px-2 text-sm text-ink-muted hover:text-ink"
              >
                Cancel
              </button>
            </form>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-ink">{club.name}</p>
                <p className="mt-0.5 text-xs text-ink-muted">
                  Shown to every coach at this club, and to any club you transfer or license collections with.
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
        </div>
      </div>
      {clubActionError && <p className="mt-2 text-sm text-bad">{clubActionError}</p>}
    </Card>
  )
}

// The crest (2026-08-30) — admin-uploaded, club-wide, shown in the app
// header and on Home (see AppShell's ClubSwitcher and HomePage's own
// crest use). The square itself IS the upload control: clicking it (or its
// hover label, for a mouse) opens the file picker, so there's no separate
// "Upload" button competing with the name field for attention in a card
// that's mostly about the name.
function CrestUploader({ crestUrl }: { crestUrl: string | null }) {
  const uploadClubCrest = useStore((s) => s.uploadClubCrest)
  const removeClubCrest = useStore((s) => s.removeClubCrest)
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  const handleFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    // Cleared immediately, not after the upload settles — otherwise
    // re-picking the exact same file (e.g. after a failed upload) fires no
    // change event at all, since the input's value never actually changed.
    e.target.value = ''
    if (!file) return
    setUploading(true)
    await uploadClubCrest(file)
    setUploading(false)
  }

  return (
    <div className="shrink-0">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        aria-label={crestUrl ? 'Change crest' : 'Upload crest'}
        className="group relative flex h-14 w-14 items-center justify-center overflow-hidden rounded-lg border border-line bg-panel-raised transition-colors hover:border-line-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
      >
        {crestUrl ? (
          <img src={crestUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <Shield className="h-6 w-6 text-ink-faint" />
        )}
        <span className="absolute inset-0 flex items-center justify-center bg-black/60 text-[10px] font-medium text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
          {uploading ? '…' : crestUrl ? 'Change' : 'Upload'}
        </span>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        onChange={handleFile}
        className="sr-only"
      />
      {crestUrl && (
        <button
          type="button"
          onClick={() => removeClubCrest()}
          className="mt-1 block text-xs text-ink-faint hover:text-bad"
        >
          Remove
        </button>
      )}
    </div>
  )
}

function DangerZoneCard() {
  const selectedClubId = useStore((s) => s.selectedClubId)
  const memberships = useStore((s) => s.memberships)
  const deleteClub = useStore((s) => s.deleteClub)
  const clubActionError = useStore((s) => s.clubActionError)

  const club = memberships.find((m) => m.club_id === selectedClubId)?.club ?? null
  const [confirming, setConfirming] = useState(false)
  const [typedName, setTypedName] = useState('')
  const [deleting, setDeleting] = useState(false)

  if (!club) return null

  const canDelete = typedName.trim() === club.name && !deleting

  const handleDelete = async () => {
    if (!canDelete) return
    setDeleting(true)
    const ok = await deleteClub()
    setDeleting(false)
    if (ok) {
      setConfirming(false)
      setTypedName('')
    }
  }

  return (
    <Card className="border-bad/30">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-ink">Delete {club.name}</p>
          <p className="mt-0.5 text-xs text-ink-muted">
            Permanently deletes every drill and tactic this club owns, and removes every coach's access — this
            can&rsquo;t be undone.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-bad/40 px-3 text-sm font-medium text-bad transition-colors hover:bg-bad/10"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Delete club
        </button>
      </div>
      {clubActionError && <p className="mt-2 text-sm text-bad">{clubActionError}</p>}

      <Modal
        open={confirming}
        onClose={() => {
          setConfirming(false)
          setTypedName('')
        }}
        title={`Delete ${club.name}?`}
        description="Every drill and tactic this club owns is gone, along with every coach's access to them. This can't be undone."
        footer={
          <>
            <button
              type="button"
              onClick={() => {
                setConfirming(false)
                setTypedName('')
              }}
              className="px-2 py-1.5 text-sm text-ink-muted hover:text-ink"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={!canDelete}
              className="rounded-md bg-bad px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
            >
              {deleting ? 'Deleting…' : 'Delete club'}
            </button>
          </>
        }
      >
        <label htmlFor="confirm-club-name" className="block text-xs font-medium text-ink-muted">
          Type <span className="font-semibold text-ink">{club.name}</span> to confirm
        </label>
        <input
          id="confirm-club-name"
          autoFocus
          value={typedName}
          onChange={(e) => setTypedName(e.target.value)}
          className={`mt-1 ${FIELD}`}
        />
      </Modal>
    </Card>
  )
}
