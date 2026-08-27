import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Copy, LibraryBig, Pause, PenSquare, Play, SlidersHorizontal, Trash2 } from 'lucide-react'
import { useStore } from '../../store'
import { selectMyRole } from '../../store/slices/clubSlice'
import { useSession } from '../../hooks/useSession'
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
import { frameAt } from './canvas/interpolate'
import { formatClock } from './timeline/cursor'
import { useTimelinePlayback } from './timeline/useTimelinePlayback'
import { EmptyState } from '../ui/EmptyState'
import { Skeleton } from '../ui/Skeleton'
import { Badge } from '../ui/Badge'
import { Dropdown } from '../ui/Dropdown'
import { PitchCanvas } from './PitchCanvas'
import { LibraryGroups } from './LibraryGroups'
import { buildLibraryGroups } from './buildLibraryGroups'

// Phase 3.1 — Drill library / browse & search (US-17), reworked by
// DRILL_CREATOR_REWORK_PLAN.md Stage 9 into a card grid with real filters and
// real animated playback, now that Stage 8 gives every drill somewhere to
// carry a level, an intensity, a session block and a player count, and Stage
// 1 gives every drill a cast of entities with stable identity across time
// instead of a list of unrelated per-phase snapshots.
//
// Still entirely client-side (build guide 2b: "this scale doesn't need
// server-side search") — eleven drills today, and the same note holds at a
// few hundred. Every filter narrows the same `drills` array the fetch below
// already loads; nothing here issues a second network request.

// Fixed placeholder count for the loading skeleton — enough cards to read as
// "a grid is coming" without implying a real drill count. Module-level so
// the array reference is stable across renders, same reasoning as
// SKELETON_ROWS in PlayerRoster.
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
// actually present in the data instead of a hardcoded list, the same way a
// faceted filter works over any free-text column.
function ageBandLabel(drill: Drill): string | null {
  if (drill.age_min && drill.age_max) return `${drill.age_min}–${drill.age_max}`
  return drill.age_min ?? drill.age_max ?? null
}

function playerCountLabel(drill: Drill): string | null {
  if (drill.min_players != null && drill.max_players != null) {
    return drill.min_players === drill.max_players ? `${drill.min_players} players` : `${drill.min_players}–${drill.max_players} players`
  }
  if (drill.players_recommended != null) return `${drill.players_recommended} players`
  return drill.min_players != null ? `${drill.min_players}+ players` : null
}

interface Filters {
  query: string
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
  query: '',
  ageBand: '',
  sessionBlock: '',
  minPlayers: '',
  difficulty: '',
  intensity: '',
  phaseOfPlay: '',
  category: '',
  maxDurationMinutes: '',
}

function filtersActive(filters: Filters): boolean {
  return Object.values(filters).some((v) => v !== '')
}

