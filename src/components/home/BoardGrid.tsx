import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { LibraryBig, Shield } from 'lucide-react'
import { PitchCanvas } from '../design/PitchCanvas'
import { useBoardPlayback } from '../../hooks/useBoardPlayback'
import { boardKey, type HomeBoard } from './homeBoards'

// The redesigned Home grid (2026-08-30, replacing the boxed hero + horizontal
// RecentRow) — a flat, equal-weight grid of every board, Mural/Coda-referenced
// at the user's request but kept inside Gaffer's one-accent restraint: no new
// colors, the boldness comes from the tile itself (live canvas filling the
// whole card, no chrome) and from motion, not from a palette.
//
// The signature interaction: a tile plays its actual animation on hover/focus
// instead of sitting on its opening frame, the same Netflix/Prime "hover to
// preview" idiom translated to a coaching board — reusing useBoardPlayback
// (built for the old hero) so reduced-motion, tab-visibility and the
// hold-start/hold-end pacing all come for free. Only the hovered tile ever
// animates; a grid of a dozen simultaneously-looping canvases would be both
// a performance cost and a wall of noise nobody asked for.
export function BoardGrid({
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
    <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {boards.map((board, index) => (
        <BoardTile
          key={boardKey(board)}
          board={board}
          openPath={openPath(board)}
          collectionName={collectionNameFor(board)}
          index={index}
        />
      ))}
    </ul>
  )
}

function BoardTile({
  board,
  openPath,
  collectionName,
  index,
}: {
  board: HomeBoard
  openPath: string
  collectionName: string | null
  index: number
}) {
  const [active, setActive] = useState(false)
  const frame = useBoardPlayback(board.doc, active)
  const Icon = board.kind === 'drill' ? LibraryBig : Shield
  // The tile is a fixed 16:9 (`aspect-video`) box, which almost never matches
  // a pitch preset's own real-world proportions (a full/portrait pitch is far
  // taller-per-width than that). PitchCanvas's `fillCanvas` stretch is built
  // for exactly this mismatch, but it only kicks in when `maxHeight` is also
  // given — without it, the canvas sizes itself off the pitch's true aspect
  // ratio and the fixed-ratio tile (with its `overflow-hidden`) clips the
  // result, which reads as an oversized, zoomed-in pitch. Measuring the tile
  // and feeding its own width/height back in is what actually engages fill.
  const tileRef = useRef<HTMLSpanElement | null>(null)
  const [tileSize, setTileSize] = useState({ width: 400, height: 225 })
  useEffect(() => {
    const el = tileRef.current
    if (!el) return
    const observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect
      if (rect && rect.width > 0 && rect.height > 0) setTileSize({ width: rect.width, height: rect.height })
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  // useBoardPlayback always returns a RenderFrame, even for a board with no
  // keyframes — frameAt's "no timeline" branch is `{ entities: [], ... }`,
  // not null (unlike openingFrame(), which LibraryItems.tsx uses and which
  // was written specifically to return null for this case — see its own
  // comment on why a blank green rectangle is worse than the file glyph).
  // Checking entity count rather than frame truthiness is what actually
  // catches it here.
  const hasContent = !!frame && frame.entities.length > 0

  return (
    <li
      className="motion-safe:animate-[home-tile-in_0.4s_cubic-bezier(0,0,0.2,1)_backwards]"
      style={{ animationDelay: `${Math.min(index, 7) * 40}ms` }}
    >
      <Link
        to={openPath}
        onMouseEnter={() => setActive(true)}
        onMouseLeave={() => setActive(false)}
        onFocus={() => setActive(true)}
        onBlur={() => setActive(false)}
        className="group block rounded-xl border border-line bg-panel transition-colors hover:border-line-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
      >
        <span
          ref={tileRef}
          className="flex aspect-video items-center justify-center overflow-hidden rounded-t-xl bg-panel-raised"
        >
          {hasContent ? (
            <PitchCanvas
              pitch={board.doc.pitch}
              frame={frame}
              maxWidth={tileSize.width}
              maxHeight={tileSize.height}
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
            {collectionName ? ` · ${collectionName}` : ''}
          </span>
        </span>
      </Link>
    </li>
  )
}
