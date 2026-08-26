import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Reveal } from './Reveal'

// A showcase carousel of six sketched drill types — the design tool's range
// in one scannable strip, ahead of FeatureSections' single deep-dive card.
// Native CSS scroll-snap (works with touch/trackpad/keyboard with zero JS)
// plus autoplay, arrow nav and dot pagination layered on top. Autoplay
// pauses on hover/touch and never starts at all under reduced motion.

interface DrillCard {
  tag: string
  title: string
  body: string
  visual: React.ReactNode
}

function pitchFrame() {
  return (
    <>
      <rect x="6" y="6" width="308" height="168" rx="8" fill="none" stroke="var(--color-line-strong)" />
      <line x1="160" y1="6" x2="160" y2="174" stroke="var(--color-line)" />
      <circle cx="160" cy="90" r="24" fill="none" stroke="var(--color-line)" />
    </>
  )
}

function RondoVisual() {
  const pts = [
    [160, 40],
    [220, 60],
    [232, 90],
    [220, 120],
    [160, 140],
    [100, 120],
    [88, 90],
    [100, 60],
  ]
  return (
    <svg viewBox="0 0 320 180" className="w-full" role="img" aria-label="Rondo possession circle">
      {pitchFrame()}
      <circle cx="160" cy="90" r="52" fill="none" stroke="var(--color-line)" strokeDasharray="3 4" />
      {pts.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="9" fill="var(--color-panel-raised)" stroke="var(--color-ink-muted)" />
      ))}
      <circle cx="160" cy="90" r="7" fill="var(--color-panel-raised)" stroke="var(--color-accent)" strokeWidth="2" />
      <circle cx="160" cy="76" r="3.5" fill="var(--color-ink)" />
    </svg>
  )
}

function FinishingVisual() {
  return (
    <svg viewBox="0 0 320 180" className="w-full" role="img" aria-label="Finishing drill into the box">
      {pitchFrame()}
      <rect x="252" y="46" width="60" height="88" fill="none" stroke="var(--color-line)" />
      <rect x="292" y="66" width="20" height="48" fill="none" stroke="var(--color-line)" />
      <path
        d="M 90 150 C 150 145, 200 110, 262 90"
        fill="none"
        stroke="var(--color-accent)"
        strokeWidth="2.5"
        strokeDasharray="6 5"
        strokeLinecap="round"
      />
      <path d="M 262 90 l -11 -3 m 11 3 l -5 9" fill="none" stroke="var(--color-accent)" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="90" cy="150" r="9" fill="var(--color-panel-raised)" stroke="var(--color-ink-muted)" />
      <circle cx="170" cy="120" r="9" fill="var(--color-panel-raised)" stroke="var(--color-ink-muted)" />
      <circle cx="94" cy="140" r="4" fill="var(--color-ink)" />
      <path d="M 218 34 l 6 12 h -12 z" fill="var(--color-warn)" opacity="0.85" />
      <path d="M 218 146 l 6 12 h -12 z" fill="var(--color-warn)" opacity="0.85" />
    </svg>
  )
}

function PressingVisual() {
  return (
    <svg viewBox="0 0 320 180" className="w-full" role="img" aria-label="Pressing trap sketch">
      {pitchFrame()}
      <rect x="130" y="40" width="70" height="100" fill="var(--color-bad)" opacity="0.08" stroke="var(--color-bad)" strokeDasharray="4 4" />
      <circle cx="165" cy="90" r="9" fill="var(--color-bad)" opacity="0.85" />
      {[
        [110, 40],
        [220, 40],
        [110, 140],
        [220, 140],
      ].map(([x, y], i) => (
        <g key={i}>
          <circle cx={x} cy={y} r="9" fill="var(--color-panel-raised)" stroke="var(--color-ink-muted)" />
          <path
            d={`M ${x} ${y} L ${165 + (x < 165 ? 12 : -12)} ${90 + (y < 90 ? 12 : -12)}`}
            stroke="var(--color-accent)"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </g>
      ))}
    </svg>
  )
}

