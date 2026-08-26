import { Reveal } from './Reveal'

// Four alternating feature vignettes (landing-page spec, 2026-08-26). The
// visuals are hand-built token-based CSS/SVG sketches, deliberately NOT
// screenshots — they stay crisp at any size and inherit the design system.

interface VignetteSpec {
  eyebrow: string
  heading: string
  body: string
  bullets: string[]
  visual: React.ReactNode
}

// A mini pitch with a dashed run-arrow and player dots — the drill designer.
function DrillVisual() {
  return (
    <svg viewBox="0 0 320 200" className="w-full" role="img" aria-label="Sketched drill with a run arrow">
      <rect x="8" y="8" width="304" height="184" rx="10" fill="none" stroke="var(--color-line-strong)" />
      <line x1="160" y1="8" x2="160" y2="192" stroke="var(--color-line)" />
      <circle cx="160" cy="100" r="26" fill="none" stroke="var(--color-line)" />
      <rect x="8" y="56" width="40" height="88" fill="none" stroke="var(--color-line)" />
      <rect x="272" y="56" width="40" height="88" fill="none" stroke="var(--color-line)" />
      {/* run arrow */}
      <path
        d="M 70 150 C 120 140, 150 90, 218 74"
        fill="none"
        stroke="var(--color-accent)"
        strokeWidth="2.5"
        strokeDasharray="6 5"
        strokeLinecap="round"
      />
      <path d="M 218 74 l -10 -2 m 10 2 l -6 8" fill="none" stroke="var(--color-accent)" strokeWidth="2.5" strokeLinecap="round" />
      {/* players */}
      <circle cx="70" cy="150" r="11" fill="var(--color-panel-raised)" stroke="var(--color-ink-muted)" />
      <circle cx="110" cy="70" r="11" fill="var(--color-panel-raised)" stroke="var(--color-ink-muted)" />
      <circle cx="230" cy="120" r="11" fill="var(--color-panel-raised)" stroke="var(--color-ink-muted)" />
      {/* cones */}
      <path d="M 180 46 l 6 12 h -12 z" fill="var(--color-warn)" opacity="0.85" />
      <path d="M 205 150 l 6 12 h -12 z" fill="var(--color-warn)" opacity="0.85" />
      <path d="M 140 130 l 6 12 h -12 z" fill="var(--color-warn)" opacity="0.85" />
      {/* ball */}
      <circle cx="74" cy="138" r="4.5" fill="var(--color-ink)" />
    </svg>
  )
}

// A 4-3-3 dot grid that shifts into a press on hover — the tactics board.
function FormationVisual() {
  // [x%, y%] per player, plus a hover offset [dx, dy] in %.
  const dots: { x: number; y: number; dx: number; dy: number }[] = [
    { x: 8, y: 50, dx: 2, dy: 0 },
    { x: 24, y: 16, dx: 5, dy: 2 },
    { x: 22, y: 39, dx: 4, dy: 0 },
    { x: 22, y: 61, dx: 4, dy: 0 },
    { x: 24, y: 84, dx: 5, dy: -2 },
    { x: 46, y: 28, dx: 7, dy: 2 },
    { x: 42, y: 50, dx: 6, dy: 0 },
    { x: 46, y: 72, dx: 7, dy: -2 },
    { x: 70, y: 18, dx: 9, dy: 4 },
    { x: 74, y: 50, dx: 8, dy: 0 },
    { x: 70, y: 82, dx: 9, dy: -4 },
  ]
  return (
    <div className="relative aspect-[8/5] w-full overflow-hidden rounded-lg border border-line bg-panel-raised" aria-label="4-3-3 formation shifting forward" role="img">
      <div className="absolute inset-y-0 left-1/2 w-px bg-line" />
      <div className="absolute left-1/2 top-1/2 h-16 w-16 -translate-x-1/2 -translate-y-1/2 rounded-full border border-line" />
      {dots.map((d, i) => (
        <span
          key={i}
          className="absolute h-3.5 w-3.5 rounded-full bg-accent transition-transform duration-500 ease-out group-hover:translate-x-[var(--fx)] group-hover:translate-y-[var(--fy)]"
          style={
            {
              left: `${d.x}%`,
              top: `${d.y}%`,
              '--fx': `${d.dx * 4}px`,
              '--fy': `${d.dy * 3}px`,
            } as React.CSSProperties
          }
        />
      ))}
      <span className="absolute bottom-2 right-3 text-xs text-ink-faint">4-3-3 → press</span>
    </div>
  )
}