export function DrillLibrary() {
  const { session } = useSession()
  const myUserId = session?.user.id ?? null
  const selectedClubId = useStore((s) => s.selectedClubId)
  const isAdmin = useStore((s) => selectMyRole(s) === 'admin')
  const clubMembers = useStore((s) => s.clubMembers)
  const collections = useStore((s) => s.collections)
  const collectionDrillIds = useStore((s) => s.collectionDrillIds)
  const licensesIn = useStore((s) => s.licensesIn)
  const fetchClubData = useStore((s) => s.fetchClubData)
  const drills = useStore((s) => s.drills)
  const drillsLoading = useStore((s) => s.drillsLoading)
  const drillsError = useStore((s) => s.drillsError)
  const fetchDrills = useStore((s) => s.fetchDrills)
  const duplicateDrill = useStore((s) => s.duplicateDrill)
  const deleteDrill = useStore((s) => s.deleteDrill)

  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS)
  const [moreOpen, setMoreOpen] = useState(false)
  const [selectedDrillId, setSelectedDrillId] = useState<string | null>(null)
  const [duplicating, setDuplicating] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // Club tenancy (2026-08-28): fetchDrills takes no scope argument any more
  // (RLS decides visibility) — selectedClubId stays a dependency purely so
  // switching clubs re-triggers a refetch (clubSlice.selectClub clears
  // `drills`/`collections`/etc. on switch; these two calls refill them).
  useEffect(() => {
    void fetchDrills()
  }, [fetchDrills, selectedClubId])

  useEffect(() => {
    void fetchClubData()
  }, [fetchClubData, selectedClubId])

  // Every option list a filter dropdown offers is built from what's actually
  // in `drills`, not a fixed vocabulary — category and age band are free
  // text, so "every value a coach has typed so far" is the only list that
  // means anything.
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

  const filteredDrills = useMemo(() => {
    const q = filters.query.trim().toLowerCase()
    const minPlayers = filters.minPlayers ? Number(filters.minPlayers) : null
    const maxDuration = filters.maxDurationMinutes ? Number(filters.maxDurationMinutes) : null

    return drills.filter((d) => {
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
      // fit, so it's excluded rather than treated as "fits anything". This is
      // exactly the stage's own point: metadata is what makes a drill
      // findable, so a drill without it stays unfindable by that filter
      // until a coach fills Details in.
      if (minPlayers != null) {
        if (d.min_players == null || d.max_players == null) return false
        if (minPlayers < d.min_players || minPlayers > d.max_players) return false
      }
      if (maxDuration != null) {
        if (d.duration_minutes == null || d.duration_minutes > maxDuration) return false
      }
      return true
    })
  }, [drills, filters])

  const selectedDrill = filteredDrills.find((d) => d.id === selectedDrillId) ?? drills.find((d) => d.id === selectedDrillId) ?? null
  // Same condition clubSlice's canEditDoc expresses, inlined rather than
  // called via useStore so it stays reactive to isAdmin/selectedClubId
  // without a second store subscription keyed on a value (selectedDrill)
  // that's itself derived from local state, not the store.
  const canEditSelected = selectedDrill
    ? (isAdmin && selectedDrill.club_id === selectedClubId) || selectedDrill.created_by === myUserId
    : false

  // Keyed on an actual active license, not "club_id !== selectedClubId" —
  // an admin of more than one club (Task 10's own verify scenario) sees
  // every administered club's collections merged into `collections` via
  // RLS, and a collection from a DIFFERENT club they ALSO administer isn't
  // licensed to them, it's just theirs too. The earlier club_id-mismatch
  // heuristic mislabeled that case "Licensed" (found live in Task 10).
  const licensedCollectionIds = useMemo(
    () => new Set(licensesIn.filter((l) => !l.revoked_at).map((l) => l.collection_id)),
    [licensesIn]
  )

  const groups = useMemo(
    () =>
      buildLibraryGroups({
        docs: filteredDrills,
        collections,
        collectionDocIds: collectionDrillIds,
        licensedCollectionIds,
        selectedClubId,
        myUserId,
        isAdmin,
        members: clubMembers,
        docLabel: 'drills',
      }),
    [filteredDrills, collections, collectionDrillIds, licensedCollectionIds, selectedClubId, myUserId, isAdmin, clubMembers]
  )

  const handleSelectDrill = (id: string) => {
    setSelectedDrillId((current) => (current === id ? null : id))
  }

  const handleDuplicate = async (drillId: string) => {
    setDuplicating(true)
    const created = await duplicateDrill(drillId)
    setDuplicating(false)
    if (created) setSelectedDrillId(created.id)
  }

  const handleDelete = async (drillId: string) => {
    setDeleting(true)
    const deleted = await deleteDrill(drillId)
    setDeleting(false)
    if (deleted) setSelectedDrillId(null)
  }

  return (
    <div className="space-y-4">
      {drillsLoading && drills.length === 0 && (
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
      )}
      {drillsError && <p className="text-sm text-bad">{drillsError}</p>}
      {!drillsLoading && drills.length === 0 && !drillsError && (
        <EmptyState
          icon={LibraryBig}
          message="No drills yet."
          action={{ to: '/design', label: 'Build one in Design →' }}
        />
      )}

      {drills.length > 0 && (
        <>
          <LibraryFilterBar
            filters={filters}
            onChange={setFilters}
            moreOpen={moreOpen}
            onToggleMore={() => setMoreOpen((v) => !v)}
            ageBandOptions={ageBandOptions}
            categoryOptions={categoryOptions}
          />
          <Link
            to="/design"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:underline"
          >
            + New drill
          </Link>

          {filteredDrills.length === 0 ? (
            <p className="text-sm text-ink-muted">No drills match these filters.</p>
          ) : (
            <LibraryGroups
              groups={groups}
              renderCard={(id) => {
                const drill = filteredDrills.find((d) => d.id === id)
                if (!drill) return null
                return <DrillCard drill={drill} selected={selectedDrillId === id} onSelect={() => handleSelectDrill(id)} />
              }}
            />
          )}

          {selectedDrill && (
            <DrillPreviewPanel
              key={selectedDrill.id}
              drill={selectedDrill}
              canEdit={canEditSelected}
              onDuplicate={() => handleDuplicate(selectedDrill.id)}
              duplicating={duplicating}
              onDelete={() => handleDelete(selectedDrill.id)}
              deleting={deleting}
            />
          )}
        </>
      )}
    </div>
  )
}

