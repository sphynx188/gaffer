import { useState } from 'react'
import { Search } from 'lucide-react'

export interface ChipOption {
  id: string
  label: string
}

// A wrap of toggle chips, with a search box once the list is long enough to
// need one. Selection semantics belong to the caller: a single-choice field
// replaces `selected` on toggle, a multi-choice one adds or removes.
export function ChipPicker({
  options,
  selected,
  onToggle,
  ariaLabel,
  searchThreshold = 8,
}: {
  options: ChipOption[]
  selected: string[]
  onToggle: (id: string) => void
  ariaLabel: string
  searchThreshold?: number
}) {
  const [query, setQuery] = useState('')
  const q = query.trim().toLowerCase()
  const shown = q ? options.filter((o) => o.label.toLowerCase().includes(q)) : options

  return (
    <div className="space-y-2">
      {options.length > searchThreshold && (
        // The wrapper carries the field's focus ring; the bare input inside
        // opts out of the global :focus-visible glow (shadow-none) so the
        // two don't stack into a ring within a ring.
        <label className="flex items-center gap-2 rounded-md border border-line bg-panel px-2 py-1.5 transition-colors focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/30">
          <Search className="h-3.5 w-3.5 shrink-0 text-ink-faint" aria-hidden />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search…"
            aria-label={`Search ${ariaLabel.toLowerCase()}`}
            className="min-w-0 flex-1 bg-transparent text-sm text-ink shadow-none outline-none placeholder:text-ink-faint"
          />
        </label>
      )}
      <div role="group" aria-label={ariaLabel} className="flex flex-wrap gap-1.5">
        {shown.map((option) => {
          const on = selected.includes(option.id)
          return (
            <button
              key={option.id}
              type="button"
              aria-pressed={on}
              onClick={() => onToggle(option.id)}
              className={
                'min-h-9 rounded-full border px-3 text-sm transition-colors ' +
                (on
                  ? 'border-accent bg-accent/15 text-accent-ink'
                  : 'border-line text-ink-muted hover:border-line-strong hover:text-ink')
              }
            >
              {option.label}
            </button>
          )
        })}
        {shown.length === 0 && <p className="text-xs text-ink-faint">Nothing matches "{query}".</p>}
      </div>
    </div>
  )
}
