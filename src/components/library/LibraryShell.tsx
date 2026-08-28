import { useEffect, useState, type ReactNode } from 'react'
import { PanelRight, X } from 'lucide-react'

// The Library's three-pane frame (2026-08-28): places rail, item list,
// details. Both tabs render into it, so Drills and Tactics are the same
// screen with different columns rather than two pages that happen to look
// alike.
//
// How it degrades is the whole point of it existing as one component:
//   • ≥ xl — all three panes side by side. `<main>` caps at max-w-6xl, so
//     this is as wide as the app ever gets; the list still keeps ~560px.
//   • lg   — rail + list; details becomes a right-hand slide-over.
//   • < lg — list only. The rail is a left drawer behind a "Places" button
//     that names where you are, and details is the same slide-over. That
//     button is deliberately not a hamburger: on a phone the one thing the
//     sidebar was carrying is "which folder am I in", and a hamburger hides
//     exactly that.
//
// The two column templates are written out as whole literal class strings
// rather than composed from fragments — Tailwind only ships classes it can
// find verbatim in the source.
const GRID_WITH_DETAILS = 'lg:grid lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-6 xl:grid-cols-[13rem_minmax(0,1fr)_17rem]'
const GRID_WITHOUT_DETAILS = 'lg:grid lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-6'

export function LibraryShell({
  sidebar,
  children,
  details,
  onCloseDetails,
  placeTitle,
  placesLabel = 'Places',
}: {
  sidebar: ReactNode
  children: ReactNode
  /** The details pane content, or null when nothing is selected. */
  details: ReactNode
  onCloseDetails: () => void
  placeTitle: string
  placesLabel?: string
}) {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const hasDetails = details != null

  useEffect(() => {
    if (!drawerOpen) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDrawerOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [drawerOpen])

  // Below xl the details pane is an overlay, so Escape has to close it too —
  // otherwise the only way out is the X, which on a phone sits above the
  // fold of a long pane.
  useEffect(() => {
    if (!hasDetails) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && window.innerWidth < 1280) onCloseDetails()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [hasDetails, onCloseDetails])

  return (
    <div className={hasDetails ? GRID_WITH_DETAILS : GRID_WITHOUT_DETAILS}>
      {/* Mobile/tablet: where-am-I button + drawer trigger, in one control. */}
      <div className="mb-3 flex items-center gap-2 lg:hidden">
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          className="flex min-w-0 items-center gap-2 rounded-md border border-line bg-panel-raised px-2.5 py-1.5 text-sm text-ink transition-colors hover:border-line-strong"
        >
          <PanelRight className="h-3.5 w-3.5 shrink-0 rotate-180 text-ink-muted" />
          <span className="truncate">{placeTitle}</span>
        </button>
      </div>

      <aside className="hidden lg:block">{sidebar}</aside>

      <div className="min-w-0">{children}</div>

      {/* Details: a real third column at xl, an overlay below it. Rendered
          twice rather than moved between parents so React keeps each
          instance's own state (playback clock, scroll position) intact
          within a breakpoint. */}
      {hasDetails && (
        <>
          <aside className="hidden xl:block">
            <div className="sticky top-20">{details}</div>
          </aside>
          <div className="fixed inset-0 z-40 xl:hidden">
            <button type="button" aria-label="Close details" onClick={onCloseDetails} className="absolute inset-0 bg-black/60" />
            <div className="absolute inset-y-0 right-0 flex w-96 max-w-[92vw] flex-col overflow-y-auto border-l border-line bg-surface p-4">
              {details}
            </div>
          </div>
        </>
      )}

      {/* Places drawer (below lg). */}
      <div className={`fixed inset-0 z-40 lg:hidden ${drawerOpen ? '' : 'pointer-events-none'}`} aria-hidden={!drawerOpen}>
        <button
          type="button"
          aria-label={`Close ${placesLabel.toLowerCase()}`}
          onClick={() => setDrawerOpen(false)}
          className={`absolute inset-0 bg-black/60 transition-opacity duration-200 ${drawerOpen ? 'opacity-100' : 'opacity-0'}`}
        />
        <div
          className={`absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-panel shadow-xl transition-transform duration-200 ${drawerOpen ? 'translate-x-0' : '-translate-x-full'}`}
        >
          <div className="flex h-14 shrink-0 items-center justify-between border-b border-line px-4">
            <h2 className="text-sm font-semibold text-ink">{placesLabel}</h2>
            <button
              type="button"
              onClick={() => setDrawerOpen(false)}
              aria-label={`Close ${placesLabel.toLowerCase()}`}
              className="rounded-md p-2 text-ink-muted hover:bg-panel-raised"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          {/* Picking a place is the drawer's only job, so any click inside
              the rail closes it — no "apply" step, and no drawer left
              covering the list you just navigated to. */}
          <div className="flex-1 overflow-y-auto px-2 py-2" onClick={() => setDrawerOpen(false)}>
            {sidebar}
          </div>
        </div>
      </div>
    </div>
  )
}
