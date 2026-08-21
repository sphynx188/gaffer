import { useEffect, useState, type FormEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { PenTool, Trash2 } from 'lucide-react'
import { useStore } from '../../store'
import type { Drill, DrillElementType, NewDrillInput, NewPhaseMode, PitchOrientation, PitchSize } from '../../store'
import { PITCH_ORIENTATION_LABELS, PITCH_SIZE_LABELS } from '../../store'
import { PitchCanvas } from './PitchCanvas'
import { ANNOTATION, ARROW, BALL, CONE, MANNEQUIN, PLAYER, WITCHES_HAT } from './pitchTheme'
import { EmptyState } from '../ui/EmptyState'

// Player A/B tool-icon colors — the same navy/red pair PitchCanvas assigns
// to whichever two team labels appear first in a phase (pitchTheme.ts's
// PLAYER.colors), used here directly since the tool icon is a static
// preview, not tied to a specific phase's actual assigned colors.
const PLAYER_A_COLOR = PLAYER.colors[0]
const PLAYER_B_COLOR = PLAYER.colors[1]

// Small previews matching pitchTheme.ts's actual canvas rendering, one per
// placeable element/tool — "the actual thing" (a cone, a witches' hat, an
// arrow) rather than just a text label, so the tool rail reads at a glance
// the same way the pitch itself does.
function PlayerToolIcon({ color }: { color: string }) {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true">
      <circle cx="11" cy="11" r="8" fill={color} />
    </svg>
  )
}

// Agility pole — slim shaft on a flat base (internal `kind` stays 'cone',
// see pitchTheme.ts's CONE comment).
function ConeToolIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true">
      <ellipse cx="11" cy="19.3" rx="6" ry="1.7" fill={CONE.base} />
      <rect x="9.6" y="2" width="2.8" height="16.5" rx="1.4" fill={CONE.fallback} />
    </svg>
  )
}

function WitchesHatToolIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true">
      <polygon points="8.5,2 13.5,2 19,15.5 3,15.5" fill={WITCHES_HAT.fill} />
      <rect x="1.5" y="15.5" width="19" height="3.3" rx="1.65" fill={WITCHES_HAT.fill} />
    </svg>
  )
}

// Ring head + mesh-look torso (a couple of vertical divider lines standing
// in for the mesh pattern) + four splayed legs — matches the reference
// plastic training-dummy photo.
function MannequinToolIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true">
      <circle cx="11" cy="3.3" r="2.1" fill="none" stroke={MANNEQUIN.stroke} strokeWidth="1.4" />
      <rect x="6.5" y="6" width="9" height="9.5" rx="1" fill={MANNEQUIN.fill} stroke={MANNEQUIN.stroke} strokeWidth="1.2" />
      <line x1="9.2" y1="6" x2="9.2" y2="15.5" stroke={MANNEQUIN.stroke} strokeWidth="0.7" />
      <line x1="12.8" y1="6" x2="12.8" y2="15.5" stroke={MANNEQUIN.stroke} strokeWidth="0.7" />
      <line x1="7.5" y1="15.5" x2="6.5" y2="20" stroke={MANNEQUIN.stroke} strokeWidth="1.4" strokeLinecap="round" />
      <line x1="9.3" y1="15.5" x2="8.8" y2="20" stroke={MANNEQUIN.stroke} strokeWidth="1.4" strokeLinecap="round" />
      <line x1="12.7" y1="15.5" x2="13.2" y2="20" stroke={MANNEQUIN.stroke} strokeWidth="1.4" strokeLinecap="round" />
      <line x1="14.5" y1="15.5" x2="15.5" y2="20" stroke={MANNEQUIN.stroke} strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
}

function BallToolIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true">
      <circle cx="11" cy="11" r="8" fill={BALL.fill} stroke={BALL.stroke} strokeWidth="1.5" />
    </svg>
  )
}

