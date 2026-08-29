import { useEffect, useRef, useState } from 'react'
import type Konva from 'konva'
import { Arc, Arrow, Circle, Ellipse, Group, Label, Layer, Line, Rect, Shape, Stage, Tag, Text, Transformer } from 'react-konva'
import type { Marking, PhasePoint, PitchConfig } from '../../store'
import { isOverlayMarking } from '../../store'
import type { RenderFrame } from './canvas/interpolate'
import type { MotionPath } from './timeline/motion'
import { ANNOTATION, ARROW, BALL, EMPHASIS, EQUIPMENT, EQUIPMENT_EXTENT, PLAYER, SELECTION, TOKEN_SHADOW, TURF } from './pitchTheme'
import { EquipmentShape } from './canvas/EquipmentShapes'
import {
  GRID_STEP_METERS,
  assignTeamColors,
  getPitchAspectRatio,
  getPitchMarkings,
  getPitchOverlays,
  snapToPitchGrid,
} from './pitchGeometry'

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
  // Caps the rendered height as well as the width. A tall pitch preset in a
  // wide column would otherwise run past the bottom of the viewport and push
  // whatever is docked under it — the timeline — out of reach. Also sets how
  // tall the surrounding turf-colored box is: when the preset's own aspect
  // ratio doesn't fill it, the box stays this size and the extra space reads
  // as more pitch (see the box/content split below) rather than as a gap.
  maxHeight?: number
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

  // Which marking the armed tool draws, if any (rework plan Stage 6.4).
  // 'ruler' is the one that isn't a marking: it measures and reports nothing,
  // so it's handled here and never reaches `onDrawMarking`.
  drawTool?: DrawTool | null
  drawStyle?: Marking['style']
  onDrawMarking?: (marking: Omit<Marking, 'id'>) => void

  // Grid & guides (Stage 6.6). Snap is what makes a cone grid or a rondo box
  // buildable without every drill looking hand-wobbled.
  showGrid?: boolean
  snapToGrid?: boolean
  smartGuides?: boolean

  // Frames to ghost underneath the live one — the keyframes either side of
  // the playhead (rework plan Stage 4.5). Only ever rendered, never
  // interactive; entities only, since ghost arrows and notes are clutter
  // rather than information about movement.
  onionFrames?: RenderFrame[]

  // Player paths and ghost trails (rework plan Stage 5.5). Both are derived
  // from what `frameAt` already produces (see timeline/motion.ts) and both are
  // only ever rendered, never interactive. They share ONE layer — see
  // MotionLayer below for why that matters.
  motionPaths?: MotionPath[]
  trailFrames?: RenderFrame[]

  // Staged first point of an in-progress two-click arrow. Only ever rendered.
  pendingArrowStart?: NormalizedPoint | null
  hintText?: string | null

  // Hands the caller the Konva stage itself, which is the only way to get a
  // picture out of it — `stage.toDataURL()` is what Stage 8.5's thumbnails
  // are. Read-only by convention: this canvas still owns everything it draws.
  stageRef?: React.RefObject<Konva.Stage | null>

  // Matched against a TourStep's `anchor` (rework plan Stage 11.1). Optional
  // and unset by every caller except the editor — DrillLibrary, the Coach's
  // Card and the share page all render a PitchCanvas too, and none of them
  // run the onboarding tour.
  onboardingAnchor?: string
}

const DEFAULT_MAX_WIDTH = 420

// Zoom stays at or above "fits the pitch" — zooming out past the whole pitch
// has nothing to show, and it keeps the pan clamp below to one simple case.
const MIN_SCALE = 1
const MAX_SCALE = 5

// The drawing tools the markings panel arms. Everything but 'ruler' commits a
// Marking; the ruler only ever reports a distance on screen.
export type DrawTool =
  | 'arrow'
  | 'line'
  | 'curve'
  | 'arc'
  | 'circle'
  | 'rect'
  | 'freehand'
  | 'zone'
  | 'shape'
  | 'multi'
  | 'spotlight'
  | 'highlight'
  | 'ruler'

// Tools drawn by pressing, dragging and releasing. The rest are polylines
// built tap by tap, or freehand. Every new tool from Stage 6.1 slots into one
// of these two families rather than needing a third gesture — arc, spotlight
// and highlight are all "drag out from a start point", and shape and multi are
// polylines exactly as zone and curve already were.
const DRAG_TOOLS: DrawTool[] = ['arrow', 'line', 'arc', 'circle', 'rect', 'spotlight', 'highlight', 'ruler']
const POLYLINE_TOOLS: DrawTool[] = ['curve', 'zone', 'shape', 'multi']

// How close two entities have to be on one axis for a smart guide to appear
// and snap them, in normalized units.
const GUIDE_TOLERANCE = 0.012

// A freehand stroke only records a point once the pointer has moved this far,
// so a slow hand doesn't produce a thousand-point path.
const FREEHAND_MIN_STEP = 0.006

// Tapping within this of the last placed point finishes a polyline.
const POLYLINE_CLOSE_DISTANCE = 0.025

// A marquee smaller than this in either axis is treated as a click on empty
// pitch (which clears the selection) rather than as a box-select, so a
// slightly shaky tap doesn't select nothing and look broken.
const MARQUEE_THRESHOLD_PX = 4

// Onion-skin ghosts sit far enough back to read as "not now" without
// disappearing against the turf.
const ONION_OPACITY = 0.28

// A ghost trail fades out as it recedes. The nearest copy is the most solid,
// and none of them reach onion-skin opacity — a trail says "a moment ago",
// which is a weaker claim than "a whole keyframe away".
const TRAIL_MAX_OPACITY = 0.22
// Movement paths sit above the turf but below everything placed on it.
const PATH_OPACITY = 0.75

