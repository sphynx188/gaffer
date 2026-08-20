import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Shield } from 'lucide-react'
import { useStore } from '../../store'
import type { Player, PlayerPosition, Tactic } from '../../store'
import { PitchCanvas } from '../design/PitchCanvas'
import { EmptyState } from '../ui/EmptyState'

// Tactics are always a full pitch, portrait — unlike drills, there's no
// size/orientation picker here (the roadmap fixes the Tactic Creator to
// "a full football pitch"). No cones/balls/witches-hats/mannequins either:
// v1 tactics are players + arrows + annotations only.
const TACTIC_PITCH_SIZE = 'full' as const
const TACTIC_ORIENTATION = 'portrait' as const

// Display-only grouping (no schema change) — winger + striker both bucket
// into "Attackers", matching the roadmap's 4-group roster panel
// (Goalkeepers/Defenders/Midfielders/Attackers) even though
// PLAYER_POSITIONS itself has 5 distinct values. Checked in this order, so
// a keeper who's also tagged something else still lands under Goalkeepers.
const POSITION_BUCKETS: { label: string; positions: PlayerPosition[] }[] = [
  { label: 'Goalkeepers', positions: ['goalkeeper'] },
  { label: 'Defenders', positions: ['defender'] },
  { label: 'Midfielders', positions: ['midfielder'] },
  { label: 'Attackers', positions: ['winger', 'striker'] },
]

function bucketFor(player: Player): string {
  for (const bucket of POSITION_BUCKETS) {
    if (bucket.positions.some((p) => player.positions.includes(p))) return bucket.label
  }
  return 'Unassigned'
}

// The full set of mutually-exclusive "click the pitch to place/remove
// something" modes — same shape as DrillPreview's PlacementMode, just
// without the element-type modes (a roster-player tap does that job here
// instead, via `pendingPlacePlayerId`, staged/committed the same
// two-click way an arrow is).
type PlacementMode = 'arrow-ball' | 'arrow-player' | 'note' | 'remove' | null

