import { useEffect, useState } from 'react'
import { useReveal } from './useReveal'

// All four are true product facts — the credibility band the spec chose over
// invented adoption numbers.
const STATS: { value: number; suffix: string; label: string }[] = [
  { value: 29, suffix: '', label: 'built-in formations' },
  { value: 13, suffix: '', label: 'drawing tools' },
  { value: 30, suffix: ' fps', label: 'animation timeline' },
  { value: 100, suffix: '%', label: 'works offline' },
]

function CountUp({ to, suffix, run }: { to: number; suffix: string; run: boolean }) {
  // Reduced-motion renders the target directly — no state write, no count-up.
  const [reduced] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  const [n, setN] = useState(0)
  useEffect(() => {
    if (!run || reduced) return
    let raf = 0
    const start = performance.now()
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / 1200)
      setN(Math.round(to * (1 - Math.pow(1 - p, 3)))) // ease-out cubic
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [run, to, reduced])
  return (
    <span className="text-4xl font-semibold tracking-tight text-ink">
      {reduced ? to : n}
      {suffix}
    </span>
  )
}

export function StatsStrip() {
  const { ref, shown } = useReveal<HTMLDivElement>(0.4)
  return (
    <section ref={ref} className="mx-auto grid max-w-5xl grid-cols-2 gap-8 px-6 py-16 sm:grid-cols-4">
      {STATS.map((s) => (
        <div key={s.label} className="flex flex-col items-center gap-1 text-center">
          <CountUp to={s.value} suffix={s.suffix} run={shown} />
          <span className="text-sm text-ink-muted">{s.label}</span>
        </div>
      ))}
    </section>
  )
}