// A mini attendance list — sessions & attendance.
function AttendanceVisual() {
  const rows: { name: string; status: 'ok' | 'warn' | 'bad' }[] = [
    { name: 'A. Keeper', status: 'ok' },
    { name: 'J. Fullback', status: 'ok' },
    { name: 'S. Midfield', status: 'warn' },
    { name: 'R. Winger', status: 'ok' },
    { name: 'T. Striker', status: 'bad' },
  ]
  const dot = { ok: 'bg-ok', warn: 'bg-warn', bad: 'bg-bad' }
  const label = { ok: 'Present', warn: 'Unconfirmed', bad: 'Unavailable' }
  return (
    <div className="w-full rounded-lg border border-line bg-panel-raised p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-semibold text-ink">Tuesday session</span>
        <span className="text-xs text-ink-muted">3 of 5 in</span>
      </div>
      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.name} className="flex items-center justify-between rounded-md border border-line bg-panel px-3 py-2">
            <span className="text-sm text-ink">{r.name}</span>
            <span className="flex items-center gap-1.5 text-xs text-ink-muted">
              <span className={`h-2 w-2 rounded-full ${dot[r.status]}`} />
              {label[r.status]}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

// A phone outline with a mini pitch and an offline pill — the PWA.
function PwaVisual() {
  return (
    <div className="flex w-full items-center justify-center py-2">
      <div className="w-44 rounded-[1.75rem] border border-line-strong bg-panel-raised p-3">
        <div className="mx-auto mb-3 h-1 w-12 rounded-full bg-line-strong" />
        <div className="relative aspect-[3/4] overflow-hidden rounded-xl border border-line bg-panel">
          <div className="absolute inset-x-3 top-3 h-1.5 rounded bg-panel-raised" />
          <div className="absolute inset-x-3 top-7 h-1.5 w-1/2 rounded bg-panel-raised" />
          <svg viewBox="0 0 100 90" className="absolute inset-x-3 bottom-3 top-12 h-auto w-[calc(100%-1.5rem)]">
            <rect x="2" y="2" width="96" height="86" rx="6" fill="none" stroke="var(--color-line-strong)" />
            <line x1="2" y1="45" x2="98" y2="45" stroke="var(--color-line)" />
            <circle cx="50" cy="45" r="12" fill="none" stroke="var(--color-line)" />
            <circle cx="34" cy="24" r="5" fill="var(--color-accent)" />
            <circle cx="66" cy="30" r="5" fill="var(--color-accent)" />
            <circle cx="50" cy="64" r="5" fill="var(--color-accent)" />
          </svg>
          <span className="absolute bottom-2 right-2 flex items-center gap-1 rounded-full border border-line bg-panel-raised px-2 py-0.5 text-[10px] font-medium text-ok">
            <span className="h-1.5 w-1.5 rounded-full bg-ok" />
            Offline
          </span>
        </div>
      </div>
    </div>
  )
}

const VIGNETTES: VignetteSpec[] = [
  {
    eyebrow: 'Drill designer',
    heading: 'Draw drills players actually understand.',
    body: 'Thirteen drawing tools, eight equipment types and four pitch formats. Sketch the movement, set the keyframes, and share a living drill card with one link — no more whiteboard photos in the group chat.',
    bullets: [
      'Animated keyframe timeline',
      "Witches' hats to mannequins — real training kit",
      'Share read-only drill cards with any coach',
    ],
    visual: <DrillVisual />,
  },
  {
    eyebrow: 'Tactics board',
    heading: 'Your game model, animated.',
    body: 'Twenty-nine built-in formations that know a right-back from a wing-back. Bind markers to your real roster, animate phases of play, and present it like you mean it.',
    bullets: [
      'Roster-linked player markers',
      'Home and away boards, single or dual view',
      'Phases, spotlights and highlights for the team talk',
    ],
    visual: <FormationVisual />,
  },
  {
    eyebrow: 'Sessions & attendance',
    heading: 'Matchday-ready in minutes, not evenings.',
    body: "Plan sessions from your drill library, track who's coming, and take attendance in two taps from the touchline. The admin disappears; the coaching stays.",
    bullets: ['Session planner built on your own drills', 'Availability at a glance', 'Two-tap attendance, pitch-side'],
    visual: <AttendanceVisual />,
  },
  {
    eyebrow: 'Pitch-side PWA',
    heading: "Works where wifi doesn't.",
    body: 'Gaffer installs to your phone and keeps your plans readable with zero bars — dark interface, floodlight-friendly, built for the touchline rather than the office.',
    bullets: ['Installs like a native app', 'Session plans readable offline', 'Fast on a three-year-old phone'],
    visual: <PwaVisual />,
  },
]

function Vignette({ spec, flip }: { spec: VignetteSpec; flip: boolean }) {
  return (
    <Reveal>
      <div className={`grid items-center gap-10 lg:grid-cols-2 ${flip ? 'lg:[&>*:first-child]:order-2' : ''}`}>
        <div>
          <p className="text-sm font-semibold text-accent">{spec.eyebrow}</p>
          <h3 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">{spec.heading}</h3>
          <p className="mt-4 text-base text-ink-muted">{spec.body}</p>
          <ul className="mt-6 space-y-2">
            {spec.bullets.map((b) => (
              <li key={b} className="flex items-start gap-2 text-sm text-ink">
                <span aria-hidden className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                {b}
              </li>
            ))}
          </ul>
        </div>
        <div className="group panel-edge rounded-xl border border-line bg-panel p-6 transition-all duration-300 hover:-translate-y-1 hover:border-line-strong">
          {spec.visual}
        </div>
      </div>
    </Reveal>
  )
}

export function FeatureSections() {
  return (
    <section id="features" className="mx-auto max-w-6xl space-y-28 px-6 py-24">
      <Reveal>
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-4xl font-semibold tracking-tight">Everything between whistle and whiteboard</h2>
          <p className="mt-3 text-ink-muted">One workspace for the whole coaching week.</p>
        </div>
      </Reveal>
      {VIGNETTES.map((spec, i) => (
        <Vignette key={spec.eyebrow} spec={spec} flip={i % 2 === 1} />
      ))}
    </section>
  )
}
