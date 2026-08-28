import { useEffect, useMemo, useState } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import { CheckSquare, FolderCog, Shield, SlidersHorizontal, Square, Trash2 } from 'lucide-react'
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
import { AddToCollectionBar } from '../components/design/AddToCollectionBar'
import { CollectionManagerPanel } from '../components/design/CollectionManagerPanel'
import { useToast } from '../components/ui/useToast'
import type { LibraryOutletContext } from './LibraryLayout'

// `/library/tactics` — the tactics library (TACTICS_BOARD_REWORK_PLAN.md
// Stage 9.1): "card grid reusing DrillLibrary.tsx's patterns: thumbnail,
// name, formation badge per side, phase count, duration." Nested under
// LibraryLayout (2026-08-28) alongside DrillLibraryPage — its own
// PageHeader moved up to the shared layout, same convention as
// AdminLayout's sub-pages.
//
// It replaces the plain list Stage 7.1 left here when the board moved out to
// `/tactics/:tacticId`. The create form that used to live here moved out to
// `/tactics/new` (2026-08-28) — creation left both library tabs the same
// day, now that `/create` is the app's one front door for "start something
// new"; this tab is browse/organize only.
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
  const createCollection = useStore((s) => s.createCollection)
  const addTacticToCollection = useStore((s) => s.addTacticToCollection)
  const removeTacticFromCollection = useStore((s) => s.removeTacticFromCollection)
  const showToast = useToast()

  const [query, setQuery] = useState('')
  const [phaseOfPlay, setPhaseOfPlay] = useState<DrillPhaseOfPlay | ''>('')
  const [filtersOpen, setFiltersOpen] = useState(false)
  // Bulk-file mode (2026-08-28, admin-only) — see DrillLibrary.tsx's
  // identical pattern/comment for why this is a separate selection from
  // whatever a plain card click already means (navigate to the editor here).
  const [bulkMode, setBulkMode] = useState(false)
  const [bulkIds, setBulkIds] = useState<Set<string>>(new Set())
  const [manageOpen, setManageOpen] = useState(false)

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

  const activeFilterCount = (query.trim() !== '' ? 1 : 0) + (phaseOfPlay !== '' ? 1 : 0)

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

  const handleToggleBulk = (id: string) => {
    setBulkIds((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleCancelBulk = () => {
    setBulkMode(false)
    setBulkIds(new Set())
  }

  // Only this club's own tactic-kind collections — see DrillLibrary.tsx's
  // identical `homeCollections`/RLS note (collection_tactic's RLS checks
  // collection.kind = 'tactic' since migration 032).
  const homeCollections = useMemo(
    () =>
      collections
        .filter((c) => c.club_id === selectedClubId && c.kind === 'tactic')
        .sort((a, b) => a.name.localeCompare(b.name)),
    [collections, selectedClubId]
  )

  const handleAddExisting = async (collectionId: string) => {
    for (const id of bulkIds) await addTacticToCollection(collectionId, id)
    const targetName = homeCollections.find((c) => c.id === collectionId)?.name ?? 'the collection'
    showToast(`Added ${bulkIds.size} ${bulkIds.size === 1 ? 'tactic' : 'tactics'} to ${targetName}`)
    setBulkIds(new Set())
  }

  const handleCreateAndAdd = async (newCollectionName: string) => {
    const created = await createCollection(newCollectionName, null, 'tactic')
    if (!created) return
    for (const id of bulkIds) await addTacticToCollection(created.id, id)
    showToast(`Added ${bulkIds.size} ${bulkIds.size === 1 ? 'tactic' : 'tactics'} to ${created.name}`)
    setBulkIds(new Set())
  }

  return (
    <Card>
      <div className="space-y-4">
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
            <EmptyState icon={Shield} message="No tactics yet." action={{ to: '/tactics/new', label: 'Build one →' }} />
          )}

          {tactics.length > 0 && (
            <>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setFiltersOpen((v) => !v)}
                    aria-pressed={filtersOpen}
                    aria-expanded={filtersOpen}
                    className={
                      'flex h-9 items-center gap-1.5 rounded-md border px-2.5 text-sm font-medium transition-colors ' +
                      (filtersOpen || activeFilterCount > 0
                        ? 'border-accent bg-accent/15 text-accent'
                        : 'border-line text-ink-muted hover:border-line-strong')
                    }
                  >
                    <SlidersHorizontal className="h-3.5 w-3.5" />
                    Filters
                    {activeFilterCount > 0 && <span className="text-xs">({activeFilterCount})</span>}
                  </button>
                  {activeFilterCount > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setQuery('')
                        setPhaseOfPlay('')
                      }}
                      className="h-9 px-2 text-sm text-ink-muted hover:text-ink"
                    >
                      Clear
                    </button>
                  )}
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => (bulkMode ? handleCancelBulk() : setBulkMode(true))}
                      aria-pressed={bulkMode}
                      className={
                        'flex h-9 items-center gap-1.5 rounded-md border px-2.5 text-sm font-medium transition-colors ' +
                        (bulkMode ? 'border-accent bg-accent/15 text-accent' : 'border-line text-ink-muted hover:border-line-strong')
                      }
                    >
                      <CheckSquare className="h-3.5 w-3.5" />
                      {bulkMode ? 'Selecting…' : 'Select'}
                    </button>
                  )}
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => setManageOpen((v) => !v)}
                      aria-pressed={manageOpen}
                      aria-expanded={manageOpen}
                      className={
                        'flex h-9 items-center gap-1.5 rounded-md border px-2.5 text-sm font-medium transition-colors ' +
                        (manageOpen ? 'border-accent bg-accent/15 text-accent' : 'border-line text-ink-muted hover:border-line-strong')
                      }
                    >
                      <FolderCog className="h-3.5 w-3.5" />
                      Manage collections
                    </button>
                  )}
                </div>

                {manageOpen && (
                  <CollectionManagerPanel
                    kind="tactic"
                    docs={tactics}
                    collectionDocIds={collectionTacticIds}
                    onRemoveDoc={removeTacticFromCollection}
                  />
                )}

                {bulkMode && bulkIds.size > 0 && (
                  <AddToCollectionBar
                    count={bulkIds.size}
                    docNoun="tactic"
                    collections={homeCollections}
                    onAddExisting={handleAddExisting}
                    onCreateAndAdd={handleCreateAndAdd}
                    onCancel={handleCancelBulk}
                  />
                )}

                {filtersOpen && (
                  <div className="flex flex-wrap items-end gap-2 rounded-lg border border-line bg-panel-raised p-2">
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
                  </div>
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
                    return (
                      <TacticCardTile
                        tactic={tactic}
                        canEdit={canEdit}
                        view={view}
                        bulkMode={bulkMode}
                        bulkSelected={bulkIds.has(id)}
                        onToggleBulk={() => handleToggleBulk(id)}
                      />
                    )
                  }}
                />
              )}
            </>
          )}
        </div>
    </Card>
  )
}

