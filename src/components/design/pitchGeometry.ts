import type { PitchConfig } from '../../store'
import { findPreset } from './canvas/pitchPresets'

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

// Regulation dimensions, in metres. Everything below is derived from these
// plus the pitch's own width and length, rather than from a hand-authored
// constant per size — which is what lets ~35 presets share one implementation
// (rework plan Stage 7.2).
const PENALTY_BOX_WIDTH = 40.32
const PENALTY_BOX_DEPTH = 16.5
const SIX_YARD_WIDTH = 18.32
const SIX_YARD_DEPTH = 5.5
const CENTER_CIRCLE_RADIUS = 9.15
const PENALTY_SPOT_DISTANCE = 11
const GOAL_WIDTH = 7.32

// A space smaller than this in either axis can't carry regulation markings
// without them swallowing the pitch, so it gets a training grid instead.
const MIN_MARKED_WIDTH = PENALTY_BOX_WIDTH + 4
const MIN_MARKED_LENGTH = PENALTY_BOX_DEPTH * 2

// Boxes are scaled down rather than dropped when a pitch is narrower than a
// regulation one — a 5v5 pitch still has a penalty area, just a smaller one.
// Capped at the regulation size so a wide pitch doesn't get an absurd one.
function boxScale(widthMeters: number): number {
  return Math.min(1, widthMeters / (PENALTY_BOX_WIDTH + 4))
}

// How many goal ends to mark. A preset says so directly where it matters — a
// half pitch is long enough for boxes at both ends but only has one goal — and
// otherwise it comes from whether the length can hold two boxes and a centre
// circle between them.
function goalEndsFor(config: PitchConfig, lengthMeters: number, depth: number): 0 | 1 | 2 {
  const preset = findPreset(config.preset)
  if (preset?.goalEnds !== undefined) return preset.goalEnds
  if (lengthMeters >= depth * 2 + CENTER_CIRCLE_RADIUS * 2) return 2
  if (lengthMeters >= depth * 2) return 1
  return 0
}

// Which style of markings a pitch gets. An explicit choice on the config wins;
// otherwise it's "full markings when the pitch is big enough for a penalty
// box, a plain boundary and a grid otherwise".
function markingStyle(config: PitchConfig): 'full' | 'grid' | 'none' {
  if (config.markings) return config.markings
  const preset = findPreset(config.preset)
  if (preset?.markings) return preset.markings
  return config.widthMeters >= MIN_MARKED_WIDTH && config.lengthMeters >= MIN_MARKED_LENGTH ? 'full' : 'grid'
}

// Regulation markings, scaled to the pitch: boundary, a penalty and six-yard
// box at each marked end, the halfway line, and a centre circle where there's
// room for one.
function fullMarkings(config: PitchConfig): PitchMarkings {
  const { widthMeters, lengthMeters } = config
  const scale = boxScale(widthMeters)
  const boxWidth = PENALTY_BOX_WIDTH * scale
  const boxDepth = PENALTY_BOX_DEPTH * scale
  const sixWidth = SIX_YARD_WIDTH * scale
  const sixDepth = SIX_YARD_DEPTH * scale
  const spot = PENALTY_SPOT_DISTANCE * scale
  const boxX = (widthMeters - boxWidth) / 2
  const sixX = (widthMeters - sixWidth) / 2
  const ends = goalEndsFor(config, lengthMeters, boxDepth)

  const rects: MetersRect[] = [{ x: 0, y: 0, w: widthMeters, h: lengthMeters }]
  const lines: MetersLine[] = []
  const circles: MetersCircle[] = []
  const dots: MetersPoint[] = []

  if (ends >= 1) {
    rects.push({ x: boxX, y: 0, w: boxWidth, h: boxDepth })
    rects.push({ x: sixX, y: 0, w: sixWidth, h: sixDepth })
    dots.push({ x: widthMeters / 2, y: spot })
  }
  if (ends >= 2) {
    rects.push({ x: boxX, y: lengthMeters - boxDepth, w: boxWidth, h: boxDepth })
    rects.push({ x: sixX, y: lengthMeters - sixDepth, w: sixWidth, h: sixDepth })
    dots.push({ x: widthMeters / 2, y: lengthMeters - spot })
  }

  // With one goal the far edge *is* the halfway line, which is what a coach
  // means by "attacking half". With two it runs through the middle.
  const halfwayY = ends === 1 ? lengthMeters : lengthMeters / 2
  lines.push({ x1: 0, y1: halfwayY, x2: widthMeters, y2: halfwayY })

  // Scaled with the boxes rather than held at the regulation 9.15m: a futsal
  // court is 20m wide, and a regulation circle on it would swallow the pitch.
  // Still only drawn where it fits and stays clear of the boxes — a clipped
  // circle reads worse than no circle at all.
  const radius = CENTER_CIRCLE_RADIUS * scale
  const roomLengthways = halfwayY - radius >= boxDepth && halfwayY + radius <= lengthMeters
  if (ends === 2 && radius > 1 && roomLengthways) {
    circles.push({ cx: widthMeters / 2, cy: halfwayY, r: radius })
    dots.push({ x: widthMeters / 2, y: halfwayY })
  }

  // A marked end with no room for a box still gets a goal mouth, so the
  // direction of play is never ambiguous.
  if (ends === 0) {
    lines.push(goalMouth(widthMeters, 0))
    lines.push(goalMouth(widthMeters, lengthMeters))
  }

  return { widthMeters, lengthMeters, rects, lines, circles, dots }
}

