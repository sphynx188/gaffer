import { useCallback, useState } from 'react'
import { TOUR_STEPS } from './tourSteps'

// Whether this browser has ever finished or skipped the tour. Not scoped to a
// drill — a coach who has seen the editor once has seen it, regardless of
// which drill they opened it from, so this is a single global flag rather
// than one per drill. Matches useTheme.ts's own localStorage convention.
const SEEN_KEY = 'gaffer-onboarding-drill-editor-seen'

function hasSeenTour(): boolean {
  if (typeof window === 'undefined') return true
  try {
    return window.localStorage.getItem(SEEN_KEY) === '1'
  } catch {
    // Storage can throw in private-browsing modes on some browsers. Treat
    // that the same as "never seen" rather than crashing the editor over a
    // walkthrough — it'll just offer the tour again next time, which is a
    // minor annoyance, not a broken app.
    return false
  }
}

function markTourSeen() {
  try {
    window.localStorage.setItem(SEEN_KEY, '1')
  } catch {
    // Same tolerance as above — a failed write just means the tour offers
    // itself again later, which is harmless.
  }
}

export interface OnboardingTour {
  open: boolean
  stepIndex: number
  step: (typeof TOUR_STEPS)[number]
  stepCount: number
  next: () => void
  back: () => void
  /** Ends the tour early and remembers it's been seen, same as finishing it. */
  skip: () => void
  /** Reopens from the first step — the top bar's "replay" button (Stage 11.1: "replayable from the editor"). */
  restart: () => void
}

export function useOnboardingTour(): OnboardingTour {
  // Auto-start once, the first time a coach opens the editor at all — after
  // that it's opt-in via the replay button. A lazy initializer rather than an
  // effect: this app has no server render (plain Vite + client React, per
  // CLAUDE.md), so there's no hydration mismatch to worry about, and reading
  // localStorage synchronously here is both simpler and avoids a pointless
  // extra render on every single mount just to flip this on.
  const [open, setOpen] = useState(() => !hasSeenTour())
  const [stepIndex, setStepIndex] = useState(0)

  const finish = useCallback(() => {
    setOpen(false)
    markTourSeen()
  }, [])

  const next = useCallback(() => {
    setStepIndex((i) => {
      if (i + 1 >= TOUR_STEPS.length) {
        finish()
        return i
      }
      return i + 1
    })
  }, [finish])

  const back = useCallback(() => {
    setStepIndex((i) => Math.max(0, i - 1))
  }, [])

  const restart = useCallback(() => {
    setStepIndex(0)
    setOpen(true)
  }, [])

  return {
    open,
    stepIndex,
    step: TOUR_STEPS[stepIndex],
    stepCount: TOUR_STEPS.length,
    next,
    back,
    skip: finish,
    restart,
  }
}
