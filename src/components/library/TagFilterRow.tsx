// Narrows the current place by tag (spec 2026-10-28). Only tags some drill in
// view actually carries, each with its count; picking several narrows — a
// drill must have all of them.
export function TagFilterRow({
  tags,
  selected,
  onChange,
}: {
  tags: { id: string; name: string; count: number }[]
  selected: string[]
  onChange: (ids: string[]) => void
}) {
  if (tags.length === 0) return null
  return (
    <div role="group" aria-label="Filter by tag" className="mb-3 flex flex-wrap items-center gap-1.5">
      {tags.map((tag) => {
        const on = selected.includes(tag.id)
        return (
          <button
            key={tag.id}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(on ? selected.filter((id) => id !== tag.id) : [...selected, tag.id])}
            className={
              'flex min-h-8 items-center gap-1.5 rounded-full border px-2.5 text-xs transition-colors ' +
              (on
                ? 'border-accent bg-accent/15 text-accent-ink'
                : 'border-line text-ink-muted hover:border-line-strong hover:text-ink')
            }
          >
            {tag.name}
            <span className="tabular-nums text-ink-faint">{tag.count}</span>
          </button>
        )
      })}
      {selected.length > 0 && (
        <button type="button" onClick={() => onChange([])} className="px-1.5 text-xs text-ink-muted hover:text-ink">
          Clear
        </button>
      )}
    </div>
  )
}
