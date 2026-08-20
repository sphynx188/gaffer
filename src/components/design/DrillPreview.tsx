import { useEffect, useState, type FormEvent } from 'react'
import { PenTool } from 'lucide-react'
import { useStore } from '../../store'
import type { Drill, DrillElementType, NewDrillInput, NewPhaseMode, PitchOrientation, PitchSize } from '../../store'
import { PITCH_ORIENTATION_LABELS, PITCH_SIZE_LABELS } from '../../store'
import { PitchCanvas } from './PitchCanvas'
import { EmptyState } from '../ui/EmptyState'
import { NumberChip } from '../ui/NumberChip'

const pitchSizeOptions: PitchSize[] = ['full', 'three_quarter', 'half', 'quarter']
const pitchOrientationOptions: PitchOrientation[] = ['portrait', 'landscape']

function pitchLabel(size: PitchSize, orientation: PitchOrientation): string {
  return `${PITCH_SIZE_LABELS[size] ?? size} · ${PITCH_ORIENTATION_LABELS[orientation] ?? orientation}`
}

// The full set of mutually-exclusive "click the pitch to place/remove
// something" modes. Only one can be active at a time — mirrors the original
// note-only toggle this replaces, just widened to cover every element type
// the canvas can now create. 'witches-hat'/'mannequin' (Upgrade Phase 2B)
// both place a 'cones' element, just with a different EquipmentKind.
// 'arrow-ball'/'arrow-player' (Upgrade Phase 2C) are the one two-click mode
// — see handleCanvasClick/pendingArrowStart.
type PlacementMode =
  | 'player-a'
  | 'player-b'
  | 'cone'
  | 'witches-hat'
  | 'mannequin'
  | 'ball'
  | 'arrow-ball'
  | 'arrow-player'
  | 'note'
  | 'remove'
  | null

