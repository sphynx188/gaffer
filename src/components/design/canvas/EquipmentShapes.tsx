import type Konva from 'konva'
import { Circle, Ellipse, Group, Line, Path, Rect, Shape } from 'react-konva'
import type { EquipmentType } from '../../../store'
import { EQUIPMENT } from '../pitchTheme'
import {
  GATE_POLE,
  HURDLE_FOOTPRINT,
  REBOUNDER_FOOTPRINT,
  footprintShadow,
  gatePoles,
  goalFootprint,
  goalModel,
  hurdleModel,
  mannequinTransform,
  rebounderModel,
} from './equipmentModels'

// The eleven equipment pieces (rework plan Stage 6.2), redrawn 2026-10-28 as
// realistic kit rather than flat cartoon silhouettes — modelled on Alpha Gear
// product photos and drawn slightly side-on, the angle a product shot takes.
// Every one is drawn around its own origin so the caller positions a Group and
// nothing here needs to know where it sits on the pitch.
//
// Realism comes from three cheap tricks applied consistently rather than from
// detail: a horizontal gradient across anything round (light from the upper
// left), a soft radial shadow on the grass under each piece, and the real
// materials' colours (pitchTheme's EQUIPMENT). The house rule from
// pitchTheme.ts still holds — each piece has to read by its shape on a phone
// pitch-side — so the forms are the real ones, just not their small print.

export interface EquipmentShapeProps {
  // Half the footprint the piece should occupy, in pixels. Everything scales
  // off this so one number keeps the whole library visually consistent.
  unit: number
  color?: string
}

// Mixes a #rgb/#rrggbb colour toward black (negative) or white (positive).
// Anything else (a named or rgba colour) passes through unshaded.
function shade(color: string, amount: number): string {
  const match = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(color.trim())
  if (!match) return color
  let hex = match[1]
  if (hex.length === 3) hex = hex.split('').map((c) => c + c).join('')
  const n = parseInt(hex, 16)
  const mix = (c: number) => Math.round(amount < 0 ? c * (1 + amount) : c + (255 - c) * amount)
  const rgb = (mix((n >> 16) & 255) << 16) | (mix((n >> 8) & 255) << 8) | mix(n & 255)
  return `#${(rgb | (1 << 24)).toString(16).slice(1)}`
}

// Lighting across a round surface from x0 to x1 (in the shape's own local
// coordinates): a shadowed edge, a highlight a third of the way in, the true
// colour, then the far edge falling off into shade.
function across(x0: number, x1: number, color: string) {
  return {
    fillLinearGradientStartPoint: { x: x0, y: 0 },
    fillLinearGradientEndPoint: { x: x1, y: 0 },
    fillLinearGradientColorStops: [0, shade(color, -0.3), 0.28, shade(color, 0.32), 0.5, color, 1, shade(color, -0.42)],
  }
}

// A soft shadow on the grass. A Circle squashed with scaleY rather than an
// Ellipse, because the transform squashes the radial gradient with it — an
// Ellipse fills after undoing its own scale, which cuts the falloff short.
function GroundShadow({ x = 0, y, rx, ry, opacity = 0.32 }: { x?: number; y: number; rx: number; ry: number; opacity?: number }) {
  return (
    <Circle
      x={x}
      y={y}
      radius={rx}
      scaleY={ry / rx}
      fillRadialGradientStartPoint={{ x: 0, y: 0 }}
      fillRadialGradientStartRadius={0}
      fillRadialGradientEndPoint={{ x: 0, y: 0 }}
      fillRadialGradientEndRadius={rx}
      fillRadialGradientColorStops={[0, `rgba(0,0,0,${opacity})`, 0.55, `rgba(0,0,0,${opacity * 0.55})`, 1, 'rgba(0,0,0,0)']}
    />
  )
}