// Nothing in this component may hold a hex value — see pitchTheme.ts.
const EMPTY_SELECTION: string[] = []

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n))
}

// An arc is stored as its two endpoints and drawn as a bow between them
// (Stage 6.1). The control point sits on the perpendicular bisector, offset by
// a fixed fraction of the chord — so a short arc bows a little and a long one
// bows a lot, and the shape reads the same at any pitch size. Konva has no
// quadratic primitive, so it's sampled into a polyline.
const ARC_BOW = 0.22
const ARC_SEGMENTS = 24

function arcPoints(from: PhasePoint, to: PhasePoint): PhasePoint[] {
  const midX = (from.x + to.x) / 2
  const midY = (from.y + to.y) / 2
  // Perpendicular to the chord, so the bow always leans the same way relative
  // to the direction it was drawn in.
  const controlX = midX - (to.y - from.y) * ARC_BOW
  const controlY = midY + (to.x - from.x) * ARC_BOW
  const points: PhasePoint[] = []
  for (let i = 0; i <= ARC_SEGMENTS; i++) {
    const t = i / ARC_SEGMENTS
    const inverse = 1 - t
    points.push({
      x: inverse * inverse * from.x + 2 * inverse * t * controlX + t * t * to.x,
      y: inverse * inverse * from.y + 2 * inverse * t * controlY + t * t * to.y,
    })
  }
  return points
}

