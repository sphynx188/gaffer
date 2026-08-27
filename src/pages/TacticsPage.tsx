import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate, useOutletContext } from 'react-router-dom'
import { Shield, Trash2 } from 'lucide-react'
import { useStore } from '../store'
import { selectMyRole } from '../store/slices/clubSlice'
import { useSession } from '../hooks/useSession'
import type { LibraryView } from '../hooks/useLibraryView'
import type { DrillPhaseOfPlay, Tactic } from '../store'
import { DRILL_PHASES_OF_PLAY, DRILL_PHASE_OF_PLAY_LABELS } from '../store'
import { FORMATIONS } from '../components/tactics/formations'
import { formatClock } from '../components/design/timeline/cursor'
import { Card } from '../components/ui/Card'
import { EmptyState } from '../components/ui/EmptyState'
import { Skeleton } from '../components/ui/Skeleton'
import { Badge } from '../components/ui/Badge'
import { Dropdown } from '../components/ui/Dropdown'
import { LibraryGroups } from '../components/design/LibraryGroups'
import { buildLibraryGroups } from '../components/design/buildLibraryGroups'
import type { LibraryOutletContext } from './LibraryLayout'

// `/library/tactics` — the tactics library (TACTICS_BOARD_REWORK_PLAN.md
// Stage 9.1): "card grid reusing DrillLibrary.tsx's patterns: thumbnail,
// name, formation badge per side, phase count, duration." Nested under
// LibraryLayout (2026-08-28) alongside DrillLibraryPage — its own
// PageHeader moved up to the shared layout, same convention as
// AdminLayout's sub-pages.
//
// It replaces the plain list Stage 7.1 left here when the board moved out to
// `/tactics/:tacticId`. The create form stays — unlike drills, which are
// built in Design and merely browsed in the library, a tactic has no other
// front door, so taking creation away would leave the coach nowhere to start.
//
// ── Two filters, not nine ─────────────────────────────────────────────────
// The plan asks for exactly "name and phase of play", and that is all there
// is here. A tactic carries light metadata by design (decided 2026-08-26 —
// no equipment, intensity or age band), so there is nothing else to filter
// ON; `DrillLibrary`'s other seven filters have no counterpart to read. Both
// are client-side over the array already in the store, the same call
// DrillLibrary makes and for the same reason: the scale is tens of rows.

const SKELETON_CARDS = [0, 1, 2, 3, 4, 5]

const FIELD =
  'h-11 w-full rounded-md border border-line bg-panel-raised px-2 text-sm text-ink outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/30 lg:h-9'

/** A built-in formation's label, or the stored key for a coach's own shape. */
function formationLabel(key: string): string {
  return FORMATIONS.find((f) => f.key === key)?.label ?? key
}

