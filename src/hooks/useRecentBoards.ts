import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'

// "Recently opened" for the Home tab (2026-08-30). The database only records
// when a board was CREATED — there is no updated_at or last-opened column,
// and adding one for a landing-page nicety would mean a write on every open.
// So this is kept per browser in localStorage: a short list of the boards
// this coach opened here, newest first. Home falls back to created_at order
// when the list is empty (a fresh browser, a new club), so nothing depends on
// it being present.
//
// Recorded from the URL rather than from each editor/view page: the four
// routes that show one board are all of the form /<kind>/<id>[/view], so a
// single listener on the location covers them and no page has to know Home
// exists.

export type BoardKind = 'drill' | 'tactic'

export interface RecentBoardRef {
  kind: BoardKind
  id: string
  /** Epoch ms of the most recent open. */
  at: number
}

const STORAGE_KEY = 'gaffer-recent-boards'
const LIMIT = 12
// A same-tab write doesn't fire the window's `storage` event (that is only
// for OTHER tabs), so subscribers get told through this instead.
const CHANGE_EVENT = 'gaffer:recent-boards'

export function readRecentBoards(): RecentBoardRef[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (entry): entry is RecentBoardRef =>
        typeof entry === 'object' &&
        entry !== null &&
        (entry.kind === 'drill' || entry.kind === 'tactic') &&
        typeof entry.id === 'string' &&
        typeof entry.at === 'number'
    )
  } catch {
    return []
  }
}

export function recordRecentBoard(ref: { kind: BoardKind; id: string }): void {
  const next: RecentBoardRef[] = [
    { ...ref, at: Date.now() },
    ...readRecentBoards().filter((entry) => !(entry.kind === ref.kind && entry.id === ref.id)),
  ].slice(0, LIMIT)
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    // Private browsing / storage disabled — Home just uses created_at order.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT))
}

export function useRecentBoards(): RecentBoardRef[] {
  const [recent, setRecent] = useState<RecentBoardRef[]>(readRecentBoards)
  useEffect(() => {
    const refresh = () => setRecent(readRecentBoards())
    window.addEventListener(CHANGE_EVENT, refresh)
    window.addEventListener('storage', refresh)
    return () => {
      window.removeEventListener(CHANGE_EVENT, refresh)
      window.removeEventListener('storage', refresh)
    }
  }, [])
  return recent
}

// The four board routes. `/tactics/new` is the create form, not a board, and
// `/design` with no id is the create-and-redirect spinner — neither matches.
const DRILL_ROUTE = /^\/(?:design|drills)\/([^/]+)(?:\/view)?$/
const TACTIC_ROUTE = /^\/tactics\/(?!new(?:\/|$))([^/]+)(?:\/view)?$/

export function boardRefFromPath(pathname: string): { kind: BoardKind; id: string } | null {
  const drill = DRILL_ROUTE.exec(pathname)
  if (drill) return { kind: 'drill', id: drill[1] }
  const tactic = TACTIC_ROUTE.exec(pathname)
  if (tactic) return { kind: 'tactic', id: tactic[1] }
  return null
}

/** Mounted once in AppShell; renders nothing. */
export function RecentBoardsRecorder() {
  const { pathname } = useLocation()
  useEffect(() => {
    const ref = boardRefFromPath(pathname)
    if (ref) recordRecentBoard(ref)
  }, [pathname])
  return null
}
