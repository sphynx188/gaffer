import { useEffect, useState } from 'react'

export type LibraryView = 'grid' | 'list'

const STORAGE_KEY = 'gaffer-library-view'

function readStoredView(): LibraryView {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'list' ? 'list' : 'grid'
  } catch {
    return 'grid'
  }
}

// Grid/list toggle for the Library tab (2026-08-28) — one preference shared
// by both the Drills and Tactics sub-tabs (LibraryLayout owns the state,
// handed down via useOutletContext so switching tabs keeps the same view),
// same persistence shape as useTheme.
export function useLibraryView() {
  const [view, setView] = useState<LibraryView>(readStoredView)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, view)
    } catch {
      // localStorage can throw in private-browsing/embedded contexts —
      // the toggle still works for the session, it just won't persist.
    }
  }, [view])

  return { view, setView }
}
