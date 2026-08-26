import type { DrillPhase, EquipmentKind, EquipmentType, Marking } from '../../../store'
import type { RenderFrame } from './interpolate'

// Deprecated bridge. Stage 3 changed PitchCanvas to render a RenderFrame
// rather than a DrillPhase, but the phases-era screens (DrillPreview, and
// DrillLibrary's preview) still hold phases and don't move onto
// scene/keyframes until Stages 5 and 9. This maps one to the other so those
// screens keep working and the build stays green in the meantime.
//
// Element ids are carried through unchanged, so a caller can map a reported
// entity or marking id straight back to the phase array it came from. Goes
// away with the phases column in migration 014.
// The phases-era equipment names, mapped onto the scene-era ones. The
// awkward one is 'cone': it was *drawn* as an agility pole, so it maps to
// 'pole' — exactly what migration 015 did to the stored scene values, kept in
// step here so the library preview and the editor show the same silhouette.
const LEGACY_EQUIPMENT: Record<EquipmentKind, EquipmentType> = {
  cone: 'pole',
  witches_hat: 'cone',
  mannequin: 'mannequin',
}

export function phaseToRenderFrame(phase: DrillPhase): RenderFrame {
  const entities: RenderFrame['entities'] = []

  for (const player of phase.players) {
    entities.push({
      id: player.id,
      kind: 'player',
      team: player.team,
      number: player.number,
      label: player.label,
      x: player.x,
      y: player.y,
      facing: 0,
    })
  }
  for (const cone of phase.cones) {
    entities.push({
      id: cone.id,
      kind: 'equipment',
      equipment: LEGACY_EQUIPMENT[cone.kind ?? 'cone'],
      color: cone.color,
      x: cone.x,
      y: cone.y,
      facing: 0,
    })
  }
  for (const ball of phase.balls) {
    entities.push({ id: ball.id, kind: 'ball', x: ball.x, y: ball.y, facing: 0 })
  }

  const markings: Marking[] = []
  for (const arrow of phase.arrows) {
    markings.push({
      id: arrow.id,
      kind: 'arrow',
      points: [arrow.from, arrow.to],
      // The same mapping migration 013b used: a dashed arrow is a ball pass.
      style: { dash: (arrow.kind ?? 'player') === 'ball' },
    })
  }
  for (const note of phase.annotations) {
    markings.push({ id: note.id, kind: 'text', points: [{ x: note.x, y: note.y }], text: note.text })
  }

  return { entities, markings }
}

// Which phase array an id reported back by the canvas came from. Ids are
// unique within a phase, so a single lookup order is enough.
export function phaseElementKind(phase: DrillPhase, id: string): 'players' | 'cones' | 'balls' | null {
  if (phase.players.some((p) => p.id === id)) return 'players'
  if (phase.cones.some((c) => c.id === id)) return 'cones'
  if (phase.balls.some((b) => b.id === id)) return 'balls'
  return null
}
