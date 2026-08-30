import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Pause, PanelRight, Play, Wrench } from 'lucide-react'
import type Konva from 'konva'
import { useStore } from '../../store'
import type { Marking, PhasePoint, Tactic } from '../../store'
import { useToast } from '../ui/useToast'
import { PitchCanvas, type EntityMove } from '../design/PitchCanvas'
import { frameAt, type RenderFrame } from '../design/canvas/interpolate'
import { DockButton, EditorLayout, ExportDrawer } from '../design/editor/EditorShell'
import { ExportPanel } from '../design/editor/ExportPanel'
import { downloadBlob, downloadDataUrl } from '../design/export/exportFile'
import { recordGif } from '../design/export/recordGif'
import { markingToolSpec, type MarkingTool } from '../design/editor/markingTools'
import { useMarkingKeys } from '../design/editor/useMarkingKeys'
import { useUndoKeys } from '../design/editor/useUndoKeys'
import { motionPathsFor, trailFramesFor } from '../design/timeline/motion'
import { onionFramesFor } from '../design/timeline/onionSkin'
import { keyframeAt } from '../design/timeline/cursor'
import { useTimelinePlayback } from '../design/timeline/useTimelinePlayback'
import { TacticInspector, type InspectorTab } from './TacticInspector'
import { TacticToolRow, type TacticPanel } from './TacticToolRow'
import { KeyframeList, TimelineControls } from '../design/editor/PropertiesPanel'
import { TacticPresentation } from './TacticPresentation'
import { TACTIC_TOUR_STEPS } from './tacticTourSteps'
import { OnboardingTour } from '../design/editor/onboarding/OnboardingTour'
import {
  TACTIC_TOUR_SEEN_KEY,
  useOnboardingTour,
} from '../design/editor/onboarding/useOnboardingTour'
import { TacticTopBar } from './TacticTopBar'
import { useTacticTimelineHost } from './useTacticTimelineHost'

// Matches the drill editor's: wide enough for a library card on a retina
// screen, small enough that the upload is instant.
const THUMBNAIL_WIDTH = 480

// The tactics editor (TACTICS_BOARD_REWORK_PLAN.md Stage 7), built on the same
// `EditorLayout` the drill editor uses. Everything below the layout is
// composition over parts Stages 3-6 already built: SquadPanel and
// FormationPicker (4, 3), the shared timeline via TimelineHost (5), the
// fourteen drawing tools and their shortcuts (6).
//
// All of the editor's own view state lives here: which tool is armed, what is
// selected, where the playhead is. None of it belongs in the store — the
// playhead alone would re-render every subscriber sixty times a second.
//
// Stage 8 added the two ways out of the editor. EXPORT reuses the drill
// editor's panel wholesale — PNG and GIF are driven from here because the
// Konva stage is only reachable from this component, exactly the split
// DrillEditor documents. PRESENT hands off to TacticPresentation entirely
// rather than layering it on top, so only one Konva stage is ever mounted.

