import { WaitlistForm } from './WaitlistForm'

// The public marketing page (landing-page spec, 2026-08-26). Sections land
// in later tasks; this skeleton exists so routing can ship first.
export function LandingPage() {
  return (
    <div className="min-h-svh bg-surface text-ink">
      <main className="mx-auto flex min-h-svh max-w-5xl flex-col items-center justify-center gap-6 px-6">
        <h1 className="text-4xl font-semibold tracking-tight">Gaffer</h1>
        <p className="mt-2 text-ink-muted">Landing page under construction.</p>
        <WaitlistForm />
      </main>
    </div>
  )
}
