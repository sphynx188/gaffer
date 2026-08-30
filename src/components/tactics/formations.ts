import type { CustomFormation, EntityState, PlayerRole, SceneEntity } from '../../store'

// The 29 built-in formations (TACTICS_BOARD_REWORK_PLAN.md Stage 3.1),
// transcribed from the inventory in §1 of that plan.
//
// ── The coordinate convention ─────────────────────────────────────────────
// Authored against a LANDSCAPE FULL PITCH with the HOME side attacking +x, in
// the same normalized 0-1 space every other coordinate in this app uses. So:
//
//   x = 0.05  own goalmouth          x = 0.80  opposition penalty area
//   y = 0.00  left touchline         y = 1.00  right touchline
//
// `y` is left-to-right from the attacking side's own point of view: facing +x
// on a canvas whose y grows downward, your left hand points at low y. That is
// why a back four reads LB, CB, CB, RB in ascending y.
//
// The AWAY side mirrors `x -> 1 - x` (see `mirrorSlots`) so both sides attack
// each other. `y` is deliberately NOT mirrored: flipping both axes would
// rotate the shape rather than reflect it, and would put an away side's
// right-back on the same touchline as the home side's.
//
// ── On the role vocabulary ────────────────────────────────────────────────
// `PlayerRole` is fixed at GK/RB/CB/LB/CDM/CM/CAM/LW/RW/ST — the plan pins it
// in both 1.1 and 4.4, so it is not widened here. Two kinds of slot therefore
// borrow a neighbouring role:
//
//   * WIDE MIDFIELDERS (the flanks of a flat midfield four, e.g. 4-4-2) are
//     `LW`/`RW`. Their depth is what distinguishes them from a front-three
//     winger — same role, x = 0.47 rather than 0.74.
//   * WING-BACKS (the flanks of a back five, e.g. 3-5-2) are `LB`/`RB`,
//     pushed up the pitch — see WB_HIGH / WB_FLAT.
//
// Affinity still separates keeper from defender from midfielder from
// attacker, which is what `assignToFormation` actually needs; the finer
// distinction is carried by the slot's position, not its label.

export interface FormationSlot {
  role: PlayerRole
  x: number
  y: number
}

export interface Formation {
  key: string
  label: string
  description: string
  // Always exactly one GK. The count is the team size — 11, 9 or 7 — and is
  // what `formationSize` reads, so a formation never has to restate it.
  slots: FormationSlot[]
}

// Depths, goal-line outward. Named rather than inlined so a whole line of the
// pitch can be nudged in one place and every formation using it stays in step.
const GK_X = 0.05
const DEF = 0.2 // a back four or the centre of a back five
// Two wing-back depths, because "five at the back" means two different shapes.
// In a 3-5-2 the wing-backs ARE the flanks of the midfield five and live high;
// in a 5-x they are the flanks of a genuine back five and sit much closer to
// the centre-backs. Collapsing them to one depth put a 5-4-1's wing-back and
// wide midfielder almost on top of each other.
const WB_HIGH = 0.34 // a 3-5-2 wing-back, level with the midfield
const WB_FLAT = 0.24 // a 5-x wing-back, just ahead of the centre-backs
const DM = 0.34
const MID = 0.47 // central midfield, and the flanks of a flat midfield four
const AM = 0.6
const WING = 0.74 // a front-three flank
const FWD = 0.8

// Widths, as y positions. A back three tucks in; a back five's flanks hug the
// touchline; a front three's wingers stay wide to stretch the last line.
const BACK4 = [0.14, 0.37, 0.63, 0.86]
const BACK3 = [0.28, 0.5, 0.72]
const BACK5_CENTRE = [0.3, 0.5, 0.7]
const TOUCHLINE = [0.08, 0.92]
const FLANKED4 = [0.12, 0.38, 0.62, 0.88]
const THREE = [0.28, 0.5, 0.72]
const PAIR = [0.38, 0.62]
const NARROW_PAIR = [0.44, 0.56]
const FRONT3 = [0.16, 0.5, 0.84]
const FRONT4 = [0.12, 0.37, 0.63, 0.88]
const CENTRE = 0.5

