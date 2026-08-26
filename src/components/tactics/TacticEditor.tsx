import { useEffect, useMemo, useState } from 'react'
import { Pause, PanelRight, Play, Users } from 'lucide-react'
import { useStore } from '../../store'
import type { Marking, PhasePoint, Tactic } from '../../store'
import { PitchCanvas, type EntityMove } from '../design/PitchCanvas'
import { frameAt, type RenderFrame } from '../design/canvas/interpolate'
import { DockButton, EditorLayout } from '../design/editor/EditorShell'
import { markingToolSpec, type MarkingTool } from '../design/editor/markingTools'
import { useMarkingKeys } from '../design/editor/useMarkingKeys'
import { motionPathsFor, trailFramesFor } from '../design/timeline/motion'
import { onionFramesFor } from '../design/timeline/onionSkin'
import { TimelineBar } from '../design/timeline/TimelineBar'
import { TimelineEditor } from '../design/timeline/TimelineEditor'
import { keyframeAt } from '../design/timeline/cursor'
import { useKeyframeToggle } from '../design/timeline/useKeyframeToggle'
import { useTimelinePlayback } from '../design/timeline/useTimelinePlayback'
import { SquadPanel } from './SquadPanel'
import { TacticInspector, type InspectorTab } from './TacticInspector'
import { TacticTopBar } from './TacticTopBar'
import { useTacticTimelineHost } from './useTacticTimelineHost'

// The tactics editor (TACTICS_BOARD_REWORK_PLAN.md Stage 7), built on the same
// `EditorLayout` the drill editor uses. Everything below the layout is
// composition over parts Stages 3-6 already built: SquadPanel and
// FormationPicker (4, 3), the shared timeline via TimelineHost (5), the
// fourteen drawing tools and their shortcuts (6).
//
// All of the editor's own view state lives here: which tool is armed, what is
// selected, where the playhead is. None of it belongs in the store — the
// playhead alone would re-render every subscriber sixty times a second.

