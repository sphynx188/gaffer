import { useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, LibraryBig, Plus, Shield } from 'lucide-react'
import { useStore } from '../store'
import { canEditDocWith, selectMyRole } from '../store/slices/clubSlice'
import { useSession } from '../hooks/useSession'
import { useRecentBoards } from '../hooks/useRecentBoards'
import { PitchCanvas } from '../components/design/PitchCanvas'
import type { RenderFrame } from '../components/design/canvas/interpolate'
import { configFromPreset, PITCH_PRESETS } from '../components/design/canvas/pitchPresets'
import { Skeleton } from '../components/ui/Skeleton'
import { BoardGrid } from '../components/home/BoardGrid'
import { CollectionShelves, type Shelf } from '../components/home/CollectionShelves'
import { boardOpenPath, orderBoards, type HomeBoard } from '../components/home/homeBoards'

// Club home, rebuilt 2026-08-28 → 2026-08-30 from a placeholder card into the
// app's real front door, then redesigned again same day into a flat board
// grid (Mural/Coda referenced, at the user's explicit request) in place of
// the boxed hero + horizontal row that first redesign shipped. Dropping the
// single "pick up where you left off" hero was a deliberate simplification,
// not a downgrade the hero earned — a coach managing a whole club's boards
// across several coaches is better served scanning several at once than
// having exactly one enlarged. What every tile keeps from the hero it
// replaces: it's still a live board, not a static thumbnail — see
// BoardGrid's own comment for the hover-to-preview interaction that carries
// that forward. No stat tiles: the numbers a coach might want are one
// sentence under the club's name, same restraint as before.
//
// Data comes from the same three fetches the Library tabs make, keyed on
// selectedClubId so switching clubs re-triggers them, exactly as those pages
// do. Drafts (a /design auto-created drill nobody has edited) are filtered
// the same way the Library filters them.

const GRID_LENGTH = 8