// Phase 2a — Static pitch renderer (US-10, partial).
// Phase 2b — Drag-and-drop persistence (US-11).
// Phase 2c — Multi-phase step-through + annotations (US-12, US-13; all
// gaffer_mvp_build_steps.md). This is the screen that hosts PitchCanvas:
// pick one of the current team's drills (coach-owned drills — team_id null —
// show up regardless of team, same scoping as drillSlice.fetchDrills
// elsewhere), step through its ordered `phases[]`, and edit whichever phase
// is currently in view. The canvas is editable — dragging a player/cone/ball
// updates local (Zustand) state on every `dragmove` for a responsive canvas,
// then fires exactly one `updateDrill` write to persist `drill.phases` on
// `dragend`. Add/delete-phase and add-annotation are local-only store
// mutations too (drillSlice.addPhase/deletePhase/addAnnotation) and follow
// that exact same local-update-then-one-write pattern via `persistPhases`
// below, so every phases-array mutation — however it originated — ends in
// exactly one Supabase write.
//
// Redesign — restructured from "canvas, then controls stacked below" into a
// two-column layout: the pitch fills the left/main column, and every control
// (drill picker, phase stepper/meta, phase add/delete, placement toggles)
// lives in a right-side panel, closer to the First Phase Studio reference
// the user shared. The interaction logic itself is unchanged from the prior
// pass — this is a layout move, not a behavior change.
export function DrillPreview() {
  const selectedTeamId = useStore((s) => s.selectedTeamId)
  const drills = useStore((s) => s.drills)
  const drillsLoading = useStore((s) => s.drillsLoading)
  const drillsError = useStore((s) => s.drillsError)
  const fetchDrills = useStore((s) => s.fetchDrills)
  const createDrill = useStore((s) => s.createDrill)
  const setPhaseElementPosition = useStore((s) => s.setPhaseElementPosition)
  const addPhase = useStore((s) => s.addPhase)
  const deletePhase = useStore((s) => s.deletePhase)
  const addAnnotation = useStore((s) => s.addAnnotation)
  const removeAnnotation = useStore((s) => s.removeAnnotation)
  const addElement = useStore((s) => s.addElement)
  const removeElement = useStore((s) => s.removeElement)
  const addArrow = useStore((s) => s.addArrow)
  const removeArrow = useStore((s) => s.removeArrow)
  const updatePhaseMeta = useStore((s) => s.updatePhaseMeta)
  const updateDrill = useStore((s) => s.updateDrill)

  const [selectedDrillId, setSelectedDrillId] = useState<string | null>(null)
  const [phaseIndex, setPhaseIndex] = useState(0)
  const [saving, setSaving] = useState(false)
  const [placementMode, setPlacementMode] = useState<PlacementMode>(null)
  const [pendingNote, setPendingNote] = useState<{ x: number; y: number } | null>(null)
  const [noteText, setNoteText] = useState('')
  // Upgrade Phase 2C: the staged first point of a two-click arrow — set on
  // the first canvas click while an 'arrow-*' mode is active, consumed
  // (and cleared) on the second, same "stage then commit" shape as
  // pendingNote above, just with a position instead of a form.
  const [pendingArrowStart, setPendingArrowStart] = useState<{ x: number; y: number } | null>(null)

  // Phase label/duration form fields — local, dirty-tracked (same pattern
  // AvailabilityRow uses), synced from the store whenever the phase/drill
  // selection itself changes (see the pendingNote-reset effect below, which
  // this shares a dependency array with) rather than on every store update,
  // so an in-progress edit here isn't stomped by an unrelated canvas change
  // (e.g. dragging a player) on the same phase.
  const [phaseLabel, setPhaseLabel] = useState('')
  const [phaseDuration, setPhaseDuration] = useState('')
  const [phaseMetaDirty, setPhaseMetaDirty] = useState(false)

  useEffect(() => {
    if (selectedTeamId) fetchDrills(selectedTeamId)
  }, [selectedTeamId, fetchDrills])

  // Keep the selection valid as the drill list changes (team switch, new
  // drill created elsewhere) rather than silently pointing at a stale id —
  // same pattern teamSlice uses for `selectedTeamId`.
  useEffect(() => {
    if (selectedDrillId && drills.some((d) => d.id === selectedDrillId)) return
    setSelectedDrillId(drills[0]?.id ?? null)
  }, [drills, selectedDrillId])

  const drill = drills.find((d) => d.id === selectedDrillId) ?? null

  // Deleting a phase (or switching to a drill with fewer phases than the
  // index currently points at) can leave `phaseIndex` past the end — clamp
  // back onto the last real phase rather than rendering nothing, which is
  // what "no stale elements bleeding through" (2c's Definition of Done)
  // means when the phase list itself shrinks out from under the viewer.
  useEffect(() => {
    if (!drill) return
    if (phaseIndex > drill.phases.length - 1) setPhaseIndex(Math.max(0, drill.phases.length - 1))
  }, [drill, phaseIndex])

  // A pending (unsaved) note belongs to the phase it was placed on — switch
  // phases or drills and it's discarded rather than silently reattached to
  // whatever phase happens to be current when the form is eventually submitted.
  useEffect(() => {
    setPendingNote(null)
    setNoteText('')
  }, [phaseIndex, selectedDrillId])

  // Same reasoning as the pendingNote effect above — a half-drawn arrow
  // belongs to the phase it was started on.
  useEffect(() => {
    setPendingArrowStart(null)
  }, [phaseIndex, selectedDrillId])

  const phase = drill?.phases[phaseIndex] ?? null

  useEffect(() => {
    setPhaseLabel(phase?.label ?? '')
    setPhaseDuration(phase?.duration_seconds != null ? String(phase.duration_seconds) : '')
    setPhaseMetaDirty(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phaseIndex, selectedDrillId])

  const handleSelectDrill = (id: string) => {
    setSelectedDrillId(id)
    setPhaseIndex(0)
    setPlacementMode(null)
  }

  const handleDrillCreated = (created: Drill) => {
    handleSelectDrill(created.id)
  }

  // Every phases-array mutation below is applied to the store locally first
  // (no network), then this reads the just-updated drill back out and fires
  // exactly one Supabase write — the split 2b established for drag-and-drop
  // (see setPhaseElementPosition), reused here for add/delete-phase and
  // add-annotation instead of duplicating a bespoke write per action.
  const persistPhases = async (drillId: string) => {
    const updated = useStore.getState().drills.find((d) => d.id === drillId)
    if (!updated) return
    setSaving(true)
    await updateDrill(drillId, { phases: updated.phases })
    setSaving(false)
  }

  // dragmove: local-state-only reposition, no network call — keeps the
  // canvas responsive while dragging (gaffer_mvp_build_steps.md 2b, step 2).
  const handleDragMove = (elementType: DrillElementType, elementId: string, position: { x: number; y: number }) => {
    if (!drill) return
    setPhaseElementPosition(drill.id, phaseIndex, elementType, elementId, position)
  }

  // dragend: apply the same local update, then persist via the one shared
  // write (2b, step 3) — never more than one write per drag.
  const handleDragEnd = (elementType: DrillElementType, elementId: string, position: { x: number; y: number }) => {
    if (!drill) return
    setPhaseElementPosition(drill.id, phaseIndex, elementType, elementId, position)
    void persistPhases(drill.id)
  }

  // "Duplicate phase" / "Add blank phase" (2c, step 2): inserts immediately
  // after the phase currently in view, then steps forward onto it so the
  // coach lands straight on the new phase rather than the one they were just
  // looking at.
  const handleAddPhase = (mode: NewPhaseMode) => {
    if (!drill) return
    addPhase(drill.id, phaseIndex, mode)
    setPhaseIndex((i) => i + 1)
    void persistPhases(drill.id)
  }

  // "Delete phase" (2c, step 2): a drill always keeps at least one phase —
  // drillSlice.deletePhase itself no-ops rather than emptying `phases`, so
  // there's nothing extra to guard here beyond disabling the button (below).
  const handleDeletePhase = () => {
    if (!drill || drill.phases.length <= 1) return
    deletePhase(drill.id, phaseIndex)
    void persistPhases(drill.id)
  }

  // Canvas click while a placement mode is active: 'note' stages the
  // position and hands off to the inline text form below the canvas (2c,
  // step 4, unchanged); 'arrow-*' stages the first point on the first
  // click and commits an arrow on the second (Upgrade Phase 2C — the one
  // two-click placement mode here, everything else is a single click);
  // every other element mode places the new player/cone/ball immediately
  // at the clicked position and persists it — no intermediate form, same
  // as a drag commits immediately on dragend.
  const handleCanvasClick = (position: { x: number; y: number }) => {
    if (!drill || !placementMode || placementMode === 'remove') return
    if (placementMode === 'note') {
      setPendingNote(position)
      setNoteText('')
      return
    }
    if (placementMode === 'arrow-ball' || placementMode === 'arrow-player') {
      if (!pendingArrowStart) {
        setPendingArrowStart(position)
        return
      }
      addArrow(drill.id, phaseIndex, pendingArrowStart, position, placementMode === 'arrow-ball' ? 'ball' : 'player')
      setPendingArrowStart(null)
      void persistPhases(drill.id)
      return
    }
    if (placementMode === 'ball') {
      addElement(drill.id, phaseIndex, 'balls', position)
    } else if (placementMode === 'cone' || placementMode === 'witches-hat' || placementMode === 'mannequin') {
      const kind = placementMode === 'witches-hat' ? 'witches_hat' : placementMode === 'mannequin' ? 'mannequin' : 'cone'
      addElement(drill.id, phaseIndex, 'cones', position, { kind })
    } else {
      addElement(drill.id, phaseIndex, 'players', position, { team: placementMode === 'player-a' ? 'A' : 'B' })
    }
    void persistPhases(drill.id)
  }

  // What to show below the canvas for the currently active placement mode
  // — PitchCanvas itself doesn't know which specific mode is active, only
  // the booleans/callbacks it maps to, so the copy lives here.
  const placementHint = pendingArrowStart
    ? 'Arrow started — tap the end point'
    : placementMode === 'note'
      ? 'Tap the pitch to place a note'
      : placementMode === 'arrow-player' || placementMode === 'arrow-ball'
        ? "Tap the pitch for the arrow's start point"
        : placementMode && placementMode !== 'remove'
          ? 'Tap the pitch to place it'
          : null

  // Toggle one placement mode on/off — clicking the already-active button
  // turns placement off rather than switching to itself. Always discards
  // any in-progress (unclicked-through) arrow start: switching tools
  // mid-gesture abandons that half-drawn arrow rather than leaving it to
  // be silently consumed by whatever mode comes next.
  const togglePlacement = (mode: Exclude<PlacementMode, null>) => {
    setPlacementMode((m) => (m === mode ? null : mode))
    setPendingArrowStart(null)
  }

  // Click on an existing player/cone/ball while in "remove" mode.
  const handleElementRemove = (elementType: DrillElementType, elementId: string) => {
    if (!drill) return
    removeElement(drill.id, phaseIndex, elementType, elementId)
    void persistPhases(drill.id)
  }

  // Click on an existing arrow while in "remove" mode.
  const handleArrowRemove = (arrowId: string) => {
    if (!drill) return
    removeArrow(drill.id, phaseIndex, arrowId)
    void persistPhases(drill.id)
  }

  // Click on an existing annotation while in "remove" mode.
  const handleAnnotationRemove = (annotationId: string) => {
    if (!drill) return
    removeAnnotation(drill.id, phaseIndex, annotationId)
    void persistPhases(drill.id)
  }

  const handleSaveNote = async (e: FormEvent) => {
    e.preventDefault()
    if (!drill || !pendingNote || !noteText.trim()) return
    addAnnotation(drill.id, phaseIndex, pendingNote, noteText.trim())
    setPendingNote(null)
    setNoteText('')
    await persistPhases(drill.id)
  }

  const handleSavePhaseMeta = async (e: FormEvent) => {
    e.preventDefault()
    if (!drill || !phaseMetaDirty) return
    updatePhaseMeta(drill.id, phaseIndex, {
      label: phaseLabel.trim() || undefined,
      duration_seconds: phaseDuration ? Number(phaseDuration) : undefined,
    })
    setPhaseMetaDirty(false)
    await persistPhases(drill.id)
  }

  return (
    <div className="space-y-4">
      {/* Top settings bar — drill selection/creation, pitch size, and phase
          navigation/management: everything that's a *setting* about the
          current drill or phase, rather than a thing you place on the
          pitch. Wraps onto multiple lines on narrow screens, but reads as
          one horizontal options bar on desktop — the element/tool palette
          lives in the right-side rail instead (see below). */}
      {selectedTeamId && (
        <div className="flex flex-wrap items-end gap-x-6 gap-y-3 rounded-xl border border-line bg-panel p-3">
          {drills.length > 0 && (
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <label htmlFor="drill-preview-picker" className="text-xs font-medium text-ink-muted">
                  Drill
                </label>
                {saving && <span className="text-xs text-ink-faint">Saving…</span>}
              </div>
              <select
                id="drill-preview-picker"
                value={selectedDrillId ?? ''}
                onChange={(e) => handleSelectDrill(e.target.value)}
                className="w-56 rounded-md border border-line bg-panel-raised px-2 py-1.5 text-sm text-ink outline-none focus:border-accent"
              >
                {drills.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({pitchLabel(d.pitch_size, d.orientation)})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Always available, not just when a team has zero drills (matches
              TeamManagement's always-visible create form) — creating a drill
              here immediately selects it (handleDrillCreated), landing the
              coach straight on its one starter phase, ready to place elements. */}
          <CreateDrillForm teamId={selectedTeamId} onCreate={createDrill} onCreated={handleDrillCreated} />

          {drill && phase && (
            <>
              {/* Phase stepper (2c, US-12) + editable label/duration — step
                  forward/back swaps which phase index is current; PitchCanvas
                  fully re-renders from the new phase's own element arrays, so
                  there's never a leftover element from the previous phase. */}
              <div className="flex flex-wrap items-end gap-3 border-l border-line pl-6">
                <div className="space-y-1">
                  <span className="block text-xs font-medium text-ink-muted">Phase</span>
                  <div className="flex items-center gap-1">
                    <NumberChip index={phaseIndex + 1} />
                    <span className="text-xs text-ink-muted">of {drill.phases.length}</span>
                    <button
                      type="button"
                      onClick={() => setPhaseIndex((i) => Math.max(0, i - 1))}
                      disabled={phaseIndex === 0}
                      className="ml-1 rounded-md border border-line px-2 py-1 text-xs text-ink-muted disabled:opacity-40"
                    >
                      ← Prev
                    </button>
                    <button
                      type="button"
                      onClick={() => setPhaseIndex((i) => Math.min(drill.phases.length - 1, i + 1))}
                      disabled={phaseIndex >= drill.phases.length - 1}
                      className="rounded-md border border-line px-2 py-1 text-xs text-ink-muted disabled:opacity-40"
                    >
                      Next →
                    </button>
                  </div>
                </div>
                <form onSubmit={handleSavePhaseMeta} className="flex flex-wrap items-end gap-2">
                  <div>
                    <label htmlFor="phase-label" className="block text-xs font-medium text-ink-muted">
                      Block title
                    </label>
                    <input
                      id="phase-label"
                      value={phaseLabel}
                      onChange={(e) => {
                        setPhaseLabel(e.target.value)
                        setPhaseMetaDirty(true)
                      }}
                      placeholder="e.g. Directional possession"
                      className="mt-1 w-44 rounded-md border border-line bg-panel-raised px-2 py-1.5 text-sm text-ink outline-none focus:border-accent"
                    />
                  </div>
                  <div>
                    <label htmlFor="phase-duration" className="block text-xs font-medium text-ink-muted">
                      Duration (s)
                    </label>
                    <input
                      id="phase-duration"
                      type="number"
                      min={0}
                      value={phaseDuration}
                      onChange={(e) => {
                        setPhaseDuration(e.target.value)
                        setPhaseMetaDirty(true)
                      }}
                      className="mt-1 w-20 rounded-md border border-line bg-panel-raised px-2 py-1.5 text-sm text-ink outline-none focus:border-accent"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={!phaseMetaDirty}
                    className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50"
                  >
                    Save
                  </button>
                </form>
              </div>

              {/* Phase controls (2c, step 2) */}
              <div className="flex flex-wrap items-end gap-2 border-l border-line pl-6">
                <button
                  type="button"
                  onClick={() => handleAddPhase('duplicate')}
                  className="rounded-md border border-line px-2 py-1 text-xs text-ink-muted hover:border-line-strong"
                >
                  Duplicate phase
                </button>
                <button
                  type="button"
                  onClick={() => handleAddPhase('blank')}
                  className="rounded-md border border-line px-2 py-1 text-xs text-ink-muted hover:border-line-strong"
                >
                  Add blank phase
                </button>
                <button
                  type="button"
                  onClick={handleDeletePhase}
                  disabled={drill.phases.length <= 1}
                  title={drill.phases.length <= 1 ? 'A drill needs at least one phase' : undefined}
                  className="rounded-md border border-bad/30 px-2 py-1 text-xs text-bad hover:border-bad/60 disabled:opacity-40"
                >
                  Delete phase
                </button>
              </div>
            </>
          )}
        </div>
      )}

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        {/* Canvas column */}
        <div className="min-w-0 flex-1 space-y-3">
          {!selectedTeamId && <EmptyState icon={PenTool} message="Select a team to preview its drills." />}
          {selectedTeamId && drillsLoading && drills.length === 0 && (
            <p className="text-sm text-ink-muted">Loading drills…</p>
          )}
          {drillsError && <p className="text-sm text-bad">{drillsError}</p>}
          {selectedTeamId && !drillsLoading && drills.length === 0 && !drillsError && (
            <EmptyState icon={PenTool} message="No drills yet for this team — create one above." />
          )}

          {drill && phase && (
            <>
              <PitchCanvas
                pitchSize={drill.pitch_size}
                orientation={drill.orientation}
                phase={phase}
                maxWidth={960}
                editable
                onElementDragMove={handleDragMove}
                onElementDragEnd={handleDragEnd}
                annotationMode={placementMode !== null && placementMode !== 'remove'}
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
                  <label htmlFor="new-annotation-text" className="text-xs font-medium text-ink-muted">
                    Note
                  </label>
                  <input
                    id="new-annotation-text"
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

        {/* Right tool rail — Photoshop-style: every element/tool you can add
            to (or remove from) the pitch, and nothing else. Two columns so
            it reads as a compact palette rather than a long single list. */}
        {drill && phase && (
          <div className="grid grid-cols-2 content-start gap-2 rounded-xl border border-line bg-panel p-3 lg:w-44 lg:shrink-0">
            <p className="col-span-2 text-xs font-medium text-ink-muted">Tools</p>
            <PlacementToggle mode="player-a" active={placementMode} onToggle={togglePlacement} label="Player A" />
            <PlacementToggle mode="player-b" active={placementMode} onToggle={togglePlacement} label="Player B" />
            <PlacementToggle mode="cone" active={placementMode} onToggle={togglePlacement} label="Cone" />
            <PlacementToggle
              mode="witches-hat"
              active={placementMode}
              onToggle={togglePlacement}
              label="Witches' hat"
            />
            <PlacementToggle mode="mannequin" active={placementMode} onToggle={togglePlacement} label="Mannequin" />
            <PlacementToggle mode="ball" active={placementMode} onToggle={togglePlacement} label="Ball" />
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
              className="border-bad/30 text-bad hover:border-bad/60"
              activeClassName="border-bad bg-bad text-white"
            />
          </div>
        )}
      </div>
    </div>
  )
}

// One toggle button in the placement-controls row — active styling and the
// toggle-off-when-already-active behavior live in `togglePlacement` above,
// this just renders consistently for every mode instead of repeating the
// className logic six times inline.
function PlacementToggle({
  mode,
  active,
  onToggle,
  label,
  className = '',
  activeClassName = 'border-accent bg-accent text-white',
}: {
  mode: Exclude<PlacementMode, null>
  active: PlacementMode
  onToggle: (mode: Exclude<PlacementMode, null>) => void
  label: string
  className?: string
  activeClassName?: string
}) {
  const isActive = active === mode
  return (
    <button
      type="button"
      onClick={() => onToggle(mode)}
      aria-pressed={isActive}
      className={
        'w-full rounded-md border px-2 py-1.5 text-center text-xs font-medium transition-colors ' +
        (isActive ? activeClassName : `border-line text-ink-muted hover:border-line-strong ${className}`)
      }
    >
      {label}
    </button>
  )
}

// Create-drill form — modeled directly on TeamManagement.tsx's
// CreateTeamForm for visual/behavioral consistency (labeled inputs,
// `submitting` state, clears the name field on success). `onCreated` fires
// with the new row so the caller can select it immediately.
function CreateDrillForm({
  teamId,
  onCreate,
  onCreated,
}: {
  teamId: string
  onCreate: (input: NewDrillInput) => Promise<Drill | null>
  onCreated: (drill: Drill) => void
}) {
  const [name, setName] = useState('')
  const [pitchSize, setPitchSize] = useState<PitchSize>('full')
  // Portrait matches how a full pitch has always rendered here (narrower
  // than tall) — kept as the default across every size so switching size
  // doesn't also silently switch orientation underneath the coach.
  const [orientation, setOrientation] = useState<PitchOrientation>('portrait')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!name.trim() || submitting) return
    setSubmitting(true)
    const created = await onCreate({
      team_id: teamId,
      name: name.trim(),
      pitch_size: pitchSize,
      orientation,
    })
    setSubmitting(false)
    if (created) {
      setName('')
      onCreated(created)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-2">
      <div>
        <label htmlFor="new-drill-name" className="block text-xs font-medium text-ink-muted">
          New drill name
        </label>
        <input
          id="new-drill-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Rondo warm-up"
          className="mt-1 w-44 rounded-md border border-line bg-panel-raised px-2 py-1.5 text-sm text-ink outline-none focus:border-accent"
        />
      </div>
      <div>
        <label htmlFor="new-drill-size" className="block text-xs font-medium text-ink-muted">
          Pitch size
        </label>
        <select
          id="new-drill-size"
          value={pitchSize}
          onChange={(e) => setPitchSize(e.target.value as PitchSize)}
          className="mt-1 rounded-md border border-line bg-panel-raised px-2 py-1.5 text-sm text-ink outline-none focus:border-accent"
        >
          {pitchSizeOptions.map((s) => (
            <option key={s} value={s}>
              {PITCH_SIZE_LABELS[s] ?? s}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="new-drill-orientation" className="block text-xs font-medium text-ink-muted">
          Orientation
        </label>
        <select
          id="new-drill-orientation"
          value={orientation}
          onChange={(e) => setOrientation(e.target.value as PitchOrientation)}
          className="mt-1 rounded-md border border-line bg-panel-raised px-2 py-1.5 text-sm text-ink outline-none focus:border-accent"
        >
          {pitchOrientationOptions.map((o) => (
            <option key={o} value={o}>
              {PITCH_ORIENTATION_LABELS[o] ?? o}
            </option>
          ))}
        </select>
      </div>
      <button
        type="submit"
        disabled={!name.trim() || submitting}
        className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50"
      >
        {submitting ? 'Creating…' : 'Create drill'}
      </button>
    </form>
  )
}
