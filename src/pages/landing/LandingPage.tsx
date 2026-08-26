import { LandingNav } from './LandingNav'
import { Footer } from './Footer'
import { Hero } from './Hero'
import { LogoWall } from './LogoWall'
import { StatsStrip } from './StatsStrip'
import { DrillCarousel } from './DrillCarousel'
import { FeatureSections } from './FeatureSections'
import { Testimonials } from './Testimonials'
import { Pricing } from './Pricing'
import { FinalCta } from './FinalCta'

// The public marketing page (landing-page spec, 2026-08-26). Dark-only via
// .landing-dark (index.css) regardless of the visitor's stored theme.
// Section order: Hero → LogoWall/StatsStrip → DrillCarousel (a scroll-snap
// showcase of the design tool's range) → FeatureSections (the deep dive) →
// Testimonials/Pricing/FinalCta.
export function LandingPage() {
  return (
    <div id="top" className="landing-dark min-h-svh scroll-smooth bg-surface text-ink">
      <LandingNav />
      <main>
        <Hero />
        <LogoWall />
        <StatsStrip />
        <DrillCarousel />
        <FeatureSections />
        <Testimonials />
        <Pricing />
        <FinalCta />
      </main>
      <Footer />
    </div>
  )
}
