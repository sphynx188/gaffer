import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useOutletContext } from 'react-router-dom'
import {
  Copy,
  Eye,
  FolderMinus,
  FolderPlus,
  Info,
  Pencil,
  PenSquare,
  Shield,
  SlidersHorizontal,
  Trash2,
  UserCog,
} from 'lucide-react'
import { useStore } from '../store'
import { isLicensedDoc, selectMyRole } from '../store/slices/clubSlice'
import { useSession } from '../hooks/useSession'
import type { DrillPhaseOfPlay, Tactic } from '../store'
import { DRILL_PHASES_OF_PLAY, DRILL_PHASE_OF_PLAY_LABELS } from '../store'
import { formationLabel } from '../components/tactics/formationLabel'
import { TacticDetails } from '../components/tactics/TacticDetails'
import { formatClock } from '../components/design/timeline/cursor'
import { frameAt } from '../components/design/canvas/interpolate'
import { openingFrame } from '../components/library/openingFrame'
import { EmptyState } from '../components/ui/EmptyState'
import { Skeleton } from '../components/ui/Skeleton'
import { Badge } from '../components/ui/Badge'
import { Dropdown } from '../components/ui/Dropdown'
import { LibraryShell } from '../components/library/LibraryShell'
import { LibrarySidebar } from '../components/library/LibrarySidebar'
import { LibraryToolbar } from '../components/library/LibraryToolbar'
import {
  LibraryTable,
  LibraryTiles,
  type LibraryColumn,
  type LibraryItemView,
} from '../components/library/LibraryItems'
import { SelectionAction, SelectionBar } from '../components/library/SelectionBar'
import { AddToCollectionDialog } from '../components/library/AddToCollectionDialog'
import { CollectionAccessDialog, ConfirmDialog, TextPromptDialog } from '../components/library/CollectionDialogs'
import { buildLibraryPlaces, rootPlaceId } from '../components/library/libraryPlaces'
import { useLibraryPlace } from '../components/library/useLibraryPlace'
import { useLibrarySelection } from '../components/library/useLibrarySelection'
import { useLibrarySort, type LibrarySort } from '../components/library/useLibrarySort'
import type { RowMenuItem } from '../components/library/RowMenu'
import { useToast } from '../components/ui/useToast'
import type { LibraryOutletContext } from './LibraryLayout'

// `/library/tactics` — the tactics library, rebuilt 2026-08-28 on the shared
// file-manager pieces in components/library/ so it and the drills tab are
// the same screen with different columns rather than two listings that
// happened to look alike (they had drifted: the drill tab grew a preview
// panel and a card grid, this one opened the editor on a plain click).
//
// ── One filter, not nine ──────────────────────────────────────────────────
// A tactic carries light metadata by design (decided 2026-08-26 — no
// equipment, intensity or age band), so there is nothing else to filter ON;
// search plus phase of play is the whole set. Search now covers name,
// description and both formation labels, so typing "4-3-3" still finds every
// tactic built on that shape even when none of them says so in its name.

const SKELETON_CARDS = [0, 1, 2, 3, 4, 5]

// Widths are real content budgets now, not Tailwind hints (see
// LibraryColumn.width). Formation got a little extra: "4-3-3 v 4-4-2" is
// the common case, but a coach's own custom formation name can run longer,
// and it now truncates cleanly with a tooltip instead of quietly growing
// the column.
const TACTIC_COLUMNS: LibraryColumn[] = [
  { key: 'formation', label: 'Formation', sortable: true, width: 140, visibilityClassName: 'hidden md:table-cell' },
  { key: 'phase', label: 'Phase', sortable: true, width: 112, visibilityClassName: 'hidden lg:table-cell' },
  { key: 'duration', label: 'Duration', sortable: true, width: 80, visibilityClassName: 'hidden sm:table-cell' },
  { key: 'created', label: 'Added', sortable: true, naturalDir: 'desc', width: 96, visibilityClassName: 'hidden xl:table-cell' },
]

