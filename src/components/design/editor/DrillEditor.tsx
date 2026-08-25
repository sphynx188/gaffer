import { useEffect, useMemo, useState, type FormEvent, type PointerEvent as ReactPointerEvent } from 'react'
import { PanelRight, Pause, Play, Wrench, X } from 'lucide-react'
import { useStore } from '../../../store'
import type { Drill, EquipmentType, Marking, PhasePoint, PitchOrientation, PitchSize } from '../../../store'
import { EQUIPMENT_LABELS } from '../../../store'
import { PitchCanvas, type EntityMove } from '../PitchCanvas'
import { frameAt } from '../canvas/interpolate'
import { TimelineBar } from '../timeline/TimelineBar'
import { TimelineEditor } from '../timeline/TimelineEditor'
import { onionFramesFor } from '../timeline/onionSkin'
import { useTimelinePlayback } from '../timeline/useTimelinePlayback'
import { useKeyframeToggle } from '../timeline/useKeyframeToggle'
import { useToast } from '../../ui/useToast'
import { EditorTopBar } from './EditorTopBar'
import { PropertiesPanel } from './PropertiesPanel'
import { ToolRail, type CanvasTool, type DragPlacement, type RailPanel } from './ToolRail'
import { markingToolSpec, type MarkingTool } from './markingTools'
import type { GridSettings } from './GridPanel'
import { BallToolIcon, PlayerToolIcon, PLAYER_A_COLOR, PLAYER_B_COLOR } from './toolIcons'
import { EquipmentIcon } from '../canvas/EquipmentShapes'

// The drill editor shell (rework plan Stage 5.2): top bar, left tool rail,
// pitch, contextual right panel, timeline docked at the bottom. Below `lg` the
// rail becomes a drawer, the panel becomes a sheet, and a floating dock carries
// Tools / play / Props — Gaffer is a pitch-side app, so the phone layout is the
// point rather than an afterthought.
//
// All the editor's own view state lives here: which tool is armed, what's
// selected, where the playhead is. None of it belongs in the store.

// Metre dimensions for the four presets the app carries today, matching what
// migration 013b wrote. Stage 7 owns the real preset table and this goes with
// the size picker that feeds it.
const PRESET_LENGTH_METERS: Record<PitchSize, number> = { full: 105, three_quarter: 79, half: 53, quarter: 35 }

function dragIcon(placement: DragPlacement) {
  if (placement.kind === 'ball') return <BallToolIcon />
  if (placement.kind === 'player') {
    return <PlayerToolIcon color={placement.team === 'B' ? PLAYER_B_COLOR : PLAYER_A_COLOR} />
  }
  return <EquipmentIcon type={placement.equipment} />
}