// A low dome seen from slightly above: a wide elliptical foot rising to a
// smaller top. A disc cone (with its hole) and a pole's rubber base are both
// this shape.
function Dome({ x = 0, R, yb, ryb, r, yt, ryt, color, hole }: {
  x?: number
  R: number
  yb: number
  ryb: number
  r: number
  yt: number
  ryt: number
  color: string
  hole?: boolean
}) {
  const shoulder = yt + (yb - yt) * 0.25
  return (
    <>
      <Shape
        x={x}
        sceneFunc={(ctx, shape) => {
          ctx.beginPath()
          ctx.moveTo(-R, yb)
          ctx.quadraticCurveTo(-r * 1.6, shoulder, -r, yt)
          ctx.lineTo(r, yt)
          ctx.quadraticCurveTo(r * 1.6, shoulder, R, yb)
          ctx.bezierCurveTo(R, yb + ryb * 1.33, -R, yb + ryb * 1.33, -R, yb)
          ctx.closePath()
          ctx.fillStrokeShape(shape)
        }}
        {...across(-R, R, color)}
      />
      {hole ? (
        <>
          <Ellipse x={x} y={yt} radiusX={r} radiusY={ryt} fill={shade(color, -0.45)} stroke={shade(color, 0.3)} strokeWidth={Math.max(0.5, ryt * 0.25)} />
          <Ellipse x={x} y={yt + ryt * 0.25} radiusX={r * 0.7} radiusY={ryt * 0.6} fill="#000000" opacity={0.35} />
        </>
      ) : (
        <Ellipse x={x} y={yt} radiusX={r} radiusY={ryt} fill={shade(color, 0.12)} />
      )}
    </>
  )
}

// A mesh panel: a translucent white fill with a diagonal crosshatch, clipped
// to an arbitrary outline. Goals and the rebounder share it.
function Mesh({ outline, spacing, lineWidth }: { outline: number[]; spacing: number; lineWidth: number }) {
  const xs = outline.filter((_, i) => i % 2 === 0)
  const ys = outline.filter((_, i) => i % 2 === 1)
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)
  const clip = (ctx: Konva.Context) => {
    ctx.beginPath()
    ctx.moveTo(outline[0], outline[1])
    for (let i = 2; i < outline.length; i += 2) ctx.lineTo(outline[i], outline[i + 1])
    ctx.closePath()
  }
  return (
    <Group clipFunc={clip}>
      <Line points={outline} closed fill={EQUIPMENT.netFill} />
      <Shape
        sceneFunc={(ctx, shape) => {
          const h = maxY - minY
          ctx.beginPath()
          for (let d = minX - h; d <= maxX; d += spacing) {
            ctx.moveTo(d, minY)
            ctx.lineTo(d + h, maxY)
            ctx.moveTo(d + h, minY)
            ctx.lineTo(d, maxY)
          }
          ctx.strokeShape(shape)
        }}
        stroke={EQUIPMENT.netLine}
        strokeWidth={lineWidth}
      />
    </Group>
  )
}

// A tall training cone, modelled on a product photo: one moulded colour
// throughout, a slightly flat top, and a thin square flange at the foot seen
// corner-on — so it reads as a diamond, with its front edges showing the
// flange's thickness.
function ConeShape({ unit, color }: EquipmentShapeProps) {
  const base = color ?? EQUIPMENT.cone
  const height = unit * 2.3
  const top = -height / 2
  const footY = height / 2 - unit * 0.32
  const flangeHalf = unit * 0.95
  const flangeDepth = unit * 0.32
  const lip = Math.max(1, unit * 0.09)
  const bodyHalf = unit * 0.58
  const apexHalf = unit * 0.12
  const flange = [-flangeHalf, footY, 0, footY + flangeDepth, flangeHalf, footY, 0, footY - flangeDepth]
  return (
    <>
      <GroundShadow x={unit * 0.2} y={footY + lip} rx={unit * 1.2} ry={unit * 0.42} />
      <Line
        points={[-flangeHalf, footY, 0, footY + flangeDepth, flangeHalf, footY, flangeHalf, footY + lip, 0, footY + flangeDepth + lip, -flangeHalf, footY + lip]}
        closed
        fill={shade(base, -0.35)}
        stroke={shade(base, -0.35)}
        strokeWidth={unit * 0.06}
        lineJoin="round"
      />
      <Line points={flange} closed fill={shade(base, -0.05)} stroke={shade(base, -0.05)} strokeWidth={unit * 0.06} lineJoin="round" />
      <Ellipse y={footY} radiusX={bodyHalf} radiusY={unit * 0.13} {...across(-bodyHalf, bodyHalf, base)} />
      <Line points={[-apexHalf, top, apexHalf, top, bodyHalf, footY, -bodyHalf, footY]} closed {...across(-bodyHalf, bodyHalf, base)} />
      <Ellipse y={top} radiusX={apexHalf} radiusY={apexHalf * 0.35} fill={shade(base, 0.1)} />
    </>
  )
}

