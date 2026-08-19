import { useEffect, useState } from 'react'

// Phase 3.4 (gaffer_mvp_build_steps.md) — PWA install + app-shell caching.
// The service worker (vite.config.ts) caches the app shell and the last
// GET response from Supabase so the app still renders with no signal, but
// it deliberately never caches or queues writes — a save made while offline
// just fails, same as it would with no service worker at all. That means
// the UI has to say so out loud: without this banner, a coach pitch-side
// with no bars could edit availability or drag a drill element and see the
// same form/canvas they'd see online, with nothing telling them the change
// didn't actually reach Supabase. `navigator.onLine` plus the `online`/
// `offline` window events are the standard (if slightly conservative —
// `onLine` can be true on a captive portal with no real connectivity) way
// to surface that state; good enough for "don't imply a write succeeded,"
// which is all the Definition of Done asks for.
export function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(() => !navigator.onLine)

  useEffect(() => {
    const goOffline = () => setIsOffline(true)
    const goOnline = () => setIsOffline(false)
    window.addEventListener('offline', goOffline)
    window.addEventListener('online', goOnline)
    return () => {
      window.removeEventListener('offline', goOffline)
      window.removeEventListener('online', goOnline)
    }
  }, [])

  if (!isOffline) {
    return null
  }

  return (
    <div
      role="status"
      className="w-full bg-amber-50 px-4 py-2 text-center text-sm text-amber-800"
    >
      You&rsquo;re offline — showing the last-synced plan. Changes won&rsquo;t save until
      you&rsquo;re back online.
    </div>
  )
}