function clamp01(n: number) {
  return clamp(n, 0, 1)
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
  maxHeight,
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
  drawTool,
  drawStyle,
  onDrawMarking,
  showGrid = false,
  snapToGrid = false,
  smartGuides = false,
  onionFrames,
  motionPaths,
  trailFrames,
  pendingArrowStart,
  hintText,
  stageRef,
  onboardingAnchor,
}: PitchCanvasProps) {
  const aspectRatio = getPitchAspectRatio(pitch) // width / length
  // Box vs. content: `width`/`height` below are the CONTENT size (every other
  // calculation in this file — scaleX/scaleY, toPx, drag bounds, marquee, grid
  // lines — keeps using them exactly as before, unaware anything changed) —
  // the largest size that preserves the preset's real proportions within the
  // available measured width capped at maxWidth, and maxHeight when the
  // caller gives one. `renderBoxWidth`/`renderBoxHeight` below are the turf
  // box actually drawn, and used to be pinned to the full available size
  // regardless of the content's own shape — which for a preset whose aspect
  // ratio didn't match the box's (a wide landscape pitch inside a box shaped
  // by a tall available viewport, say) left a wide band of plain turf beside
  // the pitch instead of "more pitch". The box now hugs the content plus the
  // fixed margin on every side instead, so it only ever shows real leftover
  // room, never dead space manufactured by the box/content mismatch.
  const { containerRef, width: boxWidth } = useMeasuredWidth(maxWidth)
  const boxHeight = maxHeight ?? boxWidth / aspectRatio
  // A band of grass between the pitch's own boundary and the edge of its
  // canvas, rather than letting the boundary touch the frame — fit the
  // content within the box shrunk by this margin on every side, so even Full
  // Pitch (which otherwise matches the box exactly) shows a sliver of turf
  // beyond its own boundary line. Was 24px, matching first-phase-studio's
  // flat 28px inset; halved on 2026-08-29 because at this canvas's size that
  // read as a gap rather than a sliver, and the 24px it gave back on each
  // side is 24px the pitch itself can use.
  const BOX_MARGIN = 12
  const width = maxHeight
    ? Math.min(Math.max(1, boxWidth - BOX_MARGIN * 2), Math.max(1, boxHeight - BOX_MARGIN * 2) * aspectRatio)
    : boxWidth
  const height = width / aspectRatio
  const renderBoxWidth = maxHeight ? width + BOX_MARGIN * 2 : boxWidth
  const renderBoxHeight = maxHeight ? height + BOX_MARGIN * 2 : boxHeight
  const markings = getPitchMarkings(pitch)
  const overlays = getPitchOverlays(pitch)
  const overlayOpacity = pitch.overlayOpacity ?? 0.4

  const [view, setView] = useState<StageView>(RESET_VIEW)
  const [spaceHeld, setSpaceHeld] = useState(false)
  const [marquee, setMarquee] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null)
  const marqueeStart = useRef<PixelPoint | null>(null)
  const pinchDistance = useRef<number | null>(null)
  const transformerRef = useRef<Konva.Transformer>(null)
  const markingNodes = useRef(new Map<string, Konva.Node>())
  // A drawing in progress: the points collected so far for whichever tool is
  // armed. Committed on release (drag tools), on a repeat tap (polylines), or
  // discarded on Escape.
  const [draft, setDraft] = useState<PhasePoint[] | null>(null)
  const drawing = useRef(false)
  // Alignment guides shown while dragging, in normalized coordinates.
  const [guides, setGuides] = useState<{ x?: number; y?: number }>({})

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

  // Grid intersections, in normalized space. Derived from the pitch's real
  // metre dimensions rather than from pixels, so the grid means the same thing
  // on a phone and a laptop.
  const gridStepX = markings.widthMeters > 0 ? GRID_STEP_METERS / markings.widthMeters : 0
  const gridStepY = markings.lengthMeters > 0 ? GRID_STEP_METERS / markings.lengthMeters : 0

  const snapped = (point: NormalizedPoint): NormalizedPoint =>
    snapToGrid ? snapToPitchGrid(point, markings) : point

  // Nudges a dragged position onto the nearest other entity's axis when it's
  // already nearly aligned, and reports the guides to draw. Skipped entirely
  // when snap-to-grid is on — two competing snaps fight each other.
  const aligned = (point: NormalizedPoint, movingIds: Set<string>): NormalizedPoint => {
    if (!smartGuides || snapToGrid) {
      if (guides.x !== undefined || guides.y !== undefined) setGuides({})
      return point
    }
    let x: number | undefined
    let y: number | undefined
    for (const entity of entities) {
      if (movingIds.has(entity.id)) continue
      if (x === undefined && Math.abs(entity.x - point.x) < GUIDE_TOLERANCE) x = entity.x
      if (y === undefined && Math.abs(entity.y - point.y) < GUIDE_TOLERANCE) y = entity.y
      if (x !== undefined && y !== undefined) break
    }
    setGuides({ x, y })
    return { x: x ?? point.x, y: y ?? point.y }
  }

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

  // Where a dragged entity actually lands: raw pointer position, then the
  // grid, then any axis it's already nearly sharing with something else.
  const placeFor = (entityId: string, event: Konva.KonvaEventObject<DragEvent>): NormalizedPoint => {
    const raw = fromPx({ x: event.target.x(), y: event.target.y() })
    const moving = new Set(dragOrigin.current?.positions.keys() ?? [entityId])
    return aligned(snapped(raw), moving)
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
    onCanvasClick(snapped(fromPx(pointer)))
  }

  // --- zoom & pan (Stage 3.6) ---------------------------------------------

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

  // --- drawing (Stage 6.4) -------------------------------------------------
  //
  // Three gestures, one per family. Drag tools press-drag-release with a live
  // preview; polylines collect a point per tap and finish when a tap lands
  // back on the point just placed; freehand records the pointer's trail.

  const commitDraft = (points: PhasePoint[]) => {
    setDraft(null)
    drawing.current = false
    if (!drawTool || !onDrawMarking || drawTool === 'ruler' || points.length < 2) return
    onDrawMarking({ kind: drawTool, points, style: drawStyle })
  }

  const handleDrawPointerDown = (point: NormalizedPoint): boolean => {
    if (!drawTool) return false

    if (POLYLINE_TOOLS.includes(drawTool)) {
      const current = draft ?? []
      const last = current[current.length - 1]
      // A second tap on the point just placed ends the shape, which is one
      // rule that works the same with a finger and with a mouse.
      if (last && Math.hypot(last.x - point.x, last.y - point.y) < POLYLINE_CLOSE_DISTANCE) {
        commitDraft(current)
        return true
      }
      setDraft([...current, point])
      return true
    }

    drawing.current = true
    setDraft([point, point])
    return true
  }

  const handleDrawPointerMove = (point: NormalizedPoint): boolean => {
    if (!drawTool || !draft) return false
    if (POLYLINE_TOOLS.includes(drawTool)) {
      // Rubber-band the segment being aimed, without committing it.
      setDraft([...draft.slice(0, -1), draft[draft.length - 1]])
      return false
    }
    if (!drawing.current) return false
    if (drawTool === 'freehand') {
      const last = draft[draft.length - 1]
      if (Math.hypot(last.x - point.x, last.y - point.y) < FREEHAND_MIN_STEP) return true
      setDraft([...draft, point])
      return true
    }
    setDraft([draft[0], point])
    return true
  }

  const handleDrawPointerUp = (): boolean => {
    if (!drawTool || !drawing.current || !draft) return false
    if (DRAG_TOOLS.includes(drawTool) || drawTool === 'freehand') {
      if (drawTool === 'ruler') {
        // Measured, shown, and deliberately not kept.
        setDraft(null)
        drawing.current = false
        return true
      }
      commitDraft(draft)
      return true
    }
    return false
  }

  // --- marquee box-select (Stage 3.4) -------------------------------------

  const handleStagePointerDown = (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    if (panning) return
    const stage = e.target.getStage()
    const pointer = stage?.getRelativePointerPosition()
    if (!stage || !pointer) return

    if (drawTool) {
      if (handleDrawPointerDown(snapped(fromPx(pointer)))) return
    }
    if (!selectable || annotationMode || removeMode) return
    if (e.target !== stage) return
    marqueeStart.current = pointer
    setMarquee(null)
  }

  const handleStagePointerMove = (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    if (drawTool) {
      const stage = e.target.getStage()
      const pointer = stage?.getRelativePointerPosition()
      if (pointer && handleDrawPointerMove(snapped(fromPx(pointer)))) return
    }
    const start = marqueeStart.current
    if (!start) return
    const stage = e.target.getStage()
    const pointer = stage?.getRelativePointerPosition()
    if (!pointer) return
    setMarquee({ x1: start.x, y1: start.y, x2: pointer.x, y2: pointer.y })
  }

  const handleStagePointerUp = () => {
    if (handleDrawPointerUp()) return
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
      if (draft) {
        setDraft(null)
        drawing.current = false
        return
      }
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

  // What each selected node looked like before the coach grabbed a handle.
  // Needed because a marking's points are stored in ABSOLUTE pitch
  // coordinates, so baking a transform means applying only what the gesture
  // changed — not the node's own resting position on top of it.
  const transformBase = useRef(new Map<string, { transform: Konva.Transform; x: number; y: number }>())

  const handleTransformStart = () => {
    transformBase.current.clear()
    for (const id of selection) {
      const node = markingNodes.current.get(id)
      if (node) {
        transformBase.current.set(id, { transform: node.getTransform().copy(), x: node.x(), y: node.y() })
      }
    }
  }

  // Bakes the Transformer's scale/rotation back into each marking's own
  // normalized points and resets the node, so the transform lives in the
  // data rather than accumulating on the Konva node.
  //
  // The transform applied is the DELTA — `current x inverse(base)` — rather
  // than the node's absolute transform. A polyline sits at the origin with its
  // geometry in its points, so for those two are the same; but an Ellipse, a
  // Circle or a Rect carries its position in x/y, and using the absolute
  // transform there translated every point a second time and dragged the shape
  // off the pitch. That bug was latent until Stage 6 wired this callback up for
  // the first time — the capability shipped with the drill rework's Stage 3.5,
  // but nothing ever passed `onMarkingsTransform`, so it never ran.
  const handleTransformEnd = () => {
    if (!onMarkingsTransform) return
    const updates: Array<{ id: string; points: PhasePoint[] }> = []
    for (const id of selection) {
      const node = markingNodes.current.get(id)
      const marking = frameMarkings.find((m) => m.id === id)
      if (!node || !marking) continue
      const base = transformBase.current.get(id)
      const delta = node.getTransform().copy()
      if (base) delta.multiply(base.transform.copy().invert())
      updates.push({
        id,
        points: marking.points.map((point) => {
          const moved = delta.point(toPx(point))
          return { x: clamp01(moved.x / width), y: clamp01(moved.y / height) }
        }),
      })
      // Back to rest. React re-renders from the new points immediately, but
      // leaving the gesture on the node would compound it into the next one.
      node.scaleX(1)
      node.scaleY(1)
      node.rotation(0)
      node.position({ x: base?.x ?? 0, y: base?.y ?? 0 })
    }
    transformBase.current.clear()
    if (updates.length > 0) onMarkingsTransform(updates)
  }

  const registerMarkingNode = (id: string) => (node: Konva.Node | null) => {
    if (node) markingNodes.current.set(id, node)
    else markingNodes.current.delete(id)
  }

  const gridColumns: number[] = []
  const gridRows: number[] = []
  if (showGrid && gridStepX > 0) for (let f = gridStepX; f < 1; f += gridStepX) gridColumns.push(Number(f.toFixed(5)))
  if (showGrid && gridStepY > 0) for (let f = gridStepY; f < 1; f += gridStepY) gridRows.push(Number(f.toFixed(5)))

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
  // Spotlight and highlight are emphasis rather than diagram, so they leave
  // the markings layer and composite above the entities instead (Stage 6.4).
  const overlayMarkings = frameMarkings.filter(isOverlayMarking)
  const shapeMarkings = frameMarkings.filter(
    (marking) => marking.kind !== 'text' && !isOverlayMarking(marking)
  )

  const teamColors = assignTeamColors(
    players.map((player) => player.team ?? ''),
    PLAYER.colors,
    PLAYER.fallback
  )

  // Straight-line distance along the drafted points, in real metres — the same
  // conversion the timeline's speed readout uses, so the two agree.
  const rulerMeters = (points: PhasePoint[]): number => {
    let total = 0
    for (let i = 1; i < points.length; i++) {
      total += Math.hypot(
        (points[i].x - points[i - 1].x) * markings.widthMeters,
        (points[i].y - points[i - 1].y) * markings.lengthMeters
      )
    }
    return total
  }

  const interactive = editable || annotationMode || removeMode || selectable || drawTool !== null
  const cursor = panning ? 'grab' : annotationMode ? 'crosshair' : removeMode ? 'pointer' : undefined

  const entityHandlers = (entityId: string, radius: number) => ({
    draggable: editable && !panning,
    dragBoundFunc: editable ? makeDragBound(radius) : undefined,
    onDragStart: editable ? () => beginEntityDrag(entityId) : undefined,
    onDragMove: editable
      ? (e: Konva.KonvaEventObject<DragEvent>) => dragEntityTo(entityId, placeFor(entityId, e), false)
      : undefined,
    onDragEnd: editable
      ? (e: Konva.KonvaEventObject<DragEvent>) => {
          dragEntityTo(entityId, placeFor(entityId, e), true)
          dragOrigin.current = null
          setGuides({})
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
    onTransformStart: handleTransformStart,
    onTransformEnd: handleTransformEnd,
  })

  return (
    <div
      ref={containerRef}
      data-pitch-canvas
      data-onboarding-anchor={onboardingAnchor}
      className={className}
      style={{ width: '100%', maxWidth, display: 'flex', flexDirection: 'column', alignItems: 'center' }}
      // Focusable so arrow-key nudge, Escape, Delete and space-to-pan reach
      // this canvas without a window-level listener that would fire while the
      // coach is typing in a form field somewhere else on the page.
      tabIndex={interactive ? 0 : undefined}
      onKeyDown={interactive ? handleKeyDown : undefined}
      onKeyUp={interactive ? handleKeyUp : undefined}
    >
      {/* The turf box: sized to the content plus the fixed margin, not the
          full available space — see the comment above renderBoxWidth/Height.
          The wrapping div above centers it when it's narrower than the space
          on offer. */}
      <div
        className="overflow-hidden rounded-lg"
        style={{
          width: renderBoxWidth,
          height: renderBoxHeight,
          flexShrink: 0,
          backgroundColor: TURF.fill,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
        }}
      >
      {/* Content wrapper: exactly the content size, unlike the box above —
          this is what the "Fit" button below anchors its absolute position
          against, so it stays pinned to the visible pitch's own corner
          rather than the (possibly larger) box's. */}
      <div style={{ position: 'relative', width, height }}>
      {width > 0 && (
        <Stage
          ref={stageRef}
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

            {/* Grid & guides (Stage 6.6). Drawn on the pitch surface rather
                than in a layer of its own — it's a backdrop, and the two layer
                slots still free belong to overlays and onion skin. */}
            {showGrid && gridStepX > 0 && gridColumns.map((fraction) => (
              <Line
                key={`grid-x-${fraction}`}
                points={[fraction * width, 0, fraction * width, height]}
                stroke={TURF.line}
                strokeWidth={lineWidth * 0.4}
                opacity={0.35}
              />
            ))}
            {showGrid && gridStepY > 0 && gridRows.map((fraction) => (
              <Line
                key={`grid-y-${fraction}`}
                points={[0, fraction * height, width, fraction * height]}
                stroke={TURF.line}
                strokeWidth={lineWidth * 0.4}
                opacity={0.35}
              />
            ))}
          </Layer>

          {/* --- OverlayLayer: thirds, channels, half-spaces, Pep zones and
              the training grid — grid systems drawn over the pitch rather than
              markings of it, so they sit above the turf and under everything a
              coach places. Only mounted when there's an overlay on. --- */}
          {(overlays.lines.length > 0 || overlays.rects.length > 0) && (
            <Layer listening={false} opacity={overlayOpacity}>
              {overlays.rects.map((r, i) => (
                <Rect
                  key={`overlay-rect-${i}`}
                  x={r.x * scaleX}
                  y={r.y * scaleY}
                  width={r.w * scaleX}
                  height={r.h * scaleY}
                  fill={TURF.line}
                  opacity={0.35}
                />
              ))}
              {overlays.lines.map((l, i) => (
                <Line
                  key={`overlay-line-${i}`}
                  points={[l.x1 * scaleX, l.y1 * scaleY, l.x2 * scaleX, l.y2 * scaleY]}
                  stroke={TURF.line}
                  strokeWidth={lineWidth * 0.8}
                  dash={l.dashed ? [lineWidth * 3, lineWidth * 2] : undefined}
                />
              ))}
            </Layer>
          )}

          {/* --- MarkingsLayer: arrows and drawn shapes, under the elements
              they connect. Text notes are the exception and render above the
              entities instead — see EntityLayer. --- */}
          <Layer listening={interactive}>
            {shapeMarkings.map((marking) => {
              const selected = isSelected(marking.id)
              // A curved arrow is still an arrow — it keeps its head, and the
              // tension is what makes it read as a bent pass rather than a
              // dog-leg.
              if ((marking.kind === 'arrow' || marking.kind === 'curve') && marking.points.length >= 2) {
                const style = ARROW[marking.style?.dash ? 'ball' : 'player']
                return (
                  <Arrow
                    key={marking.id}
                    {...markingHandlers(marking.id)}
                    points={marking.points.flatMap((point) => {
                      const p = toPx(point)
                      return [p.x, p.y]
                    })}
                    tension={marking.kind === 'curve' ? 0.4 : 0}
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
              // A multi-segment arrow is an arrow over every leg the coach
              // tapped, with the head on the last one.
              if (marking.kind === 'multi' && marking.points.length >= 2) {
                const style = ARROW[marking.style?.dash ? 'ball' : 'player']
                return (
                  <Arrow
                    key={marking.id}
                    {...markingHandlers(marking.id)}
                    points={marking.points.flatMap((point) => {
                      const p = toPx(point)
                      return [p.x, p.y]
                    })}
                    stroke={selected ? SELECTION.halo : marking.style?.stroke ?? style.stroke}
                    fill={selected ? SELECTION.halo : marking.style?.stroke ?? style.stroke}
                    dash={style.dash}
                    strokeWidth={(marking.style?.width ?? 1) * arrowStrokeWidth}
                    pointerLength={baseUnit * 2.2}
                    pointerWidth={baseUnit * 2.2}
                    hitStrokeWidth={Math.max(arrowStrokeWidth, baseUnit * 4)}
                    lineJoin="round"
                    lineCap="round"
                  />
                )
              }

              if (marking.points.length < 2) return null
              const stroke = selected ? SELECTION.halo : marking.style?.stroke ?? ARROW.player.stroke
              const strokeWidth = (marking.style?.width ?? 1) * arrowStrokeWidth
              const dash = marking.style?.dash ? ARROW.ball.dash : undefined
              const a = toPx(marking.points[0])
              const b = toPx(marking.points[marking.points.length - 1])

              // A rectangle and an ellipse are stored as the two corners of
              // their bounding box, so they're reconstructed rather than drawn
              // as a two-point polyline.
              if (marking.kind === 'rect') {
                return (
                  <Rect
                    key={marking.id}
                    {...markingHandlers(marking.id)}
                    x={Math.min(a.x, b.x)}
                    y={Math.min(a.y, b.y)}
                    width={Math.abs(b.x - a.x)}
                    height={Math.abs(b.y - a.y)}
                    stroke={stroke}
                    strokeWidth={strokeWidth}
                    dash={dash}
                    fill={marking.style?.fill}
                  />
                )
              }
              if (marking.kind === 'circle') {
                return (
                  <Ellipse
                    key={marking.id}
                    {...markingHandlers(marking.id)}
                    x={(a.x + b.x) / 2}
                    y={(a.y + b.y) / 2}
                    radiusX={Math.abs(b.x - a.x) / 2}
                    radiusY={Math.abs(b.y - a.y) / 2}
                    stroke={stroke}
                    strokeWidth={strokeWidth}
                    dash={dash}
                    fill={marking.style?.fill}
                  />
                )
              }

              // An arc bows between its two endpoints; everything else is a
              // polyline over the points as stored.
              const drawn = marking.kind === 'arc'
                ? arcPoints(marking.points[0], marking.points[marking.points.length - 1])
                : marking.points

              // Lines, arcs, curves, freehand strokes, zones and shapes are all
              // polylines; what differs is whether they close, whether they're
              // filled, and how much they're smoothed. A zone shades the area
              // it encloses; a shape is the same polygon drawn as an outline,
              // which is the distinction Teloframe draws between the two.
              const closed = marking.kind === 'zone' || marking.kind === 'shape'
              const smoothed = marking.kind === 'curve' || marking.kind === 'freehand'
              const fill =
                marking.kind === 'zone'
                  ? marking.style?.fill ?? SELECTION.marqueeFill
                  : marking.kind === 'shape'
                    ? marking.style?.fill
                    : undefined
              return (
                <Line
                  key={marking.id}
                  {...markingHandlers(marking.id)}
                  points={drawn.flatMap((point) => {
                    const p = toPx(point)
                    return [p.x, p.y]
                  })}
                  closed={closed}
                  fill={fill}
                  stroke={stroke}
                  strokeWidth={strokeWidth}
                  dash={dash}
                  tension={smoothed ? 0.4 : 0}
                  hitStrokeWidth={Math.max(arrowStrokeWidth, baseUnit * 4)}
                  lineJoin="round"
                  lineCap="round"
                />
              )
            })}
          </Layer>

          {/* --- EquipmentLayer: the full equipment library, each piece drawn
              by EquipmentShapes.tsx around its own origin so this layer only
              has to position and rotate a Group. --- */}
          <Layer listening={interactive}>
            {equipment.map((item) => {
              const p = toPx(item)
              const type = item.equipment ?? 'cone'
              const extent = (EQUIPMENT_EXTENT[type] ?? 1) * coneRadius
              return (
                <Group key={item.id} x={p.x} y={p.y} rotation={item.rotation ?? 0} {...entityHandlers(item.id, extent)}>
                  {isSelected(item.id) && <SelectionHalo radius={extent + haloWidth} strokeWidth={haloWidth} />}
                  <EquipmentShape type={type} unit={coneRadius} color={EQUIPMENT.named[item.color ?? ''] ?? item.color} />
                </Group>
              )
            })}
          </Layer>

          {/* --- OnionSkinLayer: the keyframes either side of the playhead,
              ghosted beneath the live entities so a coach can see where a run
              came from and where it's going. Simplified silhouettes rather
              than the full shapes — a ghost only has to say "something of this
              kind was here", and at this opacity the detail is noise. --- */}
          {onionFrames && onionFrames.length > 0 && (
            <Layer listening={false} opacity={ONION_OPACITY}>
              {onionFrames.flatMap((ghost, index) =>
                ghost.entities.map((entity) => {
                  const p = toPx(entity)
                  if (entity.kind === 'equipment') {
                    return (
                      <Rect
                        key={`onion-${index}-${entity.id}`}
                        x={p.x - coneRadius / 2}
                        y={p.y - coneRadius / 2}
                        width={coneRadius}
                        height={coneRadius}
                        cornerRadius={coneRadius / 4}
                        fill={EQUIPMENT.named[entity.color ?? ''] ?? entity.color ?? EQUIPMENT.marker}
                      />
                    )
                  }
                  const isBall = entity.kind === 'ball'
                  return (
                    <Circle
                      key={`onion-${index}-${entity.id}`}
                      x={p.x}
                      y={p.y}
                      radius={isBall ? ballRadius : playerRadius}
                      fill={
                        isBall
                          ? BALL.fill
                          : entity.color ?? teamColors.get(entity.team ?? '') ?? PLAYER.fallback
                      }
                    />
                  )
                })
              )}
            </Layer>
          )}

          {/* --- MotionLayer: player paths (T) and ghost trails (G), rework
              plan Stage 5.5. ONE layer for both, deliberately: the comment on
              EntityLayer below records Konva's seven-layer ceiling, and this
              canvas was already using six. Paths and trails are both
              non-interactive movement hints drawn under the live entities, so
              they share a layer and carry their opacity per shape rather than
              on the layer — which a trail needs anyway, since it fades with
              distance. --- */}
          {((motionPaths && motionPaths.length > 0) || (trailFrames && trailFrames.length > 0)) && (
            <Layer listening={false}>
              {trailFrames?.flatMap((ghost, index) =>
                ghost.entities
                  // Equipment doesn't run anywhere; trailing a cone is noise.
                  .filter((entity) => entity.kind !== 'equipment')
                  .map((entity) => {
                    const p = toPx(entity)
                    const isBall = entity.kind === 'ball'
                    return (
                      <Circle
                        key={`trail-${index}-${entity.id}`}
                        x={p.x}
                        y={p.y}
                        radius={isBall ? ballRadius : playerRadius}
                        opacity={TRAIL_MAX_OPACITY * (1 - index / (trailFrames.length + 1))}
                        fill={
                          isBall ? BALL.fill : entity.color ?? teamColors.get(entity.team ?? '') ?? PLAYER.fallback
                        }
                      />
                    )
                  })
              )}
              {motionPaths?.map((path) => {
                const points = path.points.flatMap((point) => {
                  const p = toPx(point)
                  return [p.x, p.y]
                })
                const entity = frame?.entities.find((candidate) => candidate.id === path.entityId)
                return (
                  <Line
                    key={`path-${path.entityId}`}
                    points={points}
                    stroke={entity?.color ?? teamColors.get(entity?.team ?? '') ?? PLAYER.fallback}
                    strokeWidth={Math.max(1.5, baseUnit * 0.5)}
                    opacity={PATH_OPACITY}
                    lineCap="round"
                    lineJoin="round"
                    dash={[baseUnit * 1.2, baseUnit * 1.2]}
                    // A hand-drawn route is a series of waypoints, so round the
                    // corners the way `interpolate` actually eases through them.
                    tension={path.points.length > 2 ? 0.4 : 0}
                  />
                )
              })}
            </Layer>
          )}

          {/* --- EntityLayer: balls, players, and the text notes that
              annotate them. Notes stay above the entities they point at,
              which is the one place this canvas departs from a strict
              markings-under-entities split — it preserves the z-order the
              phases-era canvas had, and keeping them here rather than adding
              a sixth layer left room for OnionSkinLayer above and
              OverlayLayer to come, inside Konva's seven-layer ceiling. --- */}
          <Layer listening={interactive}>
            {balls.map((ball) => {
              const p = toPx(ball)
              return (
                <Group key={ball.id} x={p.x} y={p.y} {...entityHandlers(ball.id, ballRadius)}>
                  {isSelected(ball.id) && <SelectionHalo radius={ballRadius + haloWidth * 1.5} strokeWidth={haloWidth} />}
                  <Circle
                    x={0}
                    y={0}
                    radius={ballRadius}
                    fill={BALL.fill}
                    stroke={BALL.stroke}
                    strokeWidth={1.5}
                    shadowColor={TOKEN_SHADOW.color}
                    shadowOpacity={TOKEN_SHADOW.opacity}
                    shadowBlur={TOKEN_SHADOW.blur}
                    shadowOffsetY={TOKEN_SHADOW.offsetY}
                  />
                  {/* A hint of panel seams — one ring, two mirrored arcs — rather
                      than a literal pentagon pattern, which stops reading as a
                      ball at the size a coach actually draws one. */}
                  <Circle x={0} y={0} radius={ballRadius * 0.45} stroke={BALL.seam} strokeWidth={0.9} opacity={0.75} listening={false} />
                  <Arc
                    x={0}
                    y={0}
                    innerRadius={ballRadius * 0.61}
                    outerRadius={ballRadius * 0.61}
                    angle={82}
                    rotation={28}
                    stroke={BALL.seam}
                    strokeWidth={0.85}
                    opacity={0.7}
                    listening={false}
                  />
                  <Arc
                    x={0}
                    y={0}
                    innerRadius={ballRadius * 0.61}
                    outerRadius={ballRadius * 0.61}
                    angle={82}
                    rotation={208}
                    stroke={BALL.seam}
                    strokeWidth={0.85}
                    opacity={0.7}
                    listening={false}
                  />
                </Group>
              )
            })}

            {players.map((player) => {
              const p = toPx(player)
              const fill = player.color ?? teamColors.get(player.team ?? '') ?? PLAYER.fallback
              const display = player.display ?? 'standard'
              // Dot mode is a bare marker — no number, no label, no room to
              // read either at the size coaches use it (a full squad packed
              // onto one pitch). Presentation goes the other way, sized up
              // for a projector; compact keeps the number but drops the name
              // chip that standard shows underneath.
              const radius = display === 'dot' ? playerRadius * 0.55 : display === 'presentation' ? playerRadius * 1.3 : playerRadius
              const showNumber = display !== 'dot' && player.number != null
              const showLabel = display === 'standard' || display === 'presentation'
              const fontSize = display === 'presentation' ? numberFontSize * 1.3 : numberFontSize
              const chipFontSize = display === 'presentation' ? labelFontSize * 1.3 : labelFontSize
              // The dot, number and label chip drag together as one unit, so
              // the Group carries the absolute position and every child is
              // positioned relative to it.
              return (
                <Group key={player.id} x={p.x} y={p.y} {...entityHandlers(player.id, radius)}>
                  {isSelected(player.id) && <SelectionHalo radius={radius + haloWidth} strokeWidth={haloWidth} />}
                  <Circle
                    x={0}
                    y={0}
                    radius={radius}
                    fill={fill}
                    shadowColor={TOKEN_SHADOW.color}
                    shadowOpacity={TOKEN_SHADOW.opacity}
                    shadowBlur={TOKEN_SHADOW.blur}
                    shadowOffsetY={TOKEN_SHADOW.offsetY}
                  />
                  {/* A subtle concentric highlight — the cheap trick behind
                      reading as a lit sphere rather than a flat coin, without
                      an actual gradient fighting the "team color reads as one
                      solid hue" rule. */}
                  <Circle
                    x={0}
                    y={0}
                    radius={radius * 0.8}
                    fill={PLAYER.ringFill}
                    stroke={PLAYER.ringStroke}
                    strokeWidth={1}
                    listening={false}
                  />
                  {showNumber && (
                    <Text
                      text={String(player.number)}
                      x={-radius}
                      y={-fontSize / 2}
                      width={radius * 2}
                      align="center"
                      fontSize={fontSize}
                      fontStyle="bold"
                      fill={PLAYER.numberText}
                      listening={false}
                    />
                  )}
                  {showLabel && player.label && (
                    // Rough width estimate to center the chip under the dot —
                    // Konva's Label doesn't auto-center, and measuring real
                    // text width needs a mounted canvas context.
                    <Label x={-(player.label.length * chipFontSize * 0.6) / 2 - 4} y={radius + 2} listening={false}>
                      <Tag fill={ANNOTATION.background} stroke={ANNOTATION.border} strokeWidth={1} cornerRadius={3} />
                      <Text text={player.label} fontSize={chipFontSize} fill={ANNOTATION.text} padding={2} />
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

            {/* --- Emphasis: spotlight and highlight (Stage 6.4). These are
                presentational rather than geometric, so they belong ABOVE the
                entities rather than under them with the other markings.
                They render at the end of this layer rather than in a new one:
                document order inside a layer already puts them above every
                player, and PitchCanvas is deliberately frugal with Konva
                layers (see EntityLayer's own note on the ceiling).

                Each is drawn twice — an unlistening fill, and a stroked rim
                that carries the click and transform handlers. Without that
                split the translucent fill would swallow every click inside it,
                and a coach could not select the very player they had just
                spotlighted. The rim is the handle; the interior stays live. */}
            {overlayMarkings.map((marking) => {
              if (marking.points.length < 2) return null
              const selected = isSelected(marking.id)
              const a = toPx(marking.points[0])
              const b = toPx(marking.points[marking.points.length - 1])

              if (marking.kind === 'spotlight') {
                // Stored as [centre, edge], so the drag radius is the distance
                // between them.
                const radius = Math.hypot(b.x - a.x, b.y - a.y)
                if (radius < 1) return null
                return (
                  <Group key={marking.id} listening={interactive}>
                    <Shape
                      listening={false}
                      sceneFunc={(context, shape) => {
                        // The veil is one path: the whole pitch wound one way
                        // with the lit circle wound the other, so the circle
                        // becomes a hole under the nonzero fill rule. Doing it
                        // this way rather than with a composite operation
                        // keeps the erase from reaching the entities already
                        // drawn beneath it in this same layer.
                        context.beginPath()
                        context.rect(0, 0, width, height)
                        context.arc(a.x, a.y, radius, 0, Math.PI * 2, true)
                        context.closePath()
                        context.fillStrokeShape(shape)
                      }}
                      fill={EMPHASIS.spotlightDim}
                    />
                    <Circle
                      {...markingHandlers(marking.id)}
                      x={a.x}
                      y={a.y}
                      radius={radius}
                      fillEnabled={false}
                      stroke={selected ? SELECTION.halo : marking.style?.stroke ?? EMPHASIS.spotlightRim}
                      strokeWidth={(marking.style?.width ?? 1) * arrowStrokeWidth}
                      hitStrokeWidth={Math.max(arrowStrokeWidth, baseUnit * 4)}
                    />
                  </Group>
                )
              }

              // Highlight: stored as two opposite corners, like a box.
              const cx = (a.x + b.x) / 2
              const cy = (a.y + b.y) / 2
              const radiusX = Math.abs(b.x - a.x) / 2
              const radiusY = Math.abs(b.y - a.y) / 2
              if (radiusX < 1 || radiusY < 1) return null
              return (
                <Group key={marking.id} listening={interactive}>
                  <Ellipse
                    listening={false}
                    x={cx}
                    y={cy}
                    radiusX={radiusX}
                    radiusY={radiusY}
                    fill={marking.style?.fill ?? EMPHASIS.highlightFill}
                  />
                  <Ellipse
                    {...markingHandlers(marking.id)}
                    x={cx}
                    y={cy}
                    radiusX={radiusX}
                    radiusY={radiusY}
                    fillEnabled={false}
                    stroke={selected ? SELECTION.halo : marking.style?.stroke ?? EMPHASIS.highlightRim}
                    strokeWidth={(marking.style?.width ?? 1) * arrowStrokeWidth}
                    hitStrokeWidth={Math.max(arrowStrokeWidth, baseUnit * 4)}
                  />
                </Group>
              )
            })}
          </Layer>

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
            {/* The shape being drawn, previewed with the same geometry it
                will be committed with, so nothing jumps on release. */}
            {draft && draft.length >= 2 && (
              <Line
                points={draft.flatMap((point) => {
                  const p = toPx(point)
                  return [p.x, p.y]
                })}
                closed={drawTool === 'zone' || drawTool === 'rect' || drawTool === 'circle'}
                stroke={drawStyle?.stroke ?? SELECTION.marqueeStroke}
                strokeWidth={arrowStrokeWidth}
                dash={drawTool === 'ruler' ? [6, 4] : drawStyle?.dash ? ARROW.ball.dash : undefined}
                fill={drawTool === 'zone' ? SELECTION.marqueeFill : undefined}
                tension={drawTool === 'curve' || drawTool === 'freehand' ? 0.4 : 0}
                lineJoin="round"
                lineCap="round"
                listening={false}
              />
            )}

            {/* The ruler reports a real distance and keeps nothing. */}
            {drawTool === 'ruler' && draft && draft.length >= 2 && (
              <Label x={toPx(draft[draft.length - 1]).x} y={toPx(draft[draft.length - 1]).y - baseUnit * 4} listening={false}>
                <Tag fill={ANNOTATION.background} stroke={ANNOTATION.border} strokeWidth={1} cornerRadius={4} />
                <Text text={`${rulerMeters(draft).toFixed(1)} m`} fontSize={annotationFontSize} fill={ANNOTATION.text} padding={4} />
              </Label>
            )}

            {guides.x !== undefined && (
              <Line points={[guides.x * width, 0, guides.x * width, height]} stroke={SELECTION.marqueeStroke} strokeWidth={1} dash={[4, 4]} listening={false} />
            )}
            {guides.y !== undefined && (
              <Line points={[0, guides.y * height, width, guides.y * height]} stroke={SELECTION.marqueeStroke} strokeWidth={1} dash={[4, 4]} listening={false} />
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
      </div>
      </div>
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
