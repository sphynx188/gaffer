import { LandingNav } from './LandingNav'
import { Footer } from './Footer'
import { Hero } from './Hero'
import { LogoWall } from './LogoWall'
import { StatsStrip } from './StatsStrip'

// The public marketing page (landing-page spec, 2026-08-26). Dark-only via
// .landing-dark (index.css) regardless of the visitor's stored theme.
// Section components replace the stub below in plan Tasks 4–7, in order:
// Hero → LogoWall/StatsStrip → FeatureSections → Testimonials/Pricing/FinalCta.
export function LandingPage() {
  return (
    <div id="top" className="landing-dark min-h-svh scroll-smooth bg-surface text-ink">
      <LandingNav />
      <main>
        <Hero />
        <LogoWall />
        <StatsStrip />
      </main>
      <Footer />
    </div>
  )
}
