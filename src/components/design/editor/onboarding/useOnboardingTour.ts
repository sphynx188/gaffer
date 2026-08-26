import { useCallback, useState } from 'react'
import type { TourStep } from './tourSteps'

// The tour machinery, shared by both editors (TACTICS_BOARD_REWORK_PLAN.md
// Stage 10.1: "reuse editor/onboarding/*"). It took no arguments while the
// drill editor was its only caller; it now takes the steps to walk and the
// localStorage key to remember them by, which is the whole of what differed
// between the two. `OnboardingTour.tsx` needed no change at all — it was
// already handed one step at a time and knows nothing about either editor.
//
// The key is per EDITOR, not per document: a coach who has seen the drill
// editor has seen it whichever drill they opened it from. Two keys, because
// the two editors teach different things — seeing one should not silently
// skip the other. Matches useTheme.ts's own localStorage convention.
export const DRILL_TOUR_SEEN_KEY = 'gaffer-onboarding-drill-editor-seen'
export const TACTIC_TOUR_SEEN_KEY = 'gaffer-onboarding-tactic-editor-seen'

function hasSeenTour(seenKey: string): boolean {
  if (typeof window === 'undefined') return true
  try {
    return window.localStorage.getItem(seenKey) === '1'
  } catch {
    // Storage can throw in private-browsing modes on some browsers. Treat
    // that the same as "never seen" rather than crashing the editor over a
    // walkthrough — it'll just offer the tour again next time, which is a
    // minor annoyance, not a broken app.
    return false
  }
}

function markTourSeen(seenKey: string) {
  try {
    window.localStorage.setItem(seenKey, '1')
  } catch {
    // Same tolerance as above — a failed write just means the tour offers
    // itself again later, which is harmless.
  }
}

export interface OnboardingTour {
  open: boolean
  stepIndex: number
  step: TourStep
  stepCount: number
  next: () => void
  back: () => void
  /** Ends the tour early and remembers it's been seen, same as finishing it. */
  skip: () => void
  /** Reopens from the first step — the top bar's "replay" button (Stage 11.1: "replayable from the editor"). */
  restart: () => void
}

export function useOnboardingTour(steps: TourStep[], seenKey: string): OnboardingTour {
  // Auto-start once, the first time a coach opens the editor at all — after
  // that it's opt-in via the replay button. A lazy initializer rather than an
  // effect: this app has no server render (plain Vite + client React, per
  // CLAUDE.md), so there's no hydration mismatch to worry about, and reading
  // localStorage synchronously here is both simpler and avoids a pointless
  // extra render on every single mount just to flip this on.
  const [open, setOpen] = useState(() => !hasSeenTour(seenKey))
  const [stepIndex, setStepIndex] = useState(0)

  const finish = useCallback(() => {
    setOpen(false)
    markTourSeen(seenKey)
  }, [seenKey])

  const next = useCallback(() => {
    setStepIndex((i) => {
      if (i + 1 >= steps.length) {
        finish()
        return i
      }
      return i + 1
    })
  }, [finish, steps.length])

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
    // Clamped rather than indexed raw: `restart` and a shorter step list can
    // otherwise leave `stepIndex` past the end for one render.
    step: steps[Math.min(stepIndex, steps.length - 1)],
    stepCount: steps.length,
    next,
    back,
    skip: finish,
    restart,
  }
}
