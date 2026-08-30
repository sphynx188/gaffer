import type { ComponentType, KeyboardEvent as ReactKeyboardEvent, MouseEvent as ReactMouseEvent, ReactNode } from 'react'
import { ArrowDown, ArrowUp } from 'lucide-react'
import { Checkbox } from './Checkbox'
import { RowMenu, type RowMenuItem } from './RowMenu'
import { PitchCanvas } from '../design/PitchCanvas'
import type { RenderFrame } from '../design/canvas/interpolate'
import type { PitchConfig } from '../../store'

// The tile preview's box. BOTH dimensions are given: the tile is 16:9 and a
// pitch preset is usually portrait, so passing width alone let PitchCanvas
// derive a height from the pitch's own aspect (360 wide -> 480 tall for a
// 30x40 area) and the tile's `overflow-hidden` simply cut the bottom off —
// goals and half the players disappeared. Constrained to the tile's own ratio
// and combined with `fillCanvas`, the whole board is visible instead.
const THUMB_WIDTH = 360
const THUMB_HEIGHT = Math.round((THUMB_WIDTH * 9) / 16)
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
  /**
   * Column width in px. Applied as an inline style on the header and cell,
   * AND as a max-width on the value's own inner wrapper (see
   * `LibraryTable`) — the second part is load-bearing, not decoration.
   * Under `table-layout: auto` (deliberate — see the note by `<table>`
   * below), a `width` on a `<td>` is only ever a hint the browser can grow
   * past to fit content; `overflow: hidden` on the `<td>` itself doesn't
   * change that; only a real max-width on an ELEMENT WITH TEXT bounds what
   * the browser will ever try to render, which is what makes the column
   * actually hold to this number. Found live (2026-08-28): without it,
   * "Conditioning" in a 112px Category column simply pushed the table
   * wider than its container, and the un-scrolled view sheared the word
   * off mid-glyph with nothing to say a scrollbar was the reason.
   */
  width: number
  /** Responsive visibility only, e.g. "hidden md:table-cell" — width lives in `width` now. */
  visibilityClassName?: string
}

