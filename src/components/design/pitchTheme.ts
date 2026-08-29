// Canvas color scheme — locked in by `discussion_visual_style.md` and spelled
// out concretely in `gaffer_mvp_build_steps.md` 2a: "navy/dark circles with
// white numbers for players, orange/yellow triangles for cones, white/off-
// white with dark outline for balls, red or black strong-contrast arrows."
// Kept to 2-3 colors per phase for pitch-side legibility — see 3.3's
// legibility Definition of Done, which this file is what that check runs
// against.
//
// This is the ONE place canvas colors live. Nothing in PitchCanvas should
// hardcode a hex value outside of here.

export const TURF = {
  fill: '#3f7d52', // mid-green — not too saturated, so markers pop (visual-style discussion)
  line: 'rgba(255, 255, 255, 0.75)', // thin white pitch lines
} as const

export const PLAYER = {
  // Team distinction is shape/2-color-pair, never a big palette (visual-style
  // discussion). The phase JSON's `team` field is freeform text (e.g.
  // "attack" in the 0.5.1 hardcoded phase) — we don't know the real values
  // ahead of time, so colors are assigned by sorted label rather than
  // matching a specific string. See `assignTeamColors` in pitchGeometry.ts.
  colors: ['#152238', '#b91c1c'] as const, // navy, then red
  fallback: '#475569', // slate-600, a third+ team label (shouldn't normally happen)
  numberText: '#ffffff',
  // A concentric ring just inside the marker's own edge, translucent enough
  // that the team color still reads first — the cheap trick behind reading
  // as a lit sphere rather than a flat coin without an actual gradient (a
  // gradient fill would fight the "team color has to read as one solid hue"
  // rule). Polish pass, 2026-08-29, first-phase-studio comparison.
  ringFill: 'rgba(255, 255, 255, 0.08)',
  ringStroke: 'rgba(255, 255, 255, 0.16)',
} as const

// Equipment palette (rework plan Stage 6.2). The house rule holds: types are
// told apart by *shape* first, with colour doing only as much work as it has
// to — a coach glancing at a phone pitch-side reads a silhouette long before
// they read a hue. Three families of colour and no more:
//   · EQUIPMENT.marker  — the yellow/orange family a cone, pole or ring wears
//   · EQUIPMENT.frame   — the blue-grey of anything with a frame or a net
//   · EQUIPMENT.ground  — the near-black of a base, rung or shadow
//
// `named` maps the optional per-entity colour override onto real values, so a
// coach can bib their cones without any of this leaking hex into components.
export const EQUIPMENT = {
  marker: '#eab308',
  markerDeep: '#f59e0b',
  frame: '#2563eb',
  frameDeep: '#1e3a8a',
  ground: '#18181b',
  net: 'rgba(255, 255, 255, 0.55)',
  named: {
    orange: '#f59e0b',
    yellow: '#eab308',
    red: '#ef4444',
    blue: '#3b82f6',
    white: '#fefdf8',
  } as Record<string, string>,
} as const

export const BALL = {
  fill: '#fefdf8', // off-white so it doesn't vanish against light markers
  stroke: '#1e293b',
  // A hint of panel seams — one inner ring plus two mirrored arcs — rather
  // than a literal pentagon pattern, which stops reading as a ball at the
  // size a coach actually draws one. Polish pass, 2026-08-29.
  seam: '#64748b',
} as const

// Shared by every "live" token on the pitch (player, ball) — a small drop
// shadow that grounds them against the turf. Canvas-only: this isn't a
// chrome surface treatment (design.md's "no drop shadows" rule is about UI
// panels/buttons), and equipment/markings don't get one — just the pieces
// that move.
export const TOKEN_SHADOW = {
  color: '#000000',
  opacity: 0.35,
  blur: 6,
  offsetY: 2,
} as const

// Upgrade Phase 2C (UPGRADE_IMPLEMENTATION_PLAN.md): two visually distinct
// arrow kinds — solid red for player movement (unchanged from before this
// distinction existed, so every pre-existing arrow with no `kind` still
// looks the same), dashed blue for ball/pass movement (blue matches CONE's
// existing "blue" named cone color, giving ball-related markings a
// consistent hue across the canvas).
export const ARROW = {
  player: { stroke: '#dc2626', dash: undefined as number[] | undefined },
  ball: { stroke: '#3b82f6', dash: [10, 6] as number[] | undefined },
} as const

export const ANNOTATION = {
  background: '#fefdf8',
  border: '#1e293b',
  text: '#1e293b',
} as const

// Selection affordances (rework plan Stage 3.4/3.5): a halo around selected
// entities, a highlight on selected markings, and the box-select marquee.
// Deliberately a light ring rather than a fill — a selected player still has
// to read as that player's team color first, which is the whole basis of the
// "shape distinction over palette" rule above.
export const SELECTION = {
  halo: '#fefdf8',
  haloShadow: 'rgba(0, 0, 0, 0.45)',
  marqueeStroke: '#fefdf8',
  marqueeFill: 'rgba(254, 253, 248, 0.12)',
} as const

// Spotlight and highlight (rework plan Stage 6.1/6.4). Emphasis rather than
// diagram: a spotlight dims the pitch everywhere OUTSIDE its circle, and a
// highlight tints the region inside its own. Both composite above the
// entities, which is why their fills are translucent — a player under either
// one has to stay recognisable, or the tool has hidden the thing it was meant
// to draw attention to.
export const EMPHASIS = {
  // The veil drawn over everything a spotlight isn't lighting. Dark enough to
  // push the rest of the pitch back, light enough to keep it legible.
  spotlightDim: 'rgba(6, 8, 10, 0.55)',
  spotlightRim: 'rgba(254, 253, 248, 0.55)',
  highlightFill: 'rgba(250, 204, 21, 0.22)',
  highlightRim: 'rgba(250, 204, 21, 0.8)',
} as const

// How much room each equipment type needs around its origin, as a multiple of
// the base unit EquipmentShapes draws at. PitchCanvas uses it for the drag
// bound and the selection halo, so a full goal doesn't get a halo sized for a
// cone. Lives here rather than beside the shapes so that file exports only
// components.
export const EQUIPMENT_EXTENT: Record<string, number> = {
  cone: 1.1,
  marker: 0.9,
  pole: 1.3,
  mannequin: 1.5,
  mini_goal: 1.3,
  agility_ring: 1.0,
  full_goal: 1.9,
  ladder: 2.2,
  hurdle: 1.2,
  rebounder: 1.4,
  passing_gate: 1.4,
}
