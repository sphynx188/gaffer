import { Reveal } from './Reveal'

// PLACEHOLDER — private mockup only. Invented people; real club names used
// as placeholder affiliations at the owner's request. Replace all three
// before any genuine marketing use.
const QUOTES = [
  {
    quote:
      'We sketch a press trigger at half-time and the players watch it move. That change alone is worth it.',
    name: 'Marco Reinholt',
    role: 'Academy Coach, Borussia Dortmund',
  },
  {
    quote:
      'Session planning used to eat my Sunday nights. Now it is twenty minutes on the sofa, drills and all.',
    name: 'Sofía Álvarez',
    role: 'U15 Head Coach, FC Barcelona',
  },
  {
    quote: 'The first coaching tool my volunteer coaches did not need a training evening for.',
    name: 'Danny Whitlow',
    role: 'Foundation Phase Lead, Arsenal',
  },
]

export function Testimonials() {
  return (
    <section className="border-t border-line px-6 py-24">
      <div className="mx-auto max-w-6xl">
        <Reveal>
          <h2 className="text-center text-4xl font-semibold tracking-tight">Coaches talk</h2>
        </Reveal>
        <div className="mt-12 grid gap-6 lg:grid-cols-3">
          {QUOTES.map((q, i) => (
            <Reveal key={q.name} delay={i * 100}>
              <figure className="panel-edge flex h-full flex-col justify-between rounded-xl border border-line bg-panel p-6 transition-all duration-300 hover:-translate-y-1 hover:border-line-strong">
                <blockquote className="text-base leading-relaxed text-ink">“{q.quote}”</blockquote>
                <figcaption className="mt-6">
                  <p className="text-sm font-semibold text-ink">{q.name}</p>
                  <p className="text-xs text-ink-muted">{q.role}</p>
                </figcaption>
              </figure>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
