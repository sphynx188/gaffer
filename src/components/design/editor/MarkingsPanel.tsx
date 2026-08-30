import { Eraser } from 'lucide-react'
import { MARKING_TOOLS, type MarkingTool } from './markingTools'

// The markings rail panel (rework plan Stage 6.4). The tool table itself lives
// in markingTools.tsx so this file exports only a component.

interface MarkingsPanelProps {
  value: MarkingTool
  onChange: (tool: MarkingTool) => void
  onClearAll: () => void
  markingCount: number
  // "Clear drawings" as an action distinct from timeline undo (Stage 6.3, and
  // the reasoning in 2.3). Optional because only the tactics board keeps a
  // separate drawing undo stack for it to be distinct FROM — a drill has one
  // stack, where clearing is just another undoable step and "Clear all
  // markings" below already covers it.
  onClearDrawings?: () => void
  drawingCount?: number
}

export function MarkingsPanel({
  value,
  onChange,
  onClearAll,
  markingCount,
  onClearDrawings,
  drawingCount = 0,
}: MarkingsPanelProps) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-ink-muted">Markings & zones</p>
      {MARKING_TOOLS.map((tool) => (
        <button
          key={tool.id}
          type="button"
          onClick={() => onChange(tool.id)}
          aria-pressed={value === tool.id}
          className={
            'flex min-h-11 w-full items-center gap-2 rounded-md px-2 text-left text-sm transition-colors lg:min-h-9 ' +
            (value === tool.id ? 'bg-accent/15 text-accent-ink' : 'text-ink-muted hover:bg-panel-raised hover:text-ink')
          }
        >
          {tool.icon}
          <span className="flex-1">{tool.label}</span>
          {tool.key && (
            <kbd className="rounded border border-line px-1 font-mono text-[10px] uppercase text-ink-faint">
              {tool.key}
            </kbd>
          )}
        </button>
      ))}
      {onClearDrawings && (
        <button
          type="button"
          onClick={onClearDrawings}
          disabled={drawingCount === 0}
          className="mt-2 flex min-h-11 w-full items-center gap-2 rounded-md border border-line px-2 text-sm font-medium text-ink-muted transition-colors hover:border-line-strong hover:text-ink disabled:opacity-40 disabled:hover:border-line disabled:hover:text-ink-muted lg:min-h-9"
        >
          <Eraser className="h-4 w-4" />
          Clear drawings
        </button>
      )}
      <button
        type="button"
        onClick={onClearAll}
        disabled={markingCount === 0}
        className="mt-2 flex min-h-11 w-full items-center gap-2 rounded-md border border-line px-2 text-sm font-medium text-ink-muted transition-colors hover:border-bad hover:text-bad disabled:opacity-40 disabled:hover:border-line disabled:hover:text-ink-muted lg:min-h-9"
      >
        <Eraser className="h-4 w-4" />
        Clear all markings
      </button>
    </div>
  )
}