export function TacticsPage() {
  const { view } = useOutletContext<LibraryOutletContext>()
  const navigate = useNavigate()
  const { session } = useSession()
  const myUserId = session?.user.id ?? null
  const selectedClubId = useStore((s) => s.selectedClubId)
  const isAdmin = useStore((s) => selectMyRole(s) === 'admin')
  const clubMembers = useStore((s) => s.clubMembers)
  const collections = useStore((s) => s.collections)
  const collectionTacticIds = useStore((s) => s.collectionTacticIds)
  const licensesIn = useStore((s) => s.licensesIn)
  const fetchClubData = useStore((s) => s.fetchClubData)
  const tactics = useStore((s) => s.tactics)
  const tacticsLoading = useStore((s) => s.tacticsLoading)
  const tacticsError = useStore((s) => s.tacticsError)
  const fetchTactics = useStore((s) => s.fetchTactics)
  const createTactic = useStore((s) => s.createTactic)

  const [name, setName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [query, setQuery] = useState('')
  const [phaseOfPlay, setPhaseOfPlay] = useState<DrillPhaseOfPlay | ''>('')

  // Club tenancy (2026-08-28): fetchTactics takes no scope argument any
  // more (RLS decides visibility) — selectedClubId stays a dependency
  // purely so switching clubs re-triggers a refetch, same reasoning as
  // DrillLibrary's identical pair of effects.
  useEffect(() => {
    void fetchTactics()
  }, [fetchTactics, selectedClubId])

  useEffect(() => {
    void fetchClubData()
  }, [fetchClubData, selectedClubId])

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault()
    if (!name.trim() || submitting) return
    setSubmitting(true)
    const created = await createTactic({ name: name.trim() })
    setSubmitting(false)
    if (created) {
      setName('')
      navigate(`/tactics/${created.id}`)
    }
  }

  // Name search also matches the two formation labels, so typing "4-3-3"
  // finds every tactic built on that shape even when none of them says so in
  // its name — the same reason DrillLibrary keeps the pitch label in scope.
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return tactics.filter((tactic) => {
      if (phaseOfPlay && tactic.phase_of_play !== phaseOfPlay) return false
      if (!q) return true
      const haystack = [
        tactic.name,
        tactic.description ?? '',
        formationLabel(tactic.sides.home.formation),
        formationLabel(tactic.sides.away.formation),
      ]
        .join(' ')
        .toLowerCase()
      return haystack.includes(q)
    })
  }, [tactics, query, phaseOfPlay])

  const filtersActive = query.trim() !== '' || phaseOfPlay !== ''

  // Keyed on an actual active license, not "club_id !== selectedClubId" —
  // see DrillLibrary.tsx's identical fix for why (found live in Task 10).
  const licensedCollectionIds = useMemo(
    () => new Set(licensesIn.filter((l) => !l.revoked_at).map((l) => l.collection_id)),
    [licensesIn]
  )

  const groups = useMemo(
    () =>
      buildLibraryGroups({
        docs: filtered,
        collections,
        collectionDocIds: collectionTacticIds,
        licensedCollectionIds,
        selectedClubId,
        myUserId,
        isAdmin,
        members: clubMembers,
        docLabel: 'tactics',
      }),
    [filtered, collections, collectionTacticIds, licensedCollectionIds, selectedClubId, myUserId, isAdmin, clubMembers]
  )

  return (
    <Card>
      <div className="space-y-4">
        <form onSubmit={handleCreate} className="flex flex-wrap items-end gap-2">
            <div>
              <label htmlFor="new-tactic-name" className="block text-xs font-medium text-ink-muted">
                New tactic name
              </label>
              <input
                id="new-tactic-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. 4-3-3 — Build Up"
                className="mt-1 w-56 rounded-md border border-line bg-panel-raised px-2 py-1.5 text-sm text-ink outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/30"
              />
            </div>
            <button
              type="submit"
              disabled={!name.trim() || submitting}
              className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50"
            >
              {submitting ? 'Creating…' : 'Create tactic'}
            </button>
          </form>

          {tacticsError && <p className="text-sm text-bad">{tacticsError}</p>}

          {tacticsLoading && tactics.length === 0 && (
            <div role="status" aria-busy="true" className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <span className="sr-only">Loading tactics…</span>
              {SKELETON_CARDS.map((card) => (
                <Skeleton key={card} className="aspect-[4/3] w-full rounded-lg" />
              ))}
            </div>
          )}

          {!tacticsLoading && tactics.length === 0 && !tacticsError && (
            <EmptyState icon={Shield} message="No tactics yet — create one above." />
          )}

          {tactics.length > 0 && (
            <>
              <div className="flex flex-wrap items-end gap-2">
                <div className="min-w-48 flex-1">
                  <label htmlFor="tactic-search" className="block text-xs font-medium text-ink-muted">
                    Search
                  </label>
                  <input
                    id="tactic-search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Name, description or formation"
                    className={`${FIELD} mt-1`}
                  />
                </div>
                <div className="w-44">
                  <label className="block text-xs font-medium text-ink-muted">Phase of play</label>
                  <div className="mt-1">
                    <Dropdown
                      value={phaseOfPlay}
                      onChange={(v) => setPhaseOfPlay(v as DrillPhaseOfPlay | '')}
                      options={[
                        { value: '', label: 'Any phase' },
                        ...DRILL_PHASES_OF_PLAY.map((p) => ({ value: p, label: DRILL_PHASE_OF_PLAY_LABELS[p] })),
                      ]}
                      searchable={false}
                      ariaLabel="Phase of play"
                      triggerClassName="h-11 w-full lg:h-9"
                    />
                  </div>
                </div>
                {filtersActive && (
                  <button
                    type="button"
                    onClick={() => {
                      setQuery('')
                      setPhaseOfPlay('')
                    }}
                    className="h-11 px-2 text-sm text-ink-muted hover:text-ink lg:h-9"
                  >
                    Clear
                  </button>
                )}
              </div>

              {filtered.length === 0 ? (
                <p className="text-sm text-ink-muted">No tactics match these filters.</p>
              ) : (
                <LibraryGroups
                  groups={groups}
                  view={view}
                  renderCard={(id) => {
                    const tactic = filtered.find((t) => t.id === id)
                    if (!tactic) return null
                    const canEdit = (isAdmin && tactic.club_id === selectedClubId) || tactic.created_by === myUserId
                    return <TacticCardTile tactic={tactic} canEdit={canEdit} view={view} />
                  }}
                />
              )}
            </>
          )}
        </div>
    </Card>
  )
}

