import type { PitchOrientation, PitchSize } from '../../store'

// Static pitch markings for Phase 2a (gaffer_mvp_build_steps.md), extended
// in the Upgrade Phase 2A (UPGRADE_IMPLEMENTATION_PLAN.md) to 4 sizes x 2
// orientations. Everything here is expressed in meters on a real (or
// nominal, for the smaller sizes) pitch — never in normalized 0-1 phase
// coordinates — because circles need an equal px-per-meter scale on both
// axes to render as true circles, and meters make that scale factor
// explicit. `PitchCanvas` converts meters to pixels once it knows the
// Stage's actual width/height.
//
// This is decorative geometry, not a regulation pitch diagram — dimensions
// are realistic ballpark figures (standard 11-a-side pitch: 105m x 68m),
// not exact competition markings.
//
// Every size below is authored once, canonically, in "portrait" meters
// space (widthMeters = the lateral/goal-width axis, lengthMeters = the
// goal-to-goal axis — whichever is naturally narrower isn't the point;
// what matters is picking one fixed axis as `widthMeters` consistently).
// `getPitchMarkings` transposes that canonical authoring for 'landscape' —
// a mechanical x/y swap, not a second hand-authored marking set — so
// orientation is purely a display choice independent of pitch size, per
// the roadmap ("the coach can choose the amount of space appropriate for
// the drill").

export interface PitchDimensions {
  widthMeters: number
  lengthMeters: number
}

export interface MetersRect {
  x: number
  y: number
  w: number
  h: number
}

export interface MetersLine {
  x1: number
  y1: number
  x2: number
  y2: number
  dashed?: boolean
  strokeWidthScale?: number // multiplier on the base line stroke width; goal mouths etc. read thicker
}

export interface MetersCircle {
  cx: number
  cy: number
  r: number
}

export interface MetersPoint {
  x: number
  y: number
}

export interface PitchMarkings extends PitchDimensions {
  rects: MetersRect[]
  lines: MetersLine[]
  circles: MetersCircle[]
  dots: MetersPoint[]
}

const FULL: PitchMarkings = (() => {
  const widthMeters = 68
  const lengthMeters = 105
  const penaltyBoxWidth = 40.32
  const penaltyBoxDepth = 16.5
  const sixYardWidth = 18.32
  const sixYardDepth = 5.5
  const centerCircleRadius = 9.15
  const penaltySpotDistance = 11

  const penaltyBoxX = (widthMeters - penaltyBoxWidth) / 2
  const sixYardX = (widthMeters - sixYardWidth) / 2

  return {
    widthMeters,
    lengthMeters,
    rects: [
      { x: 0, y: 0, w: widthMeters, h: lengthMeters }, // outer boundary
      { x: penaltyBoxX, y: 0, w: penaltyBoxWidth, h: penaltyBoxDepth }, // penalty box, top
      { x: sixYardX, y: 0, w: sixYardWidth, h: sixYardDepth }, // six-yard box, top
      { x: penaltyBoxX, y: lengthMeters - penaltyBoxDepth, w: penaltyBoxWidth, h: penaltyBoxDepth }, // penalty box, bottom
      { x: sixYardX, y: lengthMeters - sixYardDepth, w: sixYardWidth, h: sixYardDepth }, // six-yard box, bottom
    ],
    lines: [
      { x1: 0, y1: lengthMeters / 2, x2: widthMeters, y2: lengthMeters / 2 }, // halfway line
    ],
    circles: [{ cx: widthMeters / 2, cy: lengthMeters / 2, r: centerCircleRadius }],
    dots: [
      { x: widthMeters / 2, y: lengthMeters / 2 }, // center spot
      { x: widthMeters / 2, y: penaltySpotDistance }, // penalty spot, top
      { x: widthMeters / 2, y: lengthMeters - penaltySpotDistance }, // penalty spot, bottom
    ],
  }
})()

// Full width, 3/4 length, cropped from one end — keeps the near-end penalty
// box/six-yard box plus the halfway line and center circle (both comfortably
// within a 78.75m length), drops the far-end boxes entirely. Models a coach
// wanting "most of the pitch, focused on one attacking end."
const THREE_QUARTER: PitchMarkings = (() => {
  const widthMeters = 68
  const lengthMeters = 105 * 0.75 // 78.75
  const penaltyBoxWidth = 40.32
  const penaltyBoxDepth = 16.5
  const sixYardWidth = 18.32
  const sixYardDepth = 5.5
  const centerCircleRadius = 9.15
  const penaltySpotDistance = 11
  const halfwayY = 105 / 2 // 52.5 — the real pitch's halfway line, well within 78.75

  const penaltyBoxX = (widthMeters - penaltyBoxWidth) / 2
  const sixYardX = (widthMeters - sixYardWidth) / 2

  return {
    widthMeters,
    lengthMeters,
    rects: [
      { x: 0, y: 0, w: widthMeters, h: lengthMeters },
      { x: penaltyBoxX, y: 0, w: penaltyBoxWidth, h: penaltyBoxDepth },
      { x: sixYardX, y: 0, w: sixYardWidth, h: sixYardDepth },
    ],
    lines: [{ x1: 0, y1: halfwayY, x2: widthMeters, y2: halfwayY }],
    circles: [{ cx: widthMeters / 2, cy: halfwayY, r: centerCircleRadius }],
    dots: [
      { x: widthMeters / 2, y: halfwayY },
      { x: widthMeters / 2, y: penaltySpotDistance },
    ],
  }
})()