// Dropped while the details rail is open — see DrillLibrary's note.
const COMPACT_COLUMN_KEYS = ['formation', 'duration']

const TACTIC_SORT_OPTIONS = [
  { value: 'name', label: 'Name' },
  { value: 'formation', label: 'Formation' },
  { value: 'phase', label: 'Phase of play' },
  { value: 'duration', label: 'Duration' },
  { value: 'created', label: 'Date added' },
]

const LAST_TEXT = '￿'

function compareTactics(a: Tactic, b: Tactic, sort: LibrarySort): number {
  const text = (v: string | null | undefined) => (v ?? LAST_TEXT).toLowerCase()
  let primary = 0
  switch (sort.key) {
    case 'formation':
      primary = formationLabel(a.sides.home.formation).localeCompare(formationLabel(b.sides.home.formation))
      break
    case 'phase':
      primary = text(a.phase_of_play).localeCompare(text(b.phase_of_play))
      break
    case 'duration':
      primary = a.duration_seconds - b.duration_seconds
      break
    case 'created':
      primary = a.created_at.localeCompare(b.created_at)
      break
    default:
      primary = a.name.localeCompare(b.name)
  }
  if (primary === 0) return a.name.localeCompare(b.name)
  return sort.dir === 'asc' ? primary : -primary
}

type LibraryDialog =
  | { kind: 'newCollection' }
  | { kind: 'renameCollection'; collectionId: string; name: string }
  | { kind: 'deleteCollection'; collectionId: string; name: string }
  | { kind: 'access'; collectionId: string; name: string }
  | { kind: 'addToCollection'; ids: string[] }
  | { kind: 'renameTactic'; id: string; name: string }
  | { kind: 'deleteTactics'; ids: string[] }