function WideOverloadVisual() {
  return (
    <svg viewBox="0 0 320 180" className="w-full" role="img" aria-label="Wide overload overlap sketch">
      {pitchFrame()}
      <path
        d="M 60 150 C 90 150, 110 100, 90 60 C 80 40, 110 30, 140 42"
        fill="none"
        stroke="var(--color-accent)"
        strokeWidth="2.5"
        strokeDasharray="6 5"
        strokeLinecap="round"
      />
      <path d="M 140 42 l -12 -2 m 12 2 l -5 10" fill="none" stroke="var(--color-accent)" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="60" y1="150" x2="150" y2="150" stroke="var(--color-ink-muted)" strokeWidth="2" strokeDasharray="3 4" />
      <circle cx="60" cy="150" r="9" fill="var(--color-panel-raised)" stroke="var(--color-ink-muted)" />
      <circle cx="150" cy="150" r="9" fill="var(--color-panel-raised)" stroke="var(--color-ink-muted)" />
      <circle cx="64" cy="140" r="4" fill="var(--color-ink)" />
      <circle cx="230" cy="70" r="9" fill="var(--color-bad)" opacity="0.7" />
    </svg>
  )
}

function TransitionVisual() {
  return (
    <svg viewBox="0 0 320 180" className="w-full" role="img" aria-label="Transition counter-attack sketch">
      {pitchFrame()}
      <path
        d="M 50 90 L 270 90"
        fill="none"
        stroke="var(--color-accent)"
        strokeWidth="2.5"
        strokeDasharray="8 6"
        strokeLinecap="round"
      />
      <path d="M 270 90 l -12 -6 m 12 6 l -12 6" fill="none" stroke="var(--color-accent)" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="50" cy="90" r="9" fill="var(--color-panel-raised)" stroke="var(--color-ink-muted)" />
      <circle cx="54" cy="80" r="4" fill="var(--color-ink)" />
      <circle cx="120" cy="60" r="8" fill="var(--color-bad)" opacity="0.6" />
      <circle cx="140" cy="120" r="8" fill="var(--color-bad)" opacity="0.6" />
      <circle cx="230" cy="90" r="8" fill="var(--color-bad)" opacity="0.6" />
    </svg>
  )
}

function SetPieceVisual() {
  return (
    <svg viewBox="0 0 320 180" className="w-full" role="img" aria-label="Corner set-piece sketch">
      {pitchFrame()}
      <rect x="252" y="46" width="60" height="88" fill="none" stroke="var(--color-line)" />
      <path d="M 300 46 A 8 8 0 0 1 300 62" fill="none" stroke="var(--color-line-strong)" />
      <path
        d="M 300 50 C 270 60, 250 80, 260 100"
        fill="none"
        stroke="var(--color-accent)"
        strokeWidth="2"
        strokeDasharray="5 4"
      />
      <path
        d="M 300 50 C 260 70, 240 100, 258 120"
        fill="none"
        stroke="var(--color-accent-hover)"
        strokeWidth="2"
        strokeDasharray="5 4"
      />
      <circle cx="260" cy="100" r="8" fill="var(--color-panel-raised)" stroke="var(--color-ink-muted)" />
      <circle cx="258" cy="120" r="8" fill="var(--color-panel-raised)" stroke="var(--color-ink-muted)" />
      <circle cx="300" cy="50" r="4" fill="var(--color-ink)" />
    </svg>
  )
}

const CARDS: DrillCard[] = [
  { tag: 'POSSESSION', title: 'Rondo pressure', body: 'A tight circle, one target, one ball — the pattern every session starts with.', visual: <RondoVisual /> },
  { tag: 'ATTACKING', title: 'Finishing runs', body: 'Two runners, a cutback lane, and a shot arrow into the six-yard box.', visual: <FinishingVisual /> },
  { tag: 'OUT OF POSSESSION', title: 'Pressing trigger', body: 'Four defenders converging on a trapped zone the moment the ball dies.', visual: <PressingVisual /> },
  { tag: 'BUILD-UP', title: 'Wide overload', body: 'A fullback overlaps the winger to turn a 1v1 into a 2v1 out wide.', visual: <WideOverloadVisual /> },
  { tag: 'TRANSITION', title: 'Counter-attack', body: 'One long pass, three defenders still turning — the moment you drill for.', visual: <TransitionVisual /> },
  { tag: 'SET PIECE', title: 'Corner routine', body: 'Near-post flick, far-post arrival — two runs mapped off one delivery.', visual: <SetPieceVisual /> },
]

const AUTOPLAY_MS = 4200

