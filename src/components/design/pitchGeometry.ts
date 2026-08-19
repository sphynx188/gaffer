import type { PitchFormat } from '../../store'

// Static pitch markings for Phase 2a (gaffer_mvp_build_steps.md). Everything
// here is expressed in meters on a real (or nominal, for small-sided)
// pitch — never in normalized 0-1 phase coordinates — because circles need
// an equal px-per-meter scale on both axes to render as true circles, and
// meters make that scale factor explicit. `PitchCanvas` converts meters to
// pixels once it knows the Stage's actual width/height.
//
// This is decorative geometry, not a regulation pitch diagram — dimensions
// are realistic ballpark figures (standard 11-a-side pitch: 105m x 68m),
// not exact competition markings.

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

const ELEVEN_V_ELEVEN: PitchMarkings = (() => {
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

// Nominal dimensions, not a regulation size — small-sided formats vary a lot
// in practice. Rendered as a boundary + a possession grid (thirds x thirds)
// per the project plan's "smaller drill/possession-grid layouts" pitch
// format, plus thickened goal-mouth hints at top/bottom center.
const SMALL_SIDED: PitchMarkings = (() => {
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

export function getPitchMarkings(format: PitchFormat): PitchMarkings {
  return format === '11v11' ? ELEVEN_V_ELEVEN : SMALL_SIDED
}

export function getPitchAspectRatio(format: PitchFormat): number {
  const { widthMeters, lengthMeters } = getPitchMarkings(format)
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
