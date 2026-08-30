// Grid & guides (rework plan Stage 6.6). Snap is what makes a cone grid or a
// rondo box buildable — without it every drill ends up hand-wobbled.

export interface GridSettings {
  showGrid: boolean
  snapToGrid: boolean
  smartGuides: boolean
}

const OPTIONS: { key: keyof GridSettings; label: string; hint: string }[] = [
  { key: 'showGrid', label: 'Show grid', hint: 'Five-metre squares over the pitch' },
  { key: 'snapToGrid', label: 'Snap to grid', hint: 'Placed and dragged items land on intersections' },
  { key: 'smartGuides', label: 'Smart guides', hint: 'Line things up with what is already on the pitch' },
]

export function GridPanel({
  settings,
  onChange,
}: {
  settings: GridSettings
  onChange: (settings: GridSettings) => void
}) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-ink-muted">Grid & guides</p>
      {OPTIONS.map((option) => {
        const on = settings[option.key]
        return (
          <button
            key={option.key}
            type="button"
            onClick={() => onChange({ ...settings, [option.key]: !on })}
            aria-pressed={on}
            title={option.hint}
            className={
              'flex min-h-11 w-full items-center justify-between gap-2 rounded-md px-2 text-left text-sm transition-colors lg:min-h-9 ' +
              (on ? 'bg-accent/15 text-accent-ink' : 'text-ink-muted hover:bg-panel-raised hover:text-ink')
            }
          >
            {option.label}
            <span
              className={
                'h-2 w-2 shrink-0 rounded-full ' + (on ? 'bg-accent' : 'bg-line-strong')
              }
            />
          </button>
        )
      })}
      {/* Snap and smart guides pull in different directions — one to a fixed
          lattice, one to whatever is already placed — so the canvas lets snap
          win and this says so rather than leaving it a mystery. */}
      {settings.snapToGrid && settings.smartGuides && (
        <p className="px-2 text-xs text-ink-faint">Snap to grid takes precedence while both are on.</p>
      )}
    </div>
  )
}