function TacticCardTile({
  tactic,
  canEdit,
  view,
  bulkMode = false,
  bulkSelected = false,
  onToggleBulk,
}: {
  tactic: Tactic
  canEdit: boolean
  view: LibraryView
  bulkMode?: boolean
  bulkSelected?: boolean
  onToggleBulk?: () => void
}) {
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

  const deleteButton = canEdit && !bulkMode && (
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

  const checkbox = bulkMode &&
    (bulkSelected ? <CheckSquare className="h-4 w-4 shrink-0 text-accent" /> : <Square className="h-4 w-4 shrink-0 text-ink-faint" />)

  // A badge per side, which is the pair a coach actually reads a tactic by —
  // "our 4-3-3 against their 4-4-2".
  const formationBadges = (
    <>
      <Badge tone="neutral">{formationLabel(tactic.sides.home.formation)}</Badge>
      <Badge tone="neutral">v {formationLabel(tactic.sides.away.formation)}</Badge>
      {tactic.phase_of_play && <Badge tone="neutral">{DRILL_PHASE_OF_PLAY_LABELS[tactic.phase_of_play]}</Badge>}
    </>
  )

  // Bulk mode swaps the card from a navigating <Link> to a toggling
  // <button> — same shape DrillCard already used, since "select for filing"
  // and "open the editor" can't both own a click on the same element. Kept
  // as two explicit branches rather than a polymorphic `Wrapper` component:
  // <Link>'s and <button>'s prop types don't unify cleanly enough for a
  // shared spread to typecheck without a cast, and the content is identical
  // either way, so there's little to gain from forcing them into one.
  const listContent = (
    <>
      <div className="flex items-start justify-between gap-2">
        <span className="flex min-w-0 items-center gap-2">
          {checkbox}
          <p className="truncate text-sm font-medium text-ink">{tactic.name}</p>
        </span>
        {deleteButton}
      </div>
      {tactic.description && <p className="truncate text-xs text-ink-muted">{tactic.description}</p>}
      <div className="flex flex-wrap items-center gap-1.5">
        {formationBadges}
        <span className="text-xs text-ink-faint">{meta.join(' · ')}</span>
      </div>
    </>
  )

  const gridContent = (
    <>
      {deleteButton}
      <div className="flex aspect-video items-center justify-center overflow-hidden rounded-md bg-panel-raised">
        {tactic.thumbnail_url ? (
          <img src={tactic.thumbnail_url} alt={`${tactic.name} board`} className="h-full w-full object-cover" />
        ) : (
          <Shield className="h-6 w-6 text-ink-faint" />
        )}
      </div>
      <div className="min-w-0 space-y-1">
        <span className="flex min-w-0 items-center gap-2">
          {checkbox}
          <p className="truncate text-sm font-medium text-ink">{tactic.name}</p>
        </span>
        <div className="flex flex-wrap gap-1">{formationBadges}</div>
        <p className="truncate text-xs text-ink-muted">{meta.join(' · ')}</p>
      </div>
    </>
  )

  // No thumbnail in list view on purpose (2026-08-28) — list view is for
  // scanning/searching text fast, so formation badges that were hidden on
  // small screens in the compact row now always show, alongside the
  // tactic's description when it has one.
  const listClassName =
    'flex w-full flex-col gap-1 rounded-lg border border-line px-3 py-2.5 text-left transition-colors hover:border-accent/40 hover:bg-accent/5'
  const gridClassName =
    'relative flex w-full flex-col gap-2 rounded-lg border border-line p-3 text-left transition-colors hover:border-accent/40 hover:bg-accent/5'

  if (bulkMode) {
    return (
      <button
        type="button"
        onClick={onToggleBulk}
        aria-pressed={bulkSelected}
        className={view === 'list' ? listClassName : gridClassName}
      >
        {view === 'list' ? listContent : gridContent}
      </button>
    )
  }

  return (
    <Link
      to={canEdit ? `/tactics/${tactic.id}` : `/tactics/${tactic.id}/view`}
      className={view === 'list' ? listClassName : gridClassName}
    >
      {view === 'list' ? listContent : gridContent}
    </Link>
  )
}
