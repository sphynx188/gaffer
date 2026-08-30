import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Check, ChevronsUpDown, Search } from 'lucide-react'

export interface DropdownOption {
  value: string
  label: string
}

// The one dropdown pattern for the whole app (2026-08-24) — replaces every
// native <select> with a trigger button + popover, after a Supabase Studio
// project-switcher reference screenshot: search box, a scrollable option
// list, a checkmark on the selected row, an optional footer action. Native
// <select> can't be given that look at all (no styling the popup itself in
// any browser), which is why this exists instead of just restyling <select>.
// See design.md's Components section for the convention this backs.
//
// The search box only earns its place on longer lists — for a 3-item status
// picker it's pure friction with nothing to filter, so it's hidden below a
// threshold unless a caller forces it either way via `searchable`.
const SEARCH_THRESHOLD = 6

export function Dropdown({
  value,
  onChange,
  options,
  placeholder = 'Select…',
  searchable,
  footer,
  ariaLabel,
  id,
  triggerClassName = '',
  emptyMessage = 'No results',
}: {
  value: string
  onChange: (value: string) => void
  options: DropdownOption[]
  placeholder?: string
  searchable?: boolean
  footer?: ReactNode
  ariaLabel: string
  id?: string
  triggerClassName?: string
  emptyMessage?: string
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  const selected = options.find((o) => o.value === value)
  const showSearch = searchable ?? options.length > SEARCH_THRESHOLD

  // Same dismissal pattern as the original team-switcher popover this
  // generalizes: a click anywhere outside, or Escape, closes it. Listening
  // on the document rather than a blur handler so it also closes when focus
  // moves somewhere unrelated (clicking a page link), not just within it.
  useEffect(() => {
    if (!open) return
    searchRef.current?.focus()
    const onPointerDown = (e: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  const filtered = query.trim()
    ? options.filter((o) => o.label.toLowerCase().includes(query.trim().toLowerCase()))
    : options

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        id={id}
        onClick={() => {
          setQuery('')
          setOpen((o) => !o)
        }}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        className={`flex items-center justify-between gap-1.5 rounded-md border border-line bg-panel-raised px-2 py-1.5 text-sm text-ink transition-colors hover:border-line-strong ${triggerClassName}`}
      >
        <span className={`truncate ${selected ? '' : 'text-ink-faint'}`}>{selected?.label ?? placeholder}</span>
        <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-ink-faint" />
      </button>

      {open && (
        <div
          role="listbox"
          aria-label={ariaLabel}
          className="absolute left-0 top-full z-40 mt-1.5 w-full min-w-56 overflow-hidden rounded-md border border-line bg-panel shadow-xl"
        >
          {showSearch && (
            <div className="relative border-b border-line">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-faint" />
              <input
                ref={searchRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search…"
                aria-label={`Search ${ariaLabel}`}
                className="w-full bg-transparent py-2 pl-8 pr-2 text-sm text-ink outline-none placeholder:text-ink-faint"
              />
            </div>
          )}
          {filtered.length > 0 ? (
            <ul className="max-h-64 overflow-y-auto py-1">
              {filtered.map((option) => (
                <li key={option.value}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={option.value === value}
                    onClick={() => {
                      onChange(option.value)
                      setOpen(false)
                    }}
                    className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm text-ink transition-colors hover:bg-panel-raised"
                  >
                    <span className="truncate">{option.label}</span>
                    {option.value === value && <Check className="h-4 w-4 shrink-0 text-accent-ink" />}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-3 py-3 text-sm text-ink-faint">{emptyMessage}</p>
          )}
          {footer && <div className="border-t border-line py-1">{footer}</div>}
        </div>
      )}
    </div>
  )
}
