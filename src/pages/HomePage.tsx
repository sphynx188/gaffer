import { useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, LibraryBig, Plus, Shield } from 'lucide-react'
import { useStore } from '../store'
import { selectMyRole } from '../store/slices/clubSlice'
import { useSession } from '../hooks/useSession'
import { useRecentBoards } from '../hooks/useRecentBoards'
import { PitchCanvas } from '../components/design/PitchCanvas'
import { configFromPreset, PITCH_PRESETS } from '../components/design/canvas/pitchPresets'
import { Skeleton } from '../components/ui/Skeleton'
import { HeroBoard } from '../components/home/HeroBoard'
import { RecentRow } from '../components/home/RecentRow'
import { CollectionShelves, type Shelf } from '../components/home/CollectionShelves'
import { boardOpenPath, orderBoards, type HomeBoard } from '../components/home/homeBoards'

// Club home (2026-08-28), rebuilt 2026-08-30 from a placeholder card into the
// app's real front door. One job: put the coach back on the board they were
// working on in a single tap. The rest of the page is the shape of the club's
// library at a glance — the boards after that one, and the collections they
// live in — with the two create actions in the header where a hand reaches
// for them. No stat tiles: the numbers a coach might want are one sentence
// under the club's name.
//
// Data comes from the same three fetches the Library tabs make, keyed on
// selectedClubId so switching clubs re-triggers them, exactly as those pages
// do. Drafts (a /design auto-created drill nobody has edited) are filtered
// the same way the Library filters them.

const RECENT_ROW_LENGTH = 6

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
  const hero = ordered[0] ?? null
  const heroIsRecent = recentCount > 0
  const rest = ordered.slice(1, 1 + RECENT_ROW_LENGTH)
  // Only a row that is mostly real history gets called that.
  const rowIsRecent = recentCount > 1

  // Which collections a board is filed in, by name — for the hero's line and
  // the tiles' captions.
  const collectionNamesFor = (board: HomeBoard): string[] => {
    const map = board.kind === 'drill' ? collectionDrillIds : collectionTacticIds
    return collections
      .filter((collection) => collection.kind === board.kind && (map[collection.id] ?? []).includes(board.doc.id))
      .map((collection) => collection.name)
  }

  const canEdit = (board: HomeBoard) =>
    (isAdmin && board.doc.club_id === selectedClubId) || board.doc.created_by === myUserId
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
        <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-ink-faint">{todayLabel()}</p>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
          <div className="min-w-0">
            <h1 className="text-3xl font-semibold tracking-[-0.02em] text-ink sm:text-4xl">{club?.name ?? 'Home'}</h1>
            <p className="mt-2 text-sm tabular-nums text-ink-muted">{loading ? ' ' : facts}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <CreateLink to="/design" label="New drill" />
            <CreateLink to="/tactics/new" label="New tactic" />
          </div>
        </div>
      </header>

      {loading ? (
        <div aria-busy="true" className="space-y-4">
          <span className="sr-only">Loading…</span>
          <Skeleton className="h-[440px] rounded-xl" />
          <div className="flex gap-4">
            <Skeleton className="h-40 w-[300px] rounded-xl" />
            <Skeleton className="h-40 w-[300px] rounded-xl" />
            <Skeleton className="h-40 w-[300px] rounded-xl" />
          </div>
        </div>
      ) : hero ? (
        <>
          <HeroBoard
            board={hero}
            openPath={openPath(hero)}
            collectionNames={collectionNamesFor(hero)}
            eyebrow={heroIsRecent ? 'Pick up where you left off' : 'From the library'}
            playing
          />

          {rest.length > 0 && (
            <section aria-labelledby="home-recent-title">
              <SectionHeading
                id="home-recent-title"
                title={rowIsRecent ? 'Recently opened' : 'More from the library'}
                to="/library/drills"
                linkLabel="Library"
              />
              <RecentRow
                boards={rest}
                openPath={openPath}
                collectionNameFor={(board) => collectionNamesFor(board)[0] ?? null}
              />
            </section>
          )}
        </>
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

// A club with nothing in it yet: the empty pitch is the invitation. The
// canvas's own "Nothing on the pitch yet." caption would say the same thing
// twice under the heading, so it's hidden here and the heading says it.
function EmptyPitch() {
  const pitch = configFromPreset(PITCH_PRESETS[0])
  return (
    <section className="panel-edge overflow-hidden rounded-xl border border-line bg-panel">
      <div className="[&_p]:hidden">
        <PitchCanvas pitch={pitch} frame={{ entities: [], markings: [] }} maxWidth={1400} maxHeight={320} fillCanvas />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-4 border-t border-line px-5 py-4">
        <div>
          <h2 className="text-base font-semibold text-ink">Nothing on the pitch yet</h2>
          <p className="mt-0.5 text-sm text-ink-muted">Your first drill or tactic will show up here, ready to open.</p>
        </div>
        <div className="flex gap-2">
          <Link
            to="/design"
            className="inline-flex min-h-10 items-center gap-1.5 rounded-md bg-accent px-3.5 text-sm font-medium text-white transition-colors hover:bg-accent-hover"
          >
            <LibraryBig className="h-4 w-4" />
            Design a drill
          </Link>
          <Link
            to="/tactics/new"
            className="inline-flex min-h-10 items-center gap-1.5 rounded-md border border-line px-3.5 text-sm font-medium text-ink transition-colors hover:bg-panel-raised"
          >
            <Shield className="h-4 w-4" />
            Build a tactic
          </Link>
        </div>
      </div>
    </section>
  )
}