function goalMouth(widthMeters: number, y: number): MetersLine {
  const goal = Math.min(GOAL_WIDTH, widthMeters * 0.4)
  return { x1: (widthMeters - goal) / 2, y1: y, x2: (widthMeters + goal) / 2, y2: y, strokeWidthScale: 3 }
}

// A training space: boundary, a thirds-by-thirds possession grid, and goal
// mouths top and bottom. The same treatment the phases-era "quarter pitch"
// had, now applied to every space too small to mark properly.
function gridMarkings(config: PitchConfig): PitchMarkings {
  const { widthMeters, lengthMeters } = config
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
      goalMouth(widthMeters, 0),
      goalMouth(widthMeters, lengthMeters),
    ],
    circles: [],
    dots: [],
  }
}

function bareMarkings(config: PitchConfig): PitchMarkings {
  return {
    widthMeters: config.widthMeters,
    lengthMeters: config.lengthMeters,
    rects: [{ x: 0, y: 0, w: config.widthMeters, h: config.lengthMeters }],
    lines: [],
    circles: [],
    dots: [],
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

export function getPitchMarkings(config: PitchConfig): PitchMarkings {
  const style = markingStyle(config)
  const canonical =
    style === 'full' ? fullMarkings(config) : style === 'grid' ? gridMarkings(config) : bareMarkings(config)
  return config.orientation === 'landscape' ? transpose(canonical) : canonical
}

export function getPitchAspectRatio(config: PitchConfig): number {
  const { widthMeters, lengthMeters } = getPitchMarkings(config)
  return widthMeters / lengthMeters
}

// --- Overlays (rework plan Stage 7.4) --------------------------------------
//
// Grid systems drawn over the pitch rather than markings of it. Rects are
// filled at the config's overlay opacity; lines are stroked. Authored in the
// same canonical portrait metres space and transposed alongside the markings.

export interface PitchOverlayGeometry {
  rects: MetersRect[]
  lines: MetersLine[]
}

function overlayGeometry(config: PitchConfig): PitchOverlayGeometry {
  const { widthMeters: w, lengthMeters: l } = config
  const rects: MetersRect[] = []
  const lines: MetersLine[] = []

  const across = (y: number) => lines.push({ x1: 0, y1: y, x2: w, y2: y, dashed: true })
  const along = (x: number) => lines.push({ x1: x, y1: 0, x2: x, y2: l, dashed: true })

  for (const overlay of config.overlays ?? []) {
    switch (overlay) {
      case 'thirds':
        across(l / 3)
        across((l * 2) / 3)
        break
      case 'lanes':
        for (let i = 1; i < 5; i++) along((w * i) / 5)
        break
      case 'channels': {
        // The coaching-standard five: two wide channels outside the penalty
        // box, two half-spaces between it and the six-yard box, and the
        // central channel. Derived from the real box widths where they fit,
        // and from even fifths where the pitch is too narrow for them.
        const scale = boxScale(w)
        const boxEdge = (w - PENALTY_BOX_WIDTH * scale) / 2
        const sixEdge = (w - SIX_YARD_WIDTH * scale) / 2
        if (boxEdge > 0.5 && sixEdge > boxEdge) {
          along(boxEdge)
          along(sixEdge)
          along(w - sixEdge)
          along(w - boxEdge)
        } else {
          for (let i = 1; i < 5; i++) along((w * i) / 5)
        }
        break
      }
      case 'half_spaces': {
        // The two corridors between the penalty box and the six-yard box,
        // shaded rather than outlined — a half-space is an area, not a line.
        const scale = boxScale(w)
        const boxEdge = (w - PENALTY_BOX_WIDTH * scale) / 2
        const sixEdge = (w - SIX_YARD_WIDTH * scale) / 2
        const band = Math.max(0, sixEdge - boxEdge)
        if (band > 0.5) {
          rects.push({ x: boxEdge, y: 0, w: band, h: l })
          rects.push({ x: w - sixEdge, y: 0, w: band, h: l })
        }
        break
      }
      case 'pep_zones':
        // Five channels across, four bands along — the twenty-zone grid.
        for (let i = 1; i < 5; i++) along((w * i) / 5)
        for (let i = 1; i < 4; i++) across((l * i) / 4)
        break
      case 'training_grid': {
        // Ten-metre squares, the unit a coach lays a grid out in.
        const step = 10
        for (let x = step; x < w - 0.01; x += step) along(x)
        for (let y = step; y < l - 0.01; y += step) across(y)
        break
      }
    }
  }

  return { rects, lines }
}

export function getPitchOverlays(config: PitchConfig): PitchOverlayGeometry {
  const canonical = overlayGeometry(config)
  if (config.orientation !== 'landscape') return canonical
  return {
    rects: canonical.rects.map((r) => ({ x: r.y, y: r.x, w: r.h, h: r.w })),
    lines: canonical.lines.map((line) => ({ ...line, x1: line.y1, y1: line.x1, x2: line.y2, y2: line.x2 })),
  }
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
