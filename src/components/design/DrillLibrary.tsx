import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useOutletContext } from 'react-router-dom'
import {
  Copy,
  Eye,
  FolderMinus,
  FolderPlus,
  Info,
  LibraryBig,
  Pencil,
  PenSquare,
  SlidersHorizontal,
  Trash2,
  UserCog,
} from 'lucide-react'
import { useStore } from '../../store'
import { selectMyRole } from '../../store/slices/clubSlice'
import { useSession } from '../../hooks/useSession'
import type { LibraryOutletContext } from '../../pages/LibraryLayout'
import type { Drill, DrillDifficulty, DrillIntensity, DrillPhaseOfPlay, SessionBlock } from '../../store'
import {
  DRILL_DIFFICULTIES,
  DRILL_DIFFICULTY_LABELS,
  DRILL_INTENSITIES,
  DRILL_INTENSITY_LABELS,
  DRILL_PHASES_OF_PLAY,
  DRILL_PHASE_OF_PLAY_LABELS,
  SESSION_BLOCKS,
  SESSION_BLOCK_LABELS,
} from '../../store'
import { formatDimensions, presetLabel } from './canvas/pitchPresets'
import { EmptyState } from '../ui/EmptyState'
import { Skeleton } from '../ui/Skeleton'
import { Dropdown } from '../ui/Dropdown'
import { DrillDetails } from './DrillDetails'
import { LibraryShell } from '../library/LibraryShell'
import { LibrarySidebar } from '../library/LibrarySidebar'
import { LibraryToolbar } from '../library/LibraryToolbar'
import { LibraryTable, LibraryTiles, type LibraryColumn, type LibraryItemView } from '../library/LibraryItems'
import { SelectionAction, SelectionBar } from '../library/SelectionBar'
import { AddToCollectionDialog } from '../library/AddToCollectionDialog'
import { CollectionAccessDialog, ConfirmDialog, TextPromptDialog } from '../library/CollectionDialogs'
import { buildLibraryPlaces, rootPlaceId } from '../library/libraryPlaces'
import { useLibraryPlace } from '../library/useLibraryPlace'
import { useLibrarySelection } from '../library/useLibrarySelection'
import { useLibrarySort, type LibrarySort } from '../library/useLibrarySort'
import type { RowMenuItem } from '../library/RowMenu'
import { useToast } from '../ui/useToast'

// Phase 3.1 — Drill library / browse & search (US-17), rebuilt 2026-08-28 as
// a file manager: a places rail on the left, one sortable list of whatever
// place you're standing in, and a details rail for the item you clicked.
// What it replaces was a single scroll of collapsible groups — "My drills",
// then every collection, then every coach — with a drill appearing in as
// many of them as it was filed in, no sort, search hidden behind a Filters
// toggle, and its preview panel pinned below the whole list. See
// libraryPlaces.ts for the model that swap turned on.
//
// Still entirely client-side (build guide 2b: "this scale doesn't need
// server-side search"). Every filter, the search box, the sort and the place
// all narrow or reorder the same `drills` array the fetch below loads;
// nothing here issues a second request.

const SKELETON_CARDS = [0, 1, 2, 3, 4, 5]

// `${pitch preset} · ${real dimensions}`, the same label the picker and the
// session planner show (rework plan Stage 7.6) — kept in search scope so
// typing "half" still surfaces every half-pitch drill even if none of their
// names mention it.
function pitchLabel(drill: Drill): string {
  return `${presetLabel(drill.pitch.preset)} · ${formatDimensions(drill.pitch.lengthMeters, drill.pitch.widthMeters, drill.pitch.units ?? 'm')}`
}

// `age_min`/`age_max` are free text (Stage 8 migration 016) rather than a
// fixed union — a coach's own "U10", "10-12", "Adult" shouldn't be frozen
// into a type here. The age filter below is built from whatever bands are
// actually present in the data instead of a hardcoded list.
function ageBandLabel(drill: Drill): string | null {
  if (drill.age_min && drill.age_max) return `${drill.age_min}–${drill.age_max}`
  return drill.age_min ?? drill.age_max ?? null
}

function playerCountLabel(drill: Drill): string | null {
  if (drill.min_players != null && drill.max_players != null) {
    return drill.min_players === drill.max_players
      ? `${drill.min_players} players`
      : `${drill.min_players}–${drill.max_players} players`
  }
  if (drill.players_recommended != null) return `${drill.players_recommended} players`
  return drill.min_players != null ? `${drill.min_players}+ players` : null
}

