import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import type { TourStep } from './tourSteps'

// The coach-mark overlay itself (rework plan Stage 11.1). Presentational and
// dumb about the editor: it's handed a step to show and reports Back/Next/Skip
// back to the caller. All it does on its own is find the step's anchor
// element in the DOM and work out where to draw a spotlight ring and a
// tooltip around it.
//
// Positions are recomputed on mount, on every step change, and on resize —
// there's no continuous animation loop, since nothing needs to track a
// moving target between those events (the editor's layout doesn't scroll or
// animate on its own while the tour is paused on a step).

interface OnboardingTourProps {
  step: TourStep
  stepIndex: number
  stepCount: number
  onNext: () => void
  onBack: () => void
  onSkip: () => void
  /**
   * Milliseconds to wait before measuring the anchor. Non-zero when this step
   * just triggered a mobile sheet to open — that slide-in is a 200ms CSS
   * transition (Sheet's own `duration-200`), and measuring before it settles
   * would draw the spotlight around wherever the element started, not where
   * it ends up.
   */
  settleMs?: number
}

interface Rect {
  top: number
  left: number
  width: number
  height: number
}

const GAP = 12
const VIEWPORT_MARGIN = 12

// Two copies of every rail/properties anchor exist in the DOM at once — one
// for the desktop-visible layout, one inside the mobile sheet — each hidden
// by a Tailwind breakpoint class rather than being unmounted (see ToolRail's
// and DrillEditor's own Sheet usage). `querySelector` would just return
// whichever comes first in source order, which is wrong exactly half the
// time. `offsetParent` is null for anything with `display: none` in its
// ancestry (directly or via a `hidden`/`lg:hidden` class), which is precisely
// how those two copies are told apart — so this picks whichever one is
// actually on screen.
function findVisibleAnchor(id: string): HTMLElement | null {
  const matches = document.querySelectorAll<HTMLElement>(`[data-onboarding-anchor="${id}"]`)
  for (const el of matches) {
    if (el.offsetParent !== null) return el
  }
  return null
}

function rectOf(el: HTMLElement): Rect {
  const r = el.getBoundingClientRect()
  return { top: r.top, left: r.left, width: r.width, height: r.height }
}

// Picks a side for the tooltip, preferring `placement` but falling back to
// whatever actually has room — a 'right' placement on a phone-width screen
// would otherwise push the card half off the edge.
function positionTooltip(
  anchor: Rect,
  tooltipSize: { width: number; height: number },
  placement: TourStep['placement']
): { top: number; left: number } {
  const viewportW = window.innerWidth
  const viewportH = window.innerHeight

  const candidates: Record<TourStep['placement'], { top: number; left: number }> = {
    top: { top: anchor.top - tooltipSize.height - GAP, left: anchor.left + anchor.width / 2 - tooltipSize.width / 2 },
    bottom: { top: anchor.top + anchor.height + GAP, left: anchor.left + anchor.width / 2 - tooltipSize.width / 2 },
    left: { top: anchor.top + anchor.height / 2 - tooltipSize.height / 2, left: anchor.left - tooltipSize.width - GAP },
    right: { top: anchor.top + anchor.height / 2 - tooltipSize.height / 2, left: anchor.left + anchor.width + GAP },
  }

  const fits = (pos: { top: number; left: number }) =>
    pos.top >= VIEWPORT_MARGIN &&
    pos.left >= VIEWPORT_MARGIN &&
    pos.top + tooltipSize.height <= viewportH - VIEWPORT_MARGIN &&
    pos.left + tooltipSize.width <= viewportW - VIEWPORT_MARGIN

  const opposite: Record<TourStep['placement'], TourStep['placement']> = {
    top: 'bottom',
    bottom: 'top',
    left: 'right',
    right: 'left',
  }

  const order: TourStep['placement'][] = [placement, opposite[placement], 'bottom', 'top', 'right', 'left']
  const chosen = order.find((side) => fits(candidates[side])) ?? placement
  const pos = candidates[chosen]

  // Clamp rather than trust the chosen side blindly — even the "best fit"
  // side can still spill past an edge on a narrow phone screen.
  return {
    top: Math.min(Math.max(pos.top, VIEWPORT_MARGIN), viewportH - tooltipSize.height - VIEWPORT_MARGIN),
    left: Math.min(Math.max(pos.left, VIEWPORT_MARGIN), viewportW - tooltipSize.width - VIEWPORT_MARGIN),
  }
}

