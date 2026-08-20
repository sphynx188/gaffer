import { useEffect, useState, type FormEvent } from 'react'
import { PenTool } from 'lucide-react'
import { useStore } from '../../store'
import type { Drill, DrillElementType, NewDrillInput, NewPhaseMode, PitchFormat } from '../../store'
import { PITCH_FORMAT_LABELS } from '../../store'
import { PitchCanvas } from './PitchCanvas'
import { EmptyState } from '../ui/EmptyState'
import { NumberChip } from '../ui/NumberChip'

const formatOptions: PitchFormat[] = ['11v11', 'small_sided']

// The full set of mutually-exclusive "click the pitch to place/remove
// something" modes. Only one can be active at a time — mirrors the original
// note-only toggle this replaces, just widened to cover every element type
// the canvas can now create.
type PlacementMode = 'player-a' | 'player-b' | 'cone' | 'ball' | 'note' | 'remove' | null

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
  const updatePhaseMeta = useStore((s) => s.updatePhaseMeta)
  const updateDrill = useStore((s) => s.updateDrill)

  const [selectedDrillId, setSelectedDrillId] = useState<string | null>(null)
  const [phaseIndex, setPhaseIndex] = useState(0)
  const [saving, setSaving] = useState(false)
  const [placementMode, setPlacementMode] = useState<PlacementMode>(null)
  const [pendingNote, setPendingNote] = useState<{ x: number; y: number } | null>(null)
  const [noteText, setNoteText] = useState('')

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
  // step 4, unchanged); every element mode instead places the new
  // player/cone/ball immediately at the clicked position and persists it —
  // no intermediate form, same as a drag commits immediately on dragend.
  const handleCanvasClick = (position: { x: number; y: number }) => {
    if (!drill || !placementMode || placementMode === 'remove') return
    if (placementMode === 'note') {
      setPendingNote(position)
      setNoteText('')
      return
    }
    if (placementMode === 'cone' || placementMode === 'ball') {
      addElement(drill.id, phaseIndex, placementMode === 'cone' ? 'cones' : 'balls', position)
    } else {
      addElement(drill.id, phaseIndex, 'players', position, { team: placementMode === 'player-a' ? 'A' : 'B' })
    }
    void persistPhases(drill.id)
  }

  // Toggle one placement mode on/off — clicking the already-active button
  // turns placement off rather than switching to itself.
  const togglePlacement = (mode: Exclude<PlacementMode, null>) => {
    setPlacementMode((m) => (m === mode ? null : mode))
  }

  // Click on an existing player/cone/ball while in "remove" mode.
  const handleElementRemove = (elementType: DrillElementType, elementId: string) => {
    if (!drill) return
    removeElement(drill.id, phaseIndex, elementType, elementId)
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
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
      {/* Canvas column */}
      <div className="min-w-0 flex-1 space-y-3">
        {!selectedTeamId && <EmptyState icon={PenTool} message="Select a team to preview its drills." />}
        {selectedTeamId && drillsLoading && drills.length === 0 && (
          <p className="text-sm text-ink-muted">Loading drills…</p>
        )}
        {drillsError && <p className="text-sm text-bad">{drillsError}</p>}
        {selectedTeamId && !drillsLoading && drills.length === 0 && !drillsError && (
          <EmptyState icon={PenTool} message="No drills yet for this team — create one on the right." />
        )}

        {drill && phase && (
          <>
            <PitchCanvas
              pitchFormat={drill.pitch_format}
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

      {/* Right panel — every control lives here, closer to the reference's
          Block Title/Duration/Load panel layout, rather than stacked below
          the canvas. */}
      {selectedTeamId && (
        <div className="space-y-4 rounded-xl border border-line bg-panel p-4 lg:w-80 lg:shrink-0">
          {drills.length > 0 && (
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label htmlFor="drill-preview-picker" className="text-xs font-medium text-ink-muted">
                  Drill
                </label>
                {saving && <span className="text-xs text-ink-faint">Saving…</span>}
              </div>
              <select
                id="drill-preview-picker"
                value={selectedDrillId ?? ''}
                onChange={(e) => handleSelectDrill(e.target.value)}
                className="w-full rounded-md border border-line bg-panel-raised px-2 py-1.5 text-sm text-ink outline-none focus:border-accent"
              >
                {drills.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({PITCH_FORMAT_LABELS[d.pitch_format] ?? d.pitch_format})
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
              <div className="space-y-2 border-t border-line pt-4">
                <div className="flex items-center gap-2">
                  <NumberChip index={phaseIndex + 1} />
                  <span className="text-xs font-medium text-ink-muted">of {drill.phases.length} phases</span>
                  <div className="ml-auto flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setPhaseIndex((i) => Math.max(0, i - 1))}
                      disabled={phaseIndex === 0}
                      className="rounded-md border border-line px-2 py-1 text-xs text-ink-muted disabled:opacity-40"
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
                <form onSubmit={handleSavePhaseMeta} className="space-y-2">
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
                      className="mt-1 w-full rounded-md border border-line bg-panel-raised px-2 py-1.5 text-sm text-ink outline-none focus:border-accent"
                    />
                  </div>
                  <div>
                    <label htmlFor="phase-duration" className="block text-xs font-medium text-ink-muted">
                      Duration (seconds)
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
                      className="mt-1 w-full rounded-md border border-line bg-panel-raised px-2 py-1.5 text-sm text-ink outline-none focus:border-accent"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={!phaseMetaDirty}
                    className="w-full rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50"
                  >
                    Save phase details
                  </button>
                </form>
              </div>

              {/* Phase controls (2c, step 2) */}
              <div className="flex flex-wrap items-center gap-2 border-t border-line pt-4">
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

              {/* Placement controls (adds players/cones/balls/notes, and
                  removes any of them). */}
              <div className="flex flex-wrap items-center gap-2 border-t border-line pt-4">
                <PlacementToggle mode="player-a" active={placementMode} onToggle={togglePlacement} label="Player A" />
                <PlacementToggle mode="player-b" active={placementMode} onToggle={togglePlacement} label="Player B" />
                <PlacementToggle mode="cone" active={placementMode} onToggle={togglePlacement} label="Cone" />
                <PlacementToggle mode="ball" active={placementMode} onToggle={togglePlacement} label="Ball" />
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
            </>
          )}
        </div>
      )}
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
        'rounded-md border px-2 py-1 text-xs font-medium transition-colors ' +
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
  const [format, setFormat] = useState<PitchFormat>('11v11')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!name.trim() || submitting) return
    setSubmitting(true)
    const created = await onCreate({ team_id: teamId, name: name.trim(), pitch_format: format })
    setSubmitting(false)
    if (created) {
      setName('')
      onCreated(created)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2 border-t border-line pt-4 first:border-t-0 first:pt-0">
      <div>
        <label htmlFor="new-drill-name" className="block text-xs font-medium text-ink-muted">
          New drill name
        </label>
        <input
          id="new-drill-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Rondo warm-up"
          className="mt-1 w-full rounded-md border border-line bg-panel-raised px-2 py-1.5 text-sm text-ink outline-none focus:border-accent"
        />
      </div>
      <div>
        <label htmlFor="new-drill-format" className="block text-xs font-medium text-ink-muted">
          Pitch format
        </label>
        <select
          id="new-drill-format"
          value={format}
          onChange={(e) => setFormat(e.target.value as PitchFormat)}
          className="mt-1 w-full rounded-md border border-line bg-panel-raised px-2 py-1.5 text-sm text-ink outline-none focus:border-accent"
        >
          {formatOptions.map((f) => (
            <option key={f} value={f}>
              {PITCH_FORMAT_LABELS[f] ?? f}
            </option>
          ))}
        </select>
      </div>
      <button
        type="submit"
        disabled={!name.trim() || submitting}
        className="w-full rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50"
      >
        {submitting ? 'Creating…' : 'Create drill'}
      </button>
    </form>
  )
}