function ArrowToolIcon({ kind }: { kind: 'ball' | 'player' }) {
  const style = ARROW[kind]
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true">
      <line
        x1="4"
        y1="18"
        x2="16"
        y2="6"
        stroke={style.stroke}
        strokeWidth="2.25"
        strokeLinecap="round"
        strokeDasharray={style.dash ? style.dash.join(' ') : undefined}
      />
      <polygon points="16,6 10.5,7.5 14.5,11.5" fill={style.stroke} />
    </svg>
  )
}

function NoteToolIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true">
      <rect x="3" y="5" width="16" height="12" rx="2" fill={ANNOTATION.background} stroke={ANNOTATION.border} strokeWidth="1.25" />
      <line x1="6" y1="9" x2="16" y2="9" stroke={ANNOTATION.text} strokeWidth="1.1" />
      <line x1="6" y1="12.5" x2="13" y2="12.5" stroke={ANNOTATION.text} strokeWidth="1.1" />
    </svg>
  )
}

// Looked up by the drag ghost (follows the pointer while dragging) — same
// icon the tool button itself shows, just reused so the two stay in sync
// automatically rather than duplicating the shape per mode.
const DRAG_ICON: Record<DraggableElementMode, ReactNode> = {
  'player-a': <PlayerToolIcon color={PLAYER_A_COLOR} />,
  'player-b': <PlayerToolIcon color={PLAYER_B_COLOR} />,
  cone: <ConeToolIcon />,
  'witches-hat': <WitchesHatToolIcon />,
  mannequin: <MannequinToolIcon />,
  ball: <BallToolIcon />,
}

const pitchSizeOptions: PitchSize[] = ['full', 'three_quarter', 'half', 'quarter']
const pitchOrientationOptions: PitchOrientation[] = ['portrait', 'landscape']

function pitchLabel(size: PitchSize, orientation: PitchOrientation): string {
  return `${PITCH_SIZE_LABELS[size] ?? size} · ${PITCH_ORIENTATION_LABELS[orientation] ?? orientation}`
}

// The mutually-exclusive "click the pitch to do something" modes that are
// still click-to-arm-then-tap-the-pitch: arrows need two points (a start and
// an end — see handleCanvasClick/pendingArrowStart), notes need a text
// form, and remove is a mode you tap existing elements in, not a thing you
// place. Every single-point placeable element (players, cones, witches'
// hats, mannequins, balls) is drag-and-drop instead — see
// DraggableElementMode/dragMode below — since "tap a tool, then tap the
// pitch" doesn't read as naturally as literally dragging a cone onto it.
type PlacementMode = 'arrow-ball' | 'arrow-player' | 'note' | 'remove' | null

