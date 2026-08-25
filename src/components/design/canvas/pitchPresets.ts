import type { PitchOrientation } from '../../../store'

// The pitch preset table (rework plan Stage 7.1), transcribed from the
// inventory in §1 of that plan. Every preset is keyed to real metre
// dimensions, which is what makes the timeline's speed readout mean anything —
// "105m in one second" is only a red flag if the pitch really is 105m long.
//
// Dimensions are always the *canonical portrait* pair: `widthMeters` is the
// lateral (goal-to-goal-width) axis and `lengthMeters` the goal-to-goal one,
// the same convention pitchGeometry.ts has always authored in. Orientation is
// applied on top by transpose().

export type PitchFamily = 'classic' | 'small_sided' | 'functional' | 'rondo' | 'shape'

export const PITCH_FAMILIES: { id: PitchFamily; label: string }[] = [
  { id: 'classic', label: 'Classic' },
  { id: 'small_sided', label: 'Small-sided' },
  { id: 'functional', label: 'Functional' },
  { id: 'rondo', label: 'Rondo' },
  { id: 'shape', label: 'Shape' },
]

export interface PitchPreset {
  id: string
  label: string
  family: PitchFamily
  widthMeters: number
  lengthMeters: number
  // The unit the coach thinks of this space in. Rondo grids are traditionally
  // paced in yards; everything else is metric. Stored dimensions stay metric
  // either way — this only decides how the panel writes them.
  units?: 'm' | 'yd'
  // How to draw it. Omitted means "work it out from the dimensions", which is
  // what a custom size gets.
  markings?: 'full' | 'grid' | 'none'
  // How many goal ends to mark. A half pitch is 53x68 and would otherwise be
  // long enough for penalty boxes at both ends — but it has one goal, and
  // drawing two would be a lie about the space. Omitted means derive.
  goalEnds?: 0 | 1 | 2
}

const YARD = 0.9144

// Rondo grids are quoted in yards; round the metre equivalent to something a
// coach could actually pace out rather than carrying four decimals around.
function yards(n: number): number {
  return Math.round(n * YARD * 10) / 10
}

export const PITCH_PRESETS: PitchPreset[] = [
  // --- Classic (6) --------------------------------------------------------
  { id: 'full', label: 'Full pitch', family: 'classic', widthMeters: 68, lengthMeters: 105, markings: 'full', goalEnds: 2 },
  { id: 'attacking_half', label: 'Attacking half', family: 'classic', widthMeters: 68, lengthMeters: 53, markings: 'full', goalEnds: 1 },
  { id: 'defending_half', label: 'Defending half', family: 'classic', widthMeters: 68, lengthMeters: 53, markings: 'full', goalEnds: 1 },
  { id: 'final_third', label: 'Final third', family: 'classic', widthMeters: 68, lengthMeters: 35, markings: 'full', goalEnds: 1 },
  { id: 'middle_third', label: 'Middle third', family: 'classic', widthMeters: 68, lengthMeters: 35, markings: 'full', goalEnds: 0 },
  { id: 'defensive_third', label: 'Defensive third', family: 'classic', widthMeters: 68, lengthMeters: 35, markings: 'full', goalEnds: 1 },

  // --- Small-sided (5) ----------------------------------------------------
  { id: 'ssg_5v5', label: '5v5', family: 'small_sided', widthMeters: 27, lengthMeters: 37, markings: 'full', goalEnds: 2 },
  { id: 'ssg_7v7', label: '7v7', family: 'small_sided', widthMeters: 37, lengthMeters: 55, markings: 'full', goalEnds: 2 },
  { id: 'ssg_9v9', label: '9v9', family: 'small_sided', widthMeters: 46, lengthMeters: 73, markings: 'full', goalEnds: 2 },
  { id: 'futsal', label: 'Futsal', family: 'small_sided', widthMeters: 20, lengthMeters: 40, markings: 'full', goalEnds: 2 },
  { id: 'indoor_cage', label: 'Indoor cage', family: 'small_sided', widthMeters: 15, lengthMeters: 25, markings: 'grid', goalEnds: 2 },

  // --- Functional (5) -----------------------------------------------------
  // The penalty-box spaces are quoted width x depth in the plan's table
  // (17x40 is 40 wide by 17 deep), so they're stored that way round.
  { id: 'penalty_box', label: 'Penalty box', family: 'functional', widthMeters: 40, lengthMeters: 17, markings: 'full', goalEnds: 1 },
  { id: 'double_penalty_box', label: 'Double penalty box', family: 'functional', widthMeters: 40, lengthMeters: 33, markings: 'full', goalEnds: 2 },
  { id: 'final_third_goalmouth', label: 'Final third + goalmouth', family: 'functional', widthMeters: 68, lengthMeters: 35, markings: 'full', goalEnds: 1 },
  { id: 'middle_third_functional', label: 'Middle third', family: 'functional', widthMeters: 68, lengthMeters: 35, markings: 'grid', goalEnds: 0 },
  { id: 'defensive_third_goalmouth', label: 'Defensive third + goalmouth', family: 'functional', widthMeters: 68, lengthMeters: 35, markings: 'full', goalEnds: 1 },

  // --- Rondo (16) ---------------------------------------------------------
  { id: 'rondo_10', label: '10 × 10 grid', family: 'rondo', widthMeters: yards(10), lengthMeters: yards(10), units: 'yd', markings: 'grid', goalEnds: 0 },
  { id: 'rondo_12', label: '12 × 12 grid', family: 'rondo', widthMeters: yards(12), lengthMeters: yards(12), units: 'yd', markings: 'grid', goalEnds: 0 },
  { id: 'rondo_15', label: '15 × 15 grid', family: 'rondo', widthMeters: yards(15), lengthMeters: yards(15), units: 'yd', markings: 'grid', goalEnds: 0 },
  { id: 'rondo_20', label: '20 × 20 grid', family: 'rondo', widthMeters: yards(20), lengthMeters: yards(20), units: 'yd', markings: 'grid', goalEnds: 0 },
  { id: 'rondo_25', label: '25 × 25 grid', family: 'rondo', widthMeters: yards(25), lengthMeters: yards(25), units: 'yd', markings: 'grid', goalEnds: 0 },
  { id: 'rondo_3v1_triangle', label: '3v1 triangle', family: 'rondo', widthMeters: 7, lengthMeters: 7, markings: 'grid', goalEnds: 0 },
  { id: 'rondo_4v1_tight', label: '4v1 tight', family: 'rondo', widthMeters: 9, lengthMeters: 9, markings: 'grid', goalEnds: 0 },
  { id: 'rondo_rectangle', label: 'Rectangle rondo', family: 'rondo', widthMeters: 11, lengthMeters: 18, markings: 'grid', goalEnds: 0 },
  { id: 'guardiola_4v4_3', label: 'Guardiola 4v4+3', family: 'rondo', widthMeters: 17, lengthMeters: 23, markings: 'grid', goalEnds: 0 },
  { id: 'rondo_transfer', label: 'Transfer rondo', family: 'rondo', widthMeters: 20, lengthMeters: 36, markings: 'grid', goalEnds: 0 },
  { id: 'rondo_diamond', label: 'Diamond grid', family: 'rondo', widthMeters: 18, lengthMeters: 18, markings: 'grid', goalEnds: 0 },
  { id: 'rondo_hexagon', label: 'Hexagon rondo', family: 'rondo', widthMeters: 20, lengthMeters: 20, markings: 'grid', goalEnds: 0 },
  { id: 'rondo_end_zone', label: 'End-zone rondo', family: 'rondo', widthMeters: 25, lengthMeters: 35, markings: 'grid', goalEnds: 0 },
  { id: 'rondo_4_zone_box', label: '4-zone box', family: 'rondo', widthMeters: 24, lengthMeters: 24, markings: 'grid', goalEnds: 0 },
  { id: 'rondo_5_channel', label: '5-channel corridor', family: 'rondo', widthMeters: 40, lengthMeters: 25, markings: 'grid', goalEnds: 0 },
  { id: 'pep_20_zones', label: 'Pep 20 zones', family: 'rondo', widthMeters: 68, lengthMeters: 105, markings: 'full', goalEnds: 2 },

  // --- Shape (3) ----------------------------------------------------------
  { id: 'shape_long_narrow', label: 'Long & narrow', family: 'shape', widthMeters: 20, lengthMeters: 46, markings: 'grid', goalEnds: 0 },
  { id: 'shape_wide_short', label: 'Wide & short', family: 'shape', widthMeters: 40, lengthMeters: 25, markings: 'grid', goalEnds: 0 },
  { id: 'shape_diamond_funnel', label: 'Diamond / funnel', family: 'shape', widthMeters: 30, lengthMeters: 30, markings: 'grid', goalEnds: 0 },
]

