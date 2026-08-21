import { useEffect, useRef, useState } from 'react'
import type Konva from 'konva'
import { Arrow, Circle, Ellipse, Group, Label, Layer, Line, Rect, Stage, Tag, Text } from 'react-konva'
import type { DrillElementType, DrillPhase, PitchOrientation, PitchSize } from '../../store'
import { ANNOTATION, ARROW, BALL, CONE, MANNEQUIN, PLAYER, TURF, WITCHES_HAT } from './pitchTheme'
import { assignTeamColors, getPitchAspectRatio, getPitchMarkings } from './pitchGeometry'

type PixelPoint = { x: number; y: number }
type NormalizedPoint = { x: number; y: number }

interface PitchCanvasProps {
  pitchSize: PitchSize
  orientation: PitchOrientation
  // Phase 2c (multi-phase step-through): the caller (DrillPreview.tsx) owns
  // which phase index is "current" and passes that phase's data straight
  // through here — this component never owns phase-stepping state itself,
  // it just renders whatever phase it's handed.
  phase: DrillPhase | null
  maxWidth?: number
  className?: string
  // Phase 2b (US-11): when true, players/cones/balls become draggable Konva
  // nodes. `onElementDragMove` fires on every `dragmove` (local-state-only,
  // no network — see drillSlice.setPhaseElementPosition) and
  // `onElementDragEnd` fires once per drag, where the caller is expected to
  // persist via exactly one `updateDrill` call. Positions passed to both are
  // already converted back to normalized 0-1 coordinates. Omitting these
  // (or `editable`) preserves 2a's static, read-only behavior.
  editable?: boolean
  onElementDragMove?: (elementType: DrillElementType, elementId: string, position: NormalizedPoint) => void
  onElementDragEnd?: (elementType: DrillElementType, elementId: string, position: NormalizedPoint) => void
  // Phase 2c (US-13): when true, clicking/tapping an empty area of the pitch
  // — not on a draggable player/cone/ball — reports the click position back
  // via `onCanvasClick`, already converted to normalized 0-1 coordinates
  // (same conversion `onElementDragEnd` uses). The caller turns that into a
  // text prompt and persists it as a new annotation (see DrillPreview.tsx).
  // Independent of `editable`: annotation placement doesn't require element
  // dragging to also be on.
  annotationMode?: boolean
  onCanvasClick?: (position: NormalizedPoint) => void
  // When true, clicking/tapping an existing player/cone/ball/annotation
  // reports it back via `onElementClick`/`onAnnotationClick` instead of (or
  // alongside — dragging still works, since Konva suppresses the click that
  // would otherwise follow a real drag once the pointer moves past its
  // threshold) whatever `editable` already wires up. Independent of
  // `editable`/`annotationMode`, same as those are independent of each other.
  removeMode?: boolean
  onElementClick?: (elementType: DrillElementType, elementId: string) => void
  onAnnotationClick?: (annotationId: string) => void
  // Arrows aren't part of DrillElementType (they have their own
  // addArrow/removeArrow store actions, not addElement/removeElement — see
  // drillSlice.ts), so removal gets its own callback, same shape as
  // `onAnnotationClick`.
  onArrowClick?: (arrowId: string) => void
  // Upgrade Phase 2C: arrow placement is a two-click gesture (tap a start
  // point, tap again for the end point) — the caller owns that staging
  // state (see DrillPreview.tsx's `pendingArrowStart`) and passes the
  // staged point back here purely so it's never invisible mid-gesture. Only
  // ever rendered, never interactive.
  pendingArrowStart?: NormalizedPoint | null
  // Shown below the canvas whenever there's a phase to show it against —
  // the caller decides the copy since it knows which specific placement
  // mode is active (this component only knows the booleans/callbacks that
  // mode maps to, not the mode itself). Previously hardcoded to a
  // note-specific string here regardless of which mode was actually
  // active — every other placement mode showed the same wrong hint.
  hintText?: string | null
}

const DEFAULT_MAX_WIDTH = 420

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n))
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