export function OnboardingTour({ step, stepIndex, stepCount, onNext, onBack, onSkip, settleMs = 0 }: OnboardingTourProps) {
  const [anchorRect, setAnchorRect] = useState<Rect | null>(null)
  const [tooltipPos, setTooltipPos] = useState<{ top: number; left: number } | null>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false

    const measure = () => {
      if (cancelled) return
      const el = findVisibleAnchor(step.anchor)
      if (el) {
        // Bring the anchor into view before measuring it. The drill editor
        // never needed this — its only top-bar anchor is the name field, which
        // sits at the left and is always visible. The tactics top bar SCROLLS
        // SIDEWAYS on a phone (it carries more controls; see TacticTopBar's
        // header for why it scrolls rather than wraps), so Ball, Present and
        // Export are all off-screen at 375px and the spotlight would ring
        // empty space.
        //
        // `nearest`/`nearest` scrolls the minimum on each axis and only
        // ancestors that actually scroll, so it does nothing at all when the
        // anchor is already visible. No `behavior: 'smooth'` — the default is
        // synchronous, so layout has settled by the next line and there is
        // nothing to wait a frame for.
        el.scrollIntoView({ block: 'nearest', inline: 'nearest' })
      }
      setAnchorRect(el ? rectOf(el) : null)
    }

    const timer = window.setTimeout(measure, settleMs)
    window.addEventListener('resize', measure)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
      window.removeEventListener('resize', measure)
    }
    // `settleMs` is only ever a fixed per-step constant (see tourSteps.ts's
    // openTools/openProperties), not something that changes independent of
    // the step — including it would be redundant with `step` itself.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step])

  // A second pass once the anchor rect is known: only now does the tooltip
  // have real content to measure its own size from, which positionTooltip
  // needs to keep the card on screen.
  useLayoutEffect(() => {
    if (!anchorRect || !tooltipRef.current) {
      setTooltipPos(null)
      return
    }
    const { offsetWidth, offsetHeight } = tooltipRef.current
    setTooltipPos(positionTooltip(anchorRect, { width: offsetWidth, height: offsetHeight }, step.placement))
  }, [anchorRect, step.placement])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onSkip()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onSkip])

  const isLast = stepIndex === stepCount - 1

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-label="Editor walkthrough" aria-modal="true">
      {/* The spotlight: a transparent box the size of the anchor (plus a
          little padding), whose box-shadow fills the rest of the viewport.
          This is the standard CSS cutout trick — an SVG mask would do the
          same thing with more code. */}
      {anchorRect ? (
        <div
          className="pointer-events-none fixed rounded-lg border-2 border-accent transition-[top,left,width,height] duration-150"
          style={{
            top: anchorRect.top - 6,
            left: anchorRect.left - 6,
            width: anchorRect.width + 12,
            height: anchorRect.height + 12,
            boxShadow: '0 0 0 9999px rgba(0,0,0,0.6)',
          }}
        />
      ) : (
        // The step's anchor isn't on screen (shouldn't happen once the host
        // has opened the right sheet, but a resize mid-tour could still race
        // it) — a plain dimmed backdrop rather than a broken-looking overlay.
        <div className="fixed inset-0 bg-black/60" />
      )}

      {/* A full-screen click target under the tooltip: tapping the dimmed
          area closes the tour, same as Escape, rather than reaching whatever
          it's covering — a coach mid-tour who taps the (highlighted but
          inert) rail button expects "stop showing me this", not a click that
          silently landed on the real app underneath. */}
      <button type="button" onClick={onSkip} aria-label="Close walkthrough" className="fixed inset-0 cursor-default" />

      <div
        ref={tooltipRef}
        className="panel-edge fixed w-72 max-w-[calc(100vw-24px)] space-y-3 rounded-xl border border-line bg-panel p-4 shadow-xl"
        style={
          tooltipPos
            ? { top: tooltipPos.top, left: tooltipPos.left }
            : // Off-screen for the first measurement pass, so it never
              // flashes at (0,0) before its real position is known.
              { top: -9999, left: -9999 }
        }
      >
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-semibold text-ink">{step.title}</p>
          <button
            type="button"
            onClick={onSkip}
            aria-label="Close walkthrough"
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-ink-muted hover:bg-panel-raised hover:text-ink"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        <p className="text-sm text-ink-muted">{step.body}</p>

        <div className="flex items-center justify-between gap-2 pt-1">
          <p className="text-xs tabular-nums text-ink-faint">
            {stepIndex + 1} of {stepCount}
          </p>
          <div className="flex items-center gap-1.5">
            {stepIndex > 0 && (
              <button
                type="button"
                onClick={onBack}
                className="min-h-9 rounded-md border border-line px-2.5 text-xs font-medium text-ink-muted transition-colors hover:border-line-strong hover:text-ink"
              >
                Back
              </button>
            )}
            <button
              type="button"
              onClick={onNext}
              className="min-h-9 rounded-md bg-accent px-3 text-xs font-semibold text-white transition-colors hover:bg-accent-hover"
            >
              {isLast ? 'Done' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