// The single-point elements placed by dragging their tool-rail icon
// straight onto the pitch. 'witches-hat'/'mannequin' both place a 'cones'
// element with a different EquipmentKind (Upgrade Phase 2B) — same mapping
// handleCanvasClick used to do for these before they became draggable.
type DraggableElementMode = 'player-a' | 'player-b' | 'cone' | 'witches-hat' | 'mannequin' | 'ball'

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

  // Drag-and-drop for single-point elements (players/cones/equipment/ball):
  // `dragMode` is which tool is being dragged (set on the tool button's
  // pointerdown, cleared on pointerup) and also doubles as "is a drag in
  // progress" for the ghost preview/canvas highlight below. `dragPos` is
  // the pointer's live screen position, tracked separately so it can update
  // on every pointermove without re-running the effect that owns the
  // window-level listeners (see the effect below) — only `dragMode`
  // transitions (drag start/end) need that effect to re-subscribe.
  // Pointer Events (not native HTML5 drag-and-drop) deliberately, so this
  // works by touch on a phone/tablet, not just with a mouse — see
  // UPGRADE_IMPLEMENTATION_PLAN.md's mobile-first framing.
  const [dragMode, setDragMode] = useState<DraggableElementMode | null>(null)
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null)

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
  // two-click placement mode here). Single-point elements no longer go
  // through this at all — they're drag-and-drop (see dragMode/handleDragUp
  // below) since a coach dragging an actual cone onto the pitch reads more
  // naturally than tap-a-tool-then-tap-the-pitch.
  const handleCanvasClick = (position: { x: number; y: number }) => {
    if (!drill || !placementMode || placementMode === 'remove') return
    if (placementMode === 'note') {
      setPendingNote(position)
      setNoteText('')
      return
    }
    if (!pendingArrowStart) {
      setPendingArrowStart(position)
      return
    }
    addArrow(drill.id, phaseIndex, pendingArrowStart, position, placementMode === 'arrow-ball' ? 'ball' : 'player')
    setPendingArrowStart(null)
    void persistPhases(drill.id)
  }

  // Starts a drag — called from a tool button's onPointerDown. Captures the
  // pointer so pointermove/pointerup keep firing even once the finger/mouse
  // leaves the button (no native drag-and-drop involved, so nothing else
  // does this automatically).
  const startDrag = (mode: DraggableElementMode) => (e: ReactPointerEvent) => {
    e.preventDefault()
    setDragMode(mode)
    setDragPos({ x: e.clientX, y: e.clientY })
  }

  // Window-level listeners for the duration of a drag — only re-subscribes
  // when `dragMode` itself changes (drag start/end), not on every
  // pointermove, since dragPos updates happen directly in handleMove
  // without touching this effect's dependencies. On pointerup, checks
  // whether the release point falls inside PitchCanvas's container
  // (found via the `data-pitch-canvas` attribute PitchCanvas.tsx sets on
  // it, rather than plumbing a ref down through this whole tree) and, if
  // so, converts screen coordinates to the same normalized 0-1 space every
  // other placement already uses before adding the element.
  useEffect(() => {
    if (!dragMode) return

    const handleMove = (e: PointerEvent) => setDragPos({ x: e.clientX, y: e.clientY })

    const handleUp = (e: PointerEvent) => {
      const canvasEl = document.querySelector('[data-pitch-canvas]')
      if (canvasEl && drill) {
        const rect = canvasEl.getBoundingClientRect()
        if (e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom) {
          const position = {
            x: Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)),
            y: Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height)),
          }
          if (dragMode === 'ball') {
            addElement(drill.id, phaseIndex, 'balls', position)
          } else if (dragMode === 'cone' || dragMode === 'witches-hat' || dragMode === 'mannequin') {
            const kind = dragMode === 'witches-hat' ? 'witches_hat' : dragMode === 'mannequin' ? 'mannequin' : 'cone'
            addElement(drill.id, phaseIndex, 'cones', position, { kind })
          } else {
            addElement(drill.id, phaseIndex, 'players', position, { team: dragMode === 'player-a' ? 'A' : 'B' })
          }
          void persistPhases(drill.id)
        }
      }
      setDragMode(null)
      setDragPos(null)
    }

    window.addEventListener('pointermove', handleMove)
    window.addEventListener('pointerup', handleUp)
    return () => {
      window.removeEventListener('pointermove', handleMove)
      window.removeEventListener('pointerup', handleUp)
    }
    // persistPhases is deliberately omitted — it's a plain function
    // recreated every render, and including it would tear down/rebuild
    // these window listeners on every render rather than only on drag
    // start/end, which is the only thing this effect actually needs to
    // react to.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dragMode, drill, phaseIndex, addElement])

  // What to show below the canvas for the currently active placement mode
  // — PitchCanvas itself doesn't know which specific mode is active, only
  // the booleans/callbacks it maps to, so the copy lives here.
  const placementHint = pendingArrowStart
    ? 'Arrow started — tap the end point'
    : placementMode === 'note'
      ? 'Tap the pitch to place a note'
      : placementMode === 'arrow-player' || placementMode === 'arrow-ball'
        ? "Tap the pitch for the arrow's start point"
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
      {/* Top settings bar — drill selection/creation and pitch size, laid
          out left to right. Phase navigation/management moved below the
          canvas (a filmstrip, not a setting up here — see below); the
          element/tool palette lives in the right-side rail (see below). */}
      {selectedTeamId && (
        <div className="flex flex-wrap items-end gap-x-6 gap-y-3 rounded-lg border border-line bg-panel p-3">
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
                className="w-56 rounded-md border border-line bg-panel-raised px-2 py-1.5 text-sm text-ink outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/30"
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
                    className="min-w-40 flex-1 rounded-md border border-line bg-panel px-2 py-1.5 text-sm text-ink outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/30"
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

              {/* Phase filmstrip — every phase laid out left to right under
                  the pitch, like frames on a timeline, instead of a "01 of
                  N" stepper. Click a numbered tab to jump straight to that
                  phase; PitchCanvas fully re-renders from the new phase's
                  own element arrays, so there's never a leftover element
                  from the previous one. */}
              <div className="space-y-3 rounded-lg border border-line bg-panel p-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="text-xs font-medium text-ink-muted">Phases</span>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {drill.phases.map((p, i) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => setPhaseIndex(i)}
                          aria-pressed={i === phaseIndex}
                          title={p.label || `Phase ${i + 1}`}
                          className={
                            'flex h-8 w-8 items-center justify-center rounded-md border font-mono text-xs font-semibold tabular-nums transition-colors ' +
                            (i === phaseIndex
                              ? 'border-accent bg-accent text-white'
                              : 'border-line text-ink-muted hover:border-line-strong')
                          }
                        >
                          {i + 1}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleAddPhase('blank')}
                      className="rounded-md border border-line px-2 py-1 text-xs text-ink-muted hover:border-line-strong"
                    >
                      + Add phase
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAddPhase('duplicate')}
                      className="rounded-md border border-line px-2 py-1 text-xs text-ink-muted hover:border-line-strong"
                    >
                      Duplicate
                    </button>
                    <button
                      type="button"
                      onClick={handleDeletePhase}
                      disabled={drill.phases.length <= 1}
                      title={drill.phases.length <= 1 ? 'A drill needs at least one phase' : undefined}
                      className="rounded-md border border-bad/30 px-2 py-1 text-xs text-bad hover:border-bad/60 disabled:opacity-40"
                    >
                      Delete
                    </button>
                  </div>
                </div>

                <form
                  onSubmit={handleSavePhaseMeta}
                  className="flex flex-wrap items-end gap-3 border-t border-line pt-3"
                >
                  <div className="min-w-48 flex-1">
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
                      className="mt-1 w-full rounded-md border border-line bg-panel-raised px-2 py-1.5 text-sm text-ink outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/30"
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
                      className="mt-1 w-24 rounded-md border border-line bg-panel-raised px-2 py-1.5 text-sm text-ink outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/30"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={!phaseMetaDirty}
                    className="rounded-md bg-accent px-4 py-1.5 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50"
                  >
                    Save
                  </button>
                </form>
              </div>
            </>
          )}
        </div>

        {/* Right tool rail — Photoshop-style: every element/tool you can add
            to (or remove from) the pitch, and nothing else, one per row.
            The six single-point elements are drag straight onto the pitch;
            arrows/note/remove stay click-to-arm-then-tap (see PlacementMode's
            comment for why). */}
        {drill && phase && (
          <div className="flex flex-col gap-2 rounded-lg border border-line bg-panel p-3 lg:w-40 lg:shrink-0">
            <p className="text-xs font-medium text-ink-muted">Tools</p>
            <DraggableTool mode="player-a" dragMode={dragMode} onPointerDown={startDrag('player-a')} label="Player A" icon={<PlayerToolIcon color={PLAYER_A_COLOR} />} />
            <DraggableTool mode="player-b" dragMode={dragMode} onPointerDown={startDrag('player-b')} label="Player B" icon={<PlayerToolIcon color={PLAYER_B_COLOR} />} />
            <DraggableTool mode="cone" dragMode={dragMode} onPointerDown={startDrag('cone')} label="Pole" icon={<ConeToolIcon />} />
            <DraggableTool
              mode="witches-hat"
              dragMode={dragMode}
              onPointerDown={startDrag('witches-hat')}
              label="Cone"
              icon={<WitchesHatToolIcon />}
            />
            <DraggableTool
              mode="mannequin"
              dragMode={dragMode}
              onPointerDown={startDrag('mannequin')}
              label="Mannequin"
              icon={<MannequinToolIcon />}
            />
            <DraggableTool mode="ball" dragMode={dragMode} onPointerDown={startDrag('ball')} label="Ball" icon={<BallToolIcon />} />
            <PlacementToggle
              mode="arrow-player"
              active={placementMode}
              onToggle={togglePlacement}
              label="Player arrow"
              icon={<ArrowToolIcon kind="player" />}
            />
            <PlacementToggle
              mode="arrow-ball"
              active={placementMode}
              onToggle={togglePlacement}
              label="Ball arrow"
              icon={<ArrowToolIcon kind="ball" />}
            />
            <PlacementToggle
              mode="note"
              active={placementMode}
              onToggle={togglePlacement}
              label="Note"
              icon={<NoteToolIcon />}
            />
            <PlacementToggle
              mode="remove"
              active={placementMode}
              onToggle={togglePlacement}
              label="Remove"
              icon={<Trash2 className="h-[22px] w-[22px]" />}
              className="border-bad/30 text-bad hover:border-bad/60"
              activeClassName="border-bad bg-bad text-white"
            />
          </div>
        )}
      </div>

      {/* Drag ghost — follows the pointer/finger while a tool-rail element
          is being dragged, so it's visually clear something is "picked up"
          before it's dropped on the pitch. pointer-events-none so it never
          intercepts the pointerup that actually commits the drop. */}
      {dragMode && dragPos && (
        <div
          className="pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-1/2 opacity-90"
          style={{ left: dragPos.x, top: dragPos.y }}
        >
          {DRAG_ICON[dragMode]}
        </div>
      )}
    </div>
  )
}