// A disc (saucer) cone: a glossy low dome with a hole in the top and the
// moulded ridges running round it.
function MarkerShape({ unit, color }: EquipmentShapeProps) {
  const base = color ?? EQUIPMENT.disc
  // Three-quarters of the full footprint: a disc cone is the smallest thing
  // on a training pitch, and drawn full size it outweighed the tall cone.
  const k = unit * 0.75
  const R = k * 0.95
  const yb = k * 0.22
  const ryb = k * 0.36
  const r = k * 0.34
  const yt = -k * 0.28
  const ryt = k * 0.12
  const ridges = [0.4, 0.7].map((t) => ({
    rr: r + (R - r) * t * 0.92,
    y: yt + (yb - yt) * t,
    ry: ryt + (ryb - ryt) * t * 0.85,
  }))
  return (
    <>
      <GroundShadow x={k * 0.12} y={yb + k * 0.05} rx={R * 1.12} ry={ryb * 1.15} />
      <Dome R={R} yb={yb} ryb={ryb} r={r} yt={yt} ryt={ryt} color={base} hole />
      <Shape
        sceneFunc={(ctx, shape) => {
          ctx.beginPath()
          for (const { rr, y, ry } of ridges) {
            ctx.moveTo(-rr, y)
            ctx.bezierCurveTo(-rr, y + ry * 1.33, rr, y + ry * 1.33, rr, y)
          }
          ctx.strokeShape(shape)
        }}
        stroke={shade(base, -0.2)}
        strokeWidth={Math.max(0.5, k * 0.035)}
        opacity={0.7}
      />
    </>
  )
}

// A slalom pole on a black rubber dome base, with the joint ring where its two
// sections screw together. Shared by the pole and the passing gate.
function PolePiece({ x = 0, height, unit, color }: { x?: number; height: number; unit: number; color: string }) {
  const width = Math.max(2, unit * 0.2)
  const baseY = height / 2
  const baseTop = baseY - unit * 0.16
  const top = -height / 2
  return (
    <>
      <GroundShadow x={x + unit * 0.15} y={baseY + unit * 0.04} rx={unit * 0.78} ry={unit * 0.24} />
      <Dome x={x} R={unit * 0.6} yb={baseY} ryb={unit * 0.2} r={unit * 0.32} yt={baseTop} ryt={unit * 0.11} color={EQUIPMENT.rubber} />
      <Rect x={x - width / 2} y={top} width={width} height={baseTop - top} {...across(0, width, color)} />
      <Ellipse x={x} y={top} radiusX={width / 2} radiusY={width * 0.3} fill={EQUIPMENT.rubber} />
      <Rect x={x - width * 0.55} y={(top + baseTop) / 2} width={width * 1.1} height={Math.max(1, unit * 0.08)} fill={EQUIPMENT.rubber} />
    </>
  )
}

function PoleShape({ unit, color }: EquipmentShapeProps) {
  return <PolePiece height={unit * 2.8} unit={unit} color={color ?? EQUIPMENT.pole} />
}

// A free-kick mannequin: one flat moulded panel — a head loop, a latticed
// torso in three columns, legs as open loops meeting a base bar, and two
// ground spikes. Authored in unit space and scaled by the Group, so every
// stroke weight scales with it.
function MannequinShape({ unit, color, rotation }: EquipmentShapeProps & { rotation: number }) {
  // Turning the panel foreshortens and shears its flat drawing
  // (equipmentModels' mannequinTransform) rather than rotating it.
  const turn = mannequinTransform(rotation)
  return (
    <Group scaleX={turn.scaleX}>
      <Group skewY={turn.skewY}>
        <MannequinPanel unit={unit} color={color} />
      </Group>
    </Group>
  )
}