export interface LibraryItemView {
  id: string
  name: string
  thumbnailUrl: string | null
  /**
   * The drill/tactic's opening keyframe, rendered live in the tile view
   * (2026-08-30). Preferred over `thumbnailUrl`: a stored PNG is only captured
   * on the first save and goes stale the moment the board is edited, and a
   * drill that has never been saved with something on it has none at all — so
   * the grid was showing a wall of identical file glyphs. Drawing the frame
   * itself is always current and needs no capture step.
   */
  preview?: { pitch: PitchConfig; frame: RenderFrame } | null
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

// The tile's picture of a document: its opening keyframe drawn live, falling
// back to the stored PNG and then to the file glyph. Tiles are the only caller
// — the list dropped its 40x28 thumb, which was too small to tell two drills
// apart — so there is no longer a flag for which mode to draw in.
function ItemThumb({
  item,
  className,
  iconClassName,
}: {
  item: LibraryItemView
  className: string
  iconClassName: string
}) {
  // A live preview sizes itself: the canvas needs pixel dimensions, so it is
  // THUMB_WIDTH x THUMB_HEIGHT, and the tile's own `aspect-video` would crop it
  // whenever the column is narrower than THUMB_WIDTH (a 342px column gives a
  // 192px-tall tile around a 203px-tall canvas). Dropping the ratio lets the
  // tile take the canvas's height instead, so every board is fully visible and
  // all tiles line up at the same height regardless of column width.
  const showLive = !!item.preview
  const box = showLive ? className.replace('aspect-video', '') : className
  return (
    <span className={`flex shrink-0 items-center justify-center overflow-hidden rounded bg-panel-raised ${box}`}>
      {showLive && item.preview ? (
        <PitchCanvas
          pitch={item.preview.pitch}
          frame={item.preview.frame}
          maxWidth={THUMB_WIDTH}
          maxHeight={THUMB_HEIGHT}
          fillCanvas
        />
      ) : item.thumbnailUrl ? (
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
  // Checkbox (36px, `w-9`) + actions (40px, `w-10`) + a floor for name that
  // keeps it legible even when squeezed, plus whatever the actually-visible
  // metadata columns need. Computed from `columns` (already filtered to
  // compact/full by the caller) rather than a flat constant, so a table
  // showing 2 metadata columns while the details rail is open asks its
  // container for real less room than one showing all 4 — the previous
  // fixed `min-w-[34rem]` didn't know that, and forced itself wider than a
  // squeezed list column could offer regardless of how few columns were
  // actually on screen.
  const NAME_FLOOR = 160
  const minTableWidth = 36 + NAME_FLOOR + columns.reduce((sum, c) => sum + c.width, 0) + 40

  const sortIcon = (key: string) =>
    sort.key === key ? (
      sort.dir === 'asc' ? (
        <ArrowUp className="h-3 w-3 shrink-0 text-accent-ink" />
      ) : (
        <ArrowDown className="h-3 w-3 shrink-0 text-accent-ink" />
      )
    ) : null

  return (
    <div className="overflow-x-auto rounded-lg border border-line">
      {/* `table-fixed`, not auto — found the hard way (2026-08-28). Auto
          layout doesn't just treat a `width` hint as soft; a `white-space:
          nowrap` descendant ANYWHERE in a column (the name cell's subtitle
          paragraph carries `truncate`, and a drill's objective sentence is
          long) makes the auto-sizing algorithm consider that unwrapped
          text's full natural width when sizing the column — even though
          the paragraph's OWN overflow-hidden means it would never actually
          render that wide. That inflated one real table to 879px against
          a 560px container with only 4 short metadata columns and nothing
          else unusual, which is what actually sheared "Conditioning" in
          half at the scroll edge, not the table's stated min-width (the
          candidate first fixed, and it did nothing — verified live).
          `table-fixed` is what makes the browser stop consulting content
          for sizing at all: every column with a `width` gets exactly that,
          and name (the one column here with none) takes the rest.
          The earlier revert away from table-fixed ("squished name to one
          letter") was a real symptom but the wrong diagnosis — that was
          this same nowrap-inflation bug, just manifesting as an
          artificially tiny remainder instead of a torn word. `minTableWidth`
          (computed from the columns actually visible, not a flat guess)
          is what actually prevents that: below it, the table scrolls
          instead of squeezing name past readability. */}
      <table className="w-full table-fixed border-collapse text-left" style={{ minWidth: minTableWidth }}>
        <thead>
          <tr className="border-b border-line bg-panel-raised">
            <th scope="col" className="w-9 py-2 pl-3 pr-0">
              <Checkbox
                checked={allSelected}
                onToggle={onToggleAll}
                label={allSelected ? 'Clear selection' : 'Select all'}
              />
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
              <th
                key={column.key}
                scope="col"
                style={{ width: column.width }}
                className={`px-3 py-2 ${column.visibilityClassName ?? ''}`}
              >
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
                  <Checkbox
                    checked={isSelected}
                    onToggle={() => onToggle(item.id, { additive: true })}
                    label={isSelected ? `Deselect ${item.name}` : `Select ${item.name}`}
                    className={
                      'transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 ' +
                      (isSelected ? 'opacity-100' : 'opacity-0')
                    }
                  />
                </td>
                <td className="min-w-0 px-3 py-2 align-middle">
                  {/* No thumbnail in the list. At 40x28 it was too small to
                      tell two drills apart, so it read as decoration next to
                      the checkbox rather than information — the grid is where
                      you look at boards (2026-08-30). */}
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
                </td>
                {columns.map((column) => {
                  const value = item.cells[column.key]
                  return (
                    <td
                      key={column.key}
                      style={{ width: column.width }}
                      className={`px-3 py-2 align-middle text-xs text-ink-muted ${column.visibilityClassName ?? ''}`}
                    >
                      {/* The `truncate` + max-width has to live on THIS
                          inner span, not the `<td>` — see LibraryColumn.width's
                          comment for why the `<td>`'s own width is only ever
                          a hint under auto layout. px-3 either side of the
                          cell accounts for the -24. */}
                      <span
                        className="block truncate"
                        style={{ maxWidth: column.width - 24 }}
                        title={typeof value === 'string' ? value : undefined}
                      >
                        {value ?? <span className="text-ink-faint">—</span>}
                      </span>
                    </td>
                  )
                })}
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
              tabIndex={0}
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
                <Checkbox
                  checked={isSelected}
                  onToggle={() => onToggle(item.id, { additive: true })}
                  label={isSelected ? `Deselect ${item.name}` : `Select ${item.name}`}
                  className={
                    'absolute left-2 top-2 rounded bg-panel/80 p-0.5 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 ' +
                    (isSelected ? 'opacity-100' : 'opacity-0')
                  }
                />
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