// The four values migration 013b wrote for the phases-era pitch_size column.
// They aren't offered in the panel — 'attacking_half' and 'final_third' are
// the same spaces under their real names — but drills saved before Stage 7
// still carry them, so they resolve rather than falling back to a full pitch.
const LEGACY_PRESETS: Record<string, PitchPreset> = {
  full: PITCH_PRESETS[0],
  three_quarter: { id: 'three_quarter', label: 'Three-quarter pitch', family: 'classic', widthMeters: 68, lengthMeters: 79, markings: 'full', goalEnds: 1 },
  half: { ...PITCH_PRESETS[1], id: 'half', label: 'Half pitch' },
  quarter: { ...PITCH_PRESETS[3], id: 'quarter', label: 'Quarter pitch' },
}

export function findPreset(id: string): PitchPreset | null {
  return PITCH_PRESETS.find((preset) => preset.id === id) ?? LEGACY_PRESETS[id] ?? null
}

export function presetLabel(id: string): string {
  return findPreset(id)?.label ?? 'Custom'
}

export function metersToYards(meters: number): number {
  return meters / YARD
}

// "23 × 17 m" or "20 × 20 yd" — length first, the way a pitch is always
// quoted. Rounded, because nobody paces out a decimal.
export function formatDimensions(
  lengthMeters: number,
  widthMeters: number,
  units: 'm' | 'yd' = 'm'
): string {
  const convert = (value: number) => Math.round(units === 'yd' ? metersToYards(value) : value)
  return `${convert(lengthMeters)} × ${convert(widthMeters)} ${units}`
}

export function presetsInFamily(family: PitchFamily): PitchPreset[] {
  return PITCH_PRESETS.filter((preset) => preset.family === family)
}

// The config a preset turns into when a coach picks it, keeping whatever
// orientation and overlays they already had.
export function configFromPreset(
  preset: PitchPreset,
  orientation: PitchOrientation
): { preset: string; widthMeters: number; lengthMeters: number; orientation: PitchOrientation; markings?: 'full' | 'grid' | 'none'; units?: 'm' | 'yd' } {
  return {
    preset: preset.id,
    widthMeters: preset.widthMeters,
    lengthMeters: preset.lengthMeters,
    orientation,
    markings: preset.markings,
    units: preset.units,
  }
}
