import { EQUIPMENT_BOUNDS } from '../pitchTheme'

// Upright equipment as small 3D models (2026-10-28). The pieces are drawn
// slightly side-on, like a product shot — so rotating the finished picture
// flat on the pitch, as the canvas used to, laid a goal on its side rather
// than turning it to face a new way. Instead each directional piece is
// described here in 3D, turned about its vertical axis by the piece's
// rotation, and projected through one fixed camera: a goal turned 90° shows
// its side, turned 180° its back with the net in front of the frame.
//
// Coordinates are EquipmentShapes' drawing units around the piece's origin:
// `x` runs right, `z` toward the viewer (down the screen) and `h` up. The
// camera looks down on the pitch at an angle, which foreshortens ground
// depth by DEPTH_SQUASH. Rotation follows Konva's: degrees, clockwise.
export const DEPTH_SQUASH = 0.45

export interface Point3 {
  x: number
  z: number
  h: number
}

// One drawable part of a model, already projected to 2D (flat x/y points)
// and tagged with its depth, so a model's parts can be painted far to near.
export interface Prim {
  kind: 'tube' | 'mesh' | 'joint'
  role: string
  points: number[]
  depth: number
}

interface Part {
  kind: Prim['kind']
  role: string
  points: Point3[]
  // Nudges a part in front of whatever it shares a depth with — a sleeve
  // over its tube, a frame over its net.
  bias?: number
}

const P = (x: number, z: number, h: number): Point3 => ({ x, z, h })

export function projector(rotation: number) {
  const t = (rotation * Math.PI) / 180
  const c = Math.cos(t)
  const s = Math.sin(t)
  return {
    c,
    s,
    point: (p: Point3): [number, number] => [p.x * c - p.z * s, (p.x * s + p.z * c) * DEPTH_SQUASH - p.h],
    depth: (p: Point3) => p.x * s + p.z * c,
  }
}

function build(rotation: number, parts: Part[]): Prim[] {
  const view = projector(rotation)
  return parts
    .map((part) => ({
      kind: part.kind,
      role: part.role,
      points: part.points.flatMap((p) => view.point(p)),
      depth: part.points.reduce((sum, p) => sum + view.depth(p), 0) / part.points.length + (part.bias ?? 0),
    }))
    .sort((a, b) => a.depth - b.depth)
}

// A quarter arc in the upright x/h plane (z = 0), for rounded frame corners.
function arc(cx: number, ch: number, r: number, from: number, to: number): Point3[] {
  return Array.from({ length: 6 }, (_, i) => {
    const a = ((from + ((to - from) * i) / 5) * Math.PI) / 180
    return P(cx + r * Math.cos(a), 0, ch + r * Math.sin(a))
  })
}

// An inverted U standing at z = 0: two posts and a top bar with rounded
// corners, split so each piece sorts by its own depth.
function uFrame(w: number, height: number, r: number) {
  return {
    left: [P(-w, 0, 0), P(-w, 0, height - r), ...arc(-w + r, height - r, r, 180, 90)],
    bar: [P(-w + r, 0, height), P(w - r, 0, height)],
    right: [...arc(w - r, height - r, r, 90, 0), P(w, 0, 0)],
  }
}

// A box goal: a front frame on the goal line, a rear ground bar `depth`
// behind it, side bars, sloping side supports, and the net draped from the
// crossbar back to the rear bar. The mini goal is the folding kind with
// rounded top corners and sleeves; the full goal has square corners.
export const GOAL_SPEC = {
  mini_goal: { w: 1.1, height: 1.1, depth: 0.9, corner: 0.24, sleeves: true },
  full_goal: { w: 1.8, height: 1.7, depth: 1.2, corner: 0, sleeves: false },
} as const

