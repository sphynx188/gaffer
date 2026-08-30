import { Link } from 'react-router-dom'
import { LibraryBig, Shield } from 'lucide-react'
import { PitchCanvas } from '../design/PitchCanvas'
import { frameAt } from '../design/canvas/interpolate'
import { openingFrame } from '../library/openingFrame'
import { boardKey, type HomeBoard } from './homeBoards'

// The boards after the hero (2026-08-30): a single row that scrolls sideways
// rather than a grid that grows downward, so Home stays one screen tall and
// the Library remains the place to browse. Same live opening-keyframe tiles
// the Library draws, at the Library's own thumbnail size.
const TILE_WIDTH = 300
const TILE_HEIGHT = Math.round((TILE_WIDTH * 9) / 16)

export function RecentRow({
  boards,
  openPath,
  collectionNameFor,
}: {
  boards: HomeBoard[]
  openPath: (board: HomeBoard) => string
  collectionNameFor: (board: HomeBoard) => string | null
}) {
  if (boards.length === 0) return null
  return (
    <ul className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8 [scrollbar-width:thin]">
      {boards.map((board) => {
        const preview = openingFrame(board.doc, frameAt)
        const Icon = board.kind === 'drill' ? LibraryBig : Shield
        const collection = collectionNameFor(board)
        return (
          <li key={boardKey(board)} className="w-[300px] shrink-0 snap-start">
            <Link
              to={openPath(board)}
              className="group block rounded-xl border border-line bg-panel transition-colors hover:border-line-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
            >
              <span
                className="flex items-center justify-center overflow-hidden rounded-t-xl bg-panel-raised"
                style={{ height: TILE_HEIGHT }}
              >
                {preview ? (
                  <PitchCanvas
                    pitch={preview.pitch}
                    frame={preview.frame}
                    maxWidth={TILE_WIDTH}
                    maxHeight={TILE_HEIGHT}
                    fillCanvas
                  />
                ) : (
                  <Icon className="h-6 w-6 text-ink-faint" />
                )}
              </span>
              <span className="block px-3.5 py-3">
                <span className="block truncate text-sm font-medium text-ink group-hover:text-accent-ink">
                  {board.doc.name}
                </span>
                <span className="mt-0.5 block truncate text-xs text-ink-faint">
                  {board.kind === 'drill' ? 'Drill' : 'Tactic'}
                  {collection ? ` · ${collection}` : ''}
                </span>
              </span>
            </Link>
          </li>
        )
      })}
    </ul>
  )
}