export function DrillEditor({ drill }: { drill: Drill }) {
  const addEntity = useStore((s) => s.addEntity)
  const removeEntity = useStore((s) => s.removeEntity)
  const setEntityPosition = useStore((s) => s.setEntityPosition)
  const addMarking = useStore((s) => s.addMarking)
  const removeMarking = useStore((s) => s.removeMarking)
  const setDrillPitch = useStore((s) => s.setDrillPitch)
  const updateKeyframeState = useStore((s) => s.updateKeyframeState)
  const flushDrillSave = useStore((s) => s.flushDrillSave)
  const showToast = useToast()

  const [tool, setTool] = useState<CanvasTool>('select')
  const [panel, setPanel] = useState<RailPanel>(null)
  const [team, setTeam] = useState('A')
  const [equipment, setEquipment] = useState<EquipmentType>('cone')
  const [marking, setMarking] = useState<MarkingTool>('arrow')
  const [grid, setGrid] = useState<GridSettings>({ showGrid: false, snapToGrid: false, smartGuides: true })
  const [routeDraft, setRouteDraft] = useState<PhasePoint[] | null>(null)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [onionSkin, setOnionSkin] = useState(false)
  const [timelineOpen, setTimelineOpen] = useState(false)
  const [toolsOpen, setToolsOpen] = useState(false)
  const [propsOpen, setPropsOpen] = useState(false)
  const [pendingArrowStart, setPendingArrowStart] = useState<PhasePoint | null>(null)
  const [pendingNote, setPendingNote] = useState<PhasePoint | null>(null)
  const [noteText, setNoteText] = useState('')
  const [drag, setDrag] = useState<{ placement: DragPlacement; x: number; y: number } | null>(null)

  // Keeps the pitch inside the viewport so the docked timeline stays reachable
  // without scrolling past a full-height canvas. The reserve covers the top
  // bar, the timeline bar and the page's own padding.
  const [viewportHeight, setViewportHeight] = useState(() =>
    typeof window === 'undefined' ? 800 : window.innerHeight
  )
  useEffect(() => {
    const onResize = () => setViewportHeight(window.innerHeight)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const playback = useTimelinePlayback(drill.duration_seconds)
  const frame = useMemo(
    () => frameAt(drill.scene, drill.keyframes, playback.currentTime),
    [drill.scene, drill.keyframes, playback.currentTime]
  )
  const onion = useMemo(
    () => (onionSkin ? onionFramesFor(drill.scene, drill.keyframes, playback.currentTime) : undefined),
    [onionSkin, drill.scene, drill.keyframes, playback.currentTime]
  )
  const keyframeToggle = useKeyframeToggle(drill, frame, playback)

  // Switching drills, or arming a different tool, abandons anything half-drawn
  // rather than letting it be consumed by whatever comes next.
  useEffect(() => {
    setSelectedIds([])
    setPendingArrowStart(null)
    setPendingNote(null)
  }, [drill.id, tool])

  // The autosave debounce is 800ms; leaving the editor inside that window must
  // not lose the last edit.
  useEffect(() => () => void flushDrillSave(), [flushDrillSave])

  // Drag-to-place, carried over from the phases-era editor. Window listeners
  // for the duration of the drag, then a hit-test against PitchCanvas's own
  // container (found by the `data-pitch-canvas` attribute it sets, rather than
  // plumbing a ref through this whole tree).
  useEffect(() => {
    if (!drag) return
    const onMove = (event: PointerEvent) =>
      setDrag((current) => (current ? { ...current, x: event.clientX, y: event.clientY } : null))
    const onUp = (event: PointerEvent) => {
      const canvas = document.querySelector('[data-pitch-canvas]')
      const box = canvas?.getBoundingClientRect()
      if (
        box &&
        event.clientX >= box.left &&
        event.clientX <= box.right &&
        event.clientY >= box.top &&
        event.clientY <= box.bottom
      ) {
        place(drag.placement, {
          x: Math.min(1, Math.max(0, (event.clientX - box.left) / box.width)),
          y: Math.min(1, Math.max(0, (event.clientY - box.top) / box.height)),
        })
      }
      setDrag(null)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    // `place` is recreated every render; including it would tear these
    // listeners down and rebuild them on every pointermove.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drag?.placement, drill.id])

  const place = (placement: DragPlacement, position: PhasePoint) => {
    if (placement.kind === 'player') {
      addEntity(drill.id, 'player', position, { team: placement.team })
      showToast(`Player added to team ${placement.team}`)
      return
    }
    if (placement.kind === 'ball') {
      addEntity(drill.id, 'ball', position)
      showToast('Ball added')
      return
    }
    addEntity(drill.id, 'equipment', position, { equipment: placement.equipment })
    showToast(`${EQUIPMENT_LABELS[placement.equipment]} added`)
  }

  const startDrag = (placement: DragPlacement) => (event: ReactPointerEvent) => {
    event.preventDefault()
    setDrag({ placement, x: event.clientX, y: event.clientY })
  }

  // Tap-to-place: whatever the rail has armed lands where the pitch was tapped.
  // Arrows take two taps, and a note opens the text form below the pitch.
  const handleCanvasClick = (position: PhasePoint) => {
    if (routeDraft) {
      handleRoutePoint(position)
      return
    }
    if (tool === 'player' || tool === 'ball') {
      place(tool === 'ball' ? { kind: 'ball' } : { kind: 'player', team }, position)
      return
    }
    if (tool === 'equipment') {
      place({ kind: 'equipment', equipment }, position)
      return
    }
    if (tool !== 'marking') return
    if (marking === 'text') {
      setPendingNote(position)
      setNoteText('')
      return
    }
    // Everything else the markings panel arms is drawn by the canvas itself
    // and arrives through onDrawMarking.
  }

  // A drawn marking, handed back by the canvas once its gesture completes.
  const handleDrawMarking = (drawn: Omit<Marking, 'id'>) => {
    addMarking(drill.id, { ...drawn, style: { ...drawn.style, dash: marking === 'pass' } })
    showToast(`${markingToolSpec(marking).label} added`)
  }

  // Draw Route (Stage 6.5): tap a run out point by point for the selected
  // player, from the keyframe the playhead is parked on to the one after it.
  // The path is stored on the earlier keyframe's state, which is exactly where
  // frameAt looks for it.
  const routeEntityId = selectedIds.length === 1 ? selectedIds[0] : null
  const parkedKeyframe = keyframeToggle.parked
  const followingKeyframe = parkedKeyframe
    ? drill.keyframes.some((keyframe) => keyframe.t > parkedKeyframe.t)
    : false

  const commitRoute = (points: PhasePoint[]) => {
    if (!parkedKeyframe || !routeEntityId) return
    const current = parkedKeyframe.states[routeEntityId] ?? {}
    updateKeyframeState(drill.id, parkedKeyframe.id, {
      ...parkedKeyframe.states,
      [routeEntityId]: { ...current, path: points.length > 0 ? points : undefined },
    })
  }

  const handleRoutePoint = (position: PhasePoint) => {
    const points = routeDraft ?? []
    const last = points[points.length - 1]
    // Same "tap the last point again to finish" rule the polyline drawing
    // tools use, so there's one gesture to learn rather than two.
    if (last && Math.hypot(last.x - position.x, last.y - position.y) < 0.025) {
      commitRoute(points)
      setRouteDraft(null)
      showToast('Route drawn')
      return
    }
    setRouteDraft([...points, position])
  }

  const handleSaveNote = (event: FormEvent) => {
    event.preventDefault()
    if (!pendingNote || !noteText.trim()) return
    addMarking(drill.id, { kind: 'text', points: [pendingNote], text: noteText.trim() })
    setPendingNote(null)
    setNoteText('')
    showToast('Note added')
  }

  const handleEntitiesMove = (moves: EntityMove[], commit: boolean) => {
    const keyframeId = keyframeToggle.parked?.id
    // Dragging only writes into a keyframe the playhead is actually parked on;
    // between keyframes there is no single frame to write to, and silently
    // editing the nearest one would move markers the coach can't see.
    if (!keyframeId) {
      if (commit) showToast('Park the playhead on a keyframe to move things')
      return
    }
    for (const move of moves) setEntityPosition(drill.id, keyframeId, move.id, move.position, commit)
  }

  const removeSelection = (ids: string[]) => {
    let removed = 0
    for (const id of ids) {
      if (drill.scene.entities.some((entity) => entity.id === id)) {
        removeEntity(drill.id, id)
        removed++
      } else if (drill.scene.markings.some((m) => m.id === id)) {
        removeMarking(drill.id, id)
        removed++
      }
    }
    setSelectedIds([])
    if (removed > 0) showToast(removed === 1 ? 'Removed' : `${removed} removed`)
  }

  const clearMarkings = () => {
    const count = drill.scene.markings.length
    for (const item of drill.scene.markings) removeMarking(drill.id, item.id)
    if (count > 0) showToast(`${count} marking${count === 1 ? '' : 's'} cleared`)
  }

  // Copies a piece of equipment evenly to its right — the two-tap way to build
  // a cone grid or a line of poles.
  const duplicateAlongLine = (entityId: string, count: number) => {
    const source = drill.scene.entities.find((entity) => entity.id === entityId)
    const at = frame.entities.find((entity) => entity.id === entityId)
    if (!source || !at) return
    // Spaced far enough apart to read as separate pieces at phone size, and
    // stopped at the touchline rather than piling up against it.
    const gap = 0.08
    for (let i = 1; i <= count; i++) {
      const x = at.x + gap * i
      if (x > 1) break
      addEntity(drill.id, 'equipment', { x, y: at.y }, { equipment: source.equipment, color: source.color, rotation: source.rotation })
    }
    showToast(`${count} more added`)
  }

  const handlePitchChange = (size: PitchSize, orientation: PitchOrientation) => {
    setDrillPitch(drill.id, {
      ...drill.pitch,
      preset: size,
      widthMeters: 68,
      lengthMeters: PRESET_LENGTH_METERS[size],
      orientation,
    })
  }

  const placementHint = routeDraft
    ? 'Tap each point of the run, then tap the last one again to finish'
    : tool === 'marking'
      ? markingToolSpec(marking).hint || null
      : tool !== 'select'
        ? 'Tap the pitch to place, or drag the tool onto it'
        : null

  const rail = (
    <ToolRail
      layout={toolsOpen ? 'drawer' : 'rail'}
      tool={tool}
      onToolChange={setTool}
      panel={panel}
      onPanelChange={setPanel}
      team={team}
      onTeamChange={setTeam}
      equipment={equipment}
      onEquipmentChange={setEquipment}
      marking={marking}
      onMarkingChange={setMarking}
      markingCount={drill.scene.markings.length}
      onClearMarkings={clearMarkings}
      grid={grid}
      onGridChange={setGrid}
      pitchSize={(drill.pitch.preset as PitchSize) ?? 'full'}
      orientation={drill.pitch.orientation}
      onPitchChange={handlePitchChange}
      onStartDrag={startDrag}
    />
  )

  const properties = (
    <PropertiesPanel
      drill={drill}
      selectedIds={selectedIds}
      currentTime={playback.currentTime}
      parkedKeyframeId={parkedKeyframe?.id ?? null}
      hasFollowingKeyframe={followingKeyframe}
      drawingRoute={routeDraft !== null}
      onDrawRoute={() => setRouteDraft([])}
      onClearRoute={() => {
        setRouteDraft(null)
        commitRoute([])
        showToast('Route cleared')
      }}
      onSeek={playback.seek}
      onRemoveSelection={() => removeSelection(selectedIds)}
      onDuplicateAlongLine={duplicateAlongLine}
    />
  )

  return (
    <div className="flex min-h-0 flex-col gap-3">
      <EditorTopBar drill={drill} />

      <div className="flex min-w-0 gap-3">
        {/* Rail — desktop only; below lg it lives in the drawer. */}
        <div className="hidden shrink-0 lg:block">{!toolsOpen && rail}</div>

        <div className="flex min-w-0 flex-1 flex-col items-center gap-2">
          <PitchCanvas
            pitch={drill.pitch}
            frame={frame}
            onionFrames={onion}
            maxWidth={720}
            maxHeight={Math.max(260, viewportHeight - 260)}
            editable
            onEntitiesMove={handleEntitiesMove}
            annotationMode={tool !== 'select' || routeDraft !== null}
            onCanvasClick={handleCanvasClick}
            drawTool={tool === 'marking' && !routeDraft ? markingToolSpec(marking).draw : null}
            drawStyle={{ dash: marking === 'pass' }}
            onDrawMarking={handleDrawMarking}
            showGrid={grid.showGrid}
            snapToGrid={grid.snapToGrid}
            smartGuides={grid.smartGuides}
            selectedIds={selectedIds}
            onSelectionChange={tool === 'select' ? setSelectedIds : undefined}
            onDeleteSelection={removeSelection}
            pendingArrowStart={pendingArrowStart}
            hintText={placementHint}
          />

          {pendingNote && (
            <form
              onSubmit={handleSaveNote}
              className="flex w-full flex-wrap items-center gap-2 rounded-md border border-line bg-panel-raised p-2"
            >
              <label htmlFor="new-marking-text" className="text-xs font-medium text-ink-muted">
                Note
              </label>
              <input
                id="new-marking-text"
                autoFocus
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder="e.g. Press trigger"
                className="min-w-40 flex-1 rounded-md border border-line bg-panel px-2 py-1.5 text-sm text-ink outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/30"
              />
              <button
                type="submit"
                disabled={!noteText.trim()}
                className="min-h-11 rounded-md bg-accent px-3 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50 lg:min-h-9"
              >
                Save note
              </button>
              <button
                type="button"
                onClick={() => setPendingNote(null)}
                className="min-h-11 px-2 text-sm text-ink-muted lg:min-h-9"
              >
                Cancel
              </button>
            </form>
          )}
        </div>

        {/* Properties — desktop only; below lg it's the right-hand sheet. */}
        <div className="hidden w-64 shrink-0 rounded-xl border border-line bg-panel p-3 lg:block">{properties}</div>
      </div>

      <TimelineBar
        playback={playback}
        duration={drill.duration_seconds}
        keyframes={drill.keyframes}
        onionSkin={onionSkin}
        onToggleOnionSkin={() => setOnionSkin((v) => !v)}
        expanded={timelineOpen}
        onToggleExpanded={() => setTimelineOpen((v) => !v)}
        onToggleKeyframe={keyframeToggle.toggle}
      />
      {timelineOpen && <TimelineEditor drill={drill} playback={playback} frame={frame} />}

      {/* Floating dock — the phone control surface. Space is reserved below the
          timeline so the dock never covers it. */}
      <div className="h-20 lg:hidden" aria-hidden />
      <div className="fixed inset-x-0 bottom-0 z-30 flex justify-center px-4 pb-4 lg:hidden">
        <div className="flex items-center gap-1 rounded-full border border-line bg-panel p-1.5">
          <DockButton label="Tools" icon={<Wrench className="h-4 w-4" />} onClick={() => setToolsOpen(true)} />
          <button
            type="button"
            onClick={playback.togglePlay}
            aria-label={playback.playing ? 'Pause' : 'Play'}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-accent text-white"
          >
            {playback.playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
          </button>
          <DockButton label="Props" icon={<PanelRight className="h-4 w-4" />} onClick={() => setPropsOpen(true)} />
        </div>
      </div>

      <Sheet open={toolsOpen} side="left" title="Tools" onClose={() => setToolsOpen(false)}>
        {rail}
      </Sheet>
      <Sheet open={propsOpen} side="right" title="Properties" onClose={() => setPropsOpen(false)}>
        {properties}
      </Sheet>

      {/* Drag ghost — follows the pointer between picking a tool up off the
          rail and dropping it on the pitch. */}
      {drag && (
        <div
          className="pointer-events-none fixed z-50 flex h-9 w-9 items-center justify-center rounded-full border border-line bg-panel"
          style={{ left: drag.x - 18, top: drag.y - 18 }}
          aria-hidden
        >
          {dragIcon(drag.placement)}
        </div>
      )}
    </div>
  )
}

function DockButton({ label, icon, onClick }: { label: string; icon: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-11 min-w-16 flex-col items-center justify-center gap-0.5 rounded-full px-3 text-[10px] font-medium text-ink-muted"
    >
      {icon}
      {label}
    </button>
  )
}

// The same always-mounted, transform-animated pattern AppShell's mobile drawer
// uses, so both sheets in the app open and close the same way.
function Sheet({
  open,
  side,
  title,
  onClose,
  children,
}: {
  open: boolean
  side: 'left' | 'right'
  title: string
  onClose: () => void
  children: React.ReactNode
}) {
  return (
    <div className={`fixed inset-0 z-40 lg:hidden ${open ? '' : 'pointer-events-none'}`} aria-hidden={!open}>
      <button
        type="button"
        aria-label={`Close ${title.toLowerCase()}`}
        onClick={onClose}
        className={`absolute inset-0 bg-black/50 transition-opacity duration-200 ${open ? 'opacity-100' : 'opacity-0'}`}
      />
      <div
        // Written out in full rather than composed from `side` — Tailwind
        // scans for complete class names, so `left-0` built from a template
        // string never reaches the stylesheet.
        className={
          'absolute inset-y-0 flex w-72 max-w-[85vw] flex-col overflow-y-auto bg-panel transition-transform duration-200 ' +
          (side === 'left' ? 'left-0 ' : 'right-0 ') +
          (open ? 'translate-x-0' : side === 'left' ? '-translate-x-full' : 'translate-x-full')
        }
      >
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-line px-4">
          <p className="text-sm font-semibold text-ink">{title}</p>
          <button
            type="button"
            onClick={onClose}
            aria-label={`Close ${title.toLowerCase()}`}
            className="flex h-11 w-11 items-center justify-center rounded-md text-ink-muted hover:bg-panel-raised"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  )
}
