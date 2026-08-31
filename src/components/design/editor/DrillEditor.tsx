import { useEffect, useLayoutEffect, useMemo, useRef, useState, type FormEvent, type PointerEvent as ReactPointerEvent } from 'react'
import type Konva from 'konva'
import { PanelRight, Pause, Play, Wrench } from 'lucide-react'
import { useStore } from '../../../store'
import type { Drill, EquipmentType, Marking, PhasePoint, PitchConfig } from '../../../store'
import { EQUIPMENT_LABELS } from '../../../store'
import { PitchCanvas, type EntityMove } from '../PitchCanvas'
import { frameAt } from '../canvas/interpolate'
import { onionFramesFor } from '../timeline/onionSkin'
import { motionPathsFor, trailFramesFor } from '../timeline/motion'
import { useTimelinePlayback } from '../timeline/useTimelinePlayback'
import { useTimelineKeys } from '../timeline/useTimelineKeys'
import { useKeyframeToggle } from '../timeline/useKeyframeToggle'
import { useDrillTimelineHost } from './useDrillTimelineHost'
import { useToast } from '../../ui/useToast'
import { EditorTopBar } from './EditorTopBar'
import { PropertiesPanel } from './PropertiesPanel'
import { DrillDetailsDrawer } from './DrillDetailsDrawer'
import { ExportPanel } from './ExportPanel'
import { downloadBlob, downloadDataUrl } from '../export/exportFile'
import { recordGif } from '../export/recordGif'
import { ToolRail, type CanvasTool, type RailPanel } from './ToolRail'
import type { DragPlacement } from './ToolsPanel'
import { markingToolSpec, type MarkingTool } from './markingTools'
import { DockButton, EditorLayout, ExportDrawer } from './EditorShell'
import { useMarkingKeys } from './useMarkingKeys'
import { useUndoKeys } from './useUndoKeys'
import type { GridSettings } from './GridPanel'
import { BallToolIcon, PlayerToolIcon, PLAYER_A_COLOR, PLAYER_B_COLOR } from './toolIcons'
import { EquipmentIcon } from '../canvas/EquipmentShapes'
import { getPitchMarkings, snapToPitchGrid } from '../pitchGeometry'
import { OnboardingTour } from './onboarding/OnboardingTour'
import { DRILL_TOUR_SEEN_KEY, useOnboardingTour } from './onboarding/useOnboardingTour'
import { TOUR_STEPS } from './onboarding/tourSteps'

// The drill editor shell (rework plan Stage 5.2): top bar, left tool rail,
// pitch, contextual right panel, timeline docked at the bottom. Below `lg` the
// rail becomes a drawer, the panel becomes a sheet, and a floating dock carries
// Tools / play / Props — Gaffer is a pitch-side app, so the phone layout is the
// point rather than an afterthought.
//
// All the editor's own view state lives here: which tool is armed, what's
// selected, where the playhead is. None of it belongs in the store.

// How wide a captured thumbnail is, in pixels (rework plan Stage 8.5). A
// library card shows it at about half this; the full-size stage would be
// several hundred KB of PNG for no visible gain.
const THUMBNAIL_WIDTH = 480

function dragIcon(placement: DragPlacement) {
  if (placement.kind === 'ball') return <BallToolIcon />
  if (placement.kind === 'player') {
    return <PlayerToolIcon color={placement.team === 'B' ? PLAYER_B_COLOR : PLAYER_A_COLOR} />
  }
  return <EquipmentIcon type={placement.equipment} />
}

