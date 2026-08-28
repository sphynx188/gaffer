import { useCallback, useEffect, useState } from 'react'

export type SortDir = 'asc' | 'desc'

export interface LibrarySort {
  key: string
  dir: SortDir
}

// Column sorting for the Library (2026-08-28) — there was none before: the
// list rendered in whatever order the fetch returned, which for a file
// manager is the one ordering nobody ever wants. Persisted per tab (drills
// and tactics have different columns, so they can't share one key), same
// localStorage-with-a-try/catch shape as useLibraryView/useTheme.
export function useLibrarySort(storageKey: string, fallback: LibrarySort) {
  const [sort, setSort] = useState<LibrarySort>(() => {
    try {
      const raw = localStorage.getItem(storageKey)
      if (!raw) return fallback
      const parsed = JSON.parse(raw) as Partial<LibrarySort>
      if (typeof parsed?.key !== 'string' || (parsed.dir !== 'asc' && parsed.dir !== 'desc')) return fallback
      return { key: parsed.key, dir: parsed.dir }
    } catch {
      return fallback
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(sort))
    } catch {
      // Private browsing / embedded contexts — sorting still works for the
      // session, it just won't be remembered.
    }
  }, [storageKey, sort])

  // Clicking the column you're already sorted by flips direction; clicking a
  // new one starts at that column's natural direction — A→Z for text, newest
  // first for anything date-like, which is what every file manager does.
  const toggleSort = useCallback((key: string, naturalDir: SortDir = 'asc') => {
    setSort((current) =>
      current.key === key ? { key, dir: current.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: naturalDir }
    )
  }, [])

  return { sort, setSort, toggleSort }
}