export function TacticEditor({ tactic }: { tactic: Tactic }) {
  const addTacticEntity = useStore((s) => s.addTacticEntity)
  const removeTacticEntity = useStore((s) => s.removeTacticEntity)
  const setTacticEntityPosition = useStore((s) => s.setTacticEntityPosition)
  const addTacticMarking = useStore((s) => s.addTacticMarking)
  const removeTacticMarking = useStore((s) => s.removeTacticMarking)
  const updateTacticMarking = useStore((s) => s.updateTacticMarking)
  const flushTacticSave = useStore((s) => s.flushTacticSave)

  const [side, setSide] = useState<'home' | 'away'>('home')
  const [tool, setTool] = useState<'select' | 'marking'>('select')
  const [marking, setMarking] = useState<MarkingTool>('arrow')
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>('tools')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [squadOpen, setSquadOpen] = useState(false)
  const [inspectorOpen, setInspectorOpen] = useState(false)
  const [timelineOpen, setTimelineOpen] = useState(false)
  const [boardOnly, setBoardOnly] = useState(false)
  const [onionSkin, setOnionSkin] = useState(false)
  const [playerPaths, setPlayerPaths] = useState(false)
  const [ghostTrails, setGhostTrails] = useState(false)
  const [pendingNote, setPendingNote] = useState<PhasePoint | null>(null)
  const [noteText, setNoteText] = useState('')

  // Same reserve the drill editor keeps, so the docked timeline stays reachable
  // without scrolling past a full-height canvas.
  const [viewportHeight, setViewportHeight] = useState(() =>
    typeof window === 'undefined' ? 800 : window.innerHeight
  )
  useEffect(() => {
    const onResize = () => setViewportHeight(window.innerHeight)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // Anything still queued when the coach navigates away is written now rather
  // than lost to the debounce.
  useEffect(() => () => void flushTacticSave(), [flushTacticSave])

  const host = useTacticTimelineHost(tactic)
  const playback = useTimelinePlayback(tactic.duration_seconds)
  const frame = useMemo(
    () => frameAt(tactic.scene, tactic.keyframes, playback.currentTime),
    [tactic.scene, tactic.keyframes, playback.currentTime]
  )
  const keyframeToggle = useKeyframeToggle(host, frame, playback)
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

  // Board-only mode (7.5): `F` in, Escape or `F` back out.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      const tag = target?.tagName?.toLowerCase()
      if (tag === 'input' || tag === 'textarea' || tag === 'select' || target?.isContentEditable) return
      if (event.metaKey || event.ctrlKey || event.altKey) return
      if (event.key === 'f' || event.key === 'F') setBoardOnly((on) => !on)
      if (event.key === 'Escape') setBoardOnly(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

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

  const squad = keyframeId ? (
    <SquadPanel tactic={tactic} keyframeId={keyframeId} side={side} onSideChange={setSide} />
  ) : null

  const inspector = (
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
  )

  const canvas = (
    <>
      <PitchCanvas
        pitch={tactic.pitch}
        frame={visible}
        onionFrames={onion}
        motionPaths={paths}
        trailFrames={trails}
        maxWidth={720}
        maxHeight={Math.max(260, viewportHeight - (boardOnly ? 120 : 260))}
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

  const timeline = (
    <>
      <TimelineBar
        playback={playback}
        duration={tactic.duration_seconds}
        keyframes={tactic.keyframes}
        onionSkin={onionSkin}
        onToggleOnionSkin={() => setOnionSkin((v) => !v)}
        playerPaths={playerPaths}
        onTogglePlayerPaths={() => setPlayerPaths((v) => !v)}
        ghostTrails={ghostTrails}
        onToggleGhostTrails={() => setGhostTrails((v) => !v)}
        expanded={timelineOpen}
        onToggleExpanded={() => setTimelineOpen((v) => !v)}
        onToggleKeyframe={keyframeToggle.toggle}
        onCopyKeyframe={parkedKeyframe ? () => host.copyKeyframe?.(parkedKeyframe.id) : undefined}
        onPasteKeyframe={host.canPaste ? () => host.pasteKeyframe?.(playback.currentTime) : undefined}
      />
      {timelineOpen && <TimelineEditor host={host} playback={playback} frame={frame} />}
    </>
  )

  return (
    <EditorLayout
      boardOnly={boardOnly}
      topBar={
        <TacticTopBar
          tactic={tactic}
          squadOpen={squadOpen}
          onToggleSquad={() => setSquadOpen((v) => !v)}
          inspectorOpen={inspectorOpen}
          onToggleInspector={() => setInspectorOpen((v) => !v)}
          timelineOpen={timelineOpen}
          onToggleTimeline={() => setTimelineOpen((v) => !v)}
          onAddBall={() => {
            if (keyframeId) addTacticEntity(tactic.id, 'ball', { x: 0.5, y: 0.5 })
          }}
          onEnterBoardOnly={() => setBoardOnly(true)}
        />
      }
      rail={squad}
      canvas={canvas}
      inspector={inspector}
      timeline={timeline}
      railOpen={squadOpen}
      onRailClose={() => setSquadOpen(false)}
      railTitle="Squad"
      inspectorOpen={inspectorOpen}
      onInspectorClose={() => setInspectorOpen(false)}
      inspectorTitle="Inspector"
      maxPanelHeight={Math.max(260, viewportHeight - 260)}
      dock={
        <>
          <DockButton label="Squad" icon={<Users className="h-4 w-4" />} onClick={() => setSquadOpen(true)} />
          <button
            type="button"
            onClick={playback.togglePlay}
            aria-label={playback.playing ? 'Pause' : 'Play'}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-accent text-white"
          >
            {playback.playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
          </button>
          <DockButton label="Tools" icon={<PanelRight className="h-4 w-4" />} onClick={() => setInspectorOpen(true)} />
        </>
      }
      extras={
        boardOnly ? (
          <button
            type="button"
            onClick={() => setBoardOnly(false)}
            className="fixed right-4 top-4 z-40 rounded-md border border-line bg-panel/90 px-2 py-1 text-xs font-medium text-ink-muted hover:border-line-strong"
          >
            Exit board-only (F)
          </button>
        ) : null
      }
    />
  )
}