// Phase 2a — Static pitch renderer (US-10, partial; gaffer_mvp_build_steps.md).
// Phase 2b — Drag-and-drop persistence (US-11) layers on top: when
// `editable` is true, players/cones/balls become draggable Konva nodes.
// Phase 2c — Multi-phase step-through + annotation placement (US-12, US-13):
// this component still only ever renders the single `phase` it's handed
// (the caller does the stepping), but `annotationMode` layers a click-to-add
// affordance on top of that same canvas.
// Draws a pitch outline for the given format, then renders one phase's
// players/cones/balls/arrows/annotations as Konva shapes — nothing
// hand-positioned, everything derives from the phase's normalized 0-1
// coordinates and the format's meters-based markings (pitchGeometry.ts).
// This component never talks to Supabase itself — it only reports pixel
// positions back to the caller (already converted to normalized 0-1) via
// `onElementDragMove`/`onElementDragEnd`/`onCanvasClick`; persistence is the
// caller's job (see DrillPreview.tsx), same separation the store's
// `updateDrill` comment describes.
export function PitchCanvas({
  pitchSize,
  orientation,
  phase,
  maxWidth = DEFAULT_MAX_WIDTH,
  className,
  editable = false,
  onElementDragMove,
  onElementDragEnd,
  annotationMode = false,
  onCanvasClick,
  removeMode = false,
  onElementClick,
  onAnnotationClick,
  onArrowClick,
  pendingArrowStart,
  hintText,
}: PitchCanvasProps) {
  const { containerRef, width } = useMeasuredWidth(maxWidth)
  const aspectRatio = getPitchAspectRatio(pitchSize, orientation) // width / length
  const height = width / aspectRatio
  const markings = getPitchMarkings(pitchSize, orientation)

  // Meters -> pixels. Equal on both axes by construction (the Stage's
  // aspect ratio is derived from the same widthMeters/lengthMeters used
  // here), which is what keeps center circles circular instead of oval.
  const scaleX = width / markings.widthMeters
  const scaleY = height / markings.lengthMeters
  const lineWidth = Math.max(1.5, width * 0.006)

  // Phase coordinates are normalized 0-1 (see DrillPhase in store/types.ts)
  // and convert directly against Stage width/height — never against the
  // pitch markings' meters scale, which is a separate coordinate space.
  const toPx = (n: { x: number; y: number }) => ({ x: n.x * width, y: n.y * height })

  // Inverse of toPx, for dragend/dragmove — clamped defensively even though
  // dragBoundFunc (below) already keeps on-screen positions within [0,
  // width] / [0, height], so this never actually produces an out-of-range
  // normalized coordinate.
  const fromPx = (p: PixelPoint): NormalizedPoint => ({
    x: width > 0 ? clamp(p.x / width, 0, 1) : 0,
    y: height > 0 ? clamp(p.y / height, 0, 1) : 0,
  })

  // Keeps a dragged element's center fully within the canvas — a plain
  // Konva `dragBoundFunc`, called with the node's would-be absolute
  // position and expected to return the allowed one.
  const makeDragBound = (radius: number) => (pos: PixelPoint): PixelPoint => ({
    x: clamp(pos.x, radius, Math.max(radius, width - radius)),
    y: clamp(pos.y, radius, Math.max(radius, height - radius)),
  })

  const makeDragMoveHandler = (elementType: DrillElementType, elementId: string) =>
    (e: Konva.KonvaEventObject<DragEvent>) => {
      onElementDragMove?.(elementType, elementId, fromPx({ x: e.target.x(), y: e.target.y() }))
    }

  const makeDragEndHandler = (elementType: DrillElementType, elementId: string) =>
    (e: Konva.KonvaEventObject<DragEvent>) => {
      onElementDragEnd?.(elementType, elementId, fromPx({ x: e.target.x(), y: e.target.y() }))
    }

  // Annotation placement (2c, US-13): only fires when the click/tap landed
  // on empty pitch, not on a shape — Konva always sets `e.target` to
  // whichever node was actually hit, and to the Stage itself when nothing
  // was, so this check is what stops "tap a player to place a note next to
  // it" from also dropping a note under your finger. A real drag never
  // reaches here as a click either — Konva suppresses the click event that
  // would otherwise follow a drag once the pointer has moved past its
  // threshold.
  const handleStageClick = (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    if (!annotationMode || !onCanvasClick) return
    const stage = e.target.getStage()
    if (!stage || e.target !== stage) return
    const pointer = stage.getPointerPosition()
    if (!pointer) return
    onCanvasClick(fromPx(pointer))
  }

  const baseUnit = width / 100
  const playerRadius = baseUnit * 3.5
  const coneRadius = baseUnit * 2.4
  const ballRadius = baseUnit * 1.6
  const arrowStrokeWidth = Math.max(2, baseUnit * 0.8)
  const numberFontSize = baseUnit * 3
  const labelFontSize = baseUnit * 2.3
  const annotationFontSize = baseUnit * 2.4

  const teamColors = phase
    ? assignTeamColors(phase.players.map((p) => p.team), PLAYER.colors, PLAYER.fallback)
    : new Map<string, string>()

  return (
    <div
      ref={containerRef}
      data-pitch-canvas
      className={className}
      style={{ width: '100%', maxWidth }}
    >
      {width > 0 && (
        <Stage
          width={width}
          height={height}
          className="overflow-hidden rounded-lg shadow-sm"
          style={annotationMode ? { cursor: 'crosshair' } : removeMode ? { cursor: 'pointer' } : undefined}
          onClick={handleStageClick}
          onTap={handleStageClick}
        >
          {/* Non-interactive when fully read-only; listening turns on for
              editable (2b, draggable players/cones/balls), annotationMode
              (2c, click-to-place notes), and/or removeMode (click-to-remove
              an existing element/annotation/arrow) — markings stay
              non-listening in every mode so they can never intercept a drag,
              placement tap, or removal click meant for something else.
              Arrows (Upgrade Phase 2C) are the one element type that's only
              ever listening in removeMode — they aren't draggable, so
              `editable`/`annotationMode` alone leave them non-interactive. */}
          <Layer listening={editable || annotationMode || removeMode}>
            {/* Turf background */}
            <Rect x={0} y={0} width={width} height={height} fill={TURF.fill} listening={false} />

            {/* Pitch markings: rects (boundary, boxes), lines (halfway, grid,
                goal mouths), circles (center circle), dots (spots) */}
            {markings.rects.map((r, i) => (
              <Rect
                key={`rect-${i}`}
                x={r.x * scaleX}
                y={r.y * scaleY}
                width={r.w * scaleX}
                height={r.h * scaleY}
                stroke={TURF.line}
                strokeWidth={lineWidth}
                listening={false}
              />
            ))}
            {markings.lines.map((l, i) => (
              <Line
                key={`line-${i}`}
                points={[l.x1 * scaleX, l.y1 * scaleY, l.x2 * scaleX, l.y2 * scaleY]}
                stroke={TURF.line}
                strokeWidth={lineWidth * (l.strokeWidthScale ?? 1)}
                dash={l.dashed ? [lineWidth * 2, lineWidth * 2] : undefined}
                listening={false}
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
                listening={false}
              />
            ))}
            {markings.dots.map((d, i) => (
              <Circle
                key={`dot-${i}`}
                x={d.x * scaleX}
                y={d.y * scaleY}
                radius={lineWidth * 1.5}
                fill={TURF.line}
                listening={false}
              />
            ))}

            {/* Phase elements — drawn in a fixed z-order so arrows sit under
                the elements they connect, and annotations always read on top. */}
            {phase?.arrows.map((a) => {
              const from = toPx(a.from)
              const to = toPx(a.to)
              const style = ARROW[a.kind ?? 'player']
              return (
                <Arrow
                  key={a.id}
                  points={[from.x, from.y, to.x, to.y]}
                  stroke={style.stroke}
                  fill={style.stroke}
                  dash={style.dash}
                  strokeWidth={arrowStrokeWidth}
                  pointerLength={baseUnit * 2.2}
                  pointerWidth={baseUnit * 2.2}
                  hitStrokeWidth={Math.max(arrowStrokeWidth, baseUnit * 4)}
                  listening={removeMode}
                  onClick={removeMode ? () => onArrowClick?.(a.id) : undefined}
                  onTap={removeMode ? () => onArrowClick?.(a.id) : undefined}
                />
              )
            })}

            {phase?.cones.map((cone) => {
              const p = toPx(cone)
              const kind = cone.kind ?? 'cone'

              // Equipment types (Upgrade Phase 2B) share drag/click wiring
              // but differ in shape — "witches' hat" (a classic flat-base
              // training cone, per the reference photo) and "mannequin" each
              // group a couple of primitives so they read as a distinct
              // silhouette rather than just a recolored triangle.
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
                  <Group
                    key={cone.id}
                    x={p.x}
                    y={p.y}
                    draggable={editable}
                    dragBoundFunc={editable ? makeDragBound(totalHeight / 2) : undefined}
                    onDragMove={editable ? makeDragMoveHandler('cones', cone.id) : undefined}
                    onDragEnd={editable ? makeDragEndHandler('cones', cone.id) : undefined}
                    onClick={removeMode ? () => onElementClick?.('cones', cone.id) : undefined}
                    onTap={removeMode ? () => onElementClick?.('cones', cone.id) : undefined}
                  >
                    <Line
                      points={[
                        -topWidth / 2, top,
                        topWidth / 2, top,
                        bottomWidth / 2, bodyBottom,
                        -bottomWidth / 2, bodyBottom,
                      ]}
                      closed
                      fill={WITCHES_HAT.fill}
                      lineJoin="round"
                    />
                    <Rect
                      x={-baseWidth / 2}
                      y={bodyBottom}
                      width={baseWidth}
                      height={baseHeight}
                      cornerRadius={baseHeight / 2}
                      fill={WITCHES_HAT.fill}
                    />
                  </Group>
                )
              }

              if (kind === 'mannequin') {
                // Ring head + filled mesh-look torso + two splayed legs —
                // matches the reference plastic training-dummy photo's
                // silhouette (loop top, legs at the base) without trying to
                // render the mesh pattern itself at this scale, which
                // wouldn't stay legible pitch-side (see this file's own
                // "kept to 2-3 colors... legibility" framing).
                const bodyWidth = coneRadius * 1.1
                const bodyHeight = coneRadius * 1.8
                const headRadius = coneRadius * 0.5
                const legSpread = coneRadius * 0.7
                const legLength = coneRadius * 0.65
                return (
                  <Group
                    key={cone.id}
                    x={p.x}
                    y={p.y}
                    draggable={editable}
                    dragBoundFunc={editable ? makeDragBound(bodyHeight / 2 + legLength) : undefined}
                    onDragMove={editable ? makeDragMoveHandler('cones', cone.id) : undefined}
                    onDragEnd={editable ? makeDragEndHandler('cones', cone.id) : undefined}
                    onClick={removeMode ? () => onElementClick?.('cones', cone.id) : undefined}
                    onTap={removeMode ? () => onElementClick?.('cones', cone.id) : undefined}
                  >
                    <Circle
                      x={0}
                      y={-bodyHeight / 2 - headRadius}
                      radius={headRadius}
                      stroke={MANNEQUIN.stroke}
                      strokeWidth={1.3}
                    />
                    <Rect
                      x={-bodyWidth / 2}
                      y={-bodyHeight / 2}
                      width={bodyWidth}
                      height={bodyHeight}
                      cornerRadius={bodyWidth * 0.15}
                      fill={MANNEQUIN.fill}
                      stroke={MANNEQUIN.stroke}
                      strokeWidth={1}
                    />
                    <Line
                      points={[-legSpread / 2, bodyHeight / 2, -legSpread, bodyHeight / 2 + legLength]}
                      stroke={MANNEQUIN.stroke}
                      strokeWidth={1.3}
                      lineCap="round"
                    />
                    <Line
                      points={[legSpread / 2, bodyHeight / 2, legSpread, bodyHeight / 2 + legLength]}
                      stroke={MANNEQUIN.stroke}
                      strokeWidth={1.3}
                      lineCap="round"
                    />
                  </Group>
                )
              }

              // Agility pole (the internal `kind` stays 'cone' — see
              // pitchTheme.ts's CONE comment): a slim shaft on a flat base,
              // rather than a flat marker triangle.
              const poleHeight = coneRadius * 2.4
              const poleWidth = Math.max(2, coneRadius * 0.35)
              const baseWidth = coneRadius * 1.3
              const baseHeight = coneRadius * 0.4
              const fill = CONE.named[cone.color ?? ''] ?? CONE.fallback
              return (
                <Group
                  key={cone.id}
                  x={p.x}
                  y={p.y}
                  draggable={editable}
                  dragBoundFunc={editable ? makeDragBound(poleHeight / 2) : undefined}
                  onDragMove={editable ? makeDragMoveHandler('cones', cone.id) : undefined}
                  onDragEnd={editable ? makeDragEndHandler('cones', cone.id) : undefined}
                  onClick={removeMode ? () => onElementClick?.('cones', cone.id) : undefined}
                  onTap={removeMode ? () => onElementClick?.('cones', cone.id) : undefined}
                >
                  <Rect
                    x={-poleWidth / 2}
                    y={-poleHeight / 2}
                    width={poleWidth}
                    height={poleHeight}
                    cornerRadius={poleWidth / 2}
                    fill={fill}
                  />
                  <Ellipse
                    x={0}
                    y={poleHeight / 2 - baseHeight / 2}
                    radiusX={baseWidth / 2}
                    radiusY={baseHeight / 2}
                    fill={CONE.base}
                  />
                </Group>
              )
            })}

            {phase?.balls.map((ball) => {
              const p = toPx(ball)
              return (
                <Circle
                  key={ball.id}
                  x={p.x}
                  y={p.y}
                  radius={ballRadius}
                  fill={BALL.fill}
                  stroke={BALL.stroke}
                  strokeWidth={1.5}
                  draggable={editable}
                  dragBoundFunc={editable ? makeDragBound(ballRadius) : undefined}
                  onDragMove={editable ? makeDragMoveHandler('balls', ball.id) : undefined}
                  onDragEnd={editable ? makeDragEndHandler('balls', ball.id) : undefined}
                  onClick={removeMode ? () => onElementClick?.('balls', ball.id) : undefined}
                  onTap={removeMode ? () => onElementClick?.('balls', ball.id) : undefined}
                />
              )
            })}

            {phase?.players.map((player) => {
              const p = toPx(player)
              const fill = teamColors.get(player.team) ?? PLAYER.fallback
              // The dot + number + label chip drag together as one unit, so
              // the Group itself carries the element's absolute position
              // (x/y here) and every child below is positioned relative to
              // it (0,0) — a draggable Konva Group moves by adjusting its
              // own x/y, and children in local coordinates come along for
              // free instead of needing their own drag math.
              return (
                <Group
                  key={player.id}
                  x={p.x}
                  y={p.y}
                  draggable={editable}
                  dragBoundFunc={editable ? makeDragBound(playerRadius) : undefined}
                  onDragMove={editable ? makeDragMoveHandler('players', player.id) : undefined}
                  onDragEnd={editable ? makeDragEndHandler('players', player.id) : undefined}
                  onClick={removeMode ? () => onElementClick?.('players', player.id) : undefined}
                  onTap={removeMode ? () => onElementClick?.('players', player.id) : undefined}
                >
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
                    // Rough width estimate to center the chip under the
                    // player dot — Konva's Label doesn't auto-center, and
                    // measuring real text width needs a mounted canvas
                    // context, which is overkill for a short position tag.
                    <Label
                      x={-(player.label.length * labelFontSize * 0.6) / 2 - 4}
                      y={playerRadius + 2}
                      listening={false}
                    >
                      <Tag fill={ANNOTATION.background} stroke={ANNOTATION.border} strokeWidth={1} cornerRadius={3} />
                      <Text text={player.label} fontSize={labelFontSize} fill={ANNOTATION.text} padding={2} />
                    </Label>
                  )}
                </Group>
              )
            })}

            {phase?.annotations.map((note) => {
              const p = toPx(note)
              return (
                <Label
                  key={note.id}
                  x={p.x}
                  y={p.y}
                  listening={removeMode}
                  onClick={removeMode ? () => onAnnotationClick?.(note.id) : undefined}
                  onTap={removeMode ? () => onAnnotationClick?.(note.id) : undefined}
                >
                  <Tag fill={ANNOTATION.background} stroke={ANNOTATION.border} strokeWidth={1} cornerRadius={4} />
                  <Text text={note.text} fontSize={annotationFontSize} fill={ANNOTATION.text} padding={4} />
                </Label>
              )
            })}

            {/* Staged first point of an in-progress arrow (Upgrade Phase
                2C) — purely visual, never interactive, so a half-drawn
                arrow is never invisible between the two taps. */}
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
          </Layer>
        </Stage>
      )}
      {hintText && phase && <p className="mt-1 text-center text-xs text-amber-600">{hintText}</p>}
      {phase && phase.players.length + phase.cones.length + phase.balls.length === 0 && (
        <p className="mt-1 text-center text-xs text-slate-400">This phase has no elements yet.</p>
      )}
      {!phase && <p className="mt-1 text-center text-xs text-slate-400">No phase to display.</p>}
    </div>
  )
}