export function TacticEditor({ tactic }: { tactic: Tactic }) {
  const undoTactic = useStore((s) => s.undoTactic)
  const redoTactic = useStore((s) => s.redoTactic)
  const addTacticEntity = useStore((s) => s.addTacticEntity)
  const removeTacticEntity = useStore((s) => s.removeTacticEntity)
  const setTacticEntityPosition = useStore((s) => s.setTacticEntityPosition)
  const addTacticMarking = useStore((s) => s.addTacticMarking)
  const removeTacticMarking = useStore((s) => s.removeTacticMarking)
  const updateTacticMarking = useStore((s) => s.updateTacticMarking)
  const flushTacticSave = useStore((s) => s.flushTacticSave)
  const uploadTacticThumbnail = useStore((s) => s.uploadTacticThumbnail)
  const tacticSaveState = useStore((s) => s.tacticSaveState)
  const enableTacticSharing = useStore((s) => s.enableTacticSharing)
  const disableTacticSharing = useStore((s) => s.disableTacticSharing)
  const showToast = useToast()

  const [side, setSide] = useState<'home' | 'away'>('home')
  const [tool, setTool] = useState<'select' | 'marking'>('select')
  const [marking, setMarking] = useState<MarkingTool>('arrow')
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>('tools')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [squadOpen, setSquadOpen] = useState(false)
  const [rowPanel, setRowPanel] = useState<TacticPanel>(null)
  const [inspectorOpen, setInspectorOpen] = useState(false)
  const [boardOnly, setBoardOnly] = useState(false)
  const [presenting, setPresenting] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const [gifProgress, setGifProgress] = useState<number | null>(null)
  const [onionSkin, setOnionSkin] = useState(false)
  const [playerPaths, setPlayerPaths] = useState(false)
  const [ghostTrails, setGhostTrails] = useState(false)
  const [pendingNote, setPendingNote] = useState<PhasePoint | null>(null)
  const [noteText, setNoteText] = useState('')

  // Keeps the board inside the viewport without scrolling past a full-height
  // canvas.
  const [viewportHeight, setViewportHeight] = useState(() =>
    typeof window === 'undefined' ? 800 : window.innerHeight
  )
  useEffect(() => {
    const onResize = () => setViewportHeight(window.innerHeight)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // The walkthrough (Stage 10.1). Same hook, same overlay, same `TourStep`
  // shape as the drill editor's — only the ten steps and the localStorage key
  // differ, which is exactly what Stage 10.1's "reuse editor/onboarding/*"
  // asks for. Auto-opens once per browser, and the top bar's help icon
  // replays it after that.
  // How much chrome sits above the canvas, measured rather than assumed —
  // the same fix the drill editor got. The old hardcoded 260 budgeted for a
  // docked timeline bar this editor no longer has: its controls moved into the
  // right-hand panel on 2026-08-30, so that reserve was holding back height
  // for a component that is no longer rendered.
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
  const CANVAS_FOOTER = 24

  const tour = useOnboardingTour(TACTIC_TOUR_STEPS, TACTIC_TOUR_SEEN_KEY)

  // Below `lg` the squad and inspector are sheets, so a step whose anchor
  // lives in one has to open it before the overlay measures where to draw.
  // Above `lg` both panels are permanently visible and setting these would
  // actually swap the desktop panel out for a drawer — the same trap
  // DrillEditor documents, avoided the same way.
  useEffect(() => {
    if (!tour.open || typeof window === 'undefined') return
    if (window.innerWidth >= 1024) return
    setSquadOpen(Boolean(tour.step.openTools))
    setInspectorOpen(Boolean(tour.step.openProperties))
  }, [tour.open, tour.step])

  // The drawing tools live behind the inspector's Tools tab, so the `draw`
  // step has to select that tab or its anchor isn't in the DOM to point at.
  // Needed on desktop too, unlike the sheets above — the tab is a tab at
  // every width.
  useEffect(() => {
    if (tour.open && tour.step.id === 'draw') setInspectorTab('tools')
  }, [tour.open, tour.step])

  // Closing or finishing the tour must not leave a sheet stranded open.
  useEffect(() => {
    if (tour.open) return
    setSquadOpen(false)
    setInspectorOpen(false)
  }, [tour.open])

  // Anything still queued when the coach navigates away is written now rather
  // than lost to the debounce.
  useEffect(() => () => void flushTacticSave(), [flushTacticSave])

  const canUndoTimeline = useStore((s) => s.canUndoTactic(tactic.id, 'timeline'))
  const canRedoTimeline = useStore((s) => s.canRedoTactic(tactic.id, 'timeline'))

  const host = useTacticTimelineHost(tactic)
  const playback = useTimelinePlayback(tactic.duration_seconds)
  const frame = useMemo(
    () => frameAt(tactic.scene, tactic.keyframes, playback.currentTime),
    [tactic.scene, tactic.keyframes, playback.currentTime]
  )
  const parkedKeyframe = keyframeAt(tactic.keyframes, playback.currentTime)

  // Single/Dual (7.4) is a FILTER OVER ENTITIES BY TEAM, not two scenes — the
  // plan is explicit about that, and it is what keeps one interpolator, one
  // canvas and one export path serving both. Single shows whichever side the
  // squad panel is on, so switching to the away tab shows the away side rather
  // than an empty pitch.
  const visible: RenderFrame = useMemo(() => {
    if (tactic.view === 'dual') return frame
    return {
      ...frame,
      entities: frame.entities.filter((entity) => entity.kind !== 'player' || entity.team === side),
    }
  }, [frame, tactic.view, side])

  const onion = useMemo(
    () => (onionSkin ? onionFramesFor(tactic.scene, tactic.keyframes, playback.currentTime) : undefined),
    [onionSkin, tactic.scene, tactic.keyframes, playback.currentTime]
  )
  const paths = useMemo(
    () => (playerPaths ? motionPathsFor(tactic.scene, tactic.keyframes, playback.currentTime) : undefined),
    [playerPaths, tactic.scene, tactic.keyframes, playback.currentTime]
  )
  const trails = useMemo(
    () => (ghostTrails ? trailFramesFor(tactic.scene, tactic.keyframes, playback.currentTime) : undefined),
    [ghostTrails, tactic.scene, tactic.keyframes, playback.currentTime]
  )

  // Exports (Stage 8.1). Both live here rather than in ExportPanel because
  // the Konva stage is only reachable from this component — the same split
  // DrillEditor makes, for the same reason.
  const stageRef = useRef<Konva.Stage | null>(null)

  // Thumbnails (Stage 9.2). Auto-capture on save when the tactic has none —
  // the drill editor's rule, condition for condition, so the two libraries
  // fill in the same way:
  //   * something must have been edited and settled in THIS session, which
  //     also sidesteps capturing a stage that hasn't been measured yet on
  //     first paint;
  //   * the playhead must be back at the start, since what gets captured is
  //     literally what is on screen;
  //   * a tactic that already has one is left alone.
  // There is no manual re-capture button, unlike the drill's Details drawer:
  // a tactic has no details drawer to put one in, and Stage 9 doesn't ask for
  // one. Editing a tactic that has no thumbnail is the only trigger.
  const editedRef = useRef(false)
  const capturedFor = useRef<string | null>(null)
  useEffect(() => {
    if (tacticSaveState === 'dirty' || tacticSaveState === 'saving') {
      editedRef.current = true
      return
    }
    if (tacticSaveState !== 'saved' || !editedRef.current) return
    if (tactic.thumbnail_url || capturedFor.current === tactic.id) return
    if (tactic.scene.entities.length === 0 || playback.currentTime > 0) return
    const stage = stageRef.current
    if (!stage || stage.width() === 0) return
    capturedFor.current = tactic.id
    const pixelRatio = Math.min(1, THUMBNAIL_WIDTH / stage.width())
    void uploadTacticThumbnail(tactic.id, stage.toDataURL({ pixelRatio, mimeType: 'image/png' }))
    // Deliberately narrow: depending on every value read inside would re-run
    // this on each frame of playback rather than on the transitions it cares
    // about. Same exemption, same reason, as DrillEditor's.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tacticSaveState, tactic.id, tactic.thumbnail_url, tactic.scene.entities.length, playback.currentTime])

  const handleExportPng = (filename: string) => {
    const stage = stageRef.current
    if (!stage) return
    // pixelRatio 2, as the drill editor uses: a retina-sharp still that
    // survives being dropped into a team chat.
    void downloadDataUrl(stage.toDataURL({ pixelRatio: 2, mimeType: 'image/png' }), filename)
    showToast('PNG saved')
  }

  const handleExportGif = async (filename: string) => {
    const stage = stageRef.current
    if (!stage || gifProgress !== null) return
    if (tactic.keyframes.length < 2) {
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
        durationSeconds: tactic.duration_seconds,
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

  // Cmd/Ctrl+Z. Scoped to 'timeline', matching the top bar's undo button —
  // tactics keeps a second stack for free-drawn markings, and the inspector's
  // own Undo drives that one, so a bare Cmd+Z must not silently rewind
  // drawings the coach never asked it to touch.
  useUndoKeys({
    onUndo: () => undoTactic(tactic.id, 'timeline'),
    onRedo: () => redoTactic(tactic.id, 'timeline'),
    canUndo: canUndoTimeline,
    canRedo: canRedoTimeline,
  })

  useMarkingKeys({
    onSelectTool: (next) => {
      if (next === 'select') {
        setTool('select')
        return
      }
      setMarking(next)
      setTool('marking')
      setInspectorTab('tools')
    },
  })

  // Board-only mode (7.5): `F` in, Escape or `F` back out. `P` presents
  // (8.3). Both stand down while presenting, which owns its own keys —
  // otherwise Escape would leave the presentation AND toggle board-only
  // underneath it, and `F` would flip a layout nobody can see.
  useEffect(() => {
    // ...and while the tour is up: `P` would start a presentation on top of
    // the walkthrough, and Escape belongs to whichever overlay is in front.
    if (presenting || tour.open) return
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      const tag = target?.tagName?.toLowerCase()
      if (tag === 'input' || tag === 'textarea' || tag === 'select' || target?.isContentEditable) return
      if (event.metaKey || event.ctrlKey || event.altKey) return
      if (event.key === 'f' || event.key === 'F') setBoardOnly((on) => !on)
      if (event.key === 'p' || event.key === 'P') setPresenting(true)
      if (event.key === 'Escape') setBoardOnly(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [presenting, tour.open])

  const keyframeId = parkedKeyframe?.id ?? tactic.keyframes[0]?.id ?? null

  const handleEntitiesMove = (moves: EntityMove[], commit: boolean) => {
    // Dragging writes into the keyframe the playhead is parked on; between
    // keyframes there is no single frame to write to, so the drag is refused
    // rather than silently landing somewhere the coach can't see.
    if (!parkedKeyframe) return
    for (const move of moves) {
      setTacticEntityPosition(tactic.id, parkedKeyframe.id, move.id, move.position, commit)
    }
  }

  const handleDrawMarking = (draft: Omit<Marking, 'id'>) => {
    addTacticMarking(tactic.id, draft)
  }

  const handleCanvasClick = (position: PhasePoint) => {
    if (tool === 'marking' && marking === 'text') {
      setPendingNote(position)
      setNoteText('')
    }
  }

  const removeSelection = (ids: string[]) => {
    for (const id of ids) {
      if (tactic.scene.entities.some((e) => e.id === id)) removeTacticEntity(tactic.id, id)
      else removeTacticMarking(tactic.id, id)
    }
    setSelectedIds([])
  }

  const toolRowProps = {
    tactic,
    keyframeId,
    side,
    onSideChange: setSide,
    tool,
    onToolChange: setTool,
    marking,
    onMarkingChange: (next: MarkingTool) => {
      setMarking(next)
      setTool(next === 'select' ? 'select' : 'marking')
    },
    panel: rowPanel,
    onPanelChange: setRowPanel,
    onAddBall: () => {
      if (keyframeId) addTacticEntity(tactic.id, 'ball', { x: 0.5, y: 0.5 })
    },
  }
  // The drawer copy is what the mobile sheet shows; the topbar copy sits above
  // the canvas on desktop. Same split the drill editor uses.
  const toolRowDrawer = <TacticToolRow layout="drawer" {...toolRowProps} />
  const toolRowTopbar = <TacticToolRow layout="topbar" {...toolRowProps} />

  const inspector = (
    <div className="space-y-3">
      {/* The timeline moved off the bottom bar and into this panel on
          2026-08-30, the same move the drill editor made — same KeyframeList
          and TimelineControls, so the two editors' timelines are one
          implementation rather than two that look alike. */}
      <div data-onboarding-anchor="tactic-timeline" className="space-y-3">
      <KeyframeList host={host} playback={playback} currentTime={playback.currentTime} onSeek={playback.seek} />
      <TimelineControls
        host={host}
        playback={playback}
        onionSkin={onionSkin}
        onToggleOnionSkin={() => setOnionSkin((v) => !v)}
        playerPaths={playerPaths}
        onTogglePlayerPaths={() => setPlayerPaths((v) => !v)}
        ghostTrails={ghostTrails}
        onToggleGhostTrails={() => setGhostTrails((v) => !v)}
      />
      </div>
      <div className="border-t border-line pt-3">
    <TacticInspector
      tactic={tactic}
      host={host}
      tab={inspectorTab}
      onTabChange={setInspectorTab}
      marking={marking}
      onMarkingChange={(next) => {
        setMarking(next)
        setTool(next === 'select' ? 'select' : 'marking')
      }}
      selectedIds={selectedIds}
      currentTime={playback.currentTime}
      parkedKeyframeId={parkedKeyframe?.id ?? null}
      hasFollowingKeyframe={
        parkedKeyframe ? tactic.keyframes.some((k) => k.t > parkedKeyframe.t) : false
      }
      onSeek={playback.seek}
      onRemoveSelection={() => removeSelection(selectedIds)}
    />
      </div>
    </div>
  )

  const canvas = (
    <>
      <PitchCanvas
        stageRef={stageRef}
        onboardingAnchor="tactic-canvas"
        pitch={tactic.pitch}
        frame={visible}
        onionFrames={onion}
        motionPaths={paths}
        trailFrames={trails}
        maxWidth={1600}
        maxHeight={Math.max(260, viewportHeight - (boardOnly ? 120 : canvasTop + CANVAS_FOOTER))}
        // Matches the drill editor: the board fills its canvas rather than
        // holding the pitch's real proportions, now that the squad column no
        // longer takes a third of the width and there is width to fill.
        fillCanvas
        editable
        onEntitiesMove={handleEntitiesMove}
        annotationMode={tool !== 'select'}
        onCanvasClick={handleCanvasClick}
        drawTool={tool === 'marking' ? markingToolSpec(marking).draw : null}
        drawStyle={{ dash: marking === 'pass' }}
        onDrawMarking={handleDrawMarking}
        selectedIds={selectedIds}
        onSelectionChange={tool === 'select' ? setSelectedIds : undefined}
        onDeleteSelection={removeSelection}
        onMarkingsTransform={(updates) => {
          for (const update of updates) updateTacticMarking(tactic.id, update.id, { points: update.points })
        }}
        hintText={tool === 'marking' ? markingToolSpec(marking).hint || null : null}
      />

      {pendingNote && (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (!noteText.trim()) return
            addTacticMarking(tactic.id, { kind: 'text', points: [pendingNote], text: noteText.trim() })
            setPendingNote(null)
            setNoteText('')
          }}
          className="flex w-full flex-wrap items-center gap-2 rounded-md border border-line bg-panel-raised p-2"
        >
          <label htmlFor="new-tactic-note" className="text-xs font-medium text-ink-muted">
            Note
          </label>
          <input
            id="new-tactic-note"
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

  // Presentation (8.3) replaces the editor rather than covering it: one Konva
  // stage on screen, and `fixed inset-0` there escapes AppShell's nav rail,
  // which board-only can't do from inside the layout. Placed after every hook
  // above, so none of them is skipped on the render that hands off.
  if (presenting) {
    return <TacticPresentation tactic={tactic} onExit={() => setPresenting(false)} />
  }
  return (
    <EditorLayout
      boardOnly={boardOnly}
      topBar={
        <div className="flex flex-col gap-3 border-b border-line pb-3">
        <TacticTopBar
          tactic={tactic}
          onEnterBoardOnly={() => setBoardOnly(true)}
          onExport={() => setExportOpen(true)}
          onPresent={() => setPresenting(true)}
          onReplayTour={tour.restart}
        />
        <div className="hidden lg:block">{toolRowTopbar}</div>
        </div>
      }
      rail={toolRowDrawer}
      hideDesktopRail
      canvas={canvas}
      inspector={inspector}
      timeline={null}
      railOpen={squadOpen}
      onRailClose={() => setSquadOpen(false)}
      railTitle="Tools"
      inspectorOpen={inspectorOpen}
      onInspectorClose={() => setInspectorOpen(false)}
      inspectorTitle="Inspector"
      maxPanelHeight={Math.max(260, viewportHeight - canvasTop - CANVAS_FOOTER)}
      dock={
        <>
          <DockButton label="Tools" icon={<Wrench className="h-4 w-4" />} onClick={() => setSquadOpen(true)} />
          <button
            type="button"
            onClick={playback.togglePlay}
            aria-label={playback.playing ? 'Pause' : 'Play'}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-accent text-white"
          >
            {playback.playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
          </button>
          <DockButton label="Inspector" icon={<PanelRight className="h-4 w-4" />} onClick={() => setInspectorOpen(true)} />
        </>
      }
      extras={
        <>
          {boardOnly && (
            <button
              type="button"
              onClick={() => setBoardOnly(false)}
              className="fixed right-4 top-4 z-40 rounded-md border border-line bg-panel/90 px-2 py-1 text-xs font-medium text-ink-muted hover:border-line-strong"
            >
              Exit board-only (F)
            </button>
          )}

          <ExportDrawer open={exportOpen} onClose={() => setExportOpen(false)}>
            <ExportPanel
              target={{
                kind: 'tactic',
                name: tactic.name,
                shareToken: tactic.share_token,
                sharePath: '/t',
                cardPath: `/tactics/${tactic.id}/card`,
                onEnableSharing: () => enableTacticSharing(tactic.id),
                onDisableSharing: () => disableTacticSharing(tactic.id),
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
        </>
      }
    />
  )
}