function MannequinPanel({ unit, color }: EquipmentShapeProps) {
  const base = color ?? EQUIPMENT.mannequin
  const edge = shade(base, -0.25)
  const torso = { x: -0.62, y: -1.0, w: 1.24, h: 1.25 }
  const legs =
    'M -0.6 0.25 Q -0.6 0.72 -0.36 0.95 L -0.36 1.3 ' +
    'M -0.3 0.25 L -0.36 0.95 ' +
    'M -0.2 0.25 L 0 0.92 L 0.2 0.25 M 0 0.92 L 0 1.3 ' +
    'M 0.3 0.25 L 0.36 0.95 ' +
    'M 0.6 0.25 Q 0.6 0.72 0.36 0.95 L 0.36 1.3'
  return (
    <Group scaleX={unit} scaleY={unit}>
      <GroundShadow x={0.15} y={1.5} rx={0.8} ry={0.18} />
      <Line points={[-0.3, 1.42, -0.3, 1.58]} stroke={EQUIPMENT.spike} strokeWidth={0.035} />
      <Line points={[0.3, 1.42, 0.3, 1.58]} stroke={EQUIPMENT.spike} strokeWidth={0.035} />
      <Circle y={-1.33} radius={0.2} stroke={base} strokeWidth={0.07} />
      <Rect x={-0.1} y={-1.15} width={0.2} height={0.17} fill={base} />
      <Rect {...torso} cornerRadius={0.1} fill={base} opacity={0.35} />
      <Group clipX={torso.x} clipY={torso.y} clipWidth={torso.w} clipHeight={torso.h}>
        <Shape
          sceneFunc={(ctx, shape) => {
            ctx.beginPath()
            for (let d = torso.x - torso.h; d <= torso.x + torso.w; d += 0.12) {
              ctx.moveTo(d, torso.y)
              ctx.lineTo(d + torso.h, torso.y + torso.h)
              ctx.moveTo(d + torso.h, torso.y)
              ctx.lineTo(d, torso.y + torso.h)
            }
            ctx.strokeShape(shape)
          }}
          stroke={base}
          strokeWidth={0.04}
        />
      </Group>
      <Rect {...torso} cornerRadius={0.1} stroke={base} strokeWidth={0.08} />
      <Line points={[-0.2, torso.y, -0.2, torso.y + torso.h]} stroke={base} strokeWidth={0.06} />
      <Line points={[0.2, torso.y, 0.2, torso.y + torso.h]} stroke={base} strokeWidth={0.06} />
      <Path data={legs} stroke={base} strokeWidth={0.08} lineCap="round" lineJoin="round" />
      <Rect
        x={-0.46}
        y={1.28}
        width={0.92}
        height={0.15}
        cornerRadius={0.02}
        fillLinearGradientStartPoint={{ x: 0, y: 0 }}
        fillLinearGradientEndPoint={{ x: 0, y: 0.15 }}
        fillLinearGradientColorStops={[0, shade(base, 0.2), 1, edge]}
      />
    </Group>
  )
}

