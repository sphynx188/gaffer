import { useEffect, useRef, useState, type ComponentType, type MouseEvent as ReactMouseEvent } from 'react'
import { createPortal } from 'react-dom'
import { MoreHorizontal } from 'lucide-react'

export interface RowMenuItem {
  key: string
  label: string
  icon: ComponentType<{ className?: string }>
  onSelect: () => void
  /** Renders in the destructive tone, below a divider. */
  danger?: boolean
  disabled?: boolean
}

// The per-item "…" menu every file manager puts on a row or tile — open,
// rename, duplicate, add to collection, delete. Before this, single-item
// actions were only reachable by selecting an item to open the preview panel
// underneath the list, so "duplicate this one drill" cost a selection, a
// scroll, and a click.
//
// The popover is `position: fixed`, measured off the trigger's own rect,
// rather than absolutely positioned inside the row: the list scrolls
// horizontally on narrow screens (`overflow-x-auto`), and an absolutely
// positioned child of a scroll container gets clipped by it. Fixed also
// means the menu can hang past the container's bottom edge on the last row,
// which is the common case for a menu on a short list.
//
// It's portalled to <body> because "fixed" isn't: any transformed ancestor
// becomes the containing block for a fixed descendant, and both the places
// rail's hover-revealed action slot and the mobile drawer's slide-in panel
// are transformed. Without the portal the menu anchored to those instead of
// the viewport and opened hundreds of pixels from its own row — seen live,
// not theorised.
const MENU_WIDTH = 232
const ESTIMATED_ITEM_HEIGHT = 36

export function RowMenu({ items, label = 'More actions' }: { items: RowMenuItem[]; label?: string }) {
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null)
  const open = coords !== null

  useEffect(() => {
    if (!open) return
    const close = () => setCoords(null)
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node
      if (menuRef.current?.contains(target) || triggerRef.current?.contains(target)) return
      close()
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    document.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('keydown', onKeyDown)
    // Any scroll or resize invalidates the measured position — closing is
    // both simpler and less jarring than re-measuring on every frame.
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
    }
  }, [open])

  if (items.length === 0) return null

  const handleOpen = (e: ReactMouseEvent) => {
    // The trigger sits inside a row that also handles clicks (select) and
    // double-clicks (open) — neither should fire when the menu is what was
    // hit.
    e.preventDefault()
    e.stopPropagation()
    if (open) {
      setCoords(null)
      return
    }
    const rect = triggerRef.current?.getBoundingClientRect()
    if (!rect) return
    const height = items.length * ESTIMATED_ITEM_HEIGHT + 16
    const flipUp = rect.bottom + height > window.innerHeight && rect.top > height
    setCoords({
      top: flipUp ? Math.max(8, rect.top - height - 4) : rect.bottom + 4,
      left: Math.min(Math.max(8, rect.right - MENU_WIDTH), window.innerWidth - MENU_WIDTH - 8),
    })
  }

  const dangerItems = items.filter((i) => i.danger)
  const plainItems = items.filter((i) => !i.danger)

  const renderItem = (item: RowMenuItem) => (
    <button
      key={item.key}
      type="button"
      role="menuitem"
      disabled={item.disabled}
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        setCoords(null)
        item.onSelect()
      }}
      className={
        'flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors disabled:opacity-40 ' +
        (item.danger ? 'text-bad hover:bg-bad/10' : 'text-ink hover:bg-panel-raised')
      }
    >
      <item.icon className="h-3.5 w-3.5 shrink-0" />
      <span className="truncate">{item.label}</span>
    </button>
  )

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={handleOpen}
        onDoubleClick={(e) => e.stopPropagation()}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        title={label}
        className={
          'rounded-md p-1.5 text-ink-muted transition-colors hover:bg-panel-raised hover:text-ink ' +
          (open ? 'bg-panel-raised text-ink' : '')
        }
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>
      {open &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            aria-label={label}
            style={{ top: coords.top, left: coords.left, width: MENU_WIDTH }}
            className="fixed z-50 overflow-hidden rounded-md border border-line bg-panel py-1 shadow-xl"
          >
            {plainItems.map(renderItem)}
            {dangerItems.length > 0 && plainItems.length > 0 && <div className="my-1 h-px bg-line" />}
            {dangerItems.map(renderItem)}
          </div>,
          document.body
        )}
    </>
  )
}