function TacticCardTile({ tactic, canEdit, view }: { tactic: Tactic; canEdit: boolean; view: LibraryView }) {
  const deleteTactic = useStore((s) => s.deleteTactic)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const players = tactic.scene.entities.filter((e) => e.kind === 'player').length
  const meta = [
    formatClock(tactic.duration_seconds),
    tactic.phases.length > 0 ? `${tactic.phases.length} phase${tactic.phases.length === 1 ? '' : 's'}` : null,
    `${players} on the board`,
  ].filter((part): part is string => part != null)

  const handleDelete = async () => {
    if (deleting) return
    setDeleting(true)
    const deleted = await deleteTactic(tactic.id)
    setDeleting(false)
    if (deleted) setConfirmingDelete(false)
  }

  if (confirmingDelete) {
    return (
      <div
        className={
          'flex w-full flex-col justify-between gap-2 rounded-lg border border-bad/30 bg-bad/10 p-3 ' +
          (view === 'grid' ? 'h-full sm:flex-row sm:items-center' : 'sm:flex-row sm:items-center')
        }
      >
        <p className="text-sm text-bad">
          Delete <span className="font-medium">{tactic.name}</span>? Any session it's part of will drop it too —
          this can&rsquo;t be undone.
        </p>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            className="rounded-md bg-bad px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
          >
            {deleting ? 'Deleting…' : 'Delete tactic'}
          </button>
          <button
            type="button"
            onClick={() => setConfirmingDelete(false)}
            disabled={deleting}
            className="px-2 py-1.5 text-sm text-ink-muted"
          >
            Cancel
          </button>
        </div>
      </div>
    )
  }

  const deleteButton = canEdit && (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        setConfirmingDelete(true)
      }}
      title="Delete tactic"
      aria-label="Delete tactic"
      className={
        view === 'grid'
          ? 'absolute right-2 top-2 z-10 rounded-md bg-panel/80 p-1.5 text-ink-muted transition-colors hover:text-bad'
          : 'shrink-0 rounded-md p-1.5 text-ink-muted transition-colors hover:text-bad'
      }
    >
      <Trash2 className="h-3.5 w-3.5" />
    </button>
  )

  // A badge per side, which is the pair a coach actually reads a tactic by —
  // "our 4-3-3 against their 4-4-2".
  const formationBadges = (
    <>
      <Badge tone="neutral">{formationLabel(tactic.sides.home.formation)}</Badge>
      <Badge tone="neutral">v {formationLabel(tactic.sides.away.formation)}</Badge>
      {tactic.phase_of_play && <Badge tone="neutral">{DRILL_PHASE_OF_PLAY_LABELS[tactic.phase_of_play]}</Badge>}
    </>
  )

  if (view === 'list') {
    // No thumbnail here on purpose (2026-08-28) — list view is for
    // scanning/searching text fast, so formation badges that were hidden on
    // small screens in the compact row now always show, alongside the
    // tactic's description when it has one.
    return (
      <Link
        to={canEdit ? `/tactics/${tactic.id}` : `/tactics/${tactic.id}/view`}
        className="flex w-full flex-col gap-1 rounded-lg border border-line px-3 py-2.5 text-left transition-colors hover:border-accent/40 hover:bg-accent/5"
      >
        <div className="flex items-start justify-between gap-2">
          <p className="truncate text-sm font-medium text-ink">{tactic.name}</p>
          {deleteButton}
        </div>
        {tactic.description && <p className="truncate text-xs text-ink-muted">{tactic.description}</p>}
        <div className="flex flex-wrap items-center gap-1.5">
          {formationBadges}
          <span className="text-xs text-ink-faint">{meta.join(' · ')}</span>
        </div>
      </Link>
    )
  }

  return (
    <Link
      to={canEdit ? `/tactics/${tactic.id}` : `/tactics/${tactic.id}/view`}
      className="relative flex w-full flex-col gap-2 rounded-lg border border-line p-3 text-left transition-colors hover:border-accent/40 hover:bg-accent/5"
    >
      {deleteButton}
      <div className="flex aspect-video items-center justify-center overflow-hidden rounded-md bg-panel-raised">
        {tactic.thumbnail_url ? (
          <img src={tactic.thumbnail_url} alt={`${tactic.name} board`} className="h-full w-full object-cover" />
        ) : (
          <Shield className="h-6 w-6 text-ink-faint" />
        )}
      </div>
      <div className="min-w-0 space-y-1">
        <p className="truncate text-sm font-medium text-ink">{tactic.name}</p>
        <div className="flex flex-wrap gap-1">{formationBadges}</div>
        <p className="truncate text-xs text-ink-muted">{meta.join(' · ')}</p>
      </div>
    </Link>
  )
}
