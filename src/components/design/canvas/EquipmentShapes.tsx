import { Circle, Ellipse, Line, Rect } from 'react-konva'
import type { EquipmentType } from '../../../store'
import { EQUIPMENT } from '../pitchTheme'

// The eleven equipment silhouettes (rework plan Stage 6.2). Every one is drawn
// around its own origin so the caller positions a Group and nothing here needs
// to know where it sits on the pitch.
//
// House rule from pitchTheme.ts: distinguish by *shape*, not by palette. A
// coach reads these on a phone at the side of a pitch, so each has to be
// recognisable as a silhouette — a goal is a frame with a net, a ladder is
// rungs, a hurdle stands on two feet. Colour only separates the three
// families (marker / frame / ground) and carries the per-entity override.

export interface EquipmentShapeProps {
  // Half the footprint the piece should occupy, in pixels. Everything scales
  // off this so one number keeps the whole library visually consistent.
  unit: number
  color?: string
}

function ConeShape({ unit, color }: EquipmentShapeProps) {
  const fill = color ?? EQUIPMENT.markerDeep
  const height = unit * 1.8
  const top = -height / 2
  const bottom = height / 2
  return (
    <>
      <Line
        points={[-unit * 0.22, top, unit * 0.22, top, unit * 0.85, bottom * 0.72, -unit * 0.85, bottom * 0.72]}
        closed
        fill={fill}
        lineJoin="round"
      />
      <Rect
        x={-unit}
        y={bottom * 0.72}
        width={unit * 2}
        height={unit * 0.36}
        cornerRadius={unit * 0.18}
        fill={fill}
      />
    </>
  )
}

// A flat rubber disc — deliberately the lowest-profile thing in the set, since
// that is exactly what it is on grass.
function MarkerShape({ unit, color }: EquipmentShapeProps) {
  return (
    <>
      <Ellipse radiusX={unit * 0.85} radiusY={unit * 0.42} fill={color ?? EQUIPMENT.marker} />
      <Ellipse radiusX={unit * 0.42} radiusY={unit * 0.2} fill={EQUIPMENT.ground} opacity={0.25} />
    </>
  )
}

function PoleShape({ unit, color }: EquipmentShapeProps) {
  const height = unit * 2.4
  const width = Math.max(2, unit * 0.3)
  return (
    <>
      <Rect x={-width / 2} y={-height / 2} width={width} height={height} cornerRadius={width / 2} fill={color ?? EQUIPMENT.marker} />
      <Ellipse y={height / 2 - unit * 0.16} radiusX={unit * 0.65} radiusY={unit * 0.2} fill={EQUIPMENT.ground} />
    </>
  )
}

function MannequinShape({ unit, color }: EquipmentShapeProps) {
  const bodyWidth = unit * 0.95
  const bodyHeight = unit * 1.6
  const headRadius = unit * 0.42
  const legSpread = unit * 0.6
  const legLength = unit * 0.55
  return (
    <>
      <Circle y={-bodyHeight / 2 - headRadius} radius={headRadius} stroke={EQUIPMENT.frameDeep} strokeWidth={1.3} />
      <Rect
        x={-bodyWidth / 2}
        y={-bodyHeight / 2}
        width={bodyWidth}
        height={bodyHeight}
        cornerRadius={bodyWidth * 0.15}
        fill={color ?? EQUIPMENT.frame}
        stroke={EQUIPMENT.frameDeep}
        strokeWidth={1}
      />
      <Line points={[-legSpread / 2, bodyHeight / 2, -legSpread, bodyHeight / 2 + legLength]} stroke={EQUIPMENT.frameDeep} strokeWidth={1.3} lineCap="round" />
      <Line points={[legSpread / 2, bodyHeight / 2, legSpread, bodyHeight / 2 + legLength]} stroke={EQUIPMENT.frameDeep} strokeWidth={1.3} lineCap="round" />
    </>
  )
}

