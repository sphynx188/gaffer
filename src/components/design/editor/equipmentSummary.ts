import { EQUIPMENT_LABELS, type DrillScene, type EquipmentType } from '../../../store'

// Derived equipment (rework plan Stage 8.3) — "Cones ×12, Poles ×4, Mini goal
// ×2", read straight off what's on the board rather than typed in a second
// time. Zero data entry, and it can't drift out of date the way a hand-written
// list does the moment a coach adds another cone.
//
// A manual override lives in `coaching.equipment` for the cases the board
// can't know about (bibs, a ball bag, a set of markers the coach carries
// anyway); this function only ever reports what's actually placed.

// Every one of the eleven labels pluralises with a bare `s` ("Cone" → "Cones",
// "Passing gate" → "Passing gates"), so a rule beats a second table here.
function plural(type: EquipmentType, count: number): string {
  const label = EQUIPMENT_LABELS[type]
  return count > 1 ? `${label}s` : label
}

/** Empty string when nothing is on the board — the caller decides what to say. */
export function equipmentSummary(scene: DrillScene): string {
  const counts = new Map<EquipmentType, number>()
  for (const entity of scene.entities) {
    if (entity.kind !== 'equipment' || !entity.equipment) continue
    counts.set(entity.equipment, (counts.get(entity.equipment) ?? 0) + 1)
  }
  // Most-used first, so the thing a coach needs a boxful of leads the line;
  // ties fall back to the label so the order is stable between renders.
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || EQUIPMENT_LABELS[a[0]].localeCompare(EQUIPMENT_LABELS[b[0]]))
    .map(([type, count]) => `${plural(type, count)} ×${count}`)
    .join(', ')
}