// One drag-to-place tool button — pointerdown starts the drag (see
// startDrag/the window-listener effect above), no onClick at all, since
// this is a drag gesture, not a toggle. `dragMode` is only compared for the
// brief "picked up" highlight while its own drag is in flight.
function DraggableTool({
  mode,
  dragMode,
  onPointerDown,
  label,
  icon,
}: {
  mode: DraggableElementMode
  dragMode: DraggableElementMode | null
  onPointerDown: (e: ReactPointerEvent) => void
  label: string
  icon: ReactNode
}) {
  const isDragging = dragMode === mode
  return (
    <button
      type="button"
      onPointerDown={onPointerDown}
      className={
        'flex w-full touch-none flex-col items-center gap-1 rounded-md border px-2 py-2 text-center text-xs font-medium transition-colors ' +
        (isDragging ? 'border-accent bg-accent/10 text-ink' : 'border-line text-ink-muted hover:border-line-strong')
      }
    >
      {icon}
      <span>{label}</span>
    </button>
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
  icon,
  className = '',
  activeClassName = 'border-accent bg-accent text-white',
}: {
  mode: Exclude<PlacementMode, null>
  active: PlacementMode
  onToggle: (mode: Exclude<PlacementMode, null>) => void
  label: string
  icon: ReactNode
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
        'flex w-full flex-col items-center gap-1 rounded-md border px-2 py-2 text-center text-xs font-medium transition-colors ' +
        (isActive ? activeClassName : `border-line text-ink-muted hover:border-line-strong ${className}`)
      }
    >
      {icon}
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
          className="mt-1 w-44 rounded-md border border-line bg-panel-raised px-2 py-1.5 text-sm text-ink outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/30"
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
          className="mt-1 rounded-md border border-line bg-panel-raised px-2 py-1.5 text-sm text-ink outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/30"
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
          className="mt-1 rounded-md border border-line bg-panel-raised px-2 py-1.5 text-sm text-ink outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/30"
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
