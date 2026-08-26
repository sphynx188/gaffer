import { Reveal } from './Reveal'
import { WaitlistForm } from './WaitlistForm'

export function FinalCta() {
  return (
    <section id="cta" className="relative overflow-hidden border-t border-line px-6 py-28">
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-full h-[500px] w-[800px] max-w-none rounded-full blur-3xl"
        style={{
          transform: 'translate(-50%, -40%)',
          background:
            'radial-gradient(closest-side, color-mix(in srgb, var(--color-accent) 18%, transparent), transparent)',
        }}
      />
      <div className="relative mx-auto flex max-w-2xl flex-col items-center text-center">
        <Reveal>
          <h2 className="text-4xl font-semibold tracking-tight sm:text-5xl">Be first on the team sheet.</h2>
        </Reveal>
        <Reveal delay={100}>
          <p className="mt-4 text-ink-muted">Early access is rolling out club by club. Free while it does.</p>
        </Reveal>
        <Reveal delay={200} className="mt-8 flex w-full justify-center">
          <WaitlistForm id="cta-waitlist" />
        </Reveal>
      </div>
    </section>
  )
}