export function TacticsPage() {
  const { view, setView } = useOutletContext<LibraryOutletContext>()
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
  const updateTactic = useStore((s) => s.updateTactic)
  const duplicateTactic = useStore((s) => s.duplicateTactic)
  const deleteTactic = useStore((s) => s.deleteTactic)
  const createCollection = useStore((s) => s.createCollection)
  const updateCollection = useStore((s) => s.updateCollection)
  const deleteCollection = useStore((s) => s.deleteCollection)
  const addTacticToCollection = useStore((s) => s.addTacticToCollection)
  const removeTacticFromCollection = useStore((s) => s.removeTacticFromCollection)
  const showToast = useToast()

  const { placeId, setPlaceId } = useLibraryPlace(rootPlaceId(isAdmin))
  const [query, setQuery] = useState('')
  const [phaseOfPlay, setPhaseOfPlay] = useState<DrillPhaseOfPlay | ''>('')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [dialog, setDialog] = useState<LibraryDialog | null>(null)
  const { sort, toggleSort, setSort } = useLibrarySort('gaffer-library-sort-tactics', { key: 'name', dir: 'asc' })

  // Club tenancy (2026-08-28): fetchTactics takes no scope argument any more
  // (RLS decides visibility) — selectedClubId stays a dependency purely so
  // switching clubs re-triggers a refetch.
  useEffect(() => {
    void fetchTactics()
  }, [fetchTactics, selectedClubId])

  useEffect(() => {
    void fetchClubData()
  }, [fetchClubData, selectedClubId])

  const licensedCollectionIds = useMemo(
    () => new Set(licensesIn.filter((l) => !l.revoked_at).map((l) => l.collection_id)),
    [licensesIn]
  )

  // Names the caller's own folder when they aren't an admin — "Max's
  // drills" rather than "My drills". Falls back to "My …" when the club
  // membership hasn't loaded yet or carries no display name.
  const myDisplayName = clubMembers.find((m) => m.user_id === myUserId)?.display_name ?? null

  const places = useMemo(
    () =>
      buildLibraryPlaces({
        docs: tactics,
        collections,
        collectionDocIds: collectionTacticIds,
        licensedCollectionIds,
        selectedClubId,
        myUserId,
        isAdmin,
        members: clubMembers,
        myDisplayName,
        kind: 'tactic',
        docLabel: 'tactics',
      }),
    [myDisplayName, tactics, collections, collectionTacticIds, licensedCollectionIds, selectedClubId, myUserId, isAdmin, clubMembers]
  )

  const place = places.find((p) => p.id === placeId) ?? places[0]
  const root = places[0].id

  const placeTactics = useMemo(() => {
    const ids = new Set(place.ids)
    return tactics.filter((t) => ids.has(t.id))
  }, [tactics, place])

  const matched = useMemo(() => {
    const q = query.trim().toLowerCase()
    return placeTactics.filter((tactic) => {
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
  }, [placeTactics, query, phaseOfPlay])

  const sorted = useMemo(() => [...matched].sort((a, b) => compareTactics(a, b, sort)), [matched, sort])
  const orderedIds = useMemo(() => sorted.map((t) => t.id), [sorted])
  const selection = useLibrarySelection(orderedIds)

  const activeTactic = activeId ? (tactics.find((t) => t.id === activeId) ?? null) : null

  // club_id === selectedClubId is a hard precondition — see clubSlice's
  // canEditDoc comment for why: without it, a tactic you created stays
  // "yours to edit" even from a club it's merely licensed into.
  const canEdit = (tactic: Tactic) =>
    tactic.club_id === selectedClubId && (isAdmin || tactic.created_by === myUserId)

  // Only this club's own tactic-kind collections — collection_tactic's RLS
  // checks collection.kind = 'tactic' since migration 032, and requires
  // is_club_admin, which is why filing is admin-only here too.
  const homeCollections = useMemo(
    () =>
      collections
        .filter((c) => c.club_id === selectedClubId && c.kind === 'tactic')
        .sort((a, b) => a.name.localeCompare(b.name)),
    [collections, selectedClubId]
  )

  const collectionNamesFor = (tacticId: string) =>
    homeCollections.filter((c) => (collectionTacticIds[c.id] ?? []).includes(tacticId)).map((c) => c.name)

  const openTactic = (id: string) => {
    const tactic = tactics.find((t) => t.id === id)
    if (!tactic) return
    navigate(canEdit(tactic) ? `/tactics/${tactic.id}` : `/tactics/${tactic.id}/view`)
  }

  const handleActivate = (id: string) => {
    selection.clear()
    setActiveId((current) => (current === id ? null : id))
  }

  const handleDuplicate = async (tacticId: string) => {
    const created = await duplicateTactic(tacticId)
    if (created) {
      setActiveId(created.id)
      showToast(`Duplicated as "${created.name}"`)
    }
  }

  const handleAddToCollection = async (collectionId: string, ids: string[]) => {
    for (const id of ids) await addTacticToCollection(collectionId, id)
    const name = homeCollections.find((c) => c.id === collectionId)?.name ?? 'the collection'
    showToast(`Added ${ids.length} ${ids.length === 1 ? 'tactic' : 'tactics'} to ${name}`)
    selection.clear()
  }

  const handleCreateAndAdd = async (name: string, ids: string[]) => {
    const created = await createCollection(name, null, 'tactic')
    if (!created) return
    for (const id of ids) await addTacticToCollection(created.id, id)
    showToast(`Added ${ids.length} ${ids.length === 1 ? 'tactic' : 'tactics'} to ${created.name}`)
    selection.clear()
  }

  const handleRemoveFromPlace = async (ids: string[]) => {
    if (!place.collectionId) return
    for (const id of ids) await removeTacticFromCollection(place.collectionId, id)
    showToast(`Removed ${ids.length} ${ids.length === 1 ? 'tactic' : 'tactics'} from ${place.title}`)
    selection.clear()
  }

  const handleDeleteTactics = async (ids: string[]) => {
    let deleted = 0
    for (const id of ids) {
      if (await deleteTactic(id)) deleted++
    }
    if (ids.includes(activeId ?? '')) setActiveId(null)
    showToast(`Deleted ${deleted} ${deleted === 1 ? 'tactic' : 'tactics'}`)
    selection.clear()
  }

  const rowMenu = (tactic: Tactic): RowMenuItem[] => {
    const editable = canEdit(tactic)
    const items: RowMenuItem[] = [
      {
        key: 'open',
        label: editable ? 'Open' : 'View',
        icon: editable ? PenSquare : Eye,
        onSelect: () => openTactic(tactic.id),
      },
      { key: 'details', label: 'Details', icon: Info, onSelect: () => handleActivate(tactic.id) },
    ]
    // Licensed-in is view-only — no duplicating another club's tactic into
    // ours. A same-club tactic a plain coach doesn't own stays duplicable.
    if (!isLicensedDoc(tactic, selectedClubId)) {
      items.push({ key: 'duplicate', label: 'Duplicate', icon: Copy, onSelect: () => void handleDuplicate(tactic.id) })
    }
    if (editable) {
      items.push({
        key: 'rename',
        label: 'Rename',
        icon: Pencil,
        onSelect: () => setDialog({ kind: 'renameTactic', id: tactic.id, name: tactic.name }),
      })
    }
    if (isAdmin) {
      items.push({
        key: 'file',
        label: 'Add to collection…',
        icon: FolderPlus,
        onSelect: () => setDialog({ kind: 'addToCollection', ids: [tactic.id] }),
      })
      if (place.kind === 'collection' && place.collectionId) {
        items.push({
          key: 'unfile',
          // Not `Remove from ${place.title}`: a long collection name
          // truncated inside the menu, and you're standing in the folder
          // the item is being removed from anyway.
          label: 'Remove from collection',
          icon: FolderMinus,
          onSelect: () => void handleRemoveFromPlace([tactic.id]),
        })
      }
    }
    if (editable) {
      items.push({
        key: 'delete',
        label: 'Delete',
        icon: Trash2,
        danger: true,
        onSelect: () => setDialog({ kind: 'deleteTactics', ids: [tactic.id] }),
      })
    }
    return items
  }

  const items: LibraryItemView[] = sorted.map((tactic) => {
    const players = tactic.scene.entities.filter((e) => e.kind === 'player').length
    return {
      id: tactic.id,
      name: tactic.name,
      thumbnailUrl: tactic.thumbnail_url,
      preview: openingFrame(tactic, frameAt),
      icon: Shield,
      subtitle: tactic.description,
      // The pair a coach actually reads a tactic by — "our 4-3-3 against
      // their 4-4-2" — kept on the tile and the narrow row.
      badge: <Badge tone="neutral">{formationLabel(tactic.sides.home.formation)}</Badge>,
      metaLine:
        [
          `v ${formationLabel(tactic.sides.away.formation)}`,
          tactic.phase_of_play ? DRILL_PHASE_OF_PLAY_LABELS[tactic.phase_of_play] : null,
          formatClock(tactic.duration_seconds),
          `${players} on the board`,
        ]
          .filter(Boolean)
          .join(' · ') || null,
      cells: {
        formation: `${formationLabel(tactic.sides.home.formation)} v ${formationLabel(tactic.sides.away.formation)}`,
        phase: tactic.phase_of_play ? DRILL_PHASE_OF_PLAY_LABELS[tactic.phase_of_play] : null,
        duration: formatClock(tactic.duration_seconds),
        created: new Date(tactic.created_at).toLocaleDateString(),
      },
      menu: rowMenu(tactic),
    }
  })

  const columns = activeId ? TACTIC_COLUMNS.filter((c) => COMPACT_COLUMN_KEYS.includes(c.key)) : TACTIC_COLUMNS

  const selectedIds = [...selection.selected]
  const deletableSelected = selectedIds.filter((id) => {
    const tactic = tactics.find((t) => t.id === id)
    return tactic ? canEdit(tactic) : false
  })

  const collectionMenu = (collectionId: string): RowMenuItem[] => {
    const collection = homeCollections.find((c) => c.id === collectionId)
    if (!collection) return []
    return [
      {
        key: 'rename',
        label: 'Rename',
        icon: Pencil,
        onSelect: () => setDialog({ kind: 'renameCollection', collectionId, name: collection.name }),
      },
      {
        key: 'access',
        label: 'Coach access…',
        icon: UserCog,
        onSelect: () => setDialog({ kind: 'access', collectionId, name: collection.name }),
      },
      {
        key: 'delete',
        label: 'Delete collection',
        icon: Trash2,
        danger: true,
        onSelect: () => setDialog({ kind: 'deleteCollection', collectionId, name: collection.name }),
      },
    ]
  }

  if (tacticsLoading && tactics.length === 0) {
    return (
      <div role="status" aria-busy="true" className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <span className="sr-only">Loading tactics…</span>
        {SKELETON_CARDS.map((card) => (
          <Skeleton key={card} className="aspect-[4/3] w-full rounded-lg" />
        ))}
      </div>
    )
  }

  if (tacticsError) return <p className="text-sm text-bad">{tacticsError}</p>

  if (tactics.length === 0) {
    return <EmptyState icon={Shield} message="No tactics yet." action={{ to: '/tactics/new', label: 'Build one →' }} />
  }

  const narrowed = query.trim() !== '' || phaseOfPlay !== ''

  return (
    <>
      <LibraryShell
        placeTitle={place.title}
        details={
          activeTactic ? (
            <TacticDetails
              key={activeTactic.id}
              tactic={activeTactic}
              canEdit={canEdit(activeTactic)}
              canDuplicate={!isLicensedDoc(activeTactic, selectedClubId)}
              canFile={isAdmin}
              collectionNames={collectionNamesFor(activeTactic.id)}
              onClose={() => setActiveId(null)}
              onDuplicate={() => handleDuplicate(activeTactic.id)}
              onDelete={() => setDialog({ kind: 'deleteTactics', ids: [activeTactic.id] })}
              onAddToCollection={() => setDialog({ kind: 'addToCollection', ids: [activeTactic.id] })}
            />
          ) : null
        }
        onCloseDetails={() => setActiveId(null)}
        sidebar={
          <LibrarySidebar
            places={places}
            activePlaceId={place.id}
            onSelectPlace={(id) => {
              setPlaceId(id)
              setActiveId(null)
              // Walking into another folder ends the selection you made in
              // the last one — a tick that survives a navigation is a bulk
              // action waiting to surprise someone.
              selection.clear()
            }}
            isAdmin={isAdmin}
            onNewCollection={() => setDialog({ kind: 'newCollection' })}
            collectionMenu={collectionMenu}
          />
        }
      >
        <LibraryToolbar
          rootLabel="Tactics"
          placeTitle={place.title}
          isRoot={place.id === root}
          onNavigateRoot={() => setPlaceId(root)}
          query={query}
          onQueryChange={setQuery}
          searchPlaceholder="Search name, description or formation…"
          view={view}
          onViewChange={setView}
          sort={sort}
          sortOptions={TACTIC_SORT_OPTIONS}
          onSortKeyChange={(key) => setSort({ key, dir: key === 'created' ? 'desc' : 'asc' })}
          onToggleSortDir={() => setSort({ ...sort, dir: sort.dir === 'asc' ? 'desc' : 'asc' })}
          shownCount={sorted.length}
          totalCount={place.ids.length}
          placeNote={place.kind === 'licensed' ? 'Licensed to this club — read-only.' : undefined}
          filters={
            <TacticFilters
              phaseOfPlay={phaseOfPlay}
              onChange={setPhaseOfPlay}
              open={filtersOpen}
              onToggle={() => setFiltersOpen((v) => !v)}
            />
          }
        />

        {sorted.length === 0 ? (
          <EmptyState
            icon={Shield}
            message={
              narrowed
                ? 'Nothing here matches that search.'
                : place.kind === 'collection'
                  ? 'This collection is empty. Select tactics anywhere in the library and use "Add to collection".'
                  : 'Nothing here yet.'
            }
          />
        ) : view === 'list' ? (
          <LibraryTable
            items={items}
            columns={columns}
            sort={sort}
            onSort={toggleSort}
            selected={selection.selected}
            activeId={activeId}
            onToggle={selection.toggle}
            onToggleAll={() => (selection.allSelected ? selection.clear() : selection.selectAll())}
            allSelected={selection.allSelected}
            onActivate={handleActivate}
            onOpen={openTactic}
          />
        ) : (
          <LibraryTiles
            items={items}
            selected={selection.selected}
            activeId={activeId}
            onToggle={selection.toggle}
            onActivate={handleActivate}
            onOpen={openTactic}
          />
        )}
      </LibraryShell>

      <SelectionBar count={selection.count} noun="tactic" onClear={selection.clear}>
        {isAdmin && (
          <SelectionAction
            icon={FolderPlus}
            label="Add to collection"
            onClick={() => setDialog({ kind: 'addToCollection', ids: selectedIds })}
          />
        )}
        {isAdmin && place.kind === 'collection' && (
          <SelectionAction
            icon={FolderMinus}
            label="Remove from folder"
            onClick={() => void handleRemoveFromPlace(selectedIds)}
          />
        )}
        <SelectionAction
          icon={Trash2}
          label="Delete"
          danger
          disabled={deletableSelected.length === 0}
          onClick={() => setDialog({ kind: 'deleteTactics', ids: deletableSelected })}
        />
      </SelectionBar>

      {/* Mounted only while open — see DrillLibrary's identical block for
          why (fields seed from props at mount, no reset-on-reopen effect). */}
      {dialog?.kind === 'newCollection' && (
        <TextPromptDialog
          open
          onClose={() => setDialog(null)}
          title="New collection"
          label="Name"
          placeholder="e.g. Set pieces"
          submitLabel="Create"
          onSubmit={async (name) => {
            const created = await createCollection(name, null, 'tactic')
            if (created) {
              showToast(`Created "${created.name}"`)
              setPlaceId(`c:${created.id}`)
            }
          }}
        />
      )}
      {dialog?.kind === 'renameCollection' && (
        <TextPromptDialog
          open
          onClose={() => setDialog(null)}
          title="Rename collection"
          label="Name"
          initialValue={dialog.name}
          submitLabel="Rename"
          onSubmit={async (name) => {
            await updateCollection(dialog.collectionId, { name })
          }}
        />
      )}
      {dialog?.kind === 'renameTactic' && (
        <TextPromptDialog
          open
          onClose={() => setDialog(null)}
          title="Rename tactic"
          label="Name"
          initialValue={dialog.name}
          submitLabel="Rename"
          onSubmit={async (name) => {
            await updateTactic(dialog.id, { name })
          }}
        />
      )}
      {dialog?.kind === 'deleteCollection' && (
        <ConfirmDialog
          open
          onClose={() => setDialog(null)}
          title="Delete collection"
          message={`Delete "${dialog.name}"? The tactics in it stay in the library — only the collection goes.`}
          confirmLabel="Delete collection"
          onConfirm={async () => {
            const deleted = await deleteCollection(dialog.collectionId)
            if (deleted) {
              showToast(`Deleted "${dialog.name}"`)
              if (place.collectionId === dialog.collectionId) setPlaceId(root)
            }
          }}
        />
      )}
      {dialog?.kind === 'deleteTactics' && (
        <ConfirmDialog
          open
          onClose={() => setDialog(null)}
          title={dialog.ids.length > 1 ? 'Delete tactics' : 'Delete tactic'}
          message={
            dialog.ids.length === 1
              ? `Delete "${tactics.find((t) => t.id === dialog.ids[0])?.name ?? 'this tactic'}"? Any session it's part of will drop it too — this can't be undone.`
              : `Delete ${dialog.ids.length} tactics? Any session they're part of will drop them too — this can't be undone.`
          }
          confirmLabel="Delete"
          onConfirm={() => handleDeleteTactics(dialog.ids)}
        />
      )}
      {dialog?.kind === 'addToCollection' && (
        <AddToCollectionDialog
          open
          onClose={() => setDialog(null)}
          collections={homeCollections}
          collectionDocIds={collectionTacticIds}
          count={dialog.ids.length}
          noun="tactic"
          onAdd={(collectionId) => handleAddToCollection(collectionId, dialog.ids)}
          onCreateAndAdd={(name) => handleCreateAndAdd(name, dialog.ids)}
        />
      )}
      {dialog?.kind === 'access' && (
        <CollectionAccessDialog
          open
          onClose={() => setDialog(null)}
          collectionId={dialog.collectionId}
          collectionName={dialog.name}
        />
      )}
    </>
  )
}

// One filter behind the same toggle the drills tab uses, so the two tabs'
// toolbars stay identical in shape even though one has eight more controls
// hiding behind it.
function TacticFilters({
  phaseOfPlay,
  onChange,
  open,
  onToggle,
}: {
  phaseOfPlay: DrillPhaseOfPlay | ''
  onChange: (value: DrillPhaseOfPlay | '') => void
  open: boolean
  onToggle: () => void
}) {
  const count = phaseOfPlay === '' ? 0 : 1
  return (
    <div className="relative">
      <button
        type="button"
        onClick={onToggle}
        aria-pressed={open}
        aria-expanded={open}
        className={
          'flex h-9 items-center gap-1.5 rounded-md border px-2.5 text-sm font-medium transition-colors ' +
          (open || count > 0 ? 'border-accent bg-accent/15 text-accent-ink' : 'border-line text-ink-muted hover:border-line-strong')
        }
      >
        <SlidersHorizontal className="h-3.5 w-3.5" />
        Filters
        {count > 0 && <span className="text-xs">({count})</span>}
      </button>
      {open && (
        // Right-aligned — same overflow this trigger shares with DrillLibrary's
        // DrillFilters (both sit toward the right end of the toolbar): see
        // that component's comment for why `left-0` pushed the popover past
        // the viewport edge and forced a page-wide horizontal scrollbar.
        <div className="absolute right-0 top-full z-30 mt-1.5 w-64 rounded-lg border border-line bg-panel p-3 shadow-xl">
          <label className="block text-xs font-medium text-ink-muted">Phase of play</label>
          <div className="mt-1">
            <Dropdown
              value={phaseOfPlay}
              onChange={(v) => onChange(v as DrillPhaseOfPlay | '')}
              options={[
                { value: '', label: 'Any phase' },
                ...DRILL_PHASES_OF_PLAY.map((p) => ({ value: p, label: DRILL_PHASE_OF_PLAY_LABELS[p] })),
              ]}
              searchable={false}
              ariaLabel="Phase of play"
              triggerClassName="h-9 w-full"
            />
          </div>
          <div className="mt-3 flex items-center justify-between">
            <button
              type="button"
              onClick={() => onChange('')}
              disabled={count === 0}
              className="text-sm text-ink-muted transition-colors hover:text-ink disabled:opacity-40"
            >
              Clear
            </button>
            <button type="button" onClick={onToggle} className="text-sm font-medium text-accent-ink">
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