// The board-building screen: pick or create a tactic for the current team,
// place real roster players (tap a roster row, then tap the pitch — see
// UPGRADE_IMPLEMENTATION_PLAN.md Phase 3.4 for why this is tap-to-place
// rather than true drag-and-drop from the panel), draw player/ball
// movement arrows (reuses the exact two-click pattern DrillPreview's
// Phase 2C introduced), and save.
export function TacticBoard() {
  const selectedTeamId = useStore((s) => s.selectedTeamId)
  const players = useStore((s) => s.players)
  const fetchPlayers = useStore((s) => s.fetchPlayers)
  const tactics = useStore((s) => s.tactics)
  const tacticsLoading = useStore((s) => s.tacticsLoading)
  const tacticsError = useStore((s) => s.tacticsError)
  const fetchTactics = useStore((s) => s.fetchTactics)
  const createTactic = useStore((s) => s.createTactic)
  const updateTactic = useStore((s) => s.updateTactic)
  const setTacticPlayerPosition = useStore((s) => s.setTacticPlayerPosition)
  const addTacticPlayer = useStore((s) => s.addTacticPlayer)
  const removeTacticPlayer = useStore((s) => s.removeTacticPlayer)
  const addTacticArrow = useStore((s) => s.addTacticArrow)
  const removeTacticArrow = useStore((s) => s.removeTacticArrow)
  const addTacticAnnotation = useStore((s) => s.addTacticAnnotation)
  const removeTacticAnnotation = useStore((s) => s.removeTacticAnnotation)

  const [selectedTacticId, setSelectedTacticId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [placementMode, setPlacementMode] = useState<PlacementMode>(null)
  const [pendingPlacePlayerId, setPendingPlacePlayerId] = useState<string | null>(null)
  const [pendingArrowStart, setPendingArrowStart] = useState<{ x: number; y: number } | null>(null)
  const [pendingNote, setPendingNote] = useState<{ x: number; y: number } | null>(null)
  const [noteText, setNoteText] = useState('')

  useEffect(() => {
    if (selectedTeamId) {
      fetchPlayers(selectedTeamId)
      fetchTactics(selectedTeamId)
    }
  }, [selectedTeamId, fetchPlayers, fetchTactics])

  // Same "keep the selection valid as the list changes" pattern
  // DrillPreview uses for selectedDrillId.
  useEffect(() => {
    if (selectedTacticId && tactics.some((t) => t.id === selectedTacticId)) return
    setSelectedTacticId(tactics[0]?.id ?? null)
  }, [tactics, selectedTacticId])

  const tactic = tactics.find((t) => t.id === selectedTacticId) ?? null

  // A pending (unsaved) note/arrow-start/player-placement belongs to the
  // tactic it was staged on — switching tactics discards it rather than
  // silently reattaching it to whatever's selected when committed.
  useEffect(() => {
    setPendingNote(null)
    setNoteText('')
    setPendingArrowStart(null)
    setPendingPlacePlayerId(null)
    setPlacementMode(null)
  }, [selectedTacticId])

  const placedPlayerIds = useMemo(
    () => new Set(tactic?.board.players.map((p) => p.player_id) ?? []),
    [tactic]
  )
  const unplacedByBucket = useMemo(() => {
    const groups = new Map<string, Player[]>()
    for (const player of players) {
      if (placedPlayerIds.has(player.id)) continue
      const bucket = bucketFor(player)
      groups.set(bucket, [...(groups.get(bucket) ?? []), player])
    }
    return groups
  }, [players, placedPlayerIds])

  // Adapter (Phase 3.3): map this tactic's board into the exact shape
  // PitchCanvas already knows how to render (a DrillPhase-like object) —
  // no changes needed to PitchCanvas itself. `team: 'own'` (a constant, not
  // per-player) means every placed player gets the same PLAYER color;
  // tactics don't have an "opposition" concept in v1.
  const canvasPhase = tactic
    ? {
        id: tactic.id,
        players: tactic.board.players.map((tp) => {
          const roster = players.find((p) => p.id === tp.player_id)
          return {
            id: tp.id,
            x: tp.x,
            y: tp.y,
            team: 'own',
            number: roster?.squad_number ?? undefined,
            label: roster?.name,
          }
        }),
        cones: [],
        balls: [],
        arrows: tactic.board.arrows,
        annotations: tactic.board.annotations,
      }
    : null

  const persistBoard = async (tacticId: string) => {
    const updated = useStore.getState().tactics.find((t) => t.id === tacticId)
    if (!updated) return
    setSaving(true)
    await updateTactic(tacticId, { board: updated.board })
    setSaving(false)
  }

  const handleTacticCreated = (created: Tactic) => {
    setSelectedTacticId(created.id)
  }

  const handleDragMove = (_elementType: string, elementId: string, position: { x: number; y: number }) => {
    if (!tactic) return
    setTacticPlayerPosition(tactic.id, elementId, position)
  }

  const handleDragEnd = (_elementType: string, elementId: string, position: { x: number; y: number }) => {
    if (!tactic) return
    setTacticPlayerPosition(tactic.id, elementId, position)
    void persistBoard(tactic.id)
  }

  const placementHint = pendingPlacePlayerId
    ? 'Tap the pitch to place this player'
    : pendingArrowStart
      ? 'Arrow started — tap the end point'
      : placementMode === 'note'
        ? 'Tap the pitch to place a note'
        : placementMode === 'arrow-player' || placementMode === 'arrow-ball'
          ? "Tap the pitch for the arrow's start point"
          : null

  const handleCanvasClick = (position: { x: number; y: number }) => {
    if (!tactic) return
    if (pendingPlacePlayerId) {
      addTacticPlayer(tactic.id, pendingPlacePlayerId, position)
      setPendingPlacePlayerId(null)
      void persistBoard(tactic.id)
      return
    }
    if (!placementMode || placementMode === 'remove') return
    if (placementMode === 'note') {
      setPendingNote(position)
      setNoteText('')
      return
    }
    // arrow-ball / arrow-player: same two-click stage-then-commit pattern
    // as DrillPreview.tsx's Phase 2C arrow tool.
    if (!pendingArrowStart) {
      setPendingArrowStart(position)
      return
    }
    addTacticArrow(tactic.id, pendingArrowStart, position, placementMode === 'arrow-ball' ? 'ball' : 'player')
    setPendingArrowStart(null)
    void persistBoard(tactic.id)
  }

  const togglePlacement = (mode: Exclude<PlacementMode, null>) => {
    setPlacementMode((m) => (m === mode ? null : mode))
    setPendingArrowStart(null)
    setPendingPlacePlayerId(null)
  }

  const handleSelectRosterPlayer = (playerId: string) => {
    setPendingPlacePlayerId((id) => (id === playerId ? null : playerId))
    setPlacementMode(null)
    setPendingArrowStart(null)
  }

  const handleElementRemove = (_elementType: string, elementId: string) => {
    if (!tactic) return
    removeTacticPlayer(tactic.id, elementId)
    void persistBoard(tactic.id)
  }

  const handleArrowRemove = (arrowId: string) => {
    if (!tactic) return
    removeTacticArrow(tactic.id, arrowId)
    void persistBoard(tactic.id)
  }

  const handleAnnotationRemove = (annotationId: string) => {
    if (!tactic) return
    removeTacticAnnotation(tactic.id, annotationId)
    void persistBoard(tactic.id)
  }

  const handleSaveNote = async (e: FormEvent) => {
    e.preventDefault()
    if (!tactic || !pendingNote || !noteText.trim()) return
    addTacticAnnotation(tactic.id, pendingNote, noteText.trim())
    setPendingNote(null)
    setNoteText('')
    await persistBoard(tactic.id)
  }

  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
      {/* Canvas column */}
      <div className="min-w-0 flex-1 space-y-3">
        {!selectedTeamId && <EmptyState icon={Shield} message="Select a team to build its tactics." />}
        {selectedTeamId && tacticsLoading && tactics.length === 0 && (
          <p className="text-sm text-ink-muted">Loading tactics…</p>
        )}
        {tacticsError && <p className="text-sm text-bad">{tacticsError}</p>}
        {selectedTeamId && !tacticsLoading && tactics.length === 0 && !tacticsError && (
          <EmptyState icon={Shield} message="No tactics yet for this team — create one on the right." />
        )}

        {tactic && canvasPhase && (
          <>
            <PitchCanvas
              pitchSize={TACTIC_PITCH_SIZE}
              orientation={TACTIC_ORIENTATION}
              phase={canvasPhase}
              maxWidth={960}
              editable
              onElementDragMove={handleDragMove}
              onElementDragEnd={handleDragEnd}
              annotationMode={pendingPlacePlayerId !== null || (placementMode !== null && placementMode !== 'remove')}
              onCanvasClick={handleCanvasClick}
              removeMode={placementMode === 'remove'}
              onElementClick={handleElementRemove}
              onAnnotationClick={handleAnnotationRemove}
              onArrowClick={handleArrowRemove}
              pendingArrowStart={pendingArrowStart}
              hintText={placementHint}
            />

            {pendingNote && (
              <form
                onSubmit={handleSaveNote}
                className="flex flex-wrap items-center gap-2 rounded-md border border-line bg-panel-raised p-2"
              >
                <label htmlFor="new-tactic-annotation-text" className="text-xs font-medium text-ink-muted">
                  Note
                </label>
                <input
                  id="new-tactic-annotation-text"
                  autoFocus
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  placeholder="e.g. Press trigger"
                  className="min-w-40 flex-1 rounded-md border border-line bg-panel px-2 py-1.5 text-sm text-ink outline-none focus:border-accent"
                />
                <button
                  type="submit"
                  disabled={!noteText.trim()}
                  className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50"
                >
                  Save note
                </button>
                <button
                  type="button"
                  onClick={() => setPendingNote(null)}
                  className="px-2 py-1.5 text-sm text-ink-muted"
                >
                  Cancel
                </button>
              </form>
            )}
          </>
        )}
      </div>

      {/* Right panel — tactic picker/create, roster (grouped by position,
          unplaced only), then drawing tools. */}
      {selectedTeamId && (
        <div className="space-y-4 rounded-xl border border-line bg-panel p-4 lg:w-80 lg:shrink-0">
          {tactics.length > 0 && (
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label htmlFor="tactic-picker" className="text-xs font-medium text-ink-muted">
                  Tactic
                </label>
                {saving && <span className="text-xs text-ink-faint">Saving…</span>}
              </div>
              <select
                id="tactic-picker"
                value={selectedTacticId ?? ''}
                onChange={(e) => setSelectedTacticId(e.target.value)}
                className="w-full rounded-md border border-line bg-panel-raised px-2 py-1.5 text-sm text-ink outline-none focus:border-accent"
              >
                {tactics.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <CreateTacticForm teamId={selectedTeamId} onCreate={createTactic} onCreated={handleTacticCreated} />

          {tactic && (
            <>
              <div className="space-y-3 border-t border-line pt-4">
                <p className="text-xs font-medium text-ink-muted">Roster — tap a player, then tap the pitch</p>
                {players.length === 0 && <p className="text-xs text-ink-faint">No players on this team yet.</p>}
                {POSITION_BUCKETS.concat({ label: 'Unassigned', positions: [] })
                  .map((bucket) => ({ bucket, list: unplacedByBucket.get(bucket.label) ?? [] }))
                  .filter(({ list }) => list.length > 0)
                  .map(({ bucket, list }) => (
                    <div key={bucket.label} className="space-y-1">
                      <p className="text-xs text-ink-faint">{bucket.label}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {list.map((player) => (
                          <button
                            key={player.id}
                            type="button"
                            onClick={() => handleSelectRosterPlayer(player.id)}
                            aria-pressed={pendingPlacePlayerId === player.id}
                            className={
                              'rounded-md border px-2 py-1 text-xs font-medium transition-colors ' +
                              (pendingPlacePlayerId === player.id
                                ? 'border-accent bg-accent text-white'
                                : 'border-line text-ink-muted hover:border-line-strong')
                            }
                          >
                            {player.squad_number != null ? `#${player.squad_number} ` : ''}
                            {player.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                {players.length > 0 && unplacedByBucket.size === 0 && (
                  <p className="text-xs text-ink-faint">Every roster player is already placed.</p>
                )}
              </div>

              {/* Drawing/remove tools — same two-click arrow gesture and
                  tap-toggle shape as DrillPreview's placement controls. */}
              <div className="flex flex-wrap items-center gap-2 border-t border-line pt-4">
                <PlacementToggle
                  mode="arrow-player"
                  active={placementMode}
                  onToggle={togglePlacement}
                  label="Player arrow"
                />
                <PlacementToggle mode="arrow-ball" active={placementMode} onToggle={togglePlacement} label="Ball arrow" />
                <PlacementToggle mode="note" active={placementMode} onToggle={togglePlacement} label="Note" />
                <PlacementToggle
                  mode="remove"
                  active={placementMode}
                  onToggle={togglePlacement}
                  label="Remove"
                  activeClassName="border-bad bg-bad text-white"
                />
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

function PlacementToggle({
  mode,
  active,
  onToggle,
  label,
  activeClassName = 'border-accent bg-accent text-white',
}: {
  mode: Exclude<PlacementMode, null>
  active: PlacementMode
  onToggle: (mode: Exclude<PlacementMode, null>) => void
  label: string
  activeClassName?: string
}) {
  const isActive = active === mode
  return (
    <button
      type="button"
      onClick={() => onToggle(mode)}
      aria-pressed={isActive}
      className={
        'rounded-md border px-2 py-1 text-xs font-medium transition-colors ' +
        (isActive ? activeClassName : 'border-line text-ink-muted hover:border-line-strong')
      }
    >
      {label}
    </button>
  )
}

// Modeled on DrillPreview's CreateDrillForm — no pitch size/orientation
// fields here (tactics are always full pitch, portrait), just a name.
function CreateTacticForm({
  teamId,
  onCreate,
  onCreated,
}: {
  teamId: string
  onCreate: (input: { team_id: string; name: string }) => Promise<Tactic | null>
  onCreated: (tactic: Tactic) => void
}) {
  const [name, setName] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!name.trim() || submitting) return
    setSubmitting(true)
    const created = await onCreate({ team_id: teamId, name: name.trim() })
    setSubmitting(false)
    if (created) {
      setName('')
      onCreated(created)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2 border-t border-line pt-4 first:border-t-0 first:pt-0">
      <div>
        <label htmlFor="new-tactic-name" className="block text-xs font-medium text-ink-muted">
          New tactic name
        </label>
        <input
          id="new-tactic-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. 4-3-3 — Build Up"
          className="mt-1 w-full rounded-md border border-line bg-panel-raised px-2 py-1.5 text-sm text-ink outline-none focus:border-accent"
        />
      </div>
      <button
        type="submit"
        disabled={!name.trim() || submitting}
        className="w-full rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50"
      >
        {submitting ? 'Creating…' : 'Create tactic'}
      </button>
    </form>
  )
}