export function goalModel(type: keyof typeof GOAL_SPEC, rotation: number): Prim[] {
  const { w, height, depth, corner, sleeves } = GOAL_SPEC[type]
  const front = uFrame(w, height, corner)
  const parts: Part[] = [
    { kind: 'tube', role: 'base', points: [P(-w, -depth, 0), P(w, -depth, 0)] },
    { kind: 'tube', role: 'base', points: [P(-w, 0, 0), P(-w, -depth, 0)] },
    { kind: 'tube', role: 'base', points: [P(w, 0, 0), P(w, -depth, 0)] },
    { kind: 'tube', role: 'support', points: [P(-w, 0, height * 0.75), P(-w, -depth, 0)] },
    { kind: 'tube', role: 'support', points: [P(w, 0, height * 0.75), P(w, -depth, 0)] },
    { kind: 'mesh', role: 'net', points: [P(-w, 0, height), P(w, 0, height), P(w, -depth, 0), P(-w, -depth, 0)] },
    { kind: 'mesh', role: 'net', points: [P(-w, 0, 0), P(-w, 0, height), P(-w, -depth, 0)] },
    { kind: 'mesh', role: 'net', points: [P(w, 0, 0), P(w, 0, height), P(w, -depth, 0)] },
    { kind: 'tube', role: 'frame', points: front.left, bias: 0.01 },
    { kind: 'tube', role: 'frame', points: front.bar, bias: 0.01 },
    { kind: 'tube', role: 'frame', points: front.right, bias: 0.01 },
    { kind: 'joint', role: 'foot', points: [P(-w, 0, 0)], bias: 0.03 },
    { kind: 'joint', role: 'foot', points: [P(w, 0, 0)], bias: 0.03 },
  ]
  if (sleeves) {
    parts.push(
      { kind: 'tube', role: 'sleeve', points: [P(-w, 0, 0.12), P(-w, 0, height - corner)], bias: 0.02 },
      { kind: 'tube', role: 'sleeve', points: [P(w, 0, 0.12), P(w, 0, height - corner)], bias: 0.02 },
      { kind: 'tube', role: 'sleeve', points: [P(-w + corner, 0, height), P(-0.1, 0, height)], bias: 0.02 },
      { kind: 'tube', role: 'sleeve', points: [P(0.1, 0, height), P(w - corner, 0, height)], bias: 0.02 },
    )
  }
  return build(rotation, parts)
}

export function goalFootprint(type: keyof typeof GOAL_SPEC): Point3[] {
  const { w, depth } = GOAL_SPEC[type]
  return [P(-w, 0, 0), P(w, 0, 0), P(w, -depth, 0), P(-w, -depth, 0)]
}

// A speed hurdle: an inverted U on two flat feet that run front to back.
export function hurdleModel(rotation: number): Prim[] {
  const frame = uFrame(0.9, 1.1, 0.25)
  return build(rotation, [
    { kind: 'tube', role: 'foot', points: [P(-0.9, -0.3, 0), P(-0.9, 0.3, 0)] },
    { kind: 'tube', role: 'foot', points: [P(0.9, -0.3, 0), P(0.9, 0.3, 0)] },
    { kind: 'tube', role: 'frame', points: [...frame.left, ...frame.bar, ...frame.right], bias: 0.01 },
  ])
}

export const HURDLE_FOOTPRINT = [P(-0.9, -0.3, 0), P(0.9, -0.3, 0), P(0.9, 0.3, 0), P(-0.9, 0.3, 0)]

// A rebound net: a netted frame leaning back, propped on two rear legs.
export function rebounderModel(rotation: number): Prim[] {
  const bl = P(-0.95, 0, 0)
  const br = P(0.95, 0, 0)
  const tr = P(0.95, -0.45, 1.15)
  const tl = P(-0.95, -0.45, 1.15)
  return build(rotation, [
    { kind: 'tube', role: 'leg', points: [tl, P(-0.95, -1, 0)] },
    { kind: 'tube', role: 'leg', points: [tr, P(0.95, -1, 0)] },
    { kind: 'mesh', role: 'net', points: [bl, tl, tr, br] },
    { kind: 'tube', role: 'frame', points: [bl, tl, tr, br, bl], bias: 0.01 },
  ])
}

export const REBOUNDER_FOOTPRINT = [P(-0.95, 0, 0), P(0.95, 0, 0), P(0.95, -1, 0), P(-0.95, -1, 0)]

// The mannequin is one flat upright panel, so turning it is an affine
// transform of its 2D drawing: its width foreshortens by cos and its sides
// shear up or down the screen by sin. Edge-on it would vanish, so it keeps a
// sliver of width.
export function mannequinTransform(rotation: number) {
  const view = projector(rotation)
  const scaleX = Math.sign(view.c || 1) * Math.max(Math.abs(view.c), 0.15)
  return { scaleX, skewY: view.s * DEPTH_SQUASH }
}