const FIELD =
  'h-11 w-full rounded-md border border-line bg-panel-raised px-2 text-sm text-ink outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/30 lg:h-9'

// search · age · session block · players · level · more filters — the exact
// bar the target editor's library uses (plan §1's "Library" inventory).
// Duration, intensity, phase of play and category sit behind "more filters":
// the plan names only the first five as the primary bar, but the stage's own
// definition of done ("a 12-minute technical rondo for 8 players") needs a
// duration filter to exist somewhere, so it lives with the others that
// didn't make the primary five rather than crowding the bar past five
// controls a coach has to scan every time.
function LibraryFilterBar({
  filters,
  onChange,
  moreOpen,
  onToggleMore,
  ageBandOptions,
  categoryOptions,
}: {
  filters: Filters
  onChange: (filters: Filters) => void
  moreOpen: boolean
  onToggleMore: () => void
  ageBandOptions: string[]
  categoryOptions: string[]
}) {
  const patch = (next: Partial<Filters>) => onChange({ ...filters, ...next })

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-40 flex-1">
          <label htmlFor="drill-library-search" className="block text-xs font-medium text-ink-muted">
            Search
          </label>
          <input
            id="drill-library-search"
            type="search"
            value={filters.query}
            onChange={(e) => patch({ query: e.target.value })}
            placeholder="Name, category, objective, pitch…"
            className={`${FIELD} mt-1`}
          />
        </div>
        <div className="w-36">
          <label className="block text-xs font-medium text-ink-muted">Age</label>
          <div className="mt-1">
            <Dropdown
              value={filters.ageBand}
              onChange={(v) => patch({ ageBand: v })}
              options={[{ value: '', label: 'Any age' }, ...ageBandOptions.map((b) => ({ value: b, label: b }))]}
              searchable={false}
              ariaLabel="Age band"
              triggerClassName="h-11 w-full lg:h-9"
            />
          </div>
        </div>
        <div className="w-40">
          <label className="block text-xs font-medium text-ink-muted">Session block</label>
          <div className="mt-1">
            <Dropdown
              value={filters.sessionBlock}
              onChange={(v) => patch({ sessionBlock: v as SessionBlock | '' })}
              options={[{ value: '', label: 'Any block' }, ...SESSION_BLOCKS.map((b) => ({ value: b, label: SESSION_BLOCK_LABELS[b] }))]}
              searchable={false}
              ariaLabel="Session block"
              triggerClassName="h-11 w-full lg:h-9"
            />
          </div>
        </div>
        <div className="w-28">
          <label className="block text-xs font-medium text-ink-muted">Players</label>
          <input
            type="number"
            min={1}
            value={filters.minPlayers}
            onChange={(e) => patch({ minPlayers: e.target.value })}
            placeholder="e.g. 8"
            className={`${FIELD} mt-1`}
          />
        </div>
        <div className="w-32">
          <label className="block text-xs font-medium text-ink-muted">Level</label>
          <div className="mt-1">
            <Dropdown
              value={filters.difficulty}
              onChange={(v) => patch({ difficulty: v as DrillDifficulty | '' })}
              options={[{ value: '', label: 'Any level' }, ...DRILL_DIFFICULTIES.map((d) => ({ value: d, label: DRILL_DIFFICULTY_LABELS[d] }))]}
              searchable={false}
              ariaLabel="Level"
              triggerClassName="h-11 w-full lg:h-9"
            />
          </div>
        </div>
        <button
          type="button"
          onClick={onToggleMore}
          aria-pressed={moreOpen}
          className={
            'flex h-11 items-center gap-1.5 rounded-md border px-2.5 text-sm font-medium transition-colors lg:h-9 ' +
            (moreOpen ? 'border-accent bg-accent/15 text-accent' : 'border-line text-ink-muted hover:border-line-strong')
          }
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          More filters
        </button>
        {filtersActive(filters) && (
          <button
            type="button"
            onClick={() => onChange(EMPTY_FILTERS)}
            className="h-11 px-2 text-sm text-ink-muted hover:text-ink lg:h-9"
          >
            Clear
          </button>
        )}
      </div>

      {moreOpen && (
        <div className="flex flex-wrap items-end gap-2 rounded-lg border border-line bg-panel-raised p-2">
          <div className="w-32">
            <label className="block text-xs font-medium text-ink-muted">Intensity</label>
            <div className="mt-1">
              <Dropdown
                value={filters.intensity}
                onChange={(v) => patch({ intensity: v as DrillIntensity | '' })}
                options={[{ value: '', label: 'Any intensity' }, ...DRILL_INTENSITIES.map((i) => ({ value: i, label: DRILL_INTENSITY_LABELS[i] }))]}
                searchable={false}
                ariaLabel="Intensity"
                triggerClassName="h-11 w-full lg:h-9"
              />
            </div>
          </div>
          <div className="w-44">
            <label className="block text-xs font-medium text-ink-muted">Phase of play</label>
            <div className="mt-1">
              <Dropdown
                value={filters.phaseOfPlay}
                onChange={(v) => patch({ phaseOfPlay: v as DrillPhaseOfPlay | '' })}
                options={[{ value: '', label: 'Any phase' }, ...DRILL_PHASES_OF_PLAY.map((p) => ({ value: p, label: DRILL_PHASE_OF_PLAY_LABELS[p] }))]}
                searchable={false}
                ariaLabel="Phase of play"
                triggerClassName="h-11 w-full lg:h-9"
              />
            </div>
          </div>
          <div className="w-36">
            <label className="block text-xs font-medium text-ink-muted">Category</label>
            <div className="mt-1">
              <Dropdown
                value={filters.category}
                onChange={(v) => patch({ category: v })}
                options={[{ value: '', label: 'Any category' }, ...categoryOptions.map((c) => ({ value: c, label: c }))]}
                searchable={categoryOptions.length > 6}
                ariaLabel="Category"
                triggerClassName="h-11 w-full lg:h-9"
              />
            </div>
          </div>
          <div className="w-32">
            <label className="block text-xs font-medium text-ink-muted">Max duration (min)</label>
            <input
              type="number"
              min={1}
              value={filters.maxDurationMinutes}
              onChange={(e) => patch({ maxDurationMinutes: e.target.value })}
              placeholder="e.g. 12"
              className={`${FIELD} mt-1`}
            />
          </div>
        </div>
      )}
    </div>
  )
}