// One line of the pitch: every slot at the same depth, each with its own y.
// Keeping y explicit per slot rather than deriving an even spread is
// deliberate — an even spread is what makes a formation table look plausible
// and read wrong.
function line(x: number, entries: [PlayerRole, number][]): FormationSlot[] {
  return entries.map(([role, y]) => ({ role, x, y }))
}

const GK = line(GK_X, [['GK', CENTRE]])

// Reusable lines. `back4` etc. are functions only so each formation gets its
// own array rather than a shared reference.
const back4 = (): FormationSlot[] =>
  line(DEF, [
    ['LB', BACK4[0]],
    ['CB', BACK4[1]],
    ['CB', BACK4[2]],
    ['RB', BACK4[3]],
  ])

const back3 = (): FormationSlot[] =>
  line(DEF, [
    ['CB', BACK3[0]],
    ['CB', BACK3[1]],
    ['CB', BACK3[2]],
  ])

const wingBacks = (x: number): FormationSlot[] =>
  line(x, [
    ['LB', TOUCHLINE[0]],
    ['RB', TOUCHLINE[1]],
  ])

// Three centre-backs tucked in, as the spine of any back five.
const backThreeCentral = (): FormationSlot[] =>
  line(DEF, [
    ['CB', BACK5_CENTRE[0]],
    ['CB', BACK5_CENTRE[1]],
    ['CB', BACK5_CENTRE[2]],
  ])

// The flat back five of a 5-2-3 / 5-3-2 / 5-4-1.
const back5 = (): FormationSlot[] => [...backThreeCentral(), ...wingBacks(WB_FLAT)]

// A flat midfield four: two wide, two central.
const flatMid4 = (): FormationSlot[] =>
  line(MID, [
    ['LW', FLANKED4[0]],
    ['CM', FLANKED4[1]],
    ['CM', FLANKED4[2]],
    ['RW', FLANKED4[3]],
  ])

const front3 = (): FormationSlot[] => [
  ...line(WING, [['LW', FRONT3[0]]]),
  ...line(FWD, [['ST', FRONT3[1]]]),
  ...line(WING, [['RW', FRONT3[2]]]),
]

const strikers2 = (): FormationSlot[] =>
  line(FWD, [
    ['ST', PAIR[0]],
    ['ST', PAIR[1]],
  ])

const loneStriker = (): FormationSlot[] => line(FWD, [['ST', CENTRE]])

// ── Small-sided lines (2026-08-30) ────────────────────────────────────────
//
// 9v9 and 7v7 are the formats a youth coach actually spends the season in, so
// the picker groups by team size and these fill the two smaller groups. They
// reuse the depths above unchanged: a 7v7 pitch is smaller in metres, but the
// slots are NORMALISED, so "the defensive line sits a fifth of the way up" is
// the same instruction at any size and the shapes stay comparable.
const back2 = (): FormationSlot[] =>
  line(DEF, [
    ['CB', PAIR[0]],
    ['CB', PAIR[1]],
  ])

const mid2 = (): FormationSlot[] =>
  line(MID, [
    ['CM', PAIR[0]],
    ['CM', PAIR[1]],
  ])

// Wide-centre-wide rather than three central: at nine and seven a side the
// width has to come from the midfield, since there is no separate wing pair.
const mid3 = (): FormationSlot[] =>
  line(MID, [
    ['LW', THREE[0]],
    ['CM', THREE[1]],
    ['RW', THREE[2]],
  ])

const holder = (): FormationSlot[] => line(DM, [['CDM', CENTRE]])