interface Filters {
  ageBand: string
  sessionBlock: SessionBlock | ''
  minPlayers: string
  difficulty: DrillDifficulty | ''
  intensity: DrillIntensity | ''
  phaseOfPlay: DrillPhaseOfPlay | ''
  category: string
  maxDurationMinutes: string
}

const EMPTY_FILTERS: Filters = {
  ageBand: '',
  sessionBlock: '',
  minPlayers: '',
  difficulty: '',
  intensity: '',
  phaseOfPlay: '',
  category: '',
  maxDurationMinutes: '',
}

function activeFilterCount(filters: Filters): number {
  return Object.values(filters).filter((v) => v !== '').length
}

// Columns drop out as the viewport narrows rather than the table scrolling
// forever: below `sm` the row falls back to its own metadata line (see
// LibraryItems), which carries the same facts in one string.
//
// Opening the details rail is the other kind of narrowing — it costs the
// list ~300px at a page width `<main>`'s max-w-6xl already caps — so the
// two lowest-value columns are dropped for as long as it's open, rather
// than letting five columns fight over half the room.
// Widths are real content budgets now, not Tailwind hints (see
// LibraryColumn.width) — Players got bumped from its old 96px: "10–14
// players" never fit that even before today's layout changes, it just
// silently grew past it under auto layout whenever the table had slack.
const DRILL_COLUMNS: LibraryColumn[] = [
  { key: 'category', label: 'Category', sortable: true, width: 112, visibilityClassName: 'hidden md:table-cell' },
  { key: 'duration', label: 'Duration', sortable: true, width: 80, visibilityClassName: 'hidden sm:table-cell' },
  { key: 'players', label: 'Players', sortable: true, width: 116, visibilityClassName: 'hidden lg:table-cell' },
  { key: 'created', label: 'Added', sortable: true, naturalDir: 'desc', width: 96, visibilityClassName: 'hidden xl:table-cell' },
]

const COMPACT_COLUMN_KEYS = ['category', 'duration']

const DRILL_SORT_OPTIONS = [
  { value: 'name', label: 'Name' },
  { value: 'category', label: 'Category' },
  { value: 'duration', label: 'Duration' },
  { value: 'players', label: 'Players' },
  { value: 'level', label: 'Level' },
  { value: 'created', label: 'Date added' },
]

// Nulls sort last whichever way the column is pointed — a drill with no
// duration recorded isn't "the shortest", it's unknown, and burying the
// unknowns at the bottom is what makes the first screen of a sort useful.
const LAST_TEXT = '￿'

