import { useEffect, useRef, useState } from 'react'
import type Konva from 'konva'
import { Arrow, Circle, Ellipse, Group, Label, Layer, Line, Rect, Stage, Tag, Text, Transformer } from 'react-konva'
import type { PhasePoint, PitchConfig, PitchSize } from '../../store'
import type { RenderFrame } from './canvas/interpolate'
import { ANNOTATION, ARROW, BALL, CONE, MANNEQUIN, PLAYER, SELECTION, TURF, WITCHES_HAT } from './pitchTheme'
import { assignTeamColors, getPitchAspectRatio, getPitchMarkings } from './pitchGeometry'

type PixelPoint = { x: number; y: number }
type NormalizedPoint = { x: number; y: number }

export interface EntityMove {
  id: string
  position: NormalizedPoint
}

interface PitchCanvasProps {
  // Real metre dimensions plus orientation and overlays, replacing the old
  // pitchSize/orientation pair (rework plan Stage 3.2).
  pitch: PitchConfig
  // One moment of a drill, already resolved to placed shapes by `frameAt` —
  // this component never sees keyframes or interpolates anything itself, it
  // renders whatever frame it's handed, exactly as it rendered whatever phase
  // it was handed before.
  frame: RenderFrame | null
  maxWidth?: number
  className?: string

  // When true, entities become draggable Konva nodes. `onEntitiesMove` fires
  // on every `dragmove` with `commit: false` (local-state-only, no network —
  // see drillSlice.setEntityPosition) and once more on `dragend` with
  // `commit: true`, which is the call that pushes an undo snapshot and
  // schedules the autosave. Positions are already converted back to
  // normalized 0-1. A move carries every selected entity, not just the one
  // under the pointer, so dragging a box-selection moves the group.
  editable?: boolean
  onEntitiesMove?: (moves: EntityMove[], commit: boolean) => void

  // When true, clicking/tapping empty pitch reports the position back via
  // `onCanvasClick`, already normalized. Independent of `editable`.
  annotationMode?: boolean
  onCanvasClick?: (position: NormalizedPoint) => void

  // When true, clicking an entity or a marking reports it for removal
  // instead of selecting it.
  removeMode?: boolean
  onEntityClick?: (entityId: string) => void
  onMarkingClick?: (markingId: string) => void

  // Selection (Stage 3.4) is view state and belongs to the editor, not the
  // store — pass it in and this canvas reports every change back rather than
  // owning it. Passing `onSelectionChange` is what turns selection on at all;
  // without it, clicks and marquee drags stay inert, the same way `editable`
  // and `removeMode` gate their own affordances.
  selectedIds?: string[]
  onSelectionChange?: (ids: string[]) => void
  // Delete/Backspace with a selection. The canvas never mutates anything
  // itself, so removal is the caller's to perform.
  onDeleteSelection?: (ids: string[]) => void
  // Konva Transformer results, baked back into each marking's normalized
  // points (Stage 3.5). Only markings are transformable; entities move.
  onMarkingsTransform?: (updates: Array<{ id: string; points: PhasePoint[] }>) => void

  // Staged first point of an in-progress two-click arrow. Only ever rendered.
  pendingArrowStart?: NormalizedPoint | null
  hintText?: string | null
}

const DEFAULT_MAX_WIDTH = 420

// Zoom stays at or above "fits the pitch" — zooming out past the whole pitch
// has nothing to show, and it keeps the pan clamp below to one simple case.
const MIN_SCALE = 1
const MAX_SCALE = 5
const ZOOM_STEP = 1.08

// A marquee smaller than this in either axis is treated as a click on empty
// pitch (which clears the selection) rather than as a box-select, so a
// slightly shaky tap doesn't select nothing and look broken.
const MARQUEE_THRESHOLD_PX = 4

// Nothing in this component may hold a hex value — see pitchTheme.ts.
const EMPTY_SELECTION: string[] = []

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n))
}

function clamp01(n: number) {
  return clamp(n, 0, 1)
}

// Stage 3 renders a PitchConfig, but pitchGeometry still hand-authors its
// markings per PitchSize — generalising it to arbitrary metre dimensions is
// Stage 7.2. Until then the preset key maps straight back, which it can
// because migration 013b carried the four old pitch_size values across as
// preset keys. Stage 7 deletes this bridge along with the switch it feeds.
const BRIDGED_PRESETS: readonly string[] = ['full', 'three_quarter', 'half', 'quarter']

function sizeForPreset(preset: string): PitchSize {
  return BRIDGED_PRESETS.includes(preset) ? (preset as PitchSize) : 'full'
}