export const FORMATIONS: Formation[] = [
  // ── Back three (5) ──────────────────────────────────────────────────────
  {
    key: '3-1-4-2',
    label: '3-1-4-2',
    description: 'Back three screened by a holding midfielder, with two strikers ahead of a packed middle.',
    slots: [
      ...GK,
      ...back3(),
      ...line(DM, [['CDM', CENTRE]]),
      ...flatMid4(),
      ...strikers2(),
    ],
  },
  {
    key: '3-4-1-2',
    label: '3-4-1-2',
    description: 'Wing-backs supply the width while a playmaker links the midfield four to a front two.',
    slots: [...GK, ...back3(), ...flatMid4(), ...line(AM, [['CAM', CENTRE]]), ...strikers2()],
  },
  {
    key: '3-4-2-1',
    label: '3-4-2-1',
    description: 'Two free roles behind a lone striker, feeding off a midfield four.',
    slots: [
      ...GK,
      ...back3(),
      ...flatMid4(),
      ...line(AM, [
        ['CAM', PAIR[0]],
        ['CAM', PAIR[1]],
      ]),
      ...loneStriker(),
    ],
  },
  {
    key: '3-5-2',
    label: '3-5-2',
    description: 'Overloads the centre with three midfielders and pushes both wing-backs high for width.',
    slots: [
      ...GK,
      ...backThreeCentral(),
      ...wingBacks(WB_HIGH),
      ...line(MID, [
        ['CM', THREE[0]],
        ['CM', THREE[1]],
        ['CM', THREE[2]],
      ]),
      ...strikers2(),
    ],
  },
  {
    key: '3-4-3',
    label: '3-4-3',
    description: 'Aggressive shape: three at the back, three up front, and a midfield four to connect them.',
    slots: [...GK, ...back3(), ...flatMid4(), ...front3()],
  },

  // ── Back four (20) ──────────────────────────────────────────────────────
  {
    key: '4-1-2-1-2',
    label: '4-1-2-1-2',
    description: 'Midfield diamond — a holder, two shuttlers and a playmaker behind two strikers.',
    slots: [
      ...GK,
      ...back4(),
      ...line(DM, [['CDM', CENTRE]]),
      ...line(MID, [
        ['CM', PAIR[0]],
        ['CM', PAIR[1]],
      ]),
      ...line(AM, [['CAM', CENTRE]]),
      ...strikers2(),
    ],
  },
  {
    key: '4-1-2-1-2-narrow',
    label: '4-1-2-1-2 (2) Narrow',
    description: 'The diamond squeezed tight to dominate the centre, conceding the flanks entirely.',
    slots: [
      ...GK,
      ...back4(),
      ...line(DM, [['CDM', CENTRE]]),
      ...line(MID, [
        ['CM', NARROW_PAIR[0]],
        ['CM', NARROW_PAIR[1]],
      ]),
      ...line(AM, [['CAM', CENTRE]]),
      ...line(FWD, [
        ['ST', NARROW_PAIR[0]],
        ['ST', NARROW_PAIR[1]],
      ]),
    ],
  },
  {
    key: '4-1-3-2',
    label: '4-1-3-2',
    description: 'A single holder frees three midfielders to push onto a front two.',
    slots: [
      ...GK,
      ...back4(),
      ...line(DM, [['CDM', CENTRE]]),
      ...line(MID, [
        ['LW', THREE[0]],
        ['CM', THREE[1]],
        ['RW', THREE[2]],
      ]),
      ...strikers2(),
    ],
  },
  {
    key: '4-1-4-1',
    label: '4-1-4-1',
    description: 'Two banks with a dedicated screen in front of the back four — hard to play through.',
    slots: [...GK, ...back4(), ...line(DM, [['CDM', CENTRE]]), ...flatMid4(), ...loneStriker()],
  },
  {
    key: '4-2-1-3',
    label: '4-2-1-3',
    description: 'Double pivot behind a playmaker, with a front three stretching the last line.',
    slots: [
      ...GK,
      ...back4(),
      ...line(DM, [
        ['CDM', PAIR[0]],
        ['CDM', PAIR[1]],
      ]),
      ...line(AM, [['CAM', CENTRE]]),
      ...front3(),
    ],
  },
  {
    key: '4-2-2-2',
    label: '4-2-2-2',
    description: 'Boxed midfield: two holders, two attacking midfielders in the half-spaces, two strikers.',
    slots: [
      ...GK,
      ...back4(),
      ...line(DM, [
        ['CDM', PAIR[0]],
        ['CDM', PAIR[1]],
      ]),
      ...line(AM, [
        ['CAM', 0.28],
        ['CAM', 0.72],
      ]),
      ...strikers2(),
    ],
  },
  {
    key: '4-2-3-1',
    label: '4-2-3-1',
    description: 'The modern default — a double pivot, a band of three behind a lone striker.',
    slots: [
      ...GK,
      ...back4(),
      ...line(DM, [
        ['CDM', PAIR[0]],
        ['CDM', PAIR[1]],
      ]),
      ...line(AM, [
        ['LW', THREE[0]],
        ['CAM', THREE[1]],
        ['RW', THREE[2]],
      ]),
      ...loneStriker(),
    ],
  },
  {
    key: '4-2-3-1-wide',
    label: '4-2-3-1 (2) Wide',
    description: 'The same double pivot, with the wide three held on the touchlines to stretch the block.',
    slots: [
      ...GK,
      ...back4(),
      ...line(DM, [
        ['CDM', PAIR[0]],
        ['CDM', PAIR[1]],
      ]),
      ...line(AM, [
        ['LW', 0.1],
        ['CAM', CENTRE],
        ['RW', 0.9],
      ]),
      ...loneStriker(),
    ],
  },
  {
    key: '4-2-4',
    label: '4-2-4',
    description: 'All-out attack: four forwards and only two midfielders to hold the middle.',
    slots: [
      ...GK,
      ...back4(),
      ...line(MID, [
        ['CM', PAIR[0]],
        ['CM', PAIR[1]],
      ]),
      ...line(FWD, [
        ['LW', FRONT4[0]],
        ['ST', FRONT4[1]],
        ['ST', FRONT4[2]],
        ['RW', FRONT4[3]],
      ]),
    ],
  },
  {
    key: '4-3-1-2',
    label: '4-3-1-2',
    description: 'Narrow and central — three midfielders, a playmaker, and a strike partnership.',
    slots: [
      ...GK,
      ...back4(),
      ...line(MID, [
        ['CM', THREE[0]],
        ['CM', THREE[1]],
        ['CM', THREE[2]],
      ]),
      ...line(AM, [['CAM', CENTRE]]),
      ...strikers2(),
    ],
  },
  {
    key: '4-3-2-1',
    label: '4-3-2-1 (Christmas Tree)',
    description: 'Tapers to a point: three midfielders, two withdrawn forwards, one striker.',
    slots: [
      ...GK,
      ...back4(),
      ...line(MID, [
        ['CM', THREE[0]],
        ['CM', THREE[1]],
        ['CM', THREE[2]],
      ]),
      ...line(AM, [
        ['CAM', PAIR[0]],
        ['CAM', PAIR[1]],
      ]),
      ...loneStriker(),
    ],
  },
  {
    key: '4-3-3',
    label: '4-3-3',
    description: 'Balanced formation with wide attackers and strong midfield presence.',
    slots: [
      ...GK,
      ...back4(),
      ...line(MID, [
        ['CM', THREE[0]],
        ['CM', THREE[1]],
        ['CM', THREE[2]],
      ]),
      ...front3(),
    ],
  },
  {
    key: '4-3-3-cdm',
    label: '4-3-3 (2) CDM',
    description: 'A 4-3-3 anchored by one holding midfielder, with two runners ahead of them.',
    slots: [
      ...GK,
      ...back4(),
      ...line(DM, [['CDM', CENTRE]]),
      ...line(MID, [
        ['CM', PAIR[0]],
        ['CM', PAIR[1]],
      ]),
      ...front3(),
    ],
  },
  {
    key: '4-3-3-twin-cdm',
    label: '4-3-3 (3) Twin CDM',
    description: 'Two holders screen the back four, leaving one midfielder to join the front three.',
    slots: [
      ...GK,
      ...back4(),
      ...line(DM, [
        ['CDM', PAIR[0]],
        ['CDM', PAIR[1]],
      ]),
      ...line(MID, [['CM', CENTRE]]),
      ...front3(),
    ],
  },
  {
    key: '4-3-3-cam',
    label: '4-3-3 (4) CAM',
    description: 'A 4-3-3 with the spare midfielder pushed on to play between the lines.',
    slots: [
      ...GK,
      ...back4(),
      ...line(MID, [
        ['CM', PAIR[0]],
        ['CM', PAIR[1]],
      ]),
      ...line(AM, [['CAM', CENTRE]]),
      ...front3(),
    ],
  },
  {
    key: '4-4-1-2',
    label: '4-4-1-2',
    description: 'A midfield diamond behind two strikers — the tip plays as the link man.',
    // The only entry in the source list whose digits sum to 11 rather than 10
    // (every other formation sums to 10 outfield players + a keeper). Read as
    // the diamond the name describes — a holder, two shuttlers and the "1" as
    // its tip — which is what makes it eleven. That does leave it close to
    // 4-1-2-1-2; the difference is the shuttlers sit wider here.
    slots: [
      ...GK,
      ...back4(),
      ...line(DM, [['CDM', CENTRE]]),
      ...line(MID, [
        ['CM', 0.26],
        ['CM', 0.74],
      ]),
      ...line(AM, [['CAM', CENTRE]]),
      ...strikers2(),
    ],
  },
  {
    key: '4-4-2',
    label: '4-4-2',
    description: 'Two banks of four and a strike partnership — compact, familiar, hard to disorganise.',
    slots: [...GK, ...back4(), ...flatMid4(), ...strikers2()],
  },
  {
    key: '4-4-2-holding',
    label: '4-4-2 (2) Holding Mids',
    description: 'A 4-4-2 with both central midfielders sitting deep to protect the back four.',
    slots: [
      ...GK,
      ...back4(),
      ...line(MID, [
        ['LW', FLANKED4[0]],
        ['RW', FLANKED4[3]],
      ]),
      ...line(DM, [
        ['CDM', PAIR[0]],
        ['CDM', PAIR[1]],
      ]),
      ...strikers2(),
    ],
  },
  {
    key: '4-5-1',
    label: '4-5-1',
    description: 'Five across the middle with a holding anchor — a containing shape that springs forward.',
    slots: [
      ...GK,
      ...back4(),
      ...line(MID, [
        ['LW', FLANKED4[0]],
        ['CM', 0.35],
        ['CM', 0.65],
        ['RW', FLANKED4[3]],
      ]),
      ...line(DM, [['CDM', CENTRE]]),
      ...loneStriker(),
    ],
  },
  {
    key: '4-5-1-three-cms',
    label: '4-5-1 (2) Three CMs',
    description: 'The same five, flat: three central midfielders between two wide men.',
    slots: [
      ...GK,
      ...back4(),
      ...line(MID, [
        ['LW', 0.1],
        ['CM', 0.32],
        ['CM', CENTRE],
        ['CM', 0.68],
        ['RW', 0.9],
      ]),
      ...loneStriker(),
    ],
  },

  // ── Back five (4) ───────────────────────────────────────────────────────
  {
    key: '5-2-1-2',
    label: '5-2-1-2',
    description: 'Five at the back with a playmaker feeding two strikers on the counter.',
    slots: [
      ...GK,
      ...back5(),
      ...line(MID, [
        ['CM', PAIR[0]],
        ['CM', PAIR[1]],
      ]),
      ...line(AM, [['CAM', CENTRE]]),
      ...strikers2(),
    ],
  },
  {
    key: '5-2-3',
    label: '5-2-3',
    description: 'A back five that breaks into a front three — defensively solid, dangerous in transition.',
    slots: [
      ...GK,
      ...back5(),
      ...line(MID, [
        ['CM', PAIR[0]],
        ['CM', PAIR[1]],
      ]),
      ...front3(),
    ],
  },
  {
    key: '5-3-2',
    label: '5-3-2',
    description: 'Deep and compact: five defenders, three midfielders, two strikers to hold the ball up.',
    slots: [
      ...GK,
      ...back5(),
      ...line(MID, [
        ['CM', THREE[0]],
        ['CM', THREE[1]],
        ['CM', THREE[2]],
      ]),
      ...strikers2(),
    ],
  },
  {
    key: '5-4-1',
    label: '5-4-1',
    description: 'Maximum defensive cover — nine behind the ball and a lone striker to relieve pressure.',
    slots: [...GK, ...back5(), ...flatMid4(), ...loneStriker()],
  },

  // ── Nine-a-side (5) ─────────────────────────────────────────────────────
  {
    key: '9-3-2-3',
    label: '3-2-3',
    description: 'The standard nine-a-side shape: a back three, a midfield pair, and width high up.',
    slots: [...GK, ...back3(), ...mid2(), ...front3()],
  },
  {
    key: '9-3-3-2',
    label: '3-3-2',
    description: 'Three across the middle to control it, with a front pair to press in twos.',
    slots: [...GK, ...back3(), ...mid3(), ...strikers2()],
  },
  {
    key: '9-2-3-3',
    label: '2-3-3',
    description: 'Two at the back and six ahead of the ball — the attacking end of nine-a-side.',
    slots: [...GK, ...back2(), ...mid3(), ...front3()],
  },
  {
    key: '9-3-4-1',
    label: '3-4-1',
    description: 'A packed midfield four behind a lone striker, hard to play through.',
    slots: [...GK, ...back3(), ...flatMid4(), ...loneStriker()],
  },
  {
    key: '9-2-4-2',
    label: '2-4-2',
    description: 'Width and numbers in midfield, with a front two to hold the line up.',
    slots: [...GK, ...back2(), ...flatMid4(), ...strikers2()],
  },

  // ── Seven-a-side (5) ────────────────────────────────────────────────────
  {
    key: '7-2-3-1',
    label: '2-3-1',
    description: 'The default seven-a-side shape — a back pair, three across, one up.',
    slots: [...GK, ...back2(), ...mid3(), ...loneStriker()],
  },
  {
    key: '7-3-2-1',
    label: '3-2-1',
    description: 'Three at the back for cover, with a midfield pair feeding a lone striker.',
    slots: [...GK, ...back3(), ...mid2(), ...loneStriker()],
  },
  {
    key: '7-2-1-2-1',
    label: '2-1-2-1',
    description: 'A holding midfielder between the lines — the diamond, at seven a side.',
    slots: [
      ...GK,
      ...back2(),
      ...holder(),
      ...line(MID, [
        ['LW', PAIR[0]],
        ['RW', PAIR[1]],
      ]),
      ...loneStriker(),
    ],
  },
  {
    key: '7-3-1-2',
    label: '3-1-2',
    description: 'Back three screened by a holder, with two to run in behind.',
    slots: [...GK, ...back3(), ...holder(), ...strikers2()],
  },
  {
    key: '7-2-2-2',
    label: '2-2-2',
    description: 'Even thirds — simple to coach and easy for young players to hold.',
    slots: [...GK, ...back2(), ...mid2(), ...strikers2()],
  },
]