function todayLabel(): string {
  return new Intl.DateTimeFormat(undefined, { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date())
}

function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`
}

export function HomePage() {
  const { session } = useSession()
  const myUserId = session?.user.id ?? null
  const memberships = useStore((s) => s.memberships)
  const selectedClubId = useStore((s) => s.selectedClubId)
  const isAdmin = useStore((s) => selectMyRole(s) === 'admin')
  const clubMembers = useStore((s) => s.clubMembers)
  const collections = useStore((s) => s.collections)
  const collectionDrillIds = useStore((s) => s.collectionDrillIds)
  const collectionTacticIds = useStore((s) => s.collectionTacticIds)
  const collectionAccess = useStore((s) => s.collectionAccess)
  const licensesIn = useStore((s) => s.licensesIn)
  const drills = useStore((s) => s.drills)
  const drillsLoading = useStore((s) => s.drillsLoading)
  const tactics = useStore((s) => s.tactics)
  const tacticsLoading = useStore((s) => s.tacticsLoading)
  const isDrillDraft = useStore((s) => s.isDrillDraft)
  const fetchClubData = useStore((s) => s.fetchClubData)
  const fetchDrills = useStore((s) => s.fetchDrills)
  const fetchTactics = useStore((s) => s.fetchTactics)
  const recent = useRecentBoards()

  useEffect(() => {
    void fetchClubData()
    void fetchDrills()
    void fetchTactics()
  }, [fetchClubData, fetchDrills, fetchTactics, selectedClubId])

  const club = memberships.find((m) => m.club_id === selectedClubId)?.club

  // The same scoping the Library's "All" place applies (libraryPlaces.ts):
  // the store's drills/tactics/collections are RLS-scoped across every club
  // the caller administers, so an admin of two clubs would otherwise see the
  // other club's boards on this one's home.
  const licensedCollectionIds = useMemo(
    () => new Set(licensesIn.filter((l) => !l.revoked_at).map((l) => l.collection_id)),
    [licensesIn]
  )
  const licensedDocIds = useMemo(() => {
    const ids = new Set<string>()
    for (const id of licensedCollectionIds) {
      for (const docId of collectionDrillIds[id] ?? []) ids.add(docId)
      for (const docId of collectionTacticIds[id] ?? []) ids.add(docId)
    }
    return ids
  }, [licensedCollectionIds, collectionDrillIds, collectionTacticIds])
  const boards = useMemo<HomeBoard[]>(() => {
    const inScope = (doc: { id: string; club_id: string }) =>
      doc.club_id === selectedClubId || licensedDocIds.has(doc.id)
    return [
      ...drills
        .filter((drill) => inScope(drill) && !isDrillDraft(drill.id))
        .map((doc) => ({ kind: 'drill' as const, doc })),
      ...tactics.filter(inScope).map((doc) => ({ kind: 'tactic' as const, doc })),
    ]
  }, [drills, tactics, isDrillDraft, selectedClubId, licensedDocIds])
  const { boards: ordered, recentCount } = useMemo(() => orderBoards(boards, recent), [boards, recent])
  const grid = ordered.slice(0, GRID_LENGTH)
  // Only a grid that is mostly real history gets called that.
  const gridIsRecent = recentCount > 1

  // Which collections a board is filed in, by name — for the tiles' captions.
  const collectionNamesFor = (board: HomeBoard): string[] => {
    const map = board.kind === 'drill' ? collectionDrillIds : collectionTacticIds
    return collections
      .filter((collection) => collection.kind === board.kind && (map[collection.id] ?? []).includes(board.doc.id))
      .map((collection) => collection.name)
  }

  // club_id === selectedClubId is a hard precondition — see clubSlice's
  // canEditDocWith comment for why: without it, a board you created stays
  // "yours to edit" even from a club it's merely licensed into.
  const canEdit = (board: HomeBoard) =>
    canEditDocWith(board.doc, { selectedClubId, isAdmin, userId: myUserId })
  const openPath = (board: HomeBoard) => boardOpenPath(board, canEdit(board))

  const shelves = useMemo<Shelf[]>(
    () =>
      collections
        .filter((collection) => collection.club_id === selectedClubId || licensedCollectionIds.has(collection.id))
        .map((collection) => ({
          collection,
          count: (collection.kind === 'drill' ? collectionDrillIds : collectionTacticIds)[collection.id]?.length ?? 0,
          licensed: licensedCollectionIds.has(collection.id),
          sharedWith: collectionAccess[collection.id]?.length ?? 0,
        }))
        .sort((a, b) => b.count - a.count || a.collection.name.localeCompare(b.collection.name)),
    [collections, collectionDrillIds, collectionTacticIds, collectionAccess, selectedClubId, licensedCollectionIds]
  )

  const drillCount = boards.filter((board) => board.kind === 'drill').length
  const tacticCount = boards.length - drillCount
  const loading = (drillsLoading && drills.length === 0) || (tacticsLoading && tactics.length === 0)

  const facts = [
    plural(drillCount, 'drill'),
    plural(tacticCount, 'tactic'),
    plural(shelves.length, 'collection'),
    plural(clubMembers.length, 'coach'),
  ].join(' · ')

  return (
    <div className="space-y-10">
      <header>
        <div className="flex min-w-0 items-center gap-3">
          {club?.crest_url && (
            <img
              src={club.crest_url}
              alt=""
              className="h-12 w-12 shrink-0 rounded-lg border border-line object-cover sm:h-14 sm:w-14"
            />
          )}
          <h1 className="min-w-0 truncate text-3xl font-semibold tracking-[-0.02em] text-ink sm:text-4xl">
            {club?.name ?? 'Home'}
          </h1>
        </div>
        <p className="mt-2 text-sm tabular-nums text-ink-muted">{loading ? ' ' : `${todayLabel()} · ${facts}`}</p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Link
            to="/design"
            className="inline-flex min-h-10 items-center gap-1.5 rounded-md bg-accent px-3.5 text-sm font-medium text-white transition-colors hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
          >
            <Plus className="h-4 w-4" />
            New drill
          </Link>
          <CreateLink to="/tactics/new" label="New tactic" />
        </div>
      </header>

      {loading ? (
        <div aria-busy="true" className="space-y-4">
          <span className="sr-only">Loading…</span>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: GRID_LENGTH }).map((_, i) => (
              <Skeleton key={i} className="h-48 rounded-xl" />
            ))}
          </div>
        </div>
      ) : grid.length > 0 ? (
        <section aria-labelledby="home-boards-title">
          <SectionHeading
            id="home-boards-title"
            title={gridIsRecent ? 'Recently opened' : 'From the library'}
            to="/library/drills"
            linkLabel="Library"
          />
          <BoardGrid
            boards={grid}
            openPath={openPath}
            collectionNameFor={(board) => collectionNamesFor(board)[0] ?? null}
          />
        </section>
      ) : (
        <EmptyPitch />
      )}

      {!loading && shelves.length > 0 && (
        <section aria-labelledby="home-collections-title">
          <SectionHeading id="home-collections-title" title="Collections" to="/library/drills" linkLabel="Library" />
          <CollectionShelves shelves={shelves} />
        </section>
      )}
    </div>
  )
}

function CreateLink({ to, label }: { to: string; label: string }) {
  return (
    <Link
      to={to}
      className="inline-flex min-h-10 items-center gap-1.5 rounded-md border border-line bg-panel px-3 text-sm font-medium text-ink transition-colors hover:border-line-strong hover:bg-panel-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
    >
      <Plus className="h-4 w-4 text-ink-muted" />
      {label}
    </Link>
  )
}

function SectionHeading({ id, title, to, linkLabel }: { id: string; title: string; to: string; linkLabel: string }) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-4">
      <h2 id={id} className="text-sm font-semibold text-ink">
        {title}
      </h2>
      <Link
        to={to}
        className="inline-flex items-center gap-1 text-sm text-ink-muted transition-colors hover:text-ink focus-visible:outline-none focus-visible:text-accent-ink"
      >
        {linkLabel}
        <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  )
}

// A club with nothing in it yet. The previous version filled the whole
// section width with one blank, edge-to-edge pitch (maxWidth 1400) — full
// bleed and with nothing drawn on it, it read as a layout mistake rather
// than an invitation. This keeps the same instinct (a real board, not a
// stock illustration — PitchCanvas is the product's own primitive) but at a
// size that's an accent next to the copy, not the whole page, and drawn
// with a small rondo diagram rather than left blank — a working example of
// what a drill actually looks like once built, per "show, don't tell."
// `square_area` (a plain 20x20 box, no pitch lines) is picked deliberately
// over a real pitch preset: a rondo is coached in a grid like this one, and
// an unmarked square reads as a diagram rather than an odd, half-drawn
// stadium pitch at this size.
const RONDO_PITCH = configFromPreset(PITCH_PRESETS.find((p) => p.id === 'square_area') ?? PITCH_PRESETS[0])

const RONDO_FRAME: RenderFrame = {
  entities: [
    { id: 'r-top', kind: 'player', team: 'A', x: 0.5, y: 0.12, facing: 90 },
    { id: 'r-right', kind: 'player', team: 'A', x: 0.88, y: 0.5, facing: 180 },
    { id: 'r-bottom', kind: 'player', team: 'A', x: 0.5, y: 0.88, facing: 270 },
    { id: 'r-left', kind: 'player', team: 'A', x: 0.12, y: 0.5, facing: 0 },
    { id: 'r-presser', kind: 'player', team: 'B', x: 0.5, y: 0.5, facing: 0 },
  ],
  markings: [
    { id: 'r-pass', kind: 'arrow', points: [{ x: 0.5, y: 0.12 }, { x: 0.88, y: 0.5 }], style: { dash: true } },
  ],
}

function EmptyPitch() {
  return (
    <section className="panel-edge overflow-hidden rounded-xl border border-line bg-panel">
      <div className="flex flex-col items-center gap-6 p-6 sm:flex-row sm:items-center sm:gap-8 sm:p-8">
        <div className="w-40 shrink-0 overflow-hidden rounded-lg border border-line sm:w-48">
          <PitchCanvas pitch={RONDO_PITCH} frame={RONDO_FRAME} maxWidth={192} />
        </div>
        <div className="min-w-0 flex-1 text-center sm:text-left">
          <h2 className="text-lg font-semibold text-ink">Your library starts here</h2>
          <p className="mt-1.5 max-w-md text-sm text-ink-muted">
            Design a drill or tactic and it'll show up on this page — ready to reuse, share with your coaching
            staff, and build on next season.
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2 sm:justify-start">
            <Link
              to="/design"
              className="inline-flex min-h-10 items-center gap-1.5 rounded-md bg-accent px-3.5 text-sm font-medium text-white transition-colors hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
            >
              <LibraryBig className="h-4 w-4" />
              Design a drill
            </Link>
            <Link
              to="/tactics/new"
              className="inline-flex min-h-10 items-center gap-1.5 rounded-md border border-line px-3.5 text-sm font-medium text-ink transition-colors hover:bg-panel-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
            >
              <Shield className="h-4 w-4" />
              Build a tactic
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}