// Measures the wrapping div's available width via ResizeObserver so the
// Konva Stage — which needs explicit pixel width/height, unlike a CSS
// element — stays responsive across phone/tablet/laptop viewports without
// re-deriving layout logic per caller.
function useMeasuredWidth(maxWidth: number) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [width, setWidth] = useState(maxWidth)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const observer = new ResizeObserver((entries) => {
      const measured = entries[0]?.contentRect.width
      if (measured) setWidth(Math.min(measured, maxWidth))
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [maxWidth])

  return { containerRef, width }
}

// Pan/zoom of the whole Stage. Scale is never below 1, so the content is
// always at least as large as the viewport and the offset only ever needs
// clamping against one edge pair.
interface StageView {
  scale: number
  x: number
  y: number
}

const RESET_VIEW: StageView = { scale: 1, x: 0, y: 0 }

function clampView(view: StageView, width: number, height: number): StageView {
  return {
    scale: view.scale,
    x: clamp(view.x, width - width * view.scale, 0),
    y: clamp(view.y, height - height * view.scale, 0),
  }
}

function distanceBetween(a: Konva.Vector2d, b: Konva.Vector2d) {
  return Math.hypot(b.x - a.x, b.y - a.y)
}

// Renders one moment of a drill (a RenderFrame from canvas/interpolate.ts) as
// Konva shapes: a pitch for the given PitchConfig, then the frame's markings,
// equipment, balls and players — nothing hand-positioned, everything derived
// from normalized 0-1 coordinates and the pitch's meters-based markings
// (pitchGeometry.ts).
//
// This component never talks to Supabase and never mutates a drill. It reports
// pixel positions back to the caller, already converted to normalized 0-1, via
// `onEntitiesMove`/`onCanvasClick`/`onSelectionChange`/`onMarkingsTransform`;
// persistence is always the caller's job. That separation is why the tactics
// board reuses this canvas by adapting its own data into a RenderFrame rather
// than forking the component.
export function PitchCanvas({
  pitch,
  frame,
  maxWidth = DEFAULT_MAX_WIDTH,
  className,
  editable = false,
  onEntitiesMove,
  annotationMode = false,
  onCanvasClick,
  removeMode = false,
  onEntityClick,
  onMarkingClick,
  selectedIds,
  onSelectionChange,
  onDeleteSelection,
  onMarkingsTransform,
  pendingArrowStart,
  hintText,
}: PitchCanvasProps) {
  const { containerRef, width } = useMeasuredWidth(maxWidth)
  const size = sizeForPreset(pitch.preset)
  const aspectRatio = getPitchAspectRatio(size, pitch.orientation) // width / length
  const height = width / aspectRatio
  const markings = getPitchMarkings(size, pitch.orientation)

  const [view, setView] = useState<StageView>(RESET_VIEW)
  const [spaceHeld, setSpaceHeld] = useState(false)
  const [marquee, setMarquee] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null)
  const marqueeStart = useRef<PixelPoint | null>(null)
  const pinchDistance = useRef<number | null>(null)
  const transformerRef = useRef<Konva.Transformer>(null)
  const markingNodes = useRef(new Map<string, Konva.Node>())
  // Where every entity being dragged sat when the gesture began, so a
  // multi-select drag can move the whole group by the same delta.
  const dragOrigin = useRef<{ anchor: NormalizedPoint; positions: Map<string, NormalizedPoint> } | null>(null)

  const selection = selectedIds ?? EMPTY_SELECTION
  const selectable = onSelectionChange !== undefined
  const isSelected = (id: string) => selection.includes(id)
  const panning = spaceHeld
  const viewChanged = view.scale !== 1 || view.x !== 0 || view.y !== 0

  const entities = frame?.entities ?? []
  const frameMarkings = frame?.markings ?? []

  // Meters -> pixels. Equal on both axes by construction (the Stage's
  // aspect ratio is derived from the same widthMeters/lengthMeters used
  // here), which is what keeps center circles circular instead of oval.
  const scaleX = width / markings.widthMeters
  const scaleY = height / markings.lengthMeters
  const lineWidth = Math.max(1.5, width * 0.006)

  // Frame coordinates are normalized 0-1 and convert directly against Stage
  // width/height — never against the pitch markings' meters scale, which is a
  // separate coordinate space.
  const toPx = (n: NormalizedPoint): PixelPoint => ({ x: n.x * width, y: n.y * height })

  const fromPx = (p: PixelPoint): NormalizedPoint => ({
    x: width > 0 ? clamp01(p.x / width) : 0,
    y: height > 0 ? clamp01(p.y / height) : 0,
  })

  // Konva hands dragBoundFunc an absolute position, which already includes
  // the Stage's pan/zoom — so the content-space limits have to be pushed
  // through the same transform rather than compared raw.
  const makeDragBound = (radius: number) => (pos: PixelPoint): PixelPoint => {
    const lowX = radius * view.scale + view.x
    const lowY = radius * view.scale + view.y
    return {
      x: clamp(pos.x, lowX, Math.max(lowX, (width - radius) * view.scale + view.x)),
      y: clamp(pos.y, lowY, Math.max(lowY, (height - radius) * view.scale + view.y)),
    }
  }

  const beginEntityDrag = (entityId: string) => {
    const moving = isSelected(entityId) && selection.length > 1 ? selection : [entityId]
    const positions = new Map<string, NormalizedPoint>()
    for (const id of moving) {
      const entity = entities.find((e) => e.id === id)
      if (entity) positions.set(id, { x: entity.x, y: entity.y })
    }
    dragOrigin.current = { anchor: positions.get(entityId) ?? { x: 0, y: 0 }, positions }
  }

  const dragEntityTo = (entityId: string, position: NormalizedPoint, commit: boolean) => {
    const origin = dragOrigin.current
    if (!origin || origin.positions.size <= 1) {
      onEntitiesMove?.([{ id: entityId, position }], commit)
      return
    }
    const dx = position.x - origin.anchor.x
    const dy = position.y - origin.anchor.y
    const moves: EntityMove[] = []
    for (const [id, start] of origin.positions) {
      moves.push(
        id === entityId
          ? { id, position }
          : { id, position: { x: clamp01(start.x + dx), y: clamp01(start.y + dy) } }
      )
    }
    onEntitiesMove?.(moves, commit)
  }

  // Arrow-key nudge (Stage 3.5): one pixel, ten with Shift, expressed in
  // stage pixels so the step feels the same regardless of pitch preset, then
  // converted back into the normalized space everything is stored in.
  const nudgeSelection = (dxPx: number, dyPx: number) => {
    if (selection.length === 0 || width === 0 || height === 0) return
    const moves: EntityMove[] = []
    for (const id of selection) {
      const entity = entities.find((e) => e.id === id)
      if (!entity) continue
      moves.push({
        id,
        position: { x: clamp01(entity.x + dxPx / width), y: clamp01(entity.y + dyPx / height) },
      })
    }
    if (moves.length > 0) onEntitiesMove?.(moves, true)
  }

  const selectOne = (id: string, additive: boolean) => {
    if (!onSelectionChange) return
    if (!additive) {
      onSelectionChange([id])
      return
    }
    onSelectionChange(isSelected(id) ? selection.filter((s) => s !== id) : [...selection, id])
  }

  const handleEntityClick = (entityId: string) => (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    if (removeMode) {
      onEntityClick?.(entityId)
      return
    }
    const evt = e.evt as MouseEvent
    selectOne(entityId, Boolean(evt?.shiftKey || evt?.metaKey || evt?.ctrlKey))
  }

  const handleMarkingClick = (markingId: string) => (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    if (removeMode) {
      onMarkingClick?.(markingId)
      return
    }
    const evt = e.evt as MouseEvent
    selectOne(markingId, Boolean(evt?.shiftKey || evt?.metaKey || evt?.ctrlKey))
  }

  // Annotation placement: only fires when the click/tap landed on empty
  // pitch, not on a shape — Konva sets `e.target` to the Stage itself when
  // nothing was hit, which is what stops "tap a player to place a note next
  // to it" from also dropping a note under your finger.
  const handleStageClick = (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    if (!annotationMode || !onCanvasClick) return
    const stage = e.target.getStage()
    if (!stage || e.target !== stage) return
    const pointer = stage.getRelativePointerPosition()
    if (!pointer) return
    onCanvasClick(fromPx(pointer))
  }

  // --- zoom & pan (Stage 3.6) ---------------------------------------------

  const handleWheel = (e: Konva.KonvaEventObject<WheelEvent>) => {
    const stage = e.target.getStage()
    const pointer = stage?.getPointerPosition()
    if (!stage || !pointer) return
    e.evt.preventDefault()
    const nextScale = clamp(
      view.scale * (e.evt.deltaY > 0 ? 1 / ZOOM_STEP : ZOOM_STEP),
      MIN_SCALE,
      MAX_SCALE
    )
    // Keep whatever is under the cursor pinned there while the scale changes.
    const contentX = (pointer.x - view.x) / view.scale
    const contentY = (pointer.y - view.y) / view.scale
    setView(
      clampView(
        { scale: nextScale, x: pointer.x - contentX * nextScale, y: pointer.y - contentY * nextScale },
        width,
        height
      )
    )
  }

  // Two-finger pinch doubles as pan: the midpoint between the fingers is the
  // zoom anchor, so moving both fingers together drags the pitch.
  const handleTouchMove = (e: Konva.KonvaEventObject<TouchEvent>) => {
    const touches = e.evt.touches
    if (touches.length !== 2) return
    e.evt.preventDefault()
    const stage = e.target.getStage()
    if (!stage) return
    const box = stage.container().getBoundingClientRect()
    const a = { x: touches[0].clientX - box.left, y: touches[0].clientY - box.top }
    const b = { x: touches[1].clientX - box.left, y: touches[1].clientY - box.top }
    const spread = distanceBetween(a, b)
    const midpoint = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
    const previous = pinchDistance.current
    pinchDistance.current = spread
    if (!previous) return
    const nextScale = clamp(view.scale * (spread / previous), MIN_SCALE, MAX_SCALE)
    const contentX = (midpoint.x - view.x) / view.scale
    const contentY = (midpoint.y - view.y) / view.scale
    setView(
      clampView(
        { scale: nextScale, x: midpoint.x - contentX * nextScale, y: midpoint.y - contentY * nextScale },
        width,
        height
      )
    )
  }

  const endTouch = () => {
    pinchDistance.current = null
  }

  // --- marquee box-select (Stage 3.4) -------------------------------------

  const handleStagePointerDown = (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    if (!selectable || panning || annotationMode || removeMode) return
    const stage = e.target.getStage()
    if (!stage || e.target !== stage) return
    const pointer = stage.getRelativePointerPosition()
    if (!pointer) return
    marqueeStart.current = pointer
    setMarquee(null)
  }

  const handleStagePointerMove = (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    const start = marqueeStart.current
    if (!start) return
    const stage = e.target.getStage()
    const pointer = stage?.getRelativePointerPosition()
    if (!pointer) return
    setMarquee({ x1: start.x, y1: start.y, x2: pointer.x, y2: pointer.y })
  }

  const handleStagePointerUp = () => {
    const start = marqueeStart.current
    marqueeStart.current = null
    if (!start || !onSelectionChange) {
      setMarquee(null)
      return
    }
    const box = marquee
    setMarquee(null)
    // Too small to be a deliberate box: treat it as a click on empty pitch,
    // which clears the selection.
    if (!box || Math.abs(box.x2 - box.x1) < MARQUEE_THRESHOLD_PX || Math.abs(box.y2 - box.y1) < MARQUEE_THRESHOLD_PX) {
      if (selection.length > 0) onSelectionChange([])
      return
    }
    const left = Math.min(box.x1, box.x2) / width
    const right = Math.max(box.x1, box.x2) / width
    const top = Math.min(box.y1, box.y2) / height
    const bottom = Math.max(box.y1, box.y2) / height
    const caught = entities
      .filter((entity) => entity.x >= left && entity.x <= right && entity.y >= top && entity.y <= bottom)
      .map((entity) => entity.id)
    onSelectionChange(caught)
  }

  // --- keyboard (Stage 3.4/3.5) -------------------------------------------

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === ' ') {
      setSpaceHeld(true)
      e.preventDefault()
      return
    }
    if (e.key === 'Escape') {
      if (selection.length > 0) onSelectionChange?.([])
      return
    }
    if (e.key === 'Delete' || e.key === 'Backspace') {
      if (selection.length > 0 && onDeleteSelection) {
        onDeleteSelection(selection)
        e.preventDefault()
      }
      return
    }
    if (!editable || selection.length === 0) return
    const step = e.shiftKey ? 10 : 1
    switch (e.key) {
      case 'ArrowLeft':
        nudgeSelection(-step, 0)
        e.preventDefault()
        break
      case 'ArrowRight':
        nudgeSelection(step, 0)
        e.preventDefault()
        break
      case 'ArrowUp':
        nudgeSelection(0, -step)
        e.preventDefault()
        break
      case 'ArrowDown':
        nudgeSelection(0, step)
        e.preventDefault()
        break
    }
  }

  const handleKeyUp = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === ' ') setSpaceHeld(false)
  }

  // --- marking transform (Stage 3.5) --------------------------------------

  // Keeps the Transformer attached to whichever selected markings are on
  // screen. Entities aren't attached: they move, they don't scale or rotate.
  useEffect(() => {
    const transformer = transformerRef.current
    if (!transformer) return
    if (!onMarkingsTransform) {
      transformer.nodes([])
      return
    }
    const nodes = selection
      .map((id) => markingNodes.current.get(id))
      .filter((node): node is Konva.Node => node !== undefined)
    transformer.nodes(nodes)
  }, [selection, frame, onMarkingsTransform])

  // Bakes the Transformer's scale/rotation back into each marking's own
  // normalized points and resets the node, so the transform lives in the
  // data rather than accumulating on the Konva node.
  const handleTransformEnd = () => {
    if (!onMarkingsTransform) return
    const updates: Array<{ id: string; points: PhasePoint[] }> = []
    for (const id of selection) {
      const node = markingNodes.current.get(id)
      const marking = frameMarkings.find((m) => m.id === id)
      if (!node || !marking) continue
      const transform = node.getTransform().copy()
      updates.push({
        id,
        points: marking.points.map((point) => {
          const moved = transform.point(toPx(point))
          return { x: clamp01(moved.x / width), y: clamp01(moved.y / height) }
        }),
      })
      node.scaleX(1)
      node.scaleY(1)
      node.rotation(0)
      node.position({ x: 0, y: 0 })
    }
    if (updates.length > 0) onMarkingsTransform(updates)
  }

  const registerMarkingNode = (id: string) => (node: Konva.Node | null) => {
    if (node) markingNodes.current.set(id, node)
    else markingNodes.current.delete(id)
  }

  const baseUnit = width / 100
  const playerRadius = baseUnit * 3.5
  const coneRadius = baseUnit * 2.4
  const ballRadius = baseUnit * 1.6
  const arrowStrokeWidth = Math.max(2, baseUnit * 0.8)
  const numberFontSize = baseUnit * 3
  const labelFontSize = baseUnit * 2.3
  const annotationFontSize = baseUnit * 2.4
  const haloWidth = Math.max(2, baseUnit * 0.6)

  const players = entities.filter((entity) => entity.kind === 'player')
  const equipment = entities.filter((entity) => entity.kind === 'equipment')
  const balls = entities.filter((entity) => entity.kind === 'ball')
  const textMarkings = frameMarkings.filter((marking) => marking.kind === 'text')
  const shapeMarkings = frameMarkings.filter((marking) => marking.kind !== 'text')

  const teamColors = assignTeamColors(
    players.map((player) => player.team ?? ''),
    PLAYER.colors,
    PLAYER.fallback
  )

  const interactive = editable || annotationMode || removeMode || selectable
  const cursor = panning ? 'grab' : annotationMode ? 'crosshair' : removeMode ? 'pointer' : undefined

  const entityHandlers = (entityId: string, radius: number) => ({
    draggable: editable && !panning,
    dragBoundFunc: editable ? makeDragBound(radius) : undefined,
    onDragStart: editable ? () => beginEntityDrag(entityId) : undefined,
    onDragMove: editable
      ? (e: Konva.KonvaEventObject<DragEvent>) =>
          dragEntityTo(entityId, fromPx({ x: e.target.x(), y: e.target.y() }), false)
      : undefined,
    onDragEnd: editable
      ? (e: Konva.KonvaEventObject<DragEvent>) => {
          dragEntityTo(entityId, fromPx({ x: e.target.x(), y: e.target.y() }), true)
          dragOrigin.current = null
        }
      : undefined,
    onClick: interactive ? handleEntityClick(entityId) : undefined,
    onTap: interactive ? handleEntityClick(entityId) : undefined,
  })

  const markingHandlers = (markingId: string) => ({
    ref: registerMarkingNode(markingId),
    draggable: false,
    onClick: interactive ? handleMarkingClick(markingId) : undefined,
    onTap: interactive ? handleMarkingClick(markingId) : undefined,
    onTransformEnd: handleTransformEnd,
  })

  return (
    <div
      ref={containerRef}
      data-pitch-canvas
      className={className}
      style={{ width: '100%', maxWidth, position: 'relative' }}
      // Focusable so arrow-key nudge, Escape, Delete and space-to-pan reach
      // this canvas without a window-level listener that would fire while the
      // coach is typing in a form field somewhere else on the page.
      tabIndex={interactive ? 0 : undefined}
      onKeyDown={interactive ? handleKeyDown : undefined}
      onKeyUp={interactive ? handleKeyUp : undefined}
    >
      {width > 0 && (
        <Stage
          width={width}
          height={height}
          scaleX={view.scale}
          scaleY={view.scale}
          x={view.x}
          y={view.y}
          draggable={panning}
          onDragMove={panning ? (e) => setView(clampView({ scale: view.scale, x: e.target.x(), y: e.target.y() }, width, height)) : undefined}
          className="overflow-hidden rounded-lg"
          style={cursor ? { cursor } : undefined}
          onClick={handleStageClick}
          onTap={handleStageClick}
          onWheel={handleWheel}
          onMouseDown={handleStagePointerDown}
          onMouseMove={handleStagePointerMove}
          onMouseUp={handleStagePointerUp}
          onTouchStart={handleStagePointerDown}
          onTouchMove={(e) => {
            handleTouchMove(e)
            handleStagePointerMove(e)
          }}
          onTouchEnd={(e) => {
            endTouch()
            handleStagePointerUp()
            void e
          }}
        >
          {/* --- PitchLayer: turf and markings. Never listens, so it can't
              intercept a drag, placement tap or removal click meant for
              something else, and never redraws while entities move. --- */}
          <Layer listening={false}>
            <Rect x={0} y={0} width={width} height={height} fill={TURF.fill} />
            {markings.rects.map((r, i) => (
              <Rect
                key={`rect-${i}`}
                x={r.x * scaleX}
                y={r.y * scaleY}
                width={r.w * scaleX}
                height={r.h * scaleY}
                stroke={TURF.line}
                strokeWidth={lineWidth}
              />
            ))}
            {markings.lines.map((l, i) => (
              <Line
                key={`line-${i}`}
                points={[l.x1 * scaleX, l.y1 * scaleY, l.x2 * scaleX, l.y2 * scaleY]}
                stroke={TURF.line}
                strokeWidth={lineWidth * (l.strokeWidthScale ?? 1)}
                dash={l.dashed ? [lineWidth * 2, lineWidth * 2] : undefined}
              />
            ))}
            {markings.circles.map((c, i) => (
              <Circle
                key={`circle-${i}`}
                x={c.cx * scaleX}
                y={c.cy * scaleY}
                radius={c.r * scaleX}
                stroke={TURF.line}
                strokeWidth={lineWidth}
              />
            ))}
            {markings.dots.map((d, i) => (
              <Circle key={`dot-${i}`} x={d.x * scaleX} y={d.y * scaleY} radius={lineWidth * 1.5} fill={TURF.line} />
            ))}
          </Layer>

          {/* --- OverlayLayer (thirds, channels, Pep zones) belongs here,
              between the pitch and its markings. Stage 7 adds it; an empty
              Konva layer is a real canvas, so it isn't created yet. --- */}

          {/* --- MarkingsLayer: arrows and drawn shapes, under the elements
              they connect. Text notes are the exception and render above the
              entities instead — see EntityLayer. --- */}
          <Layer listening={interactive}>
            {shapeMarkings.map((marking) => {
              const selected = isSelected(marking.id)
              if (marking.kind === 'arrow' && marking.points.length >= 2) {
                const from = toPx(marking.points[0])
                const to = toPx(marking.points[1])
                const style = ARROW[marking.style?.dash ? 'ball' : 'player']
                return (
                  <Arrow
                    key={marking.id}
                    {...markingHandlers(marking.id)}
                    points={[from.x, from.y, to.x, to.y]}
                    stroke={selected ? SELECTION.halo : marking.style?.stroke ?? style.stroke}
                    fill={selected ? SELECTION.halo : marking.style?.stroke ?? style.stroke}
                    dash={style.dash}
                    strokeWidth={(marking.style?.width ?? 1) * arrowStrokeWidth}
                    pointerLength={baseUnit * 2.2}
                    pointerWidth={baseUnit * 2.2}
                    hitStrokeWidth={Math.max(arrowStrokeWidth, baseUnit * 4)}
                  />
                )
              }
              // Every other marking kind is a polyline over the same points —
              // Stage 6 introduces the tools that draw curves, zones and
              // freehand; rendering them as a closed or open line keeps any
              // that already exist visible rather than silently dropped.
              if (marking.points.length < 2) return null
              const closed = marking.kind === 'rect' || marking.kind === 'zone' || marking.kind === 'circle'
              return (
                <Line
                  key={marking.id}
                  {...markingHandlers(marking.id)}
                  points={marking.points.flatMap((point) => {
                    const p = toPx(point)
                    return [p.x, p.y]
                  })}
                  closed={closed}
                  fill={closed ? marking.style?.fill : undefined}
                  stroke={selected ? SELECTION.halo : marking.style?.stroke ?? ARROW.player.stroke}
                  strokeWidth={(marking.style?.width ?? 1) * arrowStrokeWidth}
                  dash={marking.style?.dash ? ARROW.ball.dash : undefined}
                  hitStrokeWidth={Math.max(arrowStrokeWidth, baseUnit * 4)}
                  lineJoin="round"
                />
              )
            })}
          </Layer>

          {/* --- EquipmentLayer: cones, poles, mannequins. --- */}
          <Layer listening={interactive}>
            {equipment.map((item) => {
              const p = toPx(item)
              const kind = item.equipment ?? 'cone'
              const selected = isSelected(item.id)

              if (kind === 'witches_hat') {
                const bodyHeight = coneRadius * 2
                const baseHeight = coneRadius * 0.45
                const topWidth = coneRadius * 0.5
                const bottomWidth = coneRadius * 2
                const baseWidth = coneRadius * 2.3
                const totalHeight = bodyHeight + baseHeight
                const top = -totalHeight / 2
                const bodyBottom = top + bodyHeight
                return (
                  <Group key={item.id} x={p.x} y={p.y} {...entityHandlers(item.id, totalHeight / 2)}>
                    {selected && <SelectionHalo radius={totalHeight / 2 + haloWidth} strokeWidth={haloWidth} />}
                    <Line
                      points={[-topWidth / 2, top, topWidth / 2, top, bottomWidth / 2, bodyBottom, -bottomWidth / 2, bodyBottom]}
                      closed
                      fill={item.color ?? WITCHES_HAT.fill}
                      lineJoin="round"
                    />
                    <Rect
                      x={-baseWidth / 2}
                      y={bodyBottom}
                      width={baseWidth}
                      height={baseHeight}
                      cornerRadius={baseHeight / 2}
                      fill={item.color ?? WITCHES_HAT.fill}
                    />
                  </Group>
                )
              }

              if (kind === 'mannequin') {
                const bodyWidth = coneRadius * 1.1
                const bodyHeight = coneRadius * 1.8
                const headRadius = coneRadius * 0.5
                const legSpread = coneRadius * 0.7
                const legLength = coneRadius * 0.65
                return (
                  <Group key={item.id} x={p.x} y={p.y} {...entityHandlers(item.id, bodyHeight / 2 + legLength)}>
                    {selected && <SelectionHalo radius={bodyHeight / 2 + legLength + haloWidth} strokeWidth={haloWidth} />}
                    <Circle x={0} y={-bodyHeight / 2 - headRadius} radius={headRadius} stroke={MANNEQUIN.stroke} strokeWidth={1.3} />
                    <Rect
                      x={-bodyWidth / 2}
                      y={-bodyHeight / 2}
                      width={bodyWidth}
                      height={bodyHeight}
                      cornerRadius={bodyWidth * 0.15}
                      fill={item.color ?? MANNEQUIN.fill}
                      stroke={MANNEQUIN.stroke}
                      strokeWidth={1}
                    />
                    <Line points={[-legSpread / 2, bodyHeight / 2, -legSpread, bodyHeight / 2 + legLength]} stroke={MANNEQUIN.stroke} strokeWidth={1.3} lineCap="round" />
                    <Line points={[legSpread / 2, bodyHeight / 2, legSpread, bodyHeight / 2 + legLength]} stroke={MANNEQUIN.stroke} strokeWidth={1.3} lineCap="round" />
                  </Group>
                )
              }

              // Agility pole (the stored kind stays 'cone' — see pitchTheme.ts).
              const poleHeight = coneRadius * 2.4
              const poleWidth = Math.max(2, coneRadius * 0.35)
              const baseWidth = coneRadius * 1.3
              const baseHeight = coneRadius * 0.4
              const fill = CONE.named[item.color ?? ''] ?? item.color ?? CONE.fallback
              return (
                <Group key={item.id} x={p.x} y={p.y} {...entityHandlers(item.id, poleHeight / 2)}>
                  {selected && <SelectionHalo radius={poleHeight / 2 + haloWidth} strokeWidth={haloWidth} />}
                  <Rect x={-poleWidth / 2} y={-poleHeight / 2} width={poleWidth} height={poleHeight} cornerRadius={poleWidth / 2} fill={fill} />
                  <Ellipse x={0} y={poleHeight / 2 - baseHeight / 2} radiusX={baseWidth / 2} radiusY={baseHeight / 2} fill={CONE.base} />
                </Group>
              )
            })}
          </Layer>

          {/* --- EntityLayer: balls, players, and the text notes that
              annotate them. Notes stay above the entities they point at,
              which is the one place this canvas departs from a strict
              markings-under-entities split — it preserves the z-order the
              phases-era canvas had, and keeping them here rather than adding
              a sixth layer leaves room for OverlayLayer and OnionSkinLayer
              inside Konva's seven-layer ceiling. --- */}
          <Layer listening={interactive}>
            {balls.map((ball) => {
              const p = toPx(ball)
              return (
                <Group key={ball.id} x={p.x} y={p.y} {...entityHandlers(ball.id, ballRadius)}>
                  {isSelected(ball.id) && <SelectionHalo radius={ballRadius + haloWidth * 1.5} strokeWidth={haloWidth} />}
                  <Circle x={0} y={0} radius={ballRadius} fill={BALL.fill} stroke={BALL.stroke} strokeWidth={1.5} />
                </Group>
              )
            })}

            {players.map((player) => {
              const p = toPx(player)
              const fill = player.color ?? teamColors.get(player.team ?? '') ?? PLAYER.fallback
              // The dot, number and label chip drag together as one unit, so
              // the Group carries the absolute position and every child is
              // positioned relative to it.
              return (
                <Group key={player.id} x={p.x} y={p.y} {...entityHandlers(player.id, playerRadius)}>
                  {isSelected(player.id) && <SelectionHalo radius={playerRadius + haloWidth} strokeWidth={haloWidth} />}
                  <Circle x={0} y={0} radius={playerRadius} fill={fill} />
                  {player.number != null && (
                    <Text
                      text={String(player.number)}
                      x={-playerRadius}
                      y={-numberFontSize / 2}
                      width={playerRadius * 2}
                      align="center"
                      fontSize={numberFontSize}
                      fontStyle="bold"
                      fill={PLAYER.numberText}
                      listening={false}
                    />
                  )}
                  {player.label && (
                    // Rough width estimate to center the chip under the dot —
                    // Konva's Label doesn't auto-center, and measuring real
                    // text width needs a mounted canvas context.
                    <Label x={-(player.label.length * labelFontSize * 0.6) / 2 - 4} y={playerRadius + 2} listening={false}>
                      <Tag fill={ANNOTATION.background} stroke={ANNOTATION.border} strokeWidth={1} cornerRadius={3} />
                      <Text text={player.label} fontSize={labelFontSize} fill={ANNOTATION.text} padding={2} />
                    </Label>
                  )}
                </Group>
              )
            })}

            {textMarkings.map((note) => {
              if (note.points.length === 0) return null
              const p = toPx(note.points[0])
              return (
                <Label key={note.id} x={p.x} y={p.y} {...markingHandlers(note.id)}>
                  <Tag
                    fill={ANNOTATION.background}
                    stroke={isSelected(note.id) ? SELECTION.halo : ANNOTATION.border}
                    strokeWidth={isSelected(note.id) ? haloWidth : 1}
                    cornerRadius={4}
                  />
                  <Text text={note.text ?? ''} fontSize={annotationFontSize} fill={ANNOTATION.text} padding={4} />
                </Label>
              )
            })}
          </Layer>

          {/* --- OnionSkinLayer (previous/next keyframe ghosts) belongs
              between the entities and the interaction chrome. Stage 4.5 adds
              it — it's `frameAt` called twice more at low opacity. --- */}

          {/* --- InteractionLayer: transient chrome that isn't part of the
              drill — the staged arrow point, the box-select marquee, and the
              Transformer handles. --- */}
          <Layer>
            {pendingArrowStart && (
              <Circle
                x={pendingArrowStart.x * width}
                y={pendingArrowStart.y * height}
                radius={baseUnit * 2.5}
                stroke={ANNOTATION.background}
                strokeWidth={1.5}
                dash={[3, 3]}
                listening={false}
              />
            )}
            {marquee && (
              <Rect
                x={Math.min(marquee.x1, marquee.x2)}
                y={Math.min(marquee.y1, marquee.y2)}
                width={Math.abs(marquee.x2 - marquee.x1)}
                height={Math.abs(marquee.y2 - marquee.y1)}
                fill={SELECTION.marqueeFill}
                stroke={SELECTION.marqueeStroke}
                strokeWidth={1}
                dash={[4, 4]}
                listening={false}
              />
            )}
            {onMarkingsTransform && (
              <Transformer ref={transformerRef} rotateEnabled ignoreStroke shouldOverdrawWholeArea={false} />
            )}
          </Layer>
        </Stage>
      )}

      {viewChanged && (
        <button
          type="button"
          onClick={() => setView(RESET_VIEW)}
          className="absolute right-2 top-2 rounded-md border border-line bg-panel/90 px-2 py-1 text-xs font-medium text-ink-muted hover:border-line-strong"
        >
          Fit
        </button>
      )}
      {hintText && frame && <p className="mt-1 text-center text-xs text-amber-600">{hintText}</p>}
      {frame && entities.length === 0 && (
        <p className="mt-1 text-center text-xs text-slate-400">Nothing on the pitch yet.</p>
      )}
      {!frame && <p className="mt-1 text-center text-xs text-slate-400">No drill to display.</p>}
    </div>
  )
}

// A ring drawn just outside a selected entity, sized by the caller so it
// clears whatever silhouette it's wrapping. Never listens — the entity's own
// Group already handles the click.
function SelectionHalo({ radius, strokeWidth }: { radius: number; strokeWidth: number }) {
  return (
    <Circle
      x={0}
      y={0}
      radius={radius}
      stroke={SELECTION.halo}
      strokeWidth={strokeWidth}
      shadowColor={SELECTION.haloShadow}
      shadowBlur={strokeWidth * 2}
      listening={false}
    />
  )
}