// Full width, half length, cropped from one end at exactly the real
// halfway line — near-end penalty/six-yard box plus a halfway line running
// along the far edge. No center circle: at this length it would render
// clipped against the boundary, which reads worse than just omitting it
// (same simplification the old small-sided/quarter markings already made).
const HALF: PitchMarkings = (() => {
  const widthMeters = 68
  const lengthMeters = 105 / 2 // 52.5
  const penaltyBoxWidth = 40.32
  const penaltyBoxDepth = 16.5
  const sixYardWidth = 18.32
  const sixYardDepth = 5.5
  const penaltySpotDistance = 11

  const penaltyBoxX = (widthMeters - penaltyBoxWidth) / 2
  const sixYardX = (widthMeters - sixYardWidth) / 2

  return {
    widthMeters,
    lengthMeters,
    rects: [
      { x: 0, y: 0, w: widthMeters, h: lengthMeters },
      { x: penaltyBoxX, y: 0, w: penaltyBoxWidth, h: penaltyBoxDepth },
      { x: sixYardX, y: 0, w: sixYardWidth, h: sixYardDepth },
    ],
    lines: [{ x1: 0, y1: lengthMeters, x2: widthMeters, y2: lengthMeters }], // halfway line, on the far edge
    circles: [],
    dots: [{ x: widthMeters / 2, y: penaltySpotDistance }],
  }
})()

// Nominal dimensions, not a regulation size — small drill/possession-grid
// spaces vary a lot in practice. Rendered as a boundary + a possession grid
// (thirds x thirds) plus thickened goal-mouth hints at top/bottom center.
const QUARTER: PitchMarkings = (() => {
  const widthMeters = 30
  const lengthMeters = 40
  const goalWidth = 6

  const thirdX = widthMeters / 3
  const thirdY = lengthMeters / 3

  return {
    widthMeters,
    lengthMeters,
    rects: [{ x: 0, y: 0, w: widthMeters, h: lengthMeters }],
    lines: [
      { x1: thirdX, y1: 0, x2: thirdX, y2: lengthMeters, dashed: true },
      { x1: thirdX * 2, y1: 0, x2: thirdX * 2, y2: lengthMeters, dashed: true },
      { x1: 0, y1: thirdY, x2: widthMeters, y2: thirdY, dashed: true },
      { x1: 0, y1: thirdY * 2, x2: widthMeters, y2: thirdY * 2, dashed: true },
      // goal-mouth hints
      { x1: (widthMeters - goalWidth) / 2, y1: 0, x2: (widthMeters + goalWidth) / 2, y2: 0, strokeWidthScale: 3 },
      {
        x1: (widthMeters - goalWidth) / 2,
        y1: lengthMeters,
        x2: (widthMeters + goalWidth) / 2,
        y2: lengthMeters,
        strokeWidthScale: 3,
      },
    ],
    circles: [],
    dots: [],
  }
})()

function getCanonicalMarkings(size: PitchSize): PitchMarkings {
  switch (size) {
    case 'full':
      return FULL
    case 'three_quarter':
      return THREE_QUARTER
    case 'half':
      return HALF
    case 'quarter':
      return QUARTER
  }
}

// Landscape = the canonical portrait authoring above, transposed: every
// x/y (and rect w/h) swapped, and widthMeters/lengthMeters swapped to
// match. A mechanical transform, not a second marking set to keep in sync.
function transpose(markings: PitchMarkings): PitchMarkings {
  return {
    widthMeters: markings.lengthMeters,
    lengthMeters: markings.widthMeters,
    rects: markings.rects.map((r) => ({ x: r.y, y: r.x, w: r.h, h: r.w })),
    lines: markings.lines.map((l) => ({ ...l, x1: l.y1, y1: l.x1, x2: l.y2, y2: l.x2 })),
    circles: markings.circles.map((c) => ({ ...c, cx: c.cy, cy: c.cx })),
    dots: markings.dots.map((d) => ({ x: d.y, y: d.x })),
  }
}

export function getPitchMarkings(size: PitchSize, orientation: PitchOrientation): PitchMarkings {
  const canonical = getCanonicalMarkings(size)
  return orientation === 'landscape' ? transpose(canonical) : canonical
}

export function getPitchAspectRatio(size: PitchSize, orientation: PitchOrientation): number {
  const { widthMeters, lengthMeters } = getPitchMarkings(size, orientation)
  return widthMeters / lengthMeters
}

// Team labels in a phase are freeform text (see DrillPhase in store/types.ts
// — the 0.5.1 hardcoded phase uses "attack"), so colors are assigned by
// first-seen order rather than matching specific known strings. Stable for a
// given phase because `players` is rendered in array order every time.
export function assignTeamColors(teamLabels: string[], palette: readonly string[], fallback: string) {
  const map = new Map<string, string>()
  for (const label of teamLabels) {
    if (map.has(label)) continue
    map.set(label, palette[map.size] ?? fallback)
  }
  return map
}
