import { Link } from 'react-router-dom'
import { ChevronRight, LibraryBig, Shield } from 'lucide-react'
import type { Collection } from '../../store'

// The club's collections as shelves (2026-08-30). Each row deep-links into
// the Library standing in that folder — `?place=c:<id>` is the Library's own
// URL for it (useLibraryPlace), so this is a link to a real place, not a
// filter Home has to reimplement.
//
// The count is the whole story of a shelf: how many boards, and of which
// kind. "Licensed" marks a collection another club granted this one — read
// only, and the one thing a coach needs to know before trying to file into
// it.

export interface Shelf {
  collection: Collection
  count: number
  licensed: boolean
  /** Coaches the admin has granted this collection to (own club only). */
  sharedWith: number
}

export function CollectionShelves({ shelves }: { shelves: Shelf[] }) {
  if (shelves.length === 0) return null
  return (
    <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-panel">
      {shelves.map(({ collection, count, licensed, sharedWith }) => {
        const Icon = collection.kind === 'drill' ? LibraryBig : Shield
        const tab = collection.kind === 'drill' ? 'drills' : 'tactics'
        const place = licensed ? `l:${collection.id}` : `c:${collection.id}`
        return (
          <li key={collection.id}>
            <Link
              to={`/library/${tab}?place=${encodeURIComponent(place)}`}
              className="group flex min-h-12 items-center gap-3 px-4 py-2.5 transition-colors hover:bg-panel-raised focus-visible:outline-none focus-visible:bg-panel-raised"
            >
              <Icon className="h-4 w-4 shrink-0 text-ink-faint" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-ink">{collection.name}</span>
                {collection.description && (
                  <span className="block truncate text-xs text-ink-faint">{collection.description}</span>
                )}
              </span>
              {licensed && (
                <span className="hidden rounded-full bg-panel-raised px-2 py-0.5 text-xs text-ink-muted sm:inline">
                  Licensed
                </span>
              )}
              {!licensed && sharedWith > 0 && (
                <span className="hidden text-xs text-ink-faint sm:inline">
                  {sharedWith} {sharedWith === 1 ? 'coach' : 'coaches'}
                </span>
              )}
              <span className="w-16 shrink-0 text-right text-sm tabular-nums text-ink-muted">
                {count} {collection.kind === 'drill' ? (count === 1 ? 'drill' : 'drills') : count === 1 ? 'tactic' : 'tactics'}
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-ink-faint transition-colors group-hover:text-ink" />
            </Link>
          </li>
        )
      })}
    </ul>
  )
}