function compareDrills(a: Drill, b: Drill, sort: LibrarySort): number {
  const text = (v: string | null | undefined) => (v ?? LAST_TEXT).toLowerCase()
  const num = (v: number | null | undefined) => (v == null ? Number.POSITIVE_INFINITY : v)
  let primary = 0
  switch (sort.key) {
    case 'category':
      primary = text(a.category).localeCompare(text(b.category))
      break
    case 'duration':
      primary = num(a.duration_minutes) - num(b.duration_minutes)
      break
    case 'players':
      primary = num(a.min_players ?? a.players_recommended) - num(b.min_players ?? b.players_recommended)
      break
    case 'level':
      primary =
        (a.difficulty ? DRILL_DIFFICULTIES.indexOf(a.difficulty) : Number.POSITIVE_INFINITY) -
        (b.difficulty ? DRILL_DIFFICULTIES.indexOf(b.difficulty) : Number.POSITIVE_INFINITY)
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
  | { kind: 'renameDrill'; id: string; name: string }
  | { kind: 'deleteDrills'; ids: string[] }

export function DrillLibrary() {
  const { view, setView } = useOutletContext<LibraryOutletContext>()
  const navigate = useNavigate()
  const { session } = useSession()
  const myUserId = session?.user.id ?? null
  const selectedClubId = useStore((s) => s.selectedClubId)
  const isAdmin = useStore((s) => selectMyRole(s) === 'admin')
  const clubMembers = useStore((s) => s.clubMembers)
  const collections = useStore((s) => s.collections)
  const collectionDrillIds = useStore((s) => s.collectionDrillIds)
  const licensesIn = useStore((s) => s.licensesIn)
  const fetchClubData = useStore((s) => s.fetchClubData)
  // A drill the coach opened from /design but never edited exists only in
  // local state — it has no row yet (drillSlice's startDrillDraft), so it is
  // not a library item and must not be listed as one. It disappears on its own
  // at the next reload; this keeps it out of the list until then. Discarding it
  // on the editor's unmount was tried first and is not safe: StrictMode's
  // mount/cleanup/mount would delete the draft between the two mounts, and the
  // editor then rendered "That drill isn't in your library."
  const isDrillDraft = useStore((s) => s.isDrillDraft)
  const allDrills = useStore((s) => s.drills)
  const drills = useMemo(() => allDrills.filter((d) => !isDrillDraft(d.id)), [allDrills, isDrillDraft])
  const drillsLoading = useStore((s) => s.drillsLoading)
  const drillsError = useStore((s) => s.drillsError)
  const fetchDrills = useStore((s) => s.fetchDrills)
  const updateDrill = useStore((s) => s.updateDrill)
  const duplicateDrill = useStore((s) => s.duplicateDrill)
  const deleteDrill = useStore((s) => s.deleteDrill)
  const createCollection = useStore((s) => s.createCollection)
  const updateCollection = useStore((s) => s.updateCollection)
  const deleteCollection = useStore((s) => s.deleteCollection)
  const addDrillToCollection = useStore((s) => s.addDrillToCollection)
  const removeDrillFromCollection = useStore((s) => s.removeDrillFromCollection)
  const showToast = useToast()

  const { placeId, setPlaceId } = useLibraryPlace(rootPlaceId(isAdmin))
  const [query, setQuery] = useState('')
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [dialog, setDialog] = useState<LibraryDialog | null>(null)
  const { sort, toggleSort, setSort } = useLibrarySort('gaffer-library-sort-drills', { key: 'name', dir: 'asc' })

  // Club tenancy (2026-08-28): fetchDrills takes no scope argument any more
  // (RLS decides visibility) — selectedClubId stays a dependency purely so
  // switching clubs re-triggers a refetch.
  useEffect(() => {
    void fetchDrills()
  }, [fetchDrills, selectedClubId])

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
        docs: drills,
        collections,
        collectionDocIds: collectionDrillIds,
        licensedCollectionIds,
        selectedClubId,
        myUserId,
        isAdmin,
        members: clubMembers,
        myDisplayName,
        kind: 'drill',
        docLabel: 'drills',
      }),
    [myDisplayName, drills, collections, collectionDrillIds, licensedCollectionIds, selectedClubId, myUserId, isAdmin, clubMembers]
  )

  // A place can vanish under you — a deleted collection, a coach removed
  // from the club, or a URL someone pasted from another club — so an
  // unknown token falls back to "All" rather than rendering an empty screen
  // with a title for somewhere that no longer exists.
  const place = places.find((p) => p.id === placeId) ?? places[0]
  const root = places[0].id

  const ageBandOptions = useMemo(() => {
    const bands = new Set<string>()
    for (const d of drills) {
      const band = ageBandLabel(d)
      if (band) bands.add(band)
    }
    return [...bands].sort()
  }, [drills])

  const categoryOptions = useMemo(() => {
    const categories = new Set<string>()
    for (const d of drills) if (d.category) categories.add(d.category)
    return [...categories].sort()
  }, [drills])

  const placeDrills = useMemo(() => {
    const ids = new Set(place.ids)
    return drills.filter((d) => ids.has(d.id))
  }, [drills, place])

  // Search and filters narrow the current place, not the whole library —
  // the folder metaphor's own promise, and the toolbar prints "N of M" so
  // the difference is never silent.
  const matched = useMemo(() => {
    const q = query.trim().toLowerCase()
    const minPlayers = filters.minPlayers ? Number(filters.minPlayers) : null
    const maxDuration = filters.maxDurationMinutes ? Number(filters.maxDurationMinutes) : null

    return placeDrills.filter((d) => {
      if (q) {
        const haystack = [d.name, d.category, d.objective, pitchLabel(d)].filter(Boolean).join(' ').toLowerCase()
        if (!haystack.includes(q)) return false
      }
      if (filters.ageBand && ageBandLabel(d) !== filters.ageBand) return false
      if (filters.sessionBlock && d.session_block !== filters.sessionBlock) return false
      if (filters.difficulty && d.difficulty !== filters.difficulty) return false
      if (filters.intensity && d.intensity !== filters.intensity) return false
      if (filters.phaseOfPlay && d.phase_of_play !== filters.phaseOfPlay) return false
      if (filters.category && d.category !== filters.category) return false
      // A player-count or duration filter can only match a drill that
      // actually recorded the number — an unset field can't be confirmed to
      // fit, so it's excluded rather than treated as "fits anything".
      if (minPlayers != null) {
        if (d.min_players == null || d.max_players == null) return false
        if (minPlayers < d.min_players || minPlayers > d.max_players) return false
      }
      if (maxDuration != null) {
        if (d.duration_minutes == null || d.duration_minutes > maxDuration) return false
      }
      return true
    })
  }, [placeDrills, query, filters])

  const sorted = useMemo(() => [...matched].sort((a, b) => compareDrills(a, b, sort)), [matched, sort])
  const orderedIds = useMemo(() => sorted.map((d) => d.id), [sorted])
  const selection = useLibrarySelection(orderedIds)

  const activeDrill = activeId ? (drills.find((d) => d.id === activeId) ?? null) : null

  // Same condition clubSlice's canEditDoc expresses, inlined so it stays
  // reactive to isAdmin/selectedClubId without a second store subscription.
  const canEdit = (drill: Drill) =>
    (isAdmin && drill.club_id === selectedClubId) || drill.created_by === myUserId

  // Only this club's own drill-kind collections — a licensed-in collection
  // belongs to the club that granted it, and collection_drill's RLS requires
  // is_club_admin, which is why filing is admin-only rather than
  // shown-and-failing for a plain coach.
  const homeCollections = useMemo(
    () =>
      collections
        .filter((c) => c.club_id === selectedClubId && c.kind === 'drill')
        .sort((a, b) => a.name.localeCompare(b.name)),
    [collections, selectedClubId]
  )

  const collectionNamesFor = (drillId: string) =>
    homeCollections.filter((c) => (collectionDrillIds[c.id] ?? []).includes(drillId)).map((c) => c.name)

  const openDrill = (id: string) => {
    const drill = drills.find((d) => d.id === id)
    if (!drill) return
    navigate(canEdit(drill) ? `/design/${drill.id}` : `/drills/${drill.id}/view`)
  }

  // A plain click means "show me this one", so it clears any multi-selection
  // — a tick left over from a previous bulk action must never ride along
  // into the next one.
  const handleActivate = (id: string) => {
    selection.clear()
    setActiveId((current) => (current === id ? null : id))
  }

  const handleDuplicate = async (drillId: string) => {
    const created = await duplicateDrill(drillId)
    if (created) {
      setActiveId(created.id)
      showToast(`Duplicated as "${created.name}"`)
    }
  }

  const handleAddToCollection = async (collectionId: string, ids: string[]) => {
    for (const id of ids) await addDrillToCollection(collectionId, id)
    const name = homeCollections.find((c) => c.id === collectionId)?.name ?? 'the collection'
    showToast(`Added ${ids.length} ${ids.length === 1 ? 'drill' : 'drills'} to ${name}`)
    selection.clear()
  }

  const handleCreateAndAdd = async (name: string, ids: string[]) => {
    const created = await createCollection(name, null, 'drill')
    if (!created) return
    for (const id of ids) await addDrillToCollection(created.id, id)
    showToast(`Added ${ids.length} ${ids.length === 1 ? 'drill' : 'drills'} to ${created.name}`)
    selection.clear()
  }

  const handleRemoveFromPlace = async (ids: string[]) => {
    if (!place.collectionId) return
    for (const id of ids) await removeDrillFromCollection(place.collectionId, id)
    showToast(`Removed ${ids.length} ${ids.length === 1 ? 'drill' : 'drills'} from ${place.title}`)
    selection.clear()
  }

  const handleDeleteDrills = async (ids: string[]) => {
    let deleted = 0
    for (const id of ids) {
      if (await deleteDrill(id)) deleted++
    }
    if (ids.includes(activeId ?? '')) setActiveId(null)
    showToast(`Deleted ${deleted} ${deleted === 1 ? 'drill' : 'drills'}`)
    selection.clear()
  }

  const rowMenu = (drill: Drill): RowMenuItem[] => {
    const editable = canEdit(drill)
    const items: RowMenuItem[] = [
      { key: 'open', label: editable ? 'Open' : 'View', icon: editable ? PenSquare : Eye, onSelect: () => openDrill(drill.id) },
      { key: 'details', label: 'Details', icon: Info, onSelect: () => handleActivate(drill.id) },
      { key: 'duplicate', label: 'Duplicate', icon: Copy, onSelect: () => void handleDuplicate(drill.id) },
    ]
    if (editable) {
      items.push({
        key: 'rename',
        label: 'Rename',
        icon: Pencil,
        onSelect: () => setDialog({ kind: 'renameDrill', id: drill.id, name: drill.name }),
      })
    }
    if (isAdmin) {
      items.push({
        key: 'file',
        label: 'Add to collection…',
        icon: FolderPlus,
        onSelect: () => setDialog({ kind: 'addToCollection', ids: [drill.id] }),
      })
      if (place.kind === 'collection' && place.collectionId) {
        items.push({
          key: 'unfile',
          // Not `Remove from ${place.title}`: a long collection name
          // truncated inside the menu, and you're standing in the folder
          // the item is being removed from anyway.
          label: 'Remove from collection',
          icon: FolderMinus,
          onSelect: () => void handleRemoveFromPlace([drill.id]),
        })
      }
    }
    if (editable) {
      items.push({
        key: 'delete',
        label: 'Delete',
        icon: Trash2,
        danger: true,
        onSelect: () => setDialog({ kind: 'deleteDrills', ids: [drill.id] }),
      })
    }
    return items
  }

  const items: LibraryItemView[] = sorted.map((drill) => ({
    id: drill.id,
    name: drill.name,
    thumbnailUrl: drill.thumbnail_url,
    icon: LibraryBig,
    subtitle: drill.objective,
    metaLine:
      [
        drill.category,
        drill.duration_minutes != null ? `${drill.duration_minutes} min` : null,
        drill.difficulty ? DRILL_DIFFICULTY_LABELS[drill.difficulty] : null,
        playerCountLabel(drill),
        ageBandLabel(drill),
      ]
        .filter(Boolean)
        .join(' · ') || null,
    cells: {
      category: drill.category,
      duration: drill.duration_minutes != null ? `${drill.duration_minutes} min` : null,
      players: playerCountLabel(drill),
      created: new Date(drill.created_at).toLocaleDateString(),
    },
    menu: rowMenu(drill),
  }))

  const columns = activeId ? DRILL_COLUMNS.filter((c) => COMPACT_COLUMN_KEYS.includes(c.key)) : DRILL_COLUMNS

  const selectedIds = [...selection.selected]
  const deletableSelected = selectedIds.filter((id) => {
    const drill = drills.find((d) => d.id === id)
    return drill ? canEdit(drill) : false
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

  if (drillsLoading && drills.length === 0) {
    return (
      <div role="status" aria-busy="true">
        <span className="sr-only">Loading drills…</span>
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {SKELETON_CARDS.map((card) => (
            <li key={card} className="space-y-2 rounded-lg border border-line p-3">
              <Skeleton className="aspect-video w-full rounded-md" />
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-20" />
            </li>
          ))}
        </ul>
      </div>
    )
  }

  if (drillsError) return <p className="text-sm text-bad">{drillsError}</p>

  if (drills.length === 0) {
    return <EmptyState icon={LibraryBig} message="No drills yet." action={{ to: '/design', label: 'Build one in Design →' }} />
  }

  const narrowed = query.trim() !== '' || activeFilterCount(filters) > 0

  return (
    <>
      <LibraryShell
        placeTitle={place.title}
        details={
          activeDrill ? (
            <DrillDetails
              key={activeDrill.id}
              drill={activeDrill}
              canEdit={canEdit(activeDrill)}
              canFile={isAdmin}
              collectionNames={collectionNamesFor(activeDrill.id)}
              onClose={() => setActiveId(null)}
              onDuplicate={() => handleDuplicate(activeDrill.id)}
              onDelete={() => setDialog({ kind: 'deleteDrills', ids: [activeDrill.id] })}
              onAddToCollection={() => setDialog({ kind: 'addToCollection', ids: [activeDrill.id] })}
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
          rootLabel="Drills"
          placeTitle={place.title}
          isRoot={place.id === root}
          onNavigateRoot={() => setPlaceId(root)}
          query={query}
          onQueryChange={setQuery}
          searchPlaceholder="Search name, category, objective, pitch…"
          view={view}
          onViewChange={setView}
          sort={sort}
          sortOptions={DRILL_SORT_OPTIONS}
          onSortKeyChange={(key) => setSort({ key, dir: key === 'created' ? 'desc' : 'asc' })}
          onToggleSortDir={() => setSort({ ...sort, dir: sort.dir === 'asc' ? 'desc' : 'asc' })}
          shownCount={sorted.length}
          totalCount={place.ids.length}
          placeNote={place.kind === 'licensed' ? 'Licensed to this club — read-only.' : undefined}
          filters={
            <DrillFilters
              filters={filters}
              onChange={setFilters}
              open={filtersOpen}
              onToggle={() => setFiltersOpen((v) => !v)}
              ageBandOptions={ageBandOptions}
              categoryOptions={categoryOptions}
            />
          }
        />

        {sorted.length === 0 ? (
          <EmptyState
            icon={LibraryBig}
            message={
              narrowed
                ? 'Nothing here matches that search.'
                : place.kind === 'collection'
                  ? 'This collection is empty. Select drills anywhere in the library and use "Add to collection".'
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
            onOpen={openDrill}
          />
        ) : (
          <LibraryTiles
            items={items}
            selected={selection.selected}
            activeId={activeId}
            onToggle={selection.toggle}
            onActivate={handleActivate}
            onOpen={openDrill}
          />
        )}
      </LibraryShell>

      <SelectionBar count={selection.count} noun="drill" onClear={selection.clear}>
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
          onClick={() => setDialog({ kind: 'deleteDrills', ids: deletableSelected })}
        />
      </SelectionBar>

      {/* Every dialog is mounted only while it's open, rather than kept
          mounted with an `open` flag — that's what lets each one seed its
          fields from props at mount and drop whatever was typed on cancel,
          with no reset-on-reopen effect. */}
      {dialog?.kind === 'newCollection' && (
        <TextPromptDialog
          open
          onClose={() => setDialog(null)}
          title="New collection"
          label="Name"
          placeholder="e.g. Rondos"
          submitLabel="Create"
          onSubmit={async (name) => {
            const created = await createCollection(name, null, 'drill')
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
      {dialog?.kind === 'renameDrill' && (
        <TextPromptDialog
          open
          onClose={() => setDialog(null)}
          title="Rename drill"
          label="Name"
          initialValue={dialog.name}
          submitLabel="Rename"
          onSubmit={async (name) => {
            await updateDrill(dialog.id, { name })
          }}
        />
      )}
      {dialog?.kind === 'deleteCollection' && (
        <ConfirmDialog
          open
          onClose={() => setDialog(null)}
          title="Delete collection"
          message={`Delete "${dialog.name}"? The drills in it stay in the library — only the collection goes.`}
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
      {dialog?.kind === 'deleteDrills' && (
        <ConfirmDialog
          open
          onClose={() => setDialog(null)}
          title={dialog.ids.length > 1 ? 'Delete drills' : 'Delete drill'}
          message={
            dialog.ids.length === 1
              ? `Delete "${drills.find((d) => d.id === dialog.ids[0])?.name ?? 'this drill'}"? Any session it's part of will drop it too — this can't be undone.`
              : `Delete ${dialog.ids.length} drills? Any session they're part of will drop them too — this can't be undone.`
          }
          confirmLabel="Delete"
          onConfirm={() => handleDeleteDrills(dialog.ids)}
        />
      )}
      {dialog?.kind === 'addToCollection' && (
        <AddToCollectionDialog
          open
          onClose={() => setDialog(null)}
          collections={homeCollections}
          collectionDocIds={collectionDrillIds}
          count={dialog.ids.length}
          noun="drill"
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

// The nine filters that aren't search, behind one toggle in the toolbar
// (2026-08-28) — unchanged in what they do, but search no longer collapses
// with them, and the panel now drops below the toolbar as a popover instead
// of pushing the list down the page.
function DrillFilters({
  filters,
  onChange,
  open,
  onToggle,
  ageBandOptions,
  categoryOptions,
}: {
  filters: Filters
  onChange: (filters: Filters) => void
  open: boolean
  onToggle: () => void
  ageBandOptions: string[]
  categoryOptions: string[]
}) {
  const patch = (next: Partial<Filters>) => onChange({ ...filters, ...next })
  const count = activeFilterCount(filters)
  const field =
    'h-9 w-full rounded-md border border-line bg-panel-raised px-2 text-sm text-ink outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/30'

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
        <div className="absolute left-0 top-full z-30 mt-1.5 w-[19rem] rounded-lg border border-line bg-panel p-3 shadow-xl sm:w-[26rem]">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-medium text-ink-muted">Age</label>
              <div className="mt-1">
                <Dropdown
                  value={filters.ageBand}
                  onChange={(v) => patch({ ageBand: v })}
                  options={[{ value: '', label: 'Any age' }, ...ageBandOptions.map((b) => ({ value: b, label: b }))]}
                  searchable={false}
                  ariaLabel="Age band"
                  triggerClassName="h-9 w-full"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-ink-muted">Session block</label>
              <div className="mt-1">
                <Dropdown
                  value={filters.sessionBlock}
                  onChange={(v) => patch({ sessionBlock: v as SessionBlock | '' })}
                  options={[
                    { value: '', label: 'Any block' },
                    ...SESSION_BLOCKS.map((b) => ({ value: b, label: SESSION_BLOCK_LABELS[b] })),
                  ]}
                  searchable={false}
                  ariaLabel="Session block"
                  triggerClassName="h-9 w-full"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-ink-muted">Level</label>
              <div className="mt-1">
                <Dropdown
                  value={filters.difficulty}
                  onChange={(v) => patch({ difficulty: v as DrillDifficulty | '' })}
                  options={[
                    { value: '', label: 'Any level' },
                    ...DRILL_DIFFICULTIES.map((d) => ({ value: d, label: DRILL_DIFFICULTY_LABELS[d] })),
                  ]}
                  searchable={false}
                  ariaLabel="Level"
                  triggerClassName="h-9 w-full"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-ink-muted">Intensity</label>
              <div className="mt-1">
                <Dropdown
                  value={filters.intensity}
                  onChange={(v) => patch({ intensity: v as DrillIntensity | '' })}
                  options={[
                    { value: '', label: 'Any intensity' },
                    ...DRILL_INTENSITIES.map((i) => ({ value: i, label: DRILL_INTENSITY_LABELS[i] })),
                  ]}
                  searchable={false}
                  ariaLabel="Intensity"
                  triggerClassName="h-9 w-full"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-ink-muted">Phase of play</label>
              <div className="mt-1">
                <Dropdown
                  value={filters.phaseOfPlay}
                  onChange={(v) => patch({ phaseOfPlay: v as DrillPhaseOfPlay | '' })}
                  options={[
                    { value: '', label: 'Any phase' },
                    ...DRILL_PHASES_OF_PLAY.map((p) => ({ value: p, label: DRILL_PHASE_OF_PLAY_LABELS[p] })),
                  ]}
                  searchable={false}
                  ariaLabel="Phase of play"
                  triggerClassName="h-9 w-full"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-ink-muted">Category</label>
              <div className="mt-1">
                <Dropdown
                  value={filters.category}
                  onChange={(v) => patch({ category: v })}
                  options={[{ value: '', label: 'Any category' }, ...categoryOptions.map((c) => ({ value: c, label: c }))]}
                  searchable={categoryOptions.length > 6}
                  ariaLabel="Category"
                  triggerClassName="h-9 w-full"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-ink-muted" htmlFor="drill-filter-players">
                Players
              </label>
              <input
                id="drill-filter-players"
                type="number"
                min={1}
                value={filters.minPlayers}
                onChange={(e) => patch({ minPlayers: e.target.value })}
                placeholder="e.g. 8"
                className={`${field} mt-1`}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-ink-muted" htmlFor="drill-filter-duration">
                Max duration (min)
              </label>
              <input
                id="drill-filter-duration"
                type="number"
                min={1}
                value={filters.maxDurationMinutes}
                onChange={(e) => patch({ maxDurationMinutes: e.target.value })}
                placeholder="e.g. 12"
                className={`${field} mt-1`}
              />
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between">
            <button
              type="button"
              onClick={() => onChange(EMPTY_FILTERS)}
              disabled={count === 0}
              className="text-sm text-ink-muted transition-colors hover:text-ink disabled:opacity-40"
            >
              Clear all
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