// The passing gate's two poles stand 1 unit either side of the origin; they
// draw at 0.8 scale, 1.6 units tall. Returns each pole's ground point, far
// pole first.
export const GATE_POLE = { offset: 1, scale: 0.8, height: 1.6 }

export function gatePoles(rotation: number): Array<{ x: number; y: number }> {
  const view = projector(rotation)
  return [-GATE_POLE.offset, GATE_POLE.offset]
    .map((x) => ({ point: view.point(P(x, 0, 0)), depth: view.depth(P(x, 0, 0)) }))
    .sort((a, b) => a.depth - b.depth)
    .map(({ point: [x, y] }) => ({ x, y }))
}

// A soft shadow under a footprint: centred on it, wide and deep enough to
// cover it as projected.
export function footprintShadow(footprint: Point3[], rotation: number) {
  const view = projector(rotation)
  const pts = footprint.map((p) => view.point(p))
  const xs = pts.map(([x]) => x)
  const ys = pts.map(([, y]) => y)
  const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)]
  return { x: (minX + maxX) / 2 + 0.15, y: (minY + maxY) / 2, rx: (maxX - minX) / 2 + 0.25, ry: Math.max((maxY - minY) / 2, 0.15) + 0.15 }
}

type Box = { x0: number; y0: number; x1: number; y1: number }

function boundsOf(prims: Prim[], pad: number): Box {
  const xs: number[] = []
  const ys: number[] = []
  for (const prim of prims) {
    for (let i = 0; i < prim.points.length; i += 2) {
      xs.push(prim.points[i])
      ys.push(prim.points[i + 1])
    }
  }
  return { x0: Math.min(...xs) - pad, y0: Math.min(...ys) - pad, x1: Math.max(...xs) + pad, y1: Math.max(...ys) + pad }
}

/**
 * A piece's drawn bounding box, in drawing units around its origin, for the
 * selection outline and the drag bound. Turned pieces are measured from
 * their projected model; the rest come from pitchTheme's EQUIPMENT_BOUNDS
 * (a flat piece like the ladder is turned whole, outline and all, by the
 * canvas instead).
 */
export function equipmentBounds(type: string, rotation: number): Box {
  switch (type) {
    case 'mini_goal':
    case 'full_goal':
      return boundsOf(goalModel(type, rotation), 0.1)
    case 'hurdle':
      return boundsOf(hurdleModel(rotation), 0.12)
    case 'rebounder':
      return boundsOf(rebounderModel(rotation), 0.08)
    case 'mannequin': {
      const box = EQUIPMENT_BOUNDS.mannequin
      const { scaleX, skewY } = mannequinTransform(rotation)
      const corners = [box.x0, box.x1].flatMap((x) => [box.y0, box.y1].map((y) => [x * scaleX, skewY * x + y]))
      return {
        x0: Math.min(...corners.map(([x]) => x)),
        y0: Math.min(...corners.map(([, y]) => y)),
        x1: Math.max(...corners.map(([x]) => x)),
        y1: Math.max(...corners.map(([, y]) => y)),
      }
    }
    case 'passing_gate': {
      // A pole spans ±0.48 across and from 1.62 above its ground point to
      // 0.16 below, at the gate's 0.8 scale.
      const poles = gatePoles(rotation)
      return {
        x0: Math.min(...poles.map((p) => p.x)) - 0.48,
        y0: Math.min(...poles.map((p) => p.y)) - 1.62,
        x1: Math.max(...poles.map((p) => p.x)) + 0.48,
        y1: Math.max(...poles.map((p) => p.y)) + 0.16,
      }
    }
    default:
      return EQUIPMENT_BOUNDS[type] ?? EQUIPMENT_BOUNDS.cone
  }
}

// Pieces that lie flat on the grass and so are turned whole, in the plane of
// the pitch, rather than through the 3D model. Round pieces (cone, disc,
// pole, ring) look the same from every side and ignore rotation entirely.
export const FLAT_EQUIPMENT = new Set(['ladder'])

// Pieces that look the same from every side, so turning them changes
// nothing: the canvas ignores their rotation and the properties panel offers
// no rotation control for them.
export const ROUND_EQUIPMENT = new Set(['cone', 'marker', 'pole', 'agility_ring'])