/** Team size a formation is for: 11, 9 or 7. Derived, never restated. */
export function formationSize(formation: Formation): number {
  return formation.slots.length
}

/** The sizes the picker groups by, largest first. */
export const FORMATION_SIZES = [11, 9, 7] as const

export function findFormation(key: string): Formation | null {
  return FORMATIONS.find((f) => f.key === key) ?? null
}

// The away side attacks -x, so its shape is the home authoring reflected in
// the halfway line. `y` is untouched — see the header.
export function mirrorSlots(slots: FormationSlot[]): FormationSlot[] {
  return slots.map((slot) => ({ ...slot, x: 1 - slot.x }))
}

export function slotsForSide(formation: Formation, side: 'home' | 'away'): FormationSlot[] {
  return side === 'home' ? formation.slots : mirrorSlots(formation.slots)
}

// ── Slot assignment (Stage 3.2) ───────────────────────────────────────────
//
// "Assigns each on-pitch entity to the nearest unfilled slot by role affinity
// first, then distance."
//
// Read GLOBALLY rather than as a per-entity loop: every (entity, slot) pair is
// scored, and the cheapest available pair is taken until one side runs out.
// A per-entity loop would be order-dependent — whoever happened to be first in
// `scene.entities` would get their pick, and a later entity could be stranded
// across the pitch from an equally good slot that was still free.
//
// Affinity dominates distance by construction: the widest possible distance on
// a normalized pitch is sqrt(2) ~ 1.41, and one step of role mismatch costs 10.
// So a slot is only ever decided on distance between candidates of equal role
// fit — which is exactly what "affinity first, then distance" asks for.