// Goals are a frame plus a hatched net, which is what separates them at a
// glance from a hurdle or a rebounder. `span` and `height` differ; everything
// else is shared.
function GoalShape({ unit, color, span, height }: EquipmentShapeProps & { span: number; height: number }) {
  const half = span / 2
  const stroke = color ?? EQUIPMENT.frame
  const bar = Math.max(1.5, unit * 0.16)
  const netLines = []
  const step = span / 5
  for (let i = 1; i < 5; i++) {
    netLines.push(<Line key={`v${i}`} points={[-half + step * i, -height, -half + step * i, 0]} stroke={EQUIPMENT.net} strokeWidth={0.8} />)
  }
  netLines.push(<Line key="h" points={[-half, -height / 2, half, -height / 2]} stroke={EQUIPMENT.net} strokeWidth={0.8} />)
  return (
    <>
      {netLines}
      <Line points={[-half, 0, -half, -height, half, -height, half, 0]} stroke={stroke} strokeWidth={bar} lineJoin="round" lineCap="round" />
    </>
  )
}

function AgilityRingShape({ unit, color }: EquipmentShapeProps) {
  return (
    <Ellipse
      radiusX={unit * 0.9}
      radiusY={unit * 0.45}
      stroke={color ?? EQUIPMENT.markerDeep}
      strokeWidth={Math.max(2, unit * 0.28)}
    />
  )
}

// Rungs between two rails — unmistakable even at thumbnail size, which is the
// whole reason to draw the rungs rather than an empty box.
function LadderShape({ unit, color }: EquipmentShapeProps) {
  const length = unit * 4
  const width = unit * 1.1
  const stroke = color ?? EQUIPMENT.marker
  const rungs = []
  const count = 5
  for (let i = 0; i <= count; i++) {
    const y = -length / 2 + (length / count) * i
    rungs.push(<Line key={i} points={[-width / 2, y, width / 2, y]} stroke={stroke} strokeWidth={Math.max(1.2, unit * 0.13)} />)
  }
  return (
    <>
      <Line points={[-width / 2, -length / 2, -width / 2, length / 2]} stroke={stroke} strokeWidth={Math.max(1.2, unit * 0.13)} />
      <Line points={[width / 2, -length / 2, width / 2, length / 2]} stroke={stroke} strokeWidth={Math.max(1.2, unit * 0.13)} />
      {rungs}
    </>
  )
}

// A bar on two feet, drawn side-on so the thing it asks a player to do —
// clear it — is legible.
function HurdleShape({ unit, color }: EquipmentShapeProps) {
  const span = unit * 1.8
  const height = unit * 1.1
  const stroke = color ?? EQUIPMENT.markerDeep
  const bar = Math.max(1.6, unit * 0.18)
  return (
    <>
      <Line points={[-span / 2, height / 2, -span / 2, -height / 2, span / 2, -height / 2, span / 2, height / 2]} stroke={stroke} strokeWidth={bar} lineJoin="round" />
      <Line points={[-span / 2 - unit * 0.25, height / 2, -span / 2 + unit * 0.25, height / 2]} stroke={EQUIPMENT.ground} strokeWidth={bar} lineCap="round" />
      <Line points={[span / 2 - unit * 0.25, height / 2, span / 2 + unit * 0.25, height / 2]} stroke={EQUIPMENT.ground} strokeWidth={bar} lineCap="round" />
    </>
  )
}

// An angled board — the tilt is the tell, and it also says which way a ball
// will come back.
function RebounderShape({ unit, color }: EquipmentShapeProps) {
  const span = unit * 1.9
  const height = unit * 1.2
  const stroke = color ?? EQUIPMENT.frame
  return (
    <>
      <Line
        points={[-span / 2, height / 2, -span / 2 + unit * 0.35, -height / 2, span / 2 + unit * 0.35, -height / 2, span / 2, height / 2]}
        closed
        fill={EQUIPMENT.frame}
        opacity={0.28}
      />
      <Line
        points={[-span / 2, height / 2, -span / 2 + unit * 0.35, -height / 2, span / 2 + unit * 0.35, -height / 2, span / 2, height / 2]}
        closed
        stroke={stroke}
        strokeWidth={Math.max(1.6, unit * 0.16)}
        lineJoin="round"
      />
      <Line points={[-span / 2 + unit * 0.35, -height / 2, span / 2, height / 2]} stroke={EQUIPMENT.net} strokeWidth={0.9} />
    </>
  )
}

