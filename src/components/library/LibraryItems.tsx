import type { ComponentType, KeyboardEvent as ReactKeyboardEvent, MouseEvent as ReactMouseEvent, ReactNode } from 'react'
import { ArrowDown, ArrowUp } from 'lucide-react'
import { Checkbox } from './Checkbox'
import { RowMenu, type RowMenuItem } from './RowMenu'
import type { LibrarySort, SortDir } from './useLibrarySort'
import type { ToggleOptions } from './useLibrarySelection'

// How the Library draws its items, in the two shapes a file manager offers:
// a sortable column table and a thumbnail grid. Both are driven by
// already-prepared view rows rather than by Drill/Tactic themselves — the
// two documents share almost none of their metadata (a drill has ~19
// columns, a tactic has four fields by design), so the pages compute their
// own cells and the components here only know about names, thumbnails and
// cells keyed by column.
export interface LibraryColumn {
  key: string
  label: string
  sortable?: boolean
  /** Direction a first click on this column sorts in — dates want newest first. */
  naturalDir?: SortDir
  /** Width and responsive-visibility utilities, applied to both header and cell. */
  className?: string
}

export interface LibraryItemView {
  id: string
  name: string
  thumbnailUrl: string | null
  /** Drawn when there's no thumbnail — the "file type" glyph. */
  icon: ComponentType<{ className?: string }>
  subtitle?: string | null
  /** Compact metadata line, used by tiles and by rows below `sm`. */
  metaLine?: string | null
  badge?: ReactNode
  cells: Record<string, ReactNode>
  menu: RowMenuItem[]
}

interface ItemsProps {
  items: LibraryItemView[]
  selected: Set<string>
  activeId: string | null
  onToggle: (id: string, options: ToggleOptions) => void
  /** Single click — makes this the item the details pane describes. */
  onActivate: (id: string) => void
  /** Double click or Enter — opens it in the editor/viewer. */
  onOpen: (id: string) => void
}

// One click selects and shows details, two clicks open — the desktop
// file-manager contract. Cmd/Ctrl adds to the selection, Shift extends a
// range from the last click; a bare click replaces the selection, so a
// stray earlier tick doesn't quietly ride along into the next bulk action.
function rowInteractionHandlers(
  id: string,
  { onToggle, onActivate, onOpen }: Pick<ItemsProps, 'onToggle' | 'onActivate' | 'onOpen'>
) {
  return {
    onClick: (e: ReactMouseEvent) => {
      if (e.shiftKey) onToggle(id, { shift: true })
      else if (e.metaKey || e.ctrlKey) onToggle(id, { additive: true })
      else onActivate(id)
    },
    onDoubleClick: () => onOpen(id),
    onKeyDown: (e: ReactKeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        onOpen(id)
      } else if (e.key === ' ') {
        e.preventDefault()
        onToggle(id, { additive: true })
      }
    },
  }
}

function ItemThumb({
  item,
  className,
  iconClassName,
}: {
  item: LibraryItemView
  className: string
  iconClassName: string
}) {
  return (
    <span className={`flex shrink-0 items-center justify-center overflow-hidden rounded bg-panel-raised ${className}`}>
      {item.thumbnailUrl ? (
        <img src={item.thumbnailUrl} alt="" className="h-full w-full object-cover" />
      ) : (
        <item.icon className={`text-ink-faint ${iconClassName}`} />
      )}
    </span>
  )
}

