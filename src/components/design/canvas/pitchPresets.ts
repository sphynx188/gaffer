import type { OverlayKind, PitchOrientation } from '../../../store'

// The pitch preset table — simplified 2026-08-29 to match First Phase
// Studio's field-type list (Full Pitch, Half Pitch, Thirds, Coaching Zones,
// Set Pieces, Deep Free Kick, Possession Area, Square Area, Blank Board):
// one flat list of named types instead of five family tabs and 35 presets,
// with orientation baked into each type instead of a separate toggle — a
// coach picks a named field, not a family + size + orientation + units.
//
// Every preset is still keyed to real metre dimensions, which is what makes
// the timeline's speed readout mean anything — "105m in one second" is only
// a red flag if the pitch really is 105m long. Set Pieces/Deep Free Kick/
// Possession Area/Square Area/Blank Board don't correspond to a regulation
// measurement the way Full/Half Pitch do; their dimensions are reasonable
// nominal sizes chosen to look right, the same way First Phase Studio's own
// versions are hand-tuned rather than derived from a real quoted size.
//
// Dimensions are always the *canonical portrait* pair: `widthMeters` is the
// lateral (goal-to-goal-width) axis and `lengthMeters` the goal-to-goal one,
// the same convention pitchGeometry.ts has always authored in. `orientation`
// is applied on top by transpose() when the config is built.

export interface PitchPreset {
  id: string
  label: string
  widthMeters: number
  lengthMeters: number
  orientation: PitchOrientation
  // The unit the coach thinks of this space in. Stored dimensions stay
  // metric either way — this only decides how the panel writes them.
  units?: 'm' | 'yd'
  // How to draw it. Omitted means "work it out from the dimensions", which
  // is what a custom size gets.
  markings?: 'full' | 'grid' | 'none'
  // How many goal ends to mark. A half pitch is 53x68 and would otherwise be
  // long enough for penalty boxes at both ends — but it has one goal, and
  // drawing two would be a lie about the space. Omitted means derive.
  goalEnds?: 0 | 1 | 2
  // Zone overlay(s) this field type shows by default (Thirds, Coaching
  // Zones) — see OverlayKind / getPitchOverlays.
  overlays?: OverlayKind[]
}

const YARD = 0.9144

export const PITCH_PRESETS: PitchPreset[] = [
  { id: 'full', label: 'Full Pitch', widthMeters: 68, lengthMeters: 105, orientation: 'landscape', markings: 'full', goalEnds: 2 },
  { id: 'half', label: 'Half Pitch', widthMeters: 68, lengthMeters: 53, orientation: 'portrait', markings: 'full', goalEnds: 1 },
  { id: 'thirds', label: 'Thirds', widthMeters: 68, lengthMeters: 105, orientation: 'landscape', markings: 'full', goalEnds: 2, overlays: ['thirds'] },
  { id: 'coaching_zones', label: 'Coaching Zones', widthMeters: 68, lengthMeters: 105, orientation: 'landscape', markings: 'full', goalEnds: 2, overlays: ['coaching_zones'] },
  { id: 'set_pieces', label: 'Set Pieces', widthMeters: 68, lengthMeters: 40, orientation: 'portrait', markings: 'full', goalEnds: 1 },
  { id: 'deep_free_kick', label: 'Deep Free Kick', widthMeters: 68, lengthMeters: 45, orientation: 'portrait', markings: 'full', goalEnds: 1 },
  { id: 'possession_area', label: 'Possession Area', widthMeters: 30, lengthMeters: 40, orientation: 'portrait', markings: 'none', goalEnds: 0 },
  { id: 'square_area', label: 'Square Area', widthMeters: 20, lengthMeters: 20, orientation: 'portrait', markings: 'none', goalEnds: 0 },
  { id: 'blank', label: 'Blank Board', widthMeters: 20, lengthMeters: 20, orientation: 'portrait', markings: 'none', goalEnds: 0 },
]

// Ids from the pre-simplification preset table (and, before that, the
// phases-era pitch_size enum migration 013b wrote) that drills saved before
// 2026-08-29 may still carry. Not offered in the panel — a coach re-picks a
// field type rather than getting these back — but old drills still resolve
// their real dimensions and label instead of falling back to "Custom".
// 'half' and 'quarter' (the 013b enum) are absent here on purpose: 'half'
// means exactly what the new 'half' preset above means (68x53, one goal)
// and 'quarter' the new 'set_pieces' shape (68x40-ish) closely enough that
// resolving through the current table is fine.
const LEGACY_PRESETS: Record<string, PitchPreset> = {
  three_quarter: { id: 'three_quarter', label: 'Three-quarter pitch', widthMeters: 68, lengthMeters: 79, orientation: 'portrait', markings: 'full', goalEnds: 1 },
  attacking_half: { id: 'attacking_half', label: 'Attacking half', widthMeters: 68, lengthMeters: 53, orientation: 'portrait', markings: 'full', goalEnds: 1 },
  defending_half: { id: 'defending_half', label: 'Defending half', widthMeters: 68, lengthMeters: 53, orientation: 'portrait', markings: 'full', goalEnds: 1 },
  final_third: { id: 'final_third', label: 'Final third', widthMeters: 68, lengthMeters: 35, orientation: 'portrait', markings: 'full', goalEnds: 1 },
  middle_third: { id: 'middle_third', label: 'Middle third', widthMeters: 68, lengthMeters: 35, orientation: 'portrait', markings: 'full', goalEnds: 0 },
  defensive_third: { id: 'defensive_third', label: 'Defensive third', widthMeters: 68, lengthMeters: 35, orientation: 'portrait', markings: 'full', goalEnds: 1 },
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

// The config a preset turns into when a coach picks it. Orientation and
// overlays come from the preset itself now, not a separate toggle/state —
// each field type has one fixed look, the same way First Phase Studio's do.
export function configFromPreset(preset: PitchPreset): {
  preset: string
  widthMeters: number
  lengthMeters: number
  orientation: PitchOrientation
  markings?: 'full' | 'grid' | 'none'
  units?: 'm' | 'yd'
  overlays: OverlayKind[]
} {
  return {
    preset: preset.id,
    widthMeters: preset.widthMeters,
    lengthMeters: preset.lengthMeters,
    orientation: preset.orientation,
    markings: preset.markings,
    units: preset.units,
    overlays: preset.overlays ?? [],
  }
}