// Two poles with a gap between them: the gap is the point, so it's drawn as a
// dashed line rather than left as empty space you could mistake for nothing.
function PassingGateShape({ unit, color }: EquipmentShapeProps) {
  const span = unit * 2
  const height = unit * 1.5
  const fill = color ?? EQUIPMENT.marker
  const width = Math.max(2, unit * 0.26)
  return (
    <>
      <Line points={[-span / 2, 0, span / 2, 0]} stroke={fill} strokeWidth={1} dash={[unit * 0.3, unit * 0.3]} opacity={0.75} />
      <Rect x={-span / 2 - width / 2} y={-height / 2} width={width} height={height} cornerRadius={width / 2} fill={fill} />
      <Rect x={span / 2 - width / 2} y={-height / 2} width={width} height={height} cornerRadius={width / 2} fill={fill} />
      <Ellipse x={-span / 2} y={height / 2 - unit * 0.1} radiusX={unit * 0.4} radiusY={unit * 0.14} fill={EQUIPMENT.ground} />
      <Ellipse x={span / 2} y={height / 2 - unit * 0.1} radiusX={unit * 0.4} radiusY={unit * 0.14} fill={EQUIPMENT.ground} />
    </>
  )
}

/**
 * One equipment silhouette, drawn around the origin. Callers wrap this in a
 * positioned (and optionally rotated) Konva Group.
 */
export function EquipmentShape({ type, unit, color }: EquipmentShapeProps & { type: EquipmentType }) {
  switch (type) {
    case 'marker':
      return <MarkerShape unit={unit} color={color} />
    case 'pole':
      return <PoleShape unit={unit} color={color} />
    case 'mannequin':
      return <MannequinShape unit={unit} color={color} />
    case 'mini_goal':
      return <GoalShape unit={unit} color={color} span={unit * 2.2} height={unit * 1.1} />
    case 'full_goal':
      return <GoalShape unit={unit} color={color} span={unit * 3.6} height={unit * 1.7} />
    case 'agility_ring':
      return <AgilityRingShape unit={unit} color={color} />
    case 'ladder':
      return <LadderShape unit={unit} color={color} />
    case 'hurdle':
      return <HurdleShape unit={unit} color={color} />
    case 'rebounder':
      return <RebounderShape unit={unit} color={color} />
    case 'passing_gate':
      return <PassingGateShape unit={unit} color={color} />
    case 'cone':
    default:
      return <ConeShape unit={unit} color={color} />
  }
}

// The same silhouettes as flat SVG, for the tool rail and the equipment panel.
// Drawn on a 24x24 viewBox around a centre of (12, 12) so a panel row and the
// pitch agree about what a piece looks like.
export function EquipmentIcon({ type, color }: { type: EquipmentType; color?: string }) {
  const paint = color ?? (type === 'mannequin' || type === 'mini_goal' || type === 'full_goal' || type === 'rebounder' ? EQUIPMENT.frame : EQUIPMENT.marker)
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
      <g transform="translate(12 12)">{ICON_BODY[type](paint)}</g>
    </svg>
  )
}