// Which band of the pitch a role belongs to. The GK band is deliberately its
// own thing: a keeper must never be slotted outfield and an outfielder must
// never be put in goal, which is the specific failure the definition of done
// names.
const ROLE_BAND: Record<PlayerRole, number> = {
  GK: 0,
  LB: 1,
  CB: 1,
  RB: 1,
  CDM: 2,
  CM: 2,
  CAM: 3,
  LW: 3,
  RW: 3,
  ST: 4,
}

const MISMATCH_COST = 10
// Larger than any achievable mismatch cost (max band gap is 4), so no distance
// and no combination of ordinary mismatches can ever talk the solver into
// putting an outfielder in goal.
const GK_MISMATCH_COST = 1000

function roleCost(entityRole: PlayerRole | undefined, slotRole: PlayerRole): number {
  const keeperSlot = slotRole === 'GK'
  const keeperEntity = entityRole === 'GK'

  // The goalkeeper slot is RESERVED, and this test comes before the blank-slate
  // rule below on purpose. An entity with no role fits every OUTFIELD slot
  // equally — but letting that extend to the one position that isn't
  // interchangeable is how a keeper ends up at right-back: an unroled
  // outfielder standing a few metres closer to goal outbids them for it, and
  // then every remaining slot costs the keeper a mismatch anyway, so they take
  // whichever is nearest. Observed live before this guard existed.
  //
  // If NOBODY is a known keeper, every entity pays this same cost for the slot
  // and the cheapest outfield pairs are consumed first, so whoever is left over
  // goes in goal. Someone has to.
  if (keeperSlot !== keeperEntity) return GK_MISMATCH_COST
  if (keeperSlot) return 0

  // A blank slate outfield: pure distance decides. That is the state every
  // tactic backfilled by migration 020b starts in, and the first apply is what
  // gives its players roles.
  if (!entityRole) return 0
  if (entityRole === slotRole) return 0
  return Math.abs(ROLE_BAND[entityRole] - ROLE_BAND[slotRole]) * MISMATCH_COST + MISMATCH_COST / 2
}

