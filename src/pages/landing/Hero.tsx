import { Suspense, lazy } from 'react'
import { Reveal } from './Reveal'
import { WaitlistForm } from './WaitlistForm'

const HeroPitch = lazy(() => import('./HeroPitch'))

export function Hero() {
  return (
    <section id="product" className="relative overflow-hidden px-6 pb-24 pt-36">
      {/* ambient accent glow — decorative only */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-0 h-[600px] w-[900px] max-w-none rounded-full opacity-60 blur-3xl"
        style={{
          transform: 'translate(-50%, -30%)',
          background:
            'radial-gradient(closest-side, color-mix(in srgb, var(--color-accent) 22%, transparent), transparent)',
          animation: 'landing-glow 9s ease-in-out infinite',
        }}
      />
      <div className="relative mx-auto flex max-w-4xl flex-col items-center text-center">
        <Reveal>
          <p className="rounded-full border border-line bg-panel px-3 py-1 text-xs font-medium text-ink-muted">
            Early access — now open for founding clubs
          </p>
        </Reveal>
        <Reveal delay={80}>
          <h1 className="mt-6 text-5xl font-semibold leading-[1.05] tracking-tight sm:text-7xl">
            Coach like a gaffer.
          </h1>
        </Reveal>
        <Reveal delay={160}>
          <p className="mt-5 max-w-xl text-base text-ink-muted sm:text-lg">
            Session planning, drill design and animated tactics in one fast, pitch-side
            workspace. Built by a coach, for coaches.
          </p>
        </Reveal>
        <Reveal delay={240} className="mt-8 flex w-full justify-center">
          <WaitlistForm id="hero-waitlist" />
        </Reveal>
      </div>

      <Reveal delay={320} className="relative mx-auto mt-16 max-w-4xl">
        <div className="panel-edge overflow-hidden rounded-xl border border-line bg-panel p-2 sm:p-3">
          {/* app-window chrome strip */}
          <div className="mb-2 flex items-center gap-1.5 px-2 pt-1">
            <span className="h-2.5 w-2.5 rounded-full bg-panel-raised" />
            <span className="h-2.5 w-2.5 rounded-full bg-panel-raised" />
            <span className="h-2.5 w-2.5 rounded-full bg-panel-raised" />
            <span className="ml-3 text-xs text-ink-faint">Tactics — 4-3-3 build-up</span>
          </div>
          <Suspense fallback={<div className="aspect-[105/68] w-full rounded-lg bg-panel-raised" />}>
            <HeroPitch />
          </Suspense>
        </div>
      </Reveal>
    </section>
  )
}