function DrillCard({ drill, selected, onSelect }: { drill: Drill; selected: boolean; onSelect: () => void }) {
  const meta = [
    drill.duration_minutes != null ? `${drill.duration_minutes} min` : null,
    drill.difficulty ? DRILL_DIFFICULTY_LABELS[drill.difficulty] : null,
    drill.intensity ? DRILL_INTENSITY_LABELS[drill.intensity] : null,
    playerCountLabel(drill),
    ageBandLabel(drill),
  ].filter(Boolean)

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={
        'flex w-full flex-col gap-2 rounded-lg border p-3 text-left transition-colors ' +
        (selected ? 'border-accent/40 bg-accent/5' : 'border-line hover:border-accent/40 hover:bg-accent/5')
      }
    >
      <div className="flex aspect-video items-center justify-center overflow-hidden rounded-md bg-panel-raised">
        {drill.thumbnail_url ? (
          <img src={drill.thumbnail_url} alt={`${drill.name} board`} className="h-full w-full object-cover" />
        ) : (
          <LibraryBig className="h-6 w-6 text-ink-faint" />
        )}
      </div>
      <div className="min-w-0 space-y-1">
        <p className="truncate text-sm font-medium text-ink">{drill.name}</p>
        {drill.category && (
          <div>
            <Badge tone="neutral">{drill.category}</Badge>
          </div>
        )}
        {meta.length > 0 && <p className="truncate text-xs text-ink-muted">{meta.join(' · ')}</p>}
      </div>
    </button>
  )
}