export function DrillCarousel() {
  const trackRef = useRef<HTMLDivElement | null>(null)
  const cardRefs = useRef<(HTMLDivElement | null)[]>([])
  const [active, setActive] = useState(0)
  const [paused, setPaused] = useState(false)
  const [reduced, setReduced] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches)

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const onChange = () => setReduced(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  // Tracks which card is most centered, for the dot pagination — driven by
  // scroll position rather than autoplay state, so manual drag/swipe/arrow
  // navigation keeps the dots honest too.
  useEffect(() => {
    const track = trackRef.current
    if (!track) return
    const ratios = new Map<number, number>()
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const idx = cardRefs.current.indexOf(entry.target as HTMLDivElement)
          if (idx !== -1) ratios.set(idx, entry.intersectionRatio)
        }
        let best = 0
        let bestRatio = -1
        for (const [idx, ratio] of ratios) {
          if (ratio > bestRatio) {
            best = idx
            bestRatio = ratio
          }
        }
        setActive(best)
      },
      { root: track, threshold: [0.3, 0.5, 0.7, 0.9] }
    )
    cardRefs.current.forEach((el) => el && io.observe(el))
    return () => io.disconnect()
  }, [])

  function scrollToIndex(index: number, smooth = true) {
    const card = cardRefs.current[index]
    if (!card) return
    card.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', inline: 'center', block: 'nearest' })
  }

  function step(delta: number) {
    const next = Math.max(0, Math.min(CARDS.length - 1, active + delta))
    scrollToIndex(next)
  }

  // Autoplay: advance one card on a timer, wrap to the start at the end.
  // Off entirely under reduced motion; paused on hover/touch/focus so a
  // visitor reading a card never has it yanked away mid-read.
  useEffect(() => {
    if (reduced || paused) return
    const id = window.setInterval(() => {
      const next = (active + 1) % CARDS.length
      scrollToIndex(next)
    }, AUTOPLAY_MS)
    return () => window.clearInterval(id)
  }, [active, paused, reduced])

  return (
    <section className="border-t border-line py-24">
      <div className="mx-auto max-w-6xl px-6">
        <Reveal>
          <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <p className="text-sm font-semibold text-accent">In the design tool</p>
              <h2 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
                Sketch anything you'd chalk on a whiteboard.
              </h2>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                aria-label="Previous drill"
                onClick={() => step(-1)}
                disabled={active === 0}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-line text-ink-muted transition-colors hover:border-line-strong hover:text-ink disabled:opacity-30"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                aria-label="Next drill"
                onClick={() => step(1)}
                disabled={active === CARDS.length - 1}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-line text-ink-muted transition-colors hover:border-line-strong hover:text-ink disabled:opacity-30"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </Reveal>

        <Reveal delay={120}>
          <div
            ref={trackRef}
            onPointerEnter={() => setPaused(true)}
            onPointerLeave={() => setPaused(false)}
            onFocusCapture={() => setPaused(true)}
            onBlurCapture={() => setPaused(false)}
            className="no-scrollbar mt-10 flex snap-x snap-mandatory gap-5 overflow-x-auto scroll-smooth pb-2"
          >
            {CARDS.map((card, i) => (
              <div
                key={card.title}
                ref={(el) => {
                  cardRefs.current[i] = el
                }}
                className="group w-[280px] shrink-0 snap-center sm:w-[320px]"
              >
                <div className="panel-edge h-full rounded-xl border border-line bg-panel p-5 transition-all duration-300 hover:-translate-y-1 hover:border-line-strong">
                  <div className="overflow-hidden rounded-lg border border-line bg-panel-raised">{card.visual}</div>
                  <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-accent">{card.tag}</p>
                  <h3 className="mt-1 text-lg font-semibold tracking-tight text-ink">{card.title}</h3>
                  <p className="mt-1.5 text-sm text-ink-muted">{card.body}</p>
                </div>
              </div>
            ))}
          </div>
        </Reveal>

        <div className="mt-6 flex items-center justify-center gap-2">
          {CARDS.map((card, i) => (
            <button
              key={card.title}
              type="button"
              aria-label={`Go to ${card.title}`}
              aria-current={i === active}
              onClick={() => scrollToIndex(i)}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === active ? 'w-6 bg-accent' : 'w-1.5 bg-line-strong hover:bg-ink-faint'
              }`}
            />
          ))}
        </div>
      </div>
    </section>
  )
}
