import { useEffect, useState, type FormEvent } from 'react'
import { useStore } from '../../store'
import type { DrillElementType, NewPhaseMode } from '../../store'
import { PitchCanvas } from './PitchCanvas'

const formatLabel: Record<string, string> = {
  '11v11': '11-a-side',
  small_sided: 'Small-sided',
}

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
export function DrillPreview() {
  const selectedTeamId = useStore((s) => s.selectedTeamId)
  const drills = useStore((s) => s.drills)
  const drillsLoading = useStore((s) => s.drillsLoading)
  const drillsError = useStore((s) => s.drillsError)
  const fetchDrills = useStore((s) => s.fetchDrills)
  const setPhaseElementPosition = useStore((s) => s.setPhaseElementPosition)
  const addPhase = useStore((s) => s.addPhase)
  const deletePhase = useStore((s) => s.deletePhase)
  const addAnnotation = useStore((s) => s.addAnnotation)
  const updateDrill = useStore((s) => s.updateDrill)

  const [selectedDrillId, setSelectedDrillId] = useState<string | null>(null)
  const [phaseIndex, setPhaseIndex] = useState(0)
  const [saving, setSaving] = useState(false)
  const [noteMode, setNoteMode] = useState(false)
  const [pendingNote, setPendingNote] = useState<{ x: number; y: number } | null>(null)
  const [noteText, setNoteText] = useState('')

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

  const handleSelectDrill = (id: string) => {
    setSelectedDrillId(id)
    setPhaseIndex(0)
    setNoteMode(false)
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

  // Canvas click while in "add note" mode (2c, step 4): stages the position;
  // the inline form below the canvas collects the text and actually saves it.
  const handleCanvasClick = (position: { x: number; y: number }) => {
    if (!drill) return
    setPendingNote(position)
    setNoteText('')
  }

  const handleSaveNote = async (e: FormEvent) => {
    e.preventDefault()
    if (!drill || !pendingNote || !noteText.trim()) return
    addAnnotation(drill.id, phaseIndex, pendingNote, noteText.trim())
    setPendingNote(null)
    setNoteText('')
    await persistPhases(drill.id)
  }

  return (
    <div className="w-full max-w-lg space-y-3 border-t border-slate-200 pt-6">
      <p className="text-xs uppercase tracking-wide text-slate-400">
        2c — pitch designer (multi-phase step-through, tap to annotate)
      </p>
      <h2 className="text-sm font-semibold text-slate-700">Design</h2>

      {!selectedTeamId && <p className="text-sm text-slate-400">Select a team above to preview its drills.</p>}
      {selectedTeamId && drillsLoading && drills.length === 0 && (
        <p className="text-sm text-slate-400">Loading drills…</p>
      )}
      {drillsError && <p className="text-sm text-red-600">{drillsError}</p>}
      {selectedTeamId && !drillsLoading && drills.length === 0 && !drillsError && (
        <p className="text-sm text-slate-400">
          No drills yet for this team. Create one (see the spike form below) to preview it here.
        </p>
      )}

      {drills.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor="drill-preview-picker" className="text-xs font-medium text-slate-500">
            Drill
          </label>
          <select
            id="drill-preview-picker"
            value={selectedDrillId ?? ''}
            onChange={(e) => handleSelectDrill(e.target.value)}
            className="rounded-md border border-slate-300 px-2 py-1.5 text-sm text-slate-900 outline-none focus:border-slate-500"
          >
            {drills.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name} ({formatLabel[d.pitch_format] ?? d.pitch_format})
              </option>
            ))}
          </select>
          {saving && <span className="text-xs text-slate-400">Saving…</span>}
        </div>
      )}

      {drill && phase && (
        <>
          <p className="text-sm text-slate-600">
            {drill.name} · {formatLabel[drill.pitch_format] ?? drill.pitch_format}
          </p>

          {/* Phase stepper (2c, US-12) — step forward/back swaps which phase
              index is current; PitchCanvas fully re-renders from the new
              phase's own element arrays, so there's never a leftover
              element from the previous phase. */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setPhaseIndex((i) => Math.max(0, i - 1))}
              disabled={phaseIndex === 0}
              className="rounded-md border border-slate-300 px-2 py-1 text-sm text-slate-700 disabled:opacity-40"
            >
              ← Prev
            </button>
            <span className="text-sm text-slate-600">
              Phase {phaseIndex + 1} of {drill.phases.length}
              {phase.label ? ` · "${phase.label}"` : ''}
              {phase.duration_seconds != null ? ` · ${phase.duration_seconds}s` : ''}
            </span>
            <button
              type="button"
              onClick={() => setPhaseIndex((i) => Math.min(drill.phases.length - 1, i + 1))}
              disabled={phaseIndex >= drill.phases.length - 1}
              className="rounded-md border border-slate-300 px-2 py-1 text-sm text-slate-700 disabled:opacity-40"
            >
              Next →
            </button>
          </div>

          {/* Phase + annotation controls (2c, steps 2 and 4) */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => handleAddPhase('duplicate')}
              className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:border-slate-400"
            >
              Duplicate phase
            </button>
            <button
              type="button"
              onClick={() => handleAddPhase('blank')}
              className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:border-slate-400"
            >
              Add blank phase
            </button>
            <button
              type="button"
              onClick={handleDeletePhase}
              disabled={drill.phases.length <= 1}
              title={drill.phases.length <= 1 ? 'A drill needs at least one phase' : undefined}
              className="rounded-md border border-red-200 px-2 py-1 text-xs text-red-600 hover:border-red-300 disabled:opacity-40"
            >
              Delete phase
            </button>
            <button
              type="button"
              onClick={() => setNoteMode((on) => !on)}
              aria-pressed={noteMode}
              className={
                'ml-auto rounded-md border px-2 py-1 text-xs font-medium transition-colors ' +
                (noteMode
                  ? 'border-slate-900 bg-slate-900 text-white'
                  : 'border-slate-300 text-slate-600 hover:border-slate-400')
              }
            >
              {noteMode ? 'Cancel note' : 'Add note'}
            </button>
          </div>

          <PitchCanvas
            pitchFormat={drill.pitch_format}
            phase={phase}
            editable
            onElementDragMove={handleDragMove}
            onElementDragEnd={handleDragEnd}
            annotationMode={noteMode}
            onCanvasClick={handleCanvasClick}
          />

          {pendingNote && (
            <form
              onSubmit={handleSaveNote}
              className="flex flex-wrap items-center gap-2 rounded-md border border-slate-300 bg-slate-50 p-2"
            >
              <label htmlFor="new-annotation-text" className="text-xs font-medium text-slate-500">
                Note
              </label>
              <input
                id="new-annotation-text"
                autoFocus
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder="e.g. Press trigger"
                className="min-w-40 flex-1 rounded-md border border-slate-300 px-2 py-1.5 text-sm text-slate-900 outline-none focus:border-slate-500"
              />
              <button
                type="submit"
                disabled={!noteText.trim()}
                className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
              >
                Save note
              </button>
              <button
                type="button"
                onClick={() => setPendingNote(null)}
                className="px-2 py-1.5 text-sm text-slate-500"
              >
                Cancel
              </button>
            </form>
          )}
        </>
      )}
    </div>
  )
}