// Real animated playback (rework plan Stage 9.3), replacing the old
// phase-cut timer — this is what retires DrillLibrary.tsx's old comment
// about interpolation being impossible between two phases with unrelated
// element sets. Every entity now has one id for the whole life of the drill,
// so `frameAt` can tween between any two keyframes the same way the editor's
// own timeline does; this component just drives it read-only.
//
// A fresh `useTimelinePlayback` instance per selected drill (via the `key`
// on the parent) rather than one instance reused across selections — a
// reused clock would carry the previous drill's currentTime/playing state
// into a new drill with a different duration.
function DrillPreviewPanel({
  drill,
  canEdit,
  onDuplicate,
  duplicating,
  onDelete,
  deleting,
}: {
  drill: Drill
  canEdit: boolean
  onDuplicate: () => void
  duplicating: boolean
  onDelete: () => void
  deleting: boolean
}) {
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const playback = useTimelinePlayback(drill.duration_seconds)

  // A coach glancing through the library wants a drill to keep demonstrating
  // itself, not stop after one pass and need a second tap — the same
  // "loops back to the start" behaviour the old phase-cut preview had.
  useEffect(() => {
    playback.toggleLoop()
    // Runs once for this playback instance, which is exactly one per
    // selected drill (see the `key` on DrillPreviewPanel above).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const frame = useMemo(
    () => frameAt(drill.scene, drill.keyframes, playback.currentTime),
    [drill.scene, drill.keyframes, playback.currentTime]
  )

  return (
    <div className="panel-edge rounded-xl border border-line bg-panel p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-ink">{drill.name}</p>
        <div className="flex items-center gap-2">
          <Link
            to={canEdit ? `/design/${drill.id}` : `/drills/${drill.id}/view`}
            className="flex items-center gap-1.5 rounded-md border border-line px-3 py-1.5 text-xs font-semibold text-ink-muted transition-colors hover:border-line-strong hover:text-ink"
          >
            <PenSquare className="h-3.5 w-3.5" />
            {canEdit ? 'Open in editor' : 'View'}
          </Link>
          <button
            type="button"
            onClick={onDuplicate}
            disabled={duplicating}
            className="flex items-center gap-1.5 rounded-md border border-line px-3 py-1.5 text-xs font-semibold text-ink-muted transition-colors hover:border-line-strong hover:text-ink disabled:opacity-50"
          >
            <Copy className="h-3.5 w-3.5" />
            {duplicating ? 'Duplicating…' : 'Duplicate'}
          </button>
          {drill.keyframes.length > 1 && (
            <button
              type="button"
              onClick={playback.togglePlay}
              className="flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-xs font-semibold text-white hover:bg-accent-hover"
            >
              {playback.playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
              {playback.playing ? 'Pause' : 'Play'}
            </button>
          )}
          {canEdit && (
            <button
              type="button"
              onClick={() => setConfirmingDelete(true)}
              className="flex items-center gap-1.5 rounded-md border border-line px-3 py-1.5 text-xs font-semibold text-bad transition-colors hover:border-bad/40 hover:bg-bad/5"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete
            </button>
          )}
        </div>
      </div>

      {confirmingDelete && (
        <div className="mb-3 rounded-lg border border-bad/30 bg-bad/10 p-3">
          <p className="text-sm text-bad">
            Delete <span className="font-medium">{drill.name}</span>? Any session it's part of will drop it too —
            this can&rsquo;t be undone.
          </p>
          <div className="mt-2 flex items-center gap-2">
            <button
              type="button"
              onClick={onDelete}
              disabled={deleting}
              className="rounded-md bg-bad px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
            >
              {deleting ? 'Deleting…' : 'Delete drill'}
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
      )}

      <PitchCanvas pitch={drill.pitch} frame={frame} maxWidth={340} />

      <p className="mt-2 text-xs text-ink-muted">
        {formatClock(playback.currentTime)} / {formatClock(drill.duration_seconds)}
        {' · '}
        {drill.keyframes.length} {drill.keyframes.length === 1 ? 'keyframe' : 'keyframes'}
      </p>
    </div>
  )
}