// A box goal, drawn from its 3D model (equipmentModels.ts) so it turns to
// face any way: parts painted far to near, the mesh over whatever's behind
// it. The mini goal is the folding aluminium kind with rounded top corners
// and navy sleeves; the full goal is square white posts. `color` recolours
// the sleeves on a mini goal and the frame on a full one.
function GoalShape({ unit, color, kind, rotation }: EquipmentShapeProps & { kind: 'mini_goal' | 'full_goal'; rotation: number }) {
  const bar = Math.max(1.5, unit * 0.14)
  const sleeve = kind === 'mini_goal' ? color ?? EQUIPMENT.goalSleeve : null
  const frame = kind === 'full_goal' ? color ?? EQUIPMENT.goalWhite : EQUIPMENT.aluminium
  const frameLight = kind === 'full_goal' ? shade(frame, 0.6) : EQUIPMENT.aluminiumLight
  const frameDark = kind === 'full_goal' ? shade(frame, -0.3) : EQUIPMENT.aluminiumDark
  const meshSpacing = Math.max(2.5, unit * 0.16)
  const meshWidth = Math.max(0.35, unit * 0.025)
  const shadow = footprintShadow(goalFootprint(kind), rotation)
  return (
    <>
      <GroundShadow x={shadow.x * unit} y={shadow.y * unit} rx={shadow.rx * unit} ry={shadow.ry * unit} />
      {goalModel(kind, rotation).map((prim, i) => {
        const points = prim.points.map((v) => v * unit)
        if (prim.kind === 'mesh') return <Mesh key={i} outline={points} spacing={meshSpacing} lineWidth={meshWidth} />
        if (prim.kind === 'joint') {
          return <Ellipse key={i} x={points[0]} y={points[1]} radiusX={bar * 0.85} radiusY={bar * 0.5} fill={frameLight} stroke={frameDark} strokeWidth={0.5} />
        }
        switch (prim.role) {
          case 'frame':
            return (
              <Group key={i}>
                <Line points={points} stroke={frameDark} strokeWidth={bar * 1.15} lineCap="round" lineJoin="round" />
                <Line points={points} stroke={frame} strokeWidth={bar * 0.8} lineCap="round" lineJoin="round" />
              </Group>
            )
          case 'sleeve':
            return <Line key={i} points={points} stroke={sleeve ?? frame} strokeWidth={bar * 1.4} />
          case 'support':
            return <Line key={i} points={points} stroke={frameDark} strokeWidth={bar * 0.7} lineCap="round" />
          default:
            return <Line key={i} points={points} stroke={sleeve ?? frameDark} strokeWidth={bar} lineCap="round" />
        }
      })}
    </>
  )
}

// A flat plastic agility ring lying on the grass: its thickness shows as a
// darker band under the top face, with a gloss line along it.
function AgilityRingShape({ unit, color }: EquipmentShapeProps) {
  const base = color ?? EQUIPMENT.ring
  const rx = unit * 0.9
  const ry = unit * 0.42
  const band = Math.max(2, unit * 0.16)
  return (
    <>
      <Ellipse x={unit * 0.08} y={unit * 0.1} radiusX={rx} radiusY={ry} stroke="#000000" strokeWidth={band * 1.3} opacity={0.18} />
      <Ellipse y={unit * 0.05} radiusX={rx} radiusY={ry} stroke={shade(base, -0.35)} strokeWidth={band} />
      <Ellipse radiusX={rx} radiusY={ry} stroke={base} strokeWidth={band} />
      <Ellipse y={-band * 0.15} radiusX={rx} radiusY={ry} stroke={shade(base, 0.45)} strokeWidth={band * 0.22} opacity={0.8} />
    </>
  )
}

// A speed ladder: two black nylon straps with flat plastic rungs, each rung
// showing a lit top face and a shaded front edge.
function LadderShape({ unit, color }: EquipmentShapeProps) {
  const base = color ?? EQUIPMENT.rung
  const length = unit * 4
  const width = unit * 1.1
  const strap = Math.max(1, unit * 0.07)
  const rungHeight = Math.max(1.5, unit * 0.14)
  const count = 6
  return (
    <>
      <Line points={[-width / 2, -length / 2, -width / 2, length / 2]} stroke={EQUIPMENT.strap} strokeWidth={strap} />
      <Line points={[width / 2, -length / 2, width / 2, length / 2]} stroke={EQUIPMENT.strap} strokeWidth={strap} />
      {Array.from({ length: count }, (_, i) => {
        const y = -length / 2 + (length / (count - 1)) * i - rungHeight / 2
        const x = -width / 2 - unit * 0.06
        const w = width + unit * 0.12
        return (
          <Group key={i}>
            <Rect x={x + unit * 0.05} y={y + unit * 0.07} width={w} height={rungHeight} cornerRadius={rungHeight * 0.3} fill="#000000" opacity={0.2} />
            <Rect x={x} y={y + rungHeight * 0.35} width={w} height={rungHeight * 0.65} cornerRadius={rungHeight * 0.3} fill={shade(base, -0.35)} />
            <Rect x={x} y={y} width={w} height={rungHeight * 0.7} cornerRadius={rungHeight * 0.3} fill={shade(base, 0.12)} />
          </Group>
        )
      })}
    </>
  )
}

