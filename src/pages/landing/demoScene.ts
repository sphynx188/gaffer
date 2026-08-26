import type { DrillScene, EntityState, Keyframe, PitchConfig, SceneEntity } from '../../store'

// The hero's looping build-up pattern. Hand-authored, never persisted —
// the landing page must not touch Supabase for its demo. Same shapes the
// real editors store, which is the point: the hero runs the actual engine.
//
// frameAt places an entity only if the keyframe IN FORCE lists it (holds are
// not implicit), so keyframes are authored sparsely as "movers" below and
// expanded to full states by carrying the previous keyframe forward.

const player = (id: string, team: 'A' | 'B', number: number, goalkeeper = false): SceneEntity => ({
  id,
  kind: 'player',
  team,
  number,
  goalkeeper,
})

const entities: SceneEntity[] = [
  player('gk', 'A', 1, true),
  player('rb', 'A', 2),
  player('rcb', 'A', 4),
  player('lcb', 'A', 5),
  player('lb', 'A', 3),
  player('cm', 'A', 8),
  player('rw', 'A', 7),
  player('st', 'A', 9),
  player('o1', 'B', 9),
  player('o2', 'B', 10),
  player('o3', 'B', 8),
  player('o4', 'B', 6),
  { id: 'ball', kind: 'ball' },
]

// x: 0 = own goal (attacking +x), y: 0 = left touchline. Normalized 0–1.
const start: Record<string, EntityState> = {
  gk: { x: 0.06, y: 0.5 },
  rb: { x: 0.22, y: 0.82 },
  rcb: { x: 0.18, y: 0.62 },
  lcb: { x: 0.18, y: 0.38 },
  lb: { x: 0.22, y: 0.18 },
  cm: { x: 0.34, y: 0.5 },
  rw: { x: 0.52, y: 0.88 },
  st: { x: 0.55, y: 0.45 },
  o1: { x: 0.3, y: 0.5 },
  o2: { x: 0.42, y: 0.66 },
  o3: { x: 0.42, y: 0.34 },
  o4: { x: 0.56, y: 0.5 },
  ball: { x: 0.08, y: 0.5 },
}

// Sparse authoring: each step lists only who moves by its moment.
const steps: { id: string; t: number; movers: Record<string, EntityState> }[] = [
  { id: 'k1', t: 0, movers: {} },
  {
    id: 'k2',
    t: 2.5,
    movers: {
      rcb: { x: 0.2, y: 0.64 },
      ball: { x: 0.2, y: 0.63 },
      rb: { x: 0.3, y: 0.85 },
      cm: { x: 0.38, y: 0.52 },
      o1: { x: 0.26, y: 0.55 },
    },
  },
  {
    id: 'k3',
    t: 5,
    movers: {
      rb: { x: 0.42, y: 0.88 },
      ball: { x: 0.41, y: 0.86 },
      rcb: { x: 0.24, y: 0.62 },
      rw: { x: 0.62, y: 0.8 },
      st: { x: 0.6, y: 0.5 },
      o2: { x: 0.5, y: 0.72 },
      o4: { x: 0.6, y: 0.55 },
    },
  },
  {
    id: 'k4',
    t: 7.5,
    movers: {
      rw: { x: 0.78, y: 0.78 },
      ball: { x: 0.77, y: 0.76 },
      rb: { x: 0.5, y: 0.86 },
      st: { x: 0.78, y: 0.48 },
      cm: { x: 0.55, y: 0.55 },
      o3: { x: 0.62, y: 0.4 },
      o4: { x: 0.72, y: 0.52 },
    },
  },
  {
    id: 'k5',
    t: 10,
    movers: {
      ball: { x: 0.9, y: 0.5 },
      st: { x: 0.88, y: 0.47 },
      rw: { x: 0.82, y: 0.72 },
      cm: { x: 0.66, y: 0.5 },
      o4: { x: 0.8, y: 0.5 },
    },
  },
]

const keyframes: Keyframe[] = []
let carried = start
for (const step of steps) {
  carried = { ...carried, ...step.movers }
  keyframes.push({ id: step.id, t: step.t, states: carried })
}

export const DEMO_SCENE: {
  scene: DrillScene
  keyframes: Keyframe[]
  duration: number
  pitch: PitchConfig
} = {
  scene: { entities, markings: [] },
  keyframes,
  duration: 10,
  pitch: {
    preset: 'full',
    lengthMeters: 105,
    widthMeters: 68,
    orientation: 'landscape',
    markings: 'full',
    overlays: [],
    units: 'm',
  },
}