export function LibraryTable({
  items,
  columns,
  sort,
  onSort,
  selected,
  activeId,
  onToggle,
  onToggleAll,
  allSelected,
  onActivate,
  onOpen,
}: ItemsProps & {
  columns: LibraryColumn[]
  sort: LibrarySort
  onSort: (key: string, naturalDir?: SortDir) => void
  onToggleAll: () => void
  allSelected: boolean
}) {
  const sortIcon = (key: string) =>
    sort.key === key ? (
      sort.dir === 'asc' ? (
        <ArrowUp className="h-3 w-3 shrink-0 text-accent" />
      ) : (
        <ArrowDown className="h-3 w-3 shrink-0 text-accent" />
      )
    ) : null

  return (
    <div className="overflow-x-auto rounded-lg border border-line">
      {/* Auto layout, deliberately: `table-fixed` makes the declared widths
          bind, which at the list's narrowest (details rail open) left the
          name column ~90px and truncated every drill to one letter. The
          name is the one column that must never be sacrificed, so the
          widths stay hints and the caller drops whole columns instead when
          the rail opens — see DRILL_COLUMNS / COMPACT_COLUMN_KEYS. */}
      <table className="w-full min-w-[34rem] border-collapse text-left">
        <thead>
          <tr className="border-b border-line bg-panel-raised">
            <th scope="col" className="w-9 py-2 pl-3 pr-0">
              <button
                type="button"
                onClick={onToggleAll}
                aria-label={allSelected ? 'Clear selection' : 'Select all'}
                title={allSelected ? 'Clear selection' : 'Select all'}
                className="flex items-center"
              >
                <Checkbox checked={allSelected} />
              </button>
            </th>
            <th scope="col" className="px-3 py-2">
              <button
                type="button"
                onClick={() => onSort('name')}
                className="flex items-center gap-1 text-xs font-medium text-ink-muted transition-colors hover:text-ink"
              >
                Name
                {sortIcon('name')}
              </button>
            </th>
            {columns.map((column) => (
              <th key={column.key} scope="col" className={`px-3 py-2 ${column.className ?? ''}`}>
                {column.sortable ? (
                  <button
                    type="button"
                    onClick={() => onSort(column.key, column.naturalDir)}
                    className="flex items-center gap-1 text-xs font-medium text-ink-muted transition-colors hover:text-ink"
                  >
                    {column.label}
                    {sortIcon(column.key)}
                  </button>
                ) : (
                  <span className="text-xs font-medium text-ink-muted">{column.label}</span>
                )}
              </th>
            ))}
            <th scope="col" className="w-10 px-1 py-2">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const isSelected = selected.has(item.id)
            const isActive = activeId === item.id
            return (
              <tr
                key={item.id}
                tabIndex={0}
                aria-selected={isSelected}
                {...rowInteractionHandlers(item.id, { onToggle, onActivate, onOpen })}
                className={
                  // The global :focus-visible ring is a box-shadow, which
                  // design.md warns gets clipped by an `overflow-x-auto`
                  // ancestor — which this table has. An inset ring is the
                  // one that actually paints on a row inside a horizontal
                  // scroller, so rows carry their own.
                  'group cursor-default border-b border-line/60 outline-none transition-colors last:border-0 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent/50 ' +
                  (isSelected || isActive ? 'bg-accent/10' : 'hover:bg-panel-raised')
                }
              >
                <td className="py-2 pl-3 pr-0 align-middle">
                  {/* The checkbox is invisible until the row is hovered,
                      focused or already part of a selection — the row stays
                      quiet to read, and selecting is still one click away
                      rather than behind a mode. */}
                  <span
                    role="button"
                    tabIndex={-1}
                    aria-label={isSelected ? `Deselect ${item.name}` : `Select ${item.name}`}
                    onClick={(e) => {
                      e.stopPropagation()
                      onToggle(item.id, { additive: true })
                    }}
                    onDoubleClick={(e) => e.stopPropagation()}
                    className={
                      'flex transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 ' +
                      (isSelected ? 'opacity-100' : 'opacity-0')
                    }
                  >
                    <Checkbox checked={isSelected} />
                  </span>
                </td>
                <td className="min-w-0 px-3 py-2 align-middle">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <ItemThumb item={item} className="h-7 w-10" iconClassName="h-3.5 w-3.5" />
                    <div className="min-w-0">
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="truncate text-sm font-medium text-ink">{item.name}</span>
                        {/* shrink-0: without it a flex badge gets squeezed
                            until its own text wraps mid-word, which is what
                            "4-3-3" did once the details rail narrowed the
                            column. The name truncates instead — it has the
                            room to. */}
                        {item.badge && <span className="shrink-0 whitespace-nowrap">{item.badge}</span>}
                      </div>
                      {/* Below `sm` the metadata columns are hidden, so the
                          row carries its own summary line instead of
                          becoming a bare name. */}
                      {item.metaLine && <p className="truncate text-xs text-ink-faint sm:hidden">{item.metaLine}</p>}
                      {item.subtitle && (
                        <p className="hidden truncate text-xs text-ink-muted sm:block">{item.subtitle}</p>
                      )}
                    </div>
                  </div>
                </td>
                {columns.map((column) => (
                  <td key={column.key} className={`px-3 py-2 align-middle text-xs text-ink-muted ${column.className ?? ''}`}>
                    {item.cells[column.key] ?? <span className="text-ink-faint">—</span>}
                  </td>
                ))}
                <td className="px-1 py-2 text-right align-middle">
                  <RowMenu items={item.menu} label={`Actions for ${item.name}`} />
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export function LibraryTiles({ items, selected, activeId, onToggle, onActivate, onOpen }: ItemsProps) {
  return (
    <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => {
        const isSelected = selected.has(item.id)
        const isActive = activeId === item.id
        return (
          <li key={item.id}>
            <div
              role="button"
              tabIndex={0}
              aria-selected={isSelected}
              {...rowInteractionHandlers(item.id, { onToggle, onActivate, onOpen })}
              className={
                // No focus classes: a tile is in normal flow, so index.css's
                // global :focus-visible ring paints on it for free.
                'group relative flex w-full cursor-default flex-col gap-2 rounded-lg border p-3 text-left transition-colors ' +
                (isSelected || isActive ? 'border-accent/40 bg-accent/10' : 'border-line hover:border-accent/40 hover:bg-accent/5')
              }
            >
              <div className="relative">
                <ItemThumb item={item} className="aspect-video w-full" iconClassName="h-6 w-6" />
                <span
                  role="button"
                  tabIndex={-1}
                  aria-label={isSelected ? `Deselect ${item.name}` : `Select ${item.name}`}
                  onClick={(e) => {
                    e.stopPropagation()
                    onToggle(item.id, { additive: true })
                  }}
                  onDoubleClick={(e) => e.stopPropagation()}
                  className={
                    'absolute left-2 top-2 flex rounded bg-panel/80 p-0.5 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 ' +
                    (isSelected ? 'opacity-100' : 'opacity-0')
                  }
                >
                  <Checkbox checked={isSelected} />
                </span>
                <span className="absolute right-1 top-1 rounded bg-panel/80 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                  <RowMenu items={item.menu} label={`Actions for ${item.name}`} />
                </span>
              </div>
              <div className="min-w-0 space-y-1">
                <div className="flex min-w-0 items-center gap-2">
                  <p className="truncate text-sm font-medium text-ink">{item.name}</p>
                  {item.badge && <span className="shrink-0 whitespace-nowrap">{item.badge}</span>}
                </div>
                {item.metaLine && <p className="truncate text-xs text-ink-muted">{item.metaLine}</p>}
              </div>
            </div>
          </li>
        )
      })}
    </ul>
  )
}