// A plastic speed hurdle — a rounded inverted U on flat feet — drawn from
// its 3D model so it turns to face any way, lit along its upper edge.
function HurdleShape({ unit, color, rotation }: EquipmentShapeProps & { rotation: number }) {
  const base = color ?? EQUIPMENT.hurdle
  const bar = Math.max(1.6, unit * 0.2)
  const shadow = footprintShadow(HURDLE_FOOTPRINT, rotation)
  return (
    <>
      <GroundShadow x={shadow.x * unit} y={shadow.y * unit} rx={shadow.rx * unit} ry={shadow.ry * unit} />
      {hurdleModel(rotation).map((prim, i) => {
        const points = prim.points.map((v) => v * unit)
        if (prim.role === 'foot') {
          return <Line key={i} points={points} stroke={shade(base, -0.15)} strokeWidth={bar * 0.8} lineCap="round" />
        }
        return (
          <Group key={i}>
            <Line points={points} stroke={shade(base, -0.3)} strokeWidth={bar} lineJoin="round" />
            <Line points={points} stroke={base} strokeWidth={bar * 0.7} lineJoin="round" />
            <Line points={points} x={-bar * 0.12} y={-bar * 0.12} stroke={shade(base, 0.45)} strokeWidth={bar * 0.2} lineJoin="round" opacity={0.8} />
          </Group>
        )
      })}
    </>
  )
}

// A rebound net: a netted steel frame leaning back on its rear legs, drawn
// from its 3D model so it turns to face any way. `color` recolours the frame.
function RebounderShape({ unit, color, rotation }: EquipmentShapeProps & { rotation: number }) {
  const steel = color ?? EQUIPMENT.steel
  const bar = Math.max(1.5, unit * 0.13)
  const shadow = footprintShadow(REBOUNDER_FOOTPRINT, rotation)
  return (
    <>
      <GroundShadow x={shadow.x * unit} y={shadow.y * unit} rx={shadow.rx * unit} ry={shadow.ry * unit} />
      {rebounderModel(rotation).map((prim, i) => {
        const points = prim.points.map((v) => v * unit)
        if (prim.kind === 'mesh') {
          return <Mesh key={i} outline={points} spacing={Math.max(2.5, unit * 0.15)} lineWidth={Math.max(0.35, unit * 0.025)} />
        }
        if (prim.role === 'leg') {
          return <Line key={i} points={points} stroke={shade(steel, -0.2)} strokeWidth={bar * 0.75} lineCap="round" />
        }
        return <Line key={i} points={points} stroke={steel} strokeWidth={bar} lineJoin="round" lineCap="round" />
      })}
    </>
  )
}

// Two short slalom poles with the gap between them marked on the grass: the
// gap is the point, so it's drawn rather than left as empty space. Turning
// the gate swings the poles round on the ground; each stays upright.
function PassingGateShape({ unit, color, rotation }: EquipmentShapeProps & { rotation: number }) {
  const base = color ?? EQUIPMENT.pole
  const poles = gatePoles(rotation)
  const height = GATE_POLE.height * unit
  return (
    <>
      <Line
        points={[poles[0].x * unit, poles[0].y * unit, poles[1].x * unit, poles[1].y * unit]}
        stroke={EQUIPMENT.netLine}
        strokeWidth={1}
        dash={[unit * 0.25, unit * 0.25]}
        opacity={0.7}
      />
      {poles.map((pole, i) => (
        <Group key={i} y={pole.y * unit - height / 2}>
          <PolePiece x={pole.x * unit} height={height} unit={unit * GATE_POLE.scale} color={base} />
        </Group>
      ))}
    </>
  )
}

/**
 * One equipment piece, drawn around the origin. Callers wrap this in a
 * positioned Konva Group. `rotation` (degrees, clockwise) turns a
 * directional piece to face a new way through its 3D model; round pieces
 * ignore it, and the caller turns a flat piece (the ladder) itself — see
 * equipmentModels' FLAT_EQUIPMENT.
 */