export function DrillEditor({ drill }: { drill: Drill }) {
  const undo = useStore((s) => s.undo)
  const redo = useStore((s) => s.redo)
  // Evaluated inside the selector, not read as `s.canUndo` and called later —
  // the store's own note is explicit that only the former subscribes properly.
  const canUndoDrill = useStore((s) => s.canUndo(drill.id))
  const canRedoDrill = useStore((s) => s.canRedo(drill.id))
  const addEntity = useStore((s) => s.addEntity)
  const removeEntity = useStore((s) => s.removeEntity)
  const setEntityPosition = useStore((s) => s.setEntityPosition)
  const addMarking = useStore((s) => s.addMarking)
  const removeMarking = useStore((s) => s.removeMarking)
  const updateMarking = useStore((s) => s.updateMarking)
  const setDrillPitch = useStore((s) => s.setDrillPitch)
  const updateKeyframeState = useStore((s) => s.updateKeyframeState)
  const flushDrillSave = useStore((s) => s.flushDrillSave)
  const uploadDrillThumbnail = useStore((s) => s.uploadDrillThumbnail)
  const enableDrillSharing = useStore((s) => s.enableDrillSharing)
  const disableDrillSharing = useStore((s) => s.disableDrillSharing)
  const saveState = useStore((s) => s.saveState)
  const showToast = useToast()

  const [tool, setTool] = useState<CanvasTool>('select')
  const [panel, setPanel] = useState<RailPanel>(null)
  // Which tab the properties panel shows when nothing is selected (2026-08-31)
  // — Tools (the drag-and-drop palette) or Timeline (keyframes + playback).
  // Defaults to Tools: a fresh or empty drill needs something placed before
  // a keyframe means anything.
  const [panelTab, setPanelTab] = useState<'tools' | 'timeline'>('tools')
  const [team, setTeam] = useState('A')
  const [equipment, setEquipment] = useState<EquipmentType>('cone')
  const [marking, setMarking] = useState<MarkingTool>('arrow')
  const [grid, setGrid] = useState<GridSettings>({ showGrid: false, snapToGrid: false, smartGuides: true })
  const [routeDraft, setRouteDraft] = useState<PhasePoint[] | null>(null)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [onionSkin, setOnionSkin] = useState(false)
  // Player paths and ghost trails (rework plan Stage 5.5). Independent of each
  // other and of onion skin; each costs nothing while off.
  const [playerPaths, setPlayerPaths] = useState(false)
  const [ghostTrails, setGhostTrails] = useState(false)
  const [toolsOpen, setToolsOpen] = useState(false)
  const [propsOpen, setPropsOpen] = useState(false)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [capturing, setCapturing] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const [gifProgress, setGifProgress] = useState<number | null>(null)
  const [pendingArrowStart, setPendingArrowStart] = useState<PhasePoint | null>(null)
  const [pendingNote, setPendingNote] = useState<PhasePoint | null>(null)
  const [noteText, setNoteText] = useState('')
  const [drag, setDrag] = useState<{ placement: DragPlacement; x: number; y: number } | null>(null)

  // The onboarding walkthrough (rework plan Stage 11.1) — auto-opens once on
  // a coach's first visit to this editor, replayable afterwards from the top
  // bar's help button.
  const tour = useOnboardingTour(TOUR_STEPS, DRILL_TOUR_SEEN_KEY)

  // Several tour steps point at the rail or the properties panel, which below
  // `lg` only exist on screen inside their own sheet — the sheet is always
  // mounted (see Sheet's own doc comment) but sits translated off-canvas until
  // opened. Only ever touched here on mobile: on desktop, both panels are
  // permanently visible, and setting either sheet's `open` flag there would
  // actually HIDE the desktop rail — the `!toolsOpen && rail` guard below
  // exists to swap it out for the drawer, not to layer both.
  useEffect(() => {
    if (!tour.open) return
    // Unlike the sheets below, which only matter on mobile, `panelTab` gates
    // whether the anchor even exists in the DOM on EVERY viewport — the
    // Tools and Timeline tabs are mutually exclusive renders, so a step
    // anchored inside one has nothing to measure if the other happens to be
    // active when the tour reaches it.
    if (tour.step.panelTab) setPanelTab(tour.step.panelTab)
    if (typeof window === 'undefined' || window.innerWidth >= 1024) return
    setToolsOpen(Boolean(tour.step.openTools))
    setPropsOpen(Boolean(tour.step.openProperties))
  }, [tour.open, tour.step])

  // Closing or finishing the tour must not leave a sheet stranded open.
  useEffect(() => {
    if (tour.open) return
    setToolsOpen(false)
    setPropsOpen(false)
  }, [tour.open])

  // Keeps the pitch inside the viewport without scrolling past a full-height
  // canvas.
  const [viewportHeight, setViewportHeight] = useState(() =>
    typeof window === 'undefined' ? 800 : window.innerHeight
  )
  useEffect(() => {
    const onResize = () => setViewportHeight(window.innerHeight)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // How much chrome sits above the canvas, MEASURED rather than assumed. This
  // used to be a hardcoded 260px reserve whose own comment said it covered
  // "the top bar, the timeline bar and the page's own padding" — but the
  // timeline bar moved into the Keyframes panel on 2026-08-29 and this editor
  // hasn't rendered one since, so the reserve was still holding back ~50px of
  // height for a component that no longer exists. Measuring the canvas's own
  // top can't go stale the next time the chrome above it changes. Reading it
  // off the canvas rather than a wrapper of our own keeps EditorLayout's
  // centering untouched; the canvas's height never feeds back into its own
  // top, so there's no measure/resize loop.
  const [canvasTop, setCanvasTop] = useState(260)
  useLayoutEffect(() => {
    const measure = () => {
      const el = document.querySelector('[data-pitch-canvas]')
      if (el) setCanvasTop(el.getBoundingClientRect().top + window.scrollY)
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [])
  // Room for the hint / "nothing on the pitch yet" line the canvas renders
  // beneath itself.
  const CANVAS_FOOTER = 24

  const playback = useTimelinePlayback(drill.duration_seconds)
  const frame = useMemo(
    () => frameAt(drill.scene, drill.keyframes, playback.currentTime),
    [drill.scene, drill.keyframes, playback.currentTime]
  )
  const onion = useMemo(
    () => (onionSkin ? onionFramesFor(drill.scene, drill.keyframes, playback.currentTime) : undefined),
    [onionSkin, drill.scene, drill.keyframes, playback.currentTime]
  )
  const paths = useMemo(
    () => (playerPaths ? motionPathsFor(drill.scene, drill.keyframes, playback.currentTime) : undefined),
    [playerPaths, drill.scene, drill.keyframes, playback.currentTime]
  )
  const trails = useMemo(
    () => (ghostTrails ? trailFramesFor(drill.scene, drill.keyframes, playback.currentTime) : undefined),
    [ghostTrails, drill.scene, drill.keyframes, playback.currentTime]
  )
  const timelineHost = useDrillTimelineHost(drill)
  const keyframeToggle = useKeyframeToggle(timelineHost, frame, playback)

  // Was TimelineBar's own internal call — moved here now that this editor no
  // longer renders that bar (2026-08-29, its controls live in the Keyframes
  // panel instead), since the shortcuts still need to fire regardless of
  // what's on screen. TacticEditor still renders TimelineBar, which still
  // does this itself; nothing there changed.
  useTimelineKeys({
    playback,
    keyframes: drill.keyframes,
    onToggleKeyframe: keyframeToggle.toggle,
    onTogglePlayerPaths: () => setPlayerPaths((v) => !v),
    onToggleGhostTrails: () => setGhostTrails((v) => !v),
  })

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

  // Thumbnails (rework plan Stage 8.5). The Konva stage is the only thing that
  // can produce a picture of the board, so the capture happens here and the
  // store only handles the upload.
  const stageRef = useRef<Konva.Stage | null>(null)
  const captureThumbnail = async () => {
    const stage = stageRef.current
    if (!stage || capturing || stage.width() === 0) return
    setCapturing(true)
    const pixelRatio = Math.min(1, THUMBNAIL_WIDTH / stage.width())
    const dataUrl = stage.toDataURL({ pixelRatio, mimeType: 'image/png' })
    const url = await uploadDrillThumbnail(drill.id, dataUrl)
    setCapturing(false)
    showToast(url ? 'Thumbnail captured' : "Couldn't capture the thumbnail")
  }

  // Auto-capture, for the coach who never opens Details. "On save" literally:
  // the drill has to have been edited and settled in this session, which also
  // sidesteps capturing a stage that hasn't been measured yet on first paint.
  // What's captured is what's on screen, so it waits for the playhead to be
  // back at the start — the first keyframe, and where the editor sits by
  // default. A drill that already has a thumbnail is left alone; re-capturing
  // is the button's job.
  const editedRef = useRef(false)
  const capturedFor = useRef<string | null>(null)
  useEffect(() => {
    if (saveState === 'dirty' || saveState === 'saving') {
      editedRef.current = true
      return
    }
    if (saveState !== 'saved' || !editedRef.current) return
    if (drill.thumbnail_url || capturedFor.current === drill.id) return
    if (drill.scene.entities.length === 0 || playback.currentTime > 0) return
    capturedFor.current = drill.id
    void captureThumbnail()
    // `captureThumbnail` is recreated every render; depending on it would run
    // this on every render instead of on the transitions it cares about.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saveState, drill.id, drill.thumbnail_url, drill.scene.entities.length, playback.currentTime])

  // Exports (rework plan Stage 10). Both live here rather than in ExportPanel
  // for the same reason the thumbnail capture does: the Konva stage is only
  // reachable from this component.
  const handleExportPng = (filename: string) => {
    const stage = stageRef.current
    if (!stage) return
    // pixelRatio 2 per the plan — a retina-sharp still that survives being
    // dropped into a team chat or a session document.
    void downloadDataUrl(stage.toDataURL({ pixelRatio: 2, mimeType: 'image/png' }), filename)
    showToast('PNG saved')
  }

  const handleExportGif = async (filename: string) => {
    const stage = stageRef.current
    if (!stage || gifProgress !== null) return
    if (drill.keyframes.length < 2) {
      showToast('Add a second keyframe first — there is nothing to animate')
      return
    }
    // Recording drives the playhead, so anything already playing has to stop
    // or the two would fight over it. Where the coach had it is restored
    // afterwards, whether the encode succeeded or not.
    const resumeAt = playback.currentTime
    playback.pause()
    setGifProgress(0)
    try {
      const blob = await recordGif({
        stage,
        durationSeconds: drill.duration_seconds,
        seek: playback.seek,
        onProgress: setGifProgress,
      })
      if (blob) {
        downloadBlob(blob, filename)
        showToast('GIF saved')
      } else {
        showToast("Couldn't record the GIF")
      }
    } finally {
      setGifProgress(null)
      playback.seek(resumeAt)
    }
  }

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
        // Dropped from the rail rather than tapped, so this never goes
        // through PitchCanvas and has to snap for itself — otherwise
        // "snap to grid" held for the tap gesture and silently didn't for
        // the drag one.
        const dropped = {
          x: Math.min(1, Math.max(0, (event.clientX - box.left) / box.width)),
          y: Math.min(1, Math.max(0, (event.clientY - box.top) / box.height)),
        }
        place(drag.placement, grid.snapToGrid ? snapToPitchGrid(dropped, getPitchMarkings(drill.pitch)) : dropped)
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
      // Dot, not a numbered standard marker — a coach placing players to
      // block out shape wants bare dots first and numbers only for the ones
      // that need them, not every marker pre-numbered whether asked for or
      // not. Switching a specific player to a numbered display is a click on
      // the Number field's toggle in the property panel away.
      addEntity(drill.id, 'player', position, { team: placement.team, display: 'dot' })
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

  // The tool shortcut map (Stage 6.2). 'select' drops back to the selection
  // tool; every other key arms its drawing tool and switches the canvas into
  // marking mode, which is exactly what clicking the rail does.
  // Cmd/Ctrl+Z and Cmd/Ctrl+Shift+Z. The buttons in the top bar drive the same
  // two store actions; this just gives them the shortcut every canvas tool has.
  useUndoKeys({
    onUndo: () => undo(drill.id),
    onRedo: () => redo(drill.id),
    canUndo: canUndoDrill,
    canRedo: canRedoDrill,
  })

  useMarkingKeys({
    onSelectTool: (next) => {
      if (next === 'select') {
        setTool('select')
        return
      }
      setMarking(next)
      setTool('marking')
    },
  })

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

  const placementHint = routeDraft
    ? 'Tap each point of the run, then tap the last one again to finish'
    : tool === 'marking'
      ? markingToolSpec(marking).hint || null
      : tool !== 'select'
        ? 'Tap the pitch to place, or drag the tool onto it'
        : null

  // Shared between the two ToolRail instances below — same tool/panel state,
  // just two different presentations of it (2026-08-29: topbar replaced the
  // old desktop rail; drawer still serves the mobile sheet unchanged).
  // Player/Ball/Equipment/Markings/Team moved to the properties panel's
  // Tools tab (2026-08-31, see toolsTabProps below) — this rail is left with
  // mode and board-wide settings only.
  const railProps = {
    tool,
    onToolChange: setTool,
    panel,
    onPanelChange: setPanel,
    grid,
    onGridChange: setGrid,
    pitch: drill.pitch,
    onPitchChange: (next: PitchConfig) => setDrillPitch(drill.id, next),
    onOpenDetails: () => {
      setToolsOpen(false)
      setDetailsOpen(true)
    },
  }

  const rail = <ToolRail layout="drawer" {...railProps} />
  const railTopbar = <ToolRail layout="topbar" {...railProps} />

  const toolsTabProps = {
    panelTab,
    onPanelTabChange: setPanelTab,
    tool,
    team,
    onTeamChange: setTeam,
    onToolChange: setTool,
    equipment,
    onEquipmentChange: setEquipment,
    marking,
    onMarkingChange: setMarking,
    markingCount: drill.scene.markings.length,
    onClearMarkings: clearMarkings,
    onStartDrag: startDrag,
  }

  const properties = (
    <PropertiesPanel
      host={timelineHost}
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
      playback={playback}
      onionSkin={onionSkin}
      onToggleOnionSkin={() => setOnionSkin((v) => !v)}
      playerPaths={playerPaths}
      onTogglePlayerPaths={() => setPlayerPaths((v) => !v)}
      ghostTrails={ghostTrails}
      onToggleGhostTrails={() => setGhostTrails((v) => !v)}
      toolsTab={toolsTabProps}
    />
  )

  const canvas = (
    <>
      <PitchCanvas
        stageRef={stageRef}
        onboardingAnchor="pitch-canvas"
        pitch={drill.pitch}
        frame={frame}
        onionFrames={onion}
        motionPaths={paths}
        trailFrames={trails}
        // 720, then 1200, used to be the ceiling regardless of screen size,
        // leaving wide margins either side even once AppShell gave this route
        // more room to work with. PitchCanvas already measures its own
        // container via ResizeObserver and clamps to whichever is smaller, so
        // raising this just lets it use the extra width now available rather
        // than stopping short of it — on a wide monitor width becomes the
        // binding axis and the pitch fills the canvas edge to edge.
        maxWidth={1600}
        maxHeight={Math.max(260, viewportHeight - canvasTop - CANVAS_FOOTER)}
        // Drills stretch the pitch to fill the canvas rather than holding its
        // real proportions — a drill is about the shape being drawn, not about
        // the pitch being to scale, and true proportions were leaving ~15% of
        // the canvas permanently empty. Tactics deliberately doesn't pass this.
        fillCanvas
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
        // PitchCanvas has carried the Transformer since the drill rework's
        // Stage 3.5, but it only renders it when this callback is present
        // and nothing ever passed one — so resizing and rotating a marking
        // was built and left unplugged for every kind. Stage 6's definition
        // of done asks that all fourteen tools transform, so it is wired
        // here; the canvas already bakes the result back into normalized
        // points, which is why this only has to store them.
        onMarkingsTransform={(updates) => {
          for (const update of updates) updateMarking(drill.id, update.id, { points: update.points })
        }}
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
    </>
  )

  // The tool row only shows here on desktop — below `lg` the mobile dock's
  // "Tools" button still opens `rail` (the drawer instance) in its Sheet, so
  // showing this too would be the same controls twice.
  const topBar = (
    <div className="flex flex-col gap-3 border-b border-line pb-3">
      <EditorTopBar drill={drill} onExport={() => setExportOpen(true)} onReplayTour={tour.restart} />
      <div className="hidden lg:block">{railTopbar}</div>
    </div>
  )

  return (
    <EditorLayout
      topBar={topBar}
      rail={rail}
      hideDesktopRail
      canvas={canvas}
      inspector={properties}
      timeline={null}
      railOpen={toolsOpen}
      onRailClose={() => setToolsOpen(false)}
      railTitle="Tools"
      inspectorOpen={propsOpen}
      onInspectorClose={() => setPropsOpen(false)}
      inspectorTitle="Properties"
      inspectorAnchor="properties-panel"
      maxPanelHeight={Math.max(260, viewportHeight - canvasTop - CANVAS_FOOTER)}
      dock={
        <>
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
        </>
      }
      extras={
        <>
          <DrillDetailsDrawer
            drill={drill}
            open={detailsOpen}
            onClose={() => setDetailsOpen(false)}
            onCaptureThumbnail={() => void captureThumbnail()}
            capturing={capturing}
          />

          <ExportDrawer open={exportOpen} onClose={() => setExportOpen(false)}>
            <ExportPanel
              target={{
                kind: 'drill',
                name: drill.name,
                shareToken: drill.share_token,
                sharePath: '/d',
                cardPath: `/drills/${drill.id}/card`,
                onEnableSharing: () => enableDrillSharing(drill.id),
                onDisableSharing: () => disableDrillSharing(drill.id),
              }}
              onExportPng={handleExportPng}
              onExportGif={(filename) => void handleExportGif(filename)}
              gifProgress={gifProgress}
            />
          </ExportDrawer>

          {tour.open && (
            <OnboardingTour
              step={tour.step}
              stepIndex={tour.stepIndex}
              stepCount={tour.stepCount}
              onNext={tour.next}
              onBack={tour.back}
              onSkip={tour.skip}
              settleMs={tour.step.openTools || tour.step.openProperties ? 250 : 0}
            />
          )}

          {/* Drag ghost — follows the pointer between picking a tool up off
              the rail and dropping it on the pitch. */}
          {drag && (
            <div
              className="pointer-events-none fixed z-50 flex h-9 w-9 items-center justify-center rounded-full border border-line bg-panel"
              style={{ left: drag.x - 18, top: drag.y - 18 }}
              aria-hidden
            >
              {dragIcon(drag.placement)}
            </div>
          )}
        </>
      }
    />
  )
}