const ICON_BODY: Record<EquipmentType, (paint: string) => React.ReactNode> = {
  cone: (p) => (
    <>
      <polygon points="-2,-8 2,-8 7,5 -7,5" fill={p} />
      <rect x="-9" y="5" width="18" height="3.4" rx="1.7" fill={p} />
    </>
  ),
  marker: (p) => (
    <>
      <ellipse rx="8.5" ry="4" fill={p} />
      <ellipse rx="4" ry="1.9" fill={EQUIPMENT.ground} opacity="0.25" />
    </>
  ),
  pole: (p) => (
    <>
      <rect x="-1.4" y="-9" width="2.8" height="17" rx="1.4" fill={p} />
      <ellipse cy="8" rx="6" ry="1.8" fill={EQUIPMENT.ground} />
    </>
  ),
  mannequin: (p) => (
    <>
      <circle cy="-7.5" r="2.6" fill="none" stroke={EQUIPMENT.frameDeep} strokeWidth="1.4" />
      <rect x="-4" y="-4.5" width="8" height="9" rx="1" fill={p} stroke={EQUIPMENT.frameDeep} strokeWidth="1" />
      <line x1="-2" y1="4.5" x2="-4" y2="9" stroke={EQUIPMENT.frameDeep} strokeWidth="1.4" strokeLinecap="round" />
      <line x1="2" y1="4.5" x2="4" y2="9" stroke={EQUIPMENT.frameDeep} strokeWidth="1.4" strokeLinecap="round" />
    </>
  ),
  mini_goal: (p) => (
    <>
      <line x1="-3" y1="4" x2="-3" y2="-4" stroke={EQUIPMENT.net} strokeWidth="0.9" />
      <line x1="3" y1="4" x2="3" y2="-4" stroke={EQUIPMENT.net} strokeWidth="0.9" />
      <polyline points="-8,4 -8,-4 8,-4 8,4" fill="none" stroke={p} strokeWidth="2" strokeLinejoin="round" />
    </>
  ),
  agility_ring: (p) => <ellipse rx="8.5" ry="4.2" fill="none" stroke={p} strokeWidth="2.6" />,
  full_goal: (p) => (
    <>
      <line x1="-3.5" y1="6" x2="-3.5" y2="-6" stroke={EQUIPMENT.net} strokeWidth="0.9" />
      <line x1="3.5" y1="6" x2="3.5" y2="-6" stroke={EQUIPMENT.net} strokeWidth="0.9" />
      <line x1="-10" y1="0" x2="10" y2="0" stroke={EQUIPMENT.net} strokeWidth="0.9" />
      <polyline points="-10,6 -10,-6 10,-6 10,6" fill="none" stroke={p} strokeWidth="2.2" strokeLinejoin="round" />
    </>
  ),
  ladder: (p) => (
    <>
      <line x1="-4" y1="-10" x2="-4" y2="10" stroke={p} strokeWidth="1.4" />
      <line x1="4" y1="-10" x2="4" y2="10" stroke={p} strokeWidth="1.4" />
      {[-10, -6, -2, 2, 6, 10].map((y) => (
        <line key={y} x1="-4" y1={y} x2="4" y2={y} stroke={p} strokeWidth="1.4" />
      ))}
    </>
  ),
  hurdle: (p) => (
    <>
      <polyline points="-7,5 -7,-5 7,-5 7,5" fill="none" stroke={p} strokeWidth="2" strokeLinejoin="round" />
      <line x1="-9" y1="5" x2="-5" y2="5" stroke={EQUIPMENT.ground} strokeWidth="2" strokeLinecap="round" />
      <line x1="5" y1="5" x2="9" y2="5" stroke={EQUIPMENT.ground} strokeWidth="2" strokeLinecap="round" />
    </>
  ),
  rebounder: (p) => (
    <>
      <polygon points="-8,5 -5,-5 9,-5 6,5" fill={p} opacity="0.28" />
      <polygon points="-8,5 -5,-5 9,-5 6,5" fill="none" stroke={p} strokeWidth="1.8" strokeLinejoin="round" />
    </>
  ),
  passing_gate: (p) => (
    <>
      <line x1="-8" y1="0" x2="8" y2="0" stroke={p} strokeWidth="1" strokeDasharray="2 2" opacity="0.75" />
      <rect x="-9.3" y="-6" width="2.6" height="12" rx="1.3" fill={p} />
      <rect x="6.7" y="-6" width="2.6" height="12" rx="1.3" fill={p} />
    </>
  ),
}