export function EquipmentShape({ type, unit, color, rotation = 0 }: EquipmentShapeProps & { type: EquipmentType; rotation?: number }) {
  switch (type) {
    case 'marker':
      return <MarkerShape unit={unit} color={color} />
    case 'pole':
      return <PoleShape unit={unit} color={color} />
    case 'mannequin':
      return <MannequinShape unit={unit} color={color} rotation={rotation} />
    case 'mini_goal':
    case 'full_goal':
      return <GoalShape unit={unit} color={color} kind={type} rotation={rotation} />
    case 'agility_ring':
      return <AgilityRingShape unit={unit} color={color} />
    case 'ladder':
      return <LadderShape unit={unit} color={color} />
    case 'hurdle':
      return <HurdleShape unit={unit} color={color} rotation={rotation} />
    case 'rebounder':
      return <RebounderShape unit={unit} color={color} rotation={rotation} />
    case 'passing_gate':
      return <PassingGateShape unit={unit} color={color} rotation={rotation} />
    case 'cone':
    default:
      return <ConeShape unit={unit} color={color} />
  }
}

// The colour each piece really comes in, used by the icons below when no
// override is given (the canvas shapes default the same way).
const DEFAULT_PAINT: Record<EquipmentType, string> = {
  cone: EQUIPMENT.cone,
  marker: EQUIPMENT.disc,
  pole: EQUIPMENT.pole,
  mannequin: EQUIPMENT.mannequin,
  mini_goal: EQUIPMENT.goalSleeve,
  full_goal: EQUIPMENT.goalWhite,
  agility_ring: EQUIPMENT.ring,
  ladder: EQUIPMENT.rung,
  hurdle: EQUIPMENT.hurdle,
  rebounder: EQUIPMENT.steel,
  passing_gate: EQUIPMENT.pole,
}

// The same pieces as small SVG, for the tool rail and the equipment panel.
// Drawn on a 24x24 viewBox around a centre of (12, 12) — the same forms and
// colours as the canvas, with two-tone shading in place of gradients, which
// is all a 22px icon can carry.
export function EquipmentIcon({ type, color }: { type: EquipmentType; color?: string }) {
  const paint = color ?? DEFAULT_PAINT[type]
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
      <g transform="translate(12 12)">{ICON_BODY[type](paint)}</g>
    </svg>
  )
}

