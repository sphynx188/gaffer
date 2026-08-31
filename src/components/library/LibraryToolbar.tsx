import { type ReactNode } from 'react'
import { ArrowDownAZ, ArrowUpAZ, ChevronRight, LayoutGrid, List, Search } from 'lucide-react'
import { Dropdown, type DropdownOption } from '../ui/Dropdown'
import type { LibraryView } from '../../hooks/useLibraryView'
import type { LibrarySort } from './useLibrarySort'

// Breadcrumb + search + sort + view, in that reading order (2026-08-28).
//
// Search is back in the open. It used to be the first field inside a
// collapsed "Filters" panel, which put the library's most-used control
// behind a click and left the default screen showing a toggle and nothing
// else; every file manager keeps a search box visible and puts the
// narrowing controls beside it. The nine drill filters still collapse —
// they're genuinely secondary — but they no longer take search down with
// them.
//
// Search runs inside the current place, not across the whole library. That
// matches what a folder-shaped UI implies (and what Finder/Explorer do), and
// the count line says so out loud when a query is narrowing the view.
export function LibraryToolbar({
  rootLabel,
  placeTitle,
  isRoot,
  onNavigateRoot,
  query,
  onQueryChange,
  searchPlaceholder,
  view,
  onViewChange,
  sort,
  sortOptions,
  onSortKeyChange,
  onToggleSortDir,
  shownCount,
  totalCount,
  filters,
  placeActions,
  placeNote,
}: {
  rootLabel: string
  placeTitle: string
  isRoot: boolean
  onNavigateRoot: () => void
  query: string
  onQueryChange: (query: string) => void
  searchPlaceholder: string
  view: LibraryView
  onViewChange: (view: LibraryView) => void
  sort: LibrarySort
  sortOptions: DropdownOption[]
  onSortKeyChange: (key: string) => void
  onToggleSortDir: () => void
  shownCount: number
  totalCount: number
  filters?: ReactNode
  placeActions?: ReactNode
  /** Extra context under the title — e.g. "read-only, licensed to us". */
  placeNote?: string
}) {
  const narrowed = shownCount !== totalCount

  return (
    <div className="mb-3 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-xs text-ink-faint">
            <button
              type="button"
              onClick={onNavigateRoot}
              disabled={isRoot}
              className="rounded transition-colors hover:text-ink disabled:hover:text-ink-faint"
            >
              {rootLabel}
            </button>
            {!isRoot && (
              <>
                <ChevronRight className="h-3 w-3" />
                <span className="truncate text-ink-muted">{placeTitle}</span>
              </>
            )}
          </nav>
          <div className="flex flex-wrap items-baseline gap-x-2">
            <h2 className="truncate text-lg font-semibold tracking-tight text-ink">{placeTitle}</h2>
            <span className="text-xs text-ink-faint">
              {narrowed ? `${shownCount} of ${totalCount}` : `${totalCount} item${totalCount === 1 ? '' : 's'}`}
            </span>
          </div>
          {placeNote && <p className="mt-0.5 text-xs text-ink-faint">{placeNote}</p>}
        </div>
        {placeActions && <div className="flex shrink-0 items-center gap-2">{placeActions}</div>}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-48 flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-faint" />
          <input
            type="search"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder={searchPlaceholder}
            aria-label={`Search ${placeTitle}`}
            className="h-9 w-full rounded-md border border-line bg-panel-raised pl-8 pr-2 text-sm text-ink outline-none transition-colors placeholder:text-ink-faint focus:border-accent focus:ring-2 focus:ring-accent/30"
          />
        </div>
        {filters}
        <Dropdown
          value={sort.key}
          onChange={onSortKeyChange}
          options={sortOptions}
          searchable={false}
          ariaLabel="Sort by"
          triggerClassName="h-9"
          // This trigger sits toward the right end of the toolbar (Search
          // absorbs the remaining flex space ahead of it) — left-aligning
          // the popover, Dropdown's default, pushed it past the viewport's
          // right edge and put a horizontal scrollbar on the whole page.
          // Same fix as the club switcher: grow the popover leftward instead.
          menuAlign="right"
        />
        <button
          type="button"
          onClick={onToggleSortDir}
          aria-label={sort.dir === 'asc' ? 'Sort descending' : 'Sort ascending'}
          title={sort.dir === 'asc' ? 'Ascending' : 'Descending'}
          className="flex h-9 items-center rounded-md border border-line px-2 text-ink-muted transition-colors hover:border-line-strong hover:text-ink"
        >
          {sort.dir === 'asc' ? <ArrowUpAZ className="h-4 w-4" /> : <ArrowDownAZ className="h-4 w-4" />}
        </button>
        <div className="flex items-center gap-0.5 rounded-md border border-line p-0.5">
          <button
            type="button"
            onClick={() => onViewChange('grid')}
            aria-pressed={view === 'grid'}
            aria-label="Thumbnail view"
            title="Thumbnail view"
            className={`rounded p-1.5 transition-colors ${view === 'grid' ? 'bg-accent/15 text-accent-ink' : 'text-ink-muted hover:text-ink'}`}
          >
            <LayoutGrid className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => onViewChange('list')}
            aria-pressed={view === 'list'}
            aria-label="List view"
            title="List view"
            className={`rounded p-1.5 transition-colors ${view === 'list' ? 'bg-accent/15 text-accent-ink' : 'text-ink-muted hover:text-ink'}`}
          >
            <List className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