function distance(state: EntityState | undefined, slot: FormationSlot): number {
  if (!state || state.x === undefined || state.y === undefined) return 0
  return Math.hypot(state.x - slot.x, state.y - slot.y)
}

// A keeper may be flagged rather than roled — `SceneEntity.goalkeeper` predates
// `role` and the drill editor still sets it — so treat that as a GK role.
function effectiveRole(entity: SceneEntity): PlayerRole | undefined {
  if (entity.role) return entity.role
  return entity.goalkeeper ? 'GK' : undefined
}

export interface SlotAssignment {
  entityId: string
  slot: FormationSlot
}

// Pure. Takes the entities to place and where they currently stand, and
// returns one assignment per entity that got a slot. Entities beyond the
// eleventh are left unassigned (the caller leaves them where they are);
// unfilled slots are simply not returned.
export function assignToFormation(
  entities: SceneEntity[],
  states: Record<string, EntityState>,
  slots: FormationSlot[]
): SlotAssignment[] {
  const pairs: { entityId: string; slotIndex: number; cost: number }[] = []
  for (const entity of entities) {
    const role = effectiveRole(entity)
    slots.forEach((slot, slotIndex) => {
      pairs.push({
        entityId: entity.id,
        slotIndex,
        cost: roleCost(role, slot.role) + distance(states[entity.id], slot),
      })
    })
  }
  // Ties broken by entity id then slot index, so the same inputs always give
  // the same output — a formation that reshuffled two identical players on
  // every apply would look broken.
  pairs.sort((a, b) => a.cost - b.cost || a.entityId.localeCompare(b.entityId) || a.slotIndex - b.slotIndex)

  const takenEntities = new Set<string>()
  const takenSlots = new Set<number>()
  const assignments: SlotAssignment[] = []
  for (const pair of pairs) {
    if (takenEntities.has(pair.entityId) || takenSlots.has(pair.slotIndex)) continue
    takenEntities.add(pair.entityId)
    takenSlots.add(pair.slotIndex)
    assignments.push({ entityId: pair.entityId, slot: slots[pair.slotIndex] })
  }
  return assignments
}

