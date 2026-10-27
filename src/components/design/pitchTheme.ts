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

// Polish pass, 2026-08-29, matched against first-phase-studio's own
// `drawPitch`: they fill the surface `#177245` and stroke every marking a flat
// `#e5f7df`. Two things that buys over the old mid-green/translucent-white
// pair: a deeper, more saturated turf reads as grass rather than as a grey-
// green panel, and an OPAQUE line is crisp at any size — the old
// `rgba(255,255,255,0.75)` let the turf bleed through, which at the thin end
// of the stroke range turned a marking into a soft grey smudge. The line is
// very slightly green rather than pure white, which is what keeps it from
// glaring against the darker surface.
//
// Restyled 2026-10-28 to match The Tactics App's pitch: flat mowing stripes in
// two close, muted greens (sampled from their canvas), running across the
// pitch's length and through the surround, with pure white markings. `fill`
// is the dark stripe and doubles as the base colour wherever stripes aren't
// drawn.
export const TURF = {
  fill: '#5b9c54',
  stripe: '#63a85b',
  line: '#ffffff',
  // Stripe width in real metres, so a half pitch or small-sided preset gets
  // the same stripes rather than squeezed ones. 105m / 20 — a full pitch gets
  // twenty, with the halfway line on a boundary.
  stripeMeters: 5.25,
} as const

// The boundary carries more weight than what's inside it — first-phase-studio
// strokes the outer rect at 3 and everything internal at 2. Without a
// hierarchy every marking competes equally and the pitch reads as a flat mesh
// of lines rather than as a shape with things drawn inside it.
// 2026-10-28: the boundary now matches everything else, as The Tactics App
// draws it — one thin, even weight reads cleaner than a heavier outline.
export const PITCH_LINE_WEIGHT = {
  boundary: 1,
  // The goal frame is stroked at the normal weight, not heavier: it is a small
  // shape, and at 3x the stroke was thicker than the frame was deep, so it
  // filled in as a solid block instead of reading as a goal.
  goal: 1,
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
//
// 2026-10-28: the art direction moved from flat cartoon silhouettes to
// realistic kit, modelled on Alpha Gear product photos — so the defaults below
// are the colours the real pieces come in (orange cones, neon slalom poles on
// black rubber bases, an orange free-kick mannequin, an aluminium goal with
// navy sleeves and a white net). Shading is derived from these in
// EquipmentShapes.tsx, so an override colour gets the same lighting.
export const EQUIPMENT = {
  cone: '#f04a3a',
  disc: '#f5c816',
  pole: '#d6ee2e',
  mannequin: '#ff5a1f',
  hurdle: '#f26a1b',
  ring: '#f5c816',
  rung: '#f5c816',
  strap: '#1c1c1e',
  rubber: '#1f1f22',
  aluminium: '#b9c0c9',
  aluminiumLight: '#eef1f4',
  aluminiumDark: '#7b8592',
  goalWhite: '#f4f5f7',
  goalSleeve: '#1f2a4a',
  steel: '#3d444e',
  netFill: 'rgba(255, 255, 255, 0.28)',
  netLine: 'rgba(255, 255, 255, 0.8)',
  spike: '#a1a1aa',
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
    pink: '#f78497', // sampled from a coach's actual kit
  } as Record<string, string>,
} as const

export const BALL = {
  fill: '#fefdf8', // off-white so it doesn't vanish against light markers
  stroke: '#1e293b',
  // A hint of panel seams — one inner ring plus two mirrored arcs — rather
  // than a literal pentagon pattern, which stops reading as a ball at the
  // size a coach actually draws one. Polish pass, 2026-08-29.
  seam: '#64748b',
  // 2026-10-28: the GIOCA match ball (canvas/BallShape.tsx), its colours
  // sampled from a photo of the real one.
  panel: '#ffffff',
  band: '#8a8b90',
  bandDot: '#b9bbbf',
  ink: '#46474c',
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
// The selection ring (2026-10-28): a white hairline with a faint tint inside
// and a small gap from the piece — it was a thick white stroke with a heavy
// glow, which shouted over the piece it was marking.
export const SELECTION = {
  halo: '#fefdf8',
  haloWidth: 1.5,
  haloFill: 'rgba(254, 253, 248, 0.14)',
  haloShadow: 'rgba(0, 0, 0, 0.3)',
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

// How big players, balls and equipment draw, in base units (1% of the
// canvas width), 2026-10-28. Not real-world scale — true scale leaves a ball
// a speck on a full pitch — but sized to make sense against each other: the
// ball is nearly a player's size but never bigger, a cone about a player's
// width, poles and mannequins taller, a mini goal about two players wide,
// and a full goal and a ladder the largest pieces.
export const TOKEN_SIZE = {
  playerRadius: 1.5,
  ballRadius: 1.2,
} as const

// For each equipment piece: how big its main dimension draws, in base units,
// and that same dimension in EquipmentShapes' drawing units — the ratio is
// the unit EquipmentShapes draws at.
export const EQUIPMENT_SIZE: Record<string, { size: number; units: number }> = {
  cone: { size: 3.2, units: 2.3 }, // height
  marker: { size: 2.6, units: 1.43 }, // diameter
  pole: { size: 5, units: 2.8 }, // height
  mannequin: { size: 6, units: 3.15 }, // height
  mini_goal: { size: 6.5, units: 2.2 }, // width
  full_goal: { size: 10, units: 3.6 }, // width
  agility_ring: { size: 3.2, units: 1.8 }, // diameter
  ladder: { size: 9, units: 4 }, // length
  hurdle: { size: 3.4, units: 1.8 }, // width
  rebounder: { size: 5, units: 1.9 }, // width
  passing_gate: { size: 4.5, units: 2 }, // gap
}

// Each equipment piece's drawn bounding box, in EquipmentShapes' drawing
// units around its origin, measured from the shape code (ground shadows
// left out — they're soft and fade to nothing). PitchCanvas wraps the
// selection outline round this box, so it fits every piece snugly whatever
// its shape — a circle for round kit, a pill for long kit like a ladder —
// and derives the drag bound from it. Lives here rather than beside the
// shapes so that file exports only components. If a shape's drawing
// changes, its box here has to change with it.
export const EQUIPMENT_BOUNDS: Record<string, { x0: number; y0: number; x1: number; y1: number }> = {
  cone: { x0: -0.98, y0: -1.15, x1: 0.98, y1: 1.27 },
  marker: { x0: -0.72, y0: -0.3, x1: 0.72, y1: 0.44 },
  pole: { x0: -0.6, y0: -1.43, x1: 0.6, y1: 1.6 },
  mannequin: { x0: -0.66, y0: -1.57, x1: 0.66, y1: 1.58 },
  mini_goal: { x0: -1.39, y0: -1.22, x1: 1.18, y1: 0.08 },
  full_goal: { x0: -2.23, y0: -1.78, x1: 1.88, y1: 0.08 },
  agility_ring: { x0: -0.98, y0: -0.5, x1: 0.98, y1: 0.55 },
  ladder: { x0: -0.61, y0: -2.07, x1: 0.61, y1: 2.07 },
  hurdle: { x0: -1.2, y0: -0.65, x1: 1.2, y1: 0.63 },
  rebounder: { x0: -1.02, y0: -0.67, x1: 1.84, y1: 0.67 },
  passing_gate: { x0: -1.48, y0: -0.82, x1: 1.48, y1: 0.96 },
}