const ICON_BODY: Record<EquipmentType, (paint: string) => React.ReactNode> = {
  cone: (p) => (
    <>
      <polygon points="-9.5,6.5 0,9.8 9.5,6.5 0,3.5" fill={shade(p, -0.1)} />
      <polygon points="-1.2,-10 1.2,-10 5.5,6.5 -5.5,6.5" fill={p} />
      <polygon points="-1.2,-10 -0.4,-10 -2.6,6.5 -5.5,6.5" fill={shade(p, -0.25)} />
      <polygon points="0,-10 0.8,-10 -0.2,6.5 -1.6,6.5" fill={shade(p, 0.3)} />
    </>
  ),
  marker: (p) => (
    <>
      <path d="M-9.5,3 Q-5,-2.5 -3.5,-3.5 L3.5,-3.5 Q5,-2.5 9.5,3 C9.5,7.5 -9.5,7.5 -9.5,3 Z" fill={p} />
      <path d="M-9.5,3 C-9.5,7.5 9.5,7.5 9.5,3 C9.5,5.5 -9.5,5.5 -9.5,3 Z" fill={shade(p, -0.25)} />
      <ellipse cy="-3.5" rx="3.5" ry="1.3" fill={shade(p, -0.5)} />
    </>
  ),
  pole: (p) => (
    <>
      <ellipse cy="9" rx="6" ry="2" fill={EQUIPMENT.rubber} />
      <rect x="-1.2" y="-10.5" width="2.4" height="19" fill={p} />
      <rect x="-1.4" y="-0.5" width="2.8" height="1" fill={EQUIPMENT.rubber} />
    </>
  ),
  mannequin: (p) => (
    <>
      <circle cy="-9" r="1.8" fill="none" stroke={p} strokeWidth="1.2" />
      <rect x="-5" y="-7" width="10" height="9" rx="1" fill={p} opacity="0.45" stroke={p} strokeWidth="1.2" />
      <path d="M-4.5,2 Q-4.5,6 -2.8,7.5 L-2.8,10 M-1.5,2 L0,7.2 L1.5,2 M0,7.2 L0,10 M4.5,2 Q4.5,6 2.8,7.5 L2.8,10" fill="none" stroke={p} strokeWidth="1.2" strokeLinecap="round" />
      <rect x="-4" y="10" width="8" height="1.4" fill={shade(p, -0.2)} />
    </>
  ),
  mini_goal: (p) => (
    <>
      <polygon points="-9,6 -9,-5 9,-5 9,6 7,1 -11,1" fill={EQUIPMENT.goalWhite} opacity="0.35" />
      <path d="M-9,6 L-9,-3 Q-9,-5 -7,-5 L7,-5 Q9,-5 9,-3 L9,6" fill="none" stroke={p} strokeWidth="2.2" strokeLinejoin="round" />
      <circle cx="-9" cy="6.5" r="1.2" fill={EQUIPMENT.aluminium} />
      <circle cx="9" cy="6.5" r="1.2" fill={EQUIPMENT.aluminium} />
    </>
  ),
  agility_ring: (p) => (
    <>
      <ellipse cy="0.8" rx="8.5" ry="4.2" fill="none" stroke={shade(p, -0.35)} strokeWidth="2.4" />
      <ellipse rx="8.5" ry="4.2" fill="none" stroke={p} strokeWidth="2.4" />
    </>
  ),
  full_goal: (p) => (
    <>
      <polygon points="-10,6 -10,-6 10,-6 10,6 8,1 -12,1" fill={EQUIPMENT.goalWhite} opacity="0.3" />
      <polyline points="-10,6 -10,-6 10,-6 10,6" fill="none" stroke={shade(p, -0.3)} strokeWidth="2.6" strokeLinejoin="round" />
      <polyline points="-10,6 -10,-6 10,-6 10,6" fill="none" stroke={p} strokeWidth="1.6" strokeLinejoin="round" />
    </>
  ),
  ladder: (p) => (
    <>
      <line x1="-4" y1="-11" x2="-4" y2="11" stroke={EQUIPMENT.strap} strokeWidth="1" />
      <line x1="4" y1="-11" x2="4" y2="11" stroke={EQUIPMENT.strap} strokeWidth="1" />
      {[-10, -6, -2, 2, 6, 10].map((y) => (
        <g key={y}>
          <rect x="-5" y={y - 0.6} width="10" height="1.8" rx="0.6" fill={shade(p, -0.35)} />
          <rect x="-5" y={y - 1} width="10" height="1.4" rx="0.6" fill={p} />
        </g>
      ))}
    </>
  ),
  hurdle: (p) => (
    <>
      <path d="M-7,6 L-7,-3 Q-7,-5 -5,-5 L5,-5 Q7,-5 7,-3 L7,6" fill="none" stroke={p} strokeWidth="2.2" strokeLinejoin="round" />
      <rect x="-9.5" y="5.5" width="5" height="1.6" rx="0.6" fill={shade(p, -0.2)} />
      <rect x="4.5" y="5.5" width="5" height="1.6" rx="0.6" fill={shade(p, -0.2)} />
    </>
  ),
  rebounder: (p) => (
    <>
      <polygon points="-8,5 -5,-5 9,-5 6,5" fill={EQUIPMENT.goalWhite} opacity="0.4" />
      <polygon points="-8,5 -5,-5 9,-5 6,5" fill="none" stroke={p} strokeWidth="1.8" strokeLinejoin="round" />
    </>
  ),
  passing_gate: (p) => (
    <>
      <line x1="-8" y1="7" x2="8" y2="7" stroke={shade(p, -0.3)} strokeWidth="1" strokeDasharray="2 2" />
      <ellipse cx="-8" cy="7.5" rx="3.2" ry="1.3" fill={EQUIPMENT.rubber} />
      <ellipse cx="8" cy="7.5" rx="3.2" ry="1.3" fill={EQUIPMENT.rubber} />
      <rect x="-9" y="-7" width="2" height="14" fill={p} />
      <rect x="7" y="-7" width="2" height="14" fill={p} />
    </>
  ),
}