// ── Custom formations (Stage 3.4) ─────────────────────────────────────────
//
// A coach's saved shapes live in the `formation` table (migration 022) and are
// offered in the same picker as the 29 built-ins. Their keys are prefixed so a
// shape a coach names "4-3-3" can never collide with the built-in of that name.

const CUSTOM_PREFIX = 'custom:'

export function customFormationKey(id: string): string {
  return `${CUSTOM_PREFIX}${id}`
}

export function isCustomFormationKey(key: string): boolean {
  return key.startsWith(CUSTOM_PREFIX)
}

export function customFormationId(key: string): string {
  return key.slice(CUSTOM_PREFIX.length)
}

// Resolves a formation key against the built-ins and the coach's saved shapes,
// so a caller holding only a key can get the slots it needs to apply.
export function resolveFormation(key: string, custom: CustomFormation[]): Formation | null {
  if (!isCustomFormationKey(key)) return findFormation(key)
  const saved = custom.find((f) => f.id === customFormationId(key))
  if (!saved) return null
  return { key, label: saved.name, description: 'Your saved shape.', slots: saved.slots }
}

// The slot a player who has NEVER been on the pitch should be placed in
// (Stage 4's verify step: "toggling one on places it in the first free slot").
//
// Distinct from `assignToFormation`, and deliberately so: that re-shapes a
// whole side at once and is free to move everyone, while this places one
// player into a shape the others are already standing in. Walking the slots in
// formation order — keeper first, then defence, midfield, attack — means a
// coach filling an empty board one player at a time builds their team back to
// front, which is how they would set it up on a whiteboard.
//
// `occupied` is the set of on-pitch positions, so a slot counts as free when
// nobody is standing on it. Returns null when every slot is taken; the caller
// then has more players than the formation has places, and puts them somewhere
// of its own choosing rather than stacking them on someone.
export function nextFreeSlot(
  slots: FormationSlot[],
  states: Record<string, EntityState>,
  onPitchEntityIds: string[]
): FormationSlot | null {
  const occupied = new Set(
    onPitchEntityIds
      .map((id) => states[id])
      .filter((state): state is EntityState => !!state && state.x !== undefined && state.y !== undefined)
      .map((state) => `${state.x}:${state.y}`)
  )
  return slots.find((slot) => !occupied.has(`${slot.x}:${slot.y}`)) ?? null
}
