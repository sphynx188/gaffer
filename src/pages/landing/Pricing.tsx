import { Reveal } from './Reveal'

// Planned tiers (landing-page spec, 2026-08-26) — early-access framing, no
// live billing. Every CTA routes to the waitlist section.
interface Tier {
  name: string
  price: string
  period?: string
  tagline: string
  features: string[]
  highlighted?: boolean
}

const TIERS: Tier[] = [
  {
    name: 'Starter',
    price: 'Free',
    tagline: 'For the coach with one squad and a plan.',
    features: ['1 team', 'Full drill designer', 'Session planning & attendance', '5 active share links'],
  },
  {
    name: 'Club',
    price: '£9',
    period: '/mo per coach',
    tagline: 'For coaches who live in pre-season all year.',
    features: [
      'Unlimited teams',
      'Animated tactics board',
      '29 formations + custom formations',
      'Unlimited share links',
      'Priority support',
    ],
    highlighted: true,
  },
  {
    name: 'Organisation',
    price: "Let's talk",
    tagline: 'For academies and multi-team clubs.',
    features: ['Everything in Club', 'Multi-coach teams', 'Roster import', 'Onboarding for your staff'],
  },
]

export function Pricing() {
  return (
    <section id="pricing" className="border-t border-line px-6 py-24">
      <div className="mx-auto max-w-6xl">
        <Reveal>
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-4xl font-semibold tracking-tight">Early-access pricing</h2>
            <p className="mt-3 text-ink-muted">
              Planned launch pricing — waitlist members lock in these rates. Free during early access.
            </p>
          </div>
        </Reveal>
        <div className="mt-12 grid gap-6 lg:grid-cols-3">
          {TIERS.map((tier, i) => (
            <Reveal key={tier.name} delay={i * 100} className="h-full">
              <div
                className={`panel-edge flex h-full flex-col rounded-xl border bg-panel p-8 ${
                  tier.highlighted ? 'border-accent' : 'border-line'
                }`}
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold tracking-tight text-ink">{tier.name}</h3>
                  {tier.highlighted && <span className="text-xs font-semibold text-accent">Most popular</span>}
                </div>
                <p className="mt-4 text-4xl font-semibold tracking-tight text-ink">
                  {tier.price}
                  {tier.period && <span className="ml-1 text-sm font-normal text-ink-muted">{tier.period}</span>}
                </p>
                <p className="mt-2 text-sm text-ink-muted">{tier.tagline}</p>
                <ul className="mt-6 flex-1 space-y-2">
                  {tier.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-ink">
                      <span aria-hidden className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                      {f}
                    </li>
                  ))}
                </ul>
                <a
                  href="#cta"
                  className={`mt-8 rounded-md px-4 py-2.5 text-center text-sm font-semibold transition-colors ${
                    tier.highlighted
                      ? 'bg-accent text-white hover:bg-accent-hover'
                      : 'border border-line text-ink hover:border-line-strong'
                  }`}
                >
                  Join the waitlist
                </a>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
