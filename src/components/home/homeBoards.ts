import type { Drill, Tactic } from '../../store'
import type { BoardKind, RecentBoardRef } from '../../hooks/useRecentBoards'

// One shape for "a thing you can open from Home" (2026-08-30) — drills and
// tactics share scene/keyframes/pitch entity for entity, and Home only ever
// needs to draw one and link to it, so it never cares which slice it came
// from beyond the route it opens.
export type HomeBoard = { kind: 'drill'; doc: Drill } | { kind: 'tactic'; doc: Tactic }

export function boardKey(board: { kind: BoardKind; doc: { id: string } }): string {
  return `${board.kind}:${board.doc.id}`
}

// Same rule the Library applies (DrillLibrary/TacticsPage `canEdit`): an
// admin edits anything in their own club, a coach edits what they made.
export function boardOpenPath(board: HomeBoard, canEdit: boolean): string {
  const { id } = board.doc
  if (board.kind === 'drill') return canEdit ? `/design/${id}` : `/drills/${id}/view`
  return canEdit ? `/tactics/${id}` : `/tactics/${id}/view`
}

/**
 * Boards in "most relevant first" order: everything this browser opened
 * recently (newest open first), then whatever is left — worked-up boards
 * (animated, with more than a player or two on them) ahead of bare ones,
 * newest first within that — because a blank "New drill" is never the
 * thing a coach came back for. A recent ref whose board is gone —
 * deleted, or belonging to another club — simply doesn't match and drops
 * out. `recentCount` says how many of the leading entries are real history,
 * so the page can label them honestly.
 */
export function orderBoards(
  boards: HomeBoard[],
  recent: RecentBoardRef[]
): { boards: HomeBoard[]; recentCount: number } {
  const byKey = new Map(boards.map((board) => [boardKey(board), board]))
  const ordered: HomeBoard[] = []
  const seen = new Set<string>()
  for (const ref of recent) {
    const key = `${ref.kind}:${ref.id}`
    const board = byKey.get(key)
    if (board && !seen.has(key)) {
      ordered.push(board)
      seen.add(key)
    }
  }
  const workedUp = (board: HomeBoard) =>
    (board.doc.keyframes.length >= 2 ? 2 : 0) + (board.doc.scene.entities.length >= 3 ? 1 : 0)
  const rest = boards
    .filter((board) => !seen.has(boardKey(board)))
    .sort((a, b) => workedUp(b) - workedUp(a) || b.doc.created_at.localeCompare(a.doc.created_at))
  return { boards: [...ordered, ...rest], recentCount: ordered.length }
}
