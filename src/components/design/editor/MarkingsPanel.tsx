import { ChevronDown, Eraser } from 'lucide-react'
import { MARKING_TOOLS, type MarkingTool } from './markingTools'

// The markings rail panel (rework plan Stage 6.4). The tool table itself lives
// in markingTools.tsx so this file exports only a component.
//
// Shared between the drill editor's Tools tab (ToolsPanel.tsx) and
// TacticInspector — collapse is drill-only (2026-08-31), so `collapsed`/
// `onToggleCollapsed` are optional and gated together: leave both undefined
// (TacticInspector's own call site) and the title renders as plain text,
// always expanded, exactly as before.

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
  collapsed?: boolean
  onToggleCollapsed?: () => void
  // Whether `value` is the tool actually armed on the canvas right now, as
  // opposed to just the last one chosen (2026-08-31). Defaults to true —
  // TacticInspector's "Tools" tab IS the drawing context the moment it's
  // open, so its remembered choice is always the live one. The drill
  // editor's Tools tab sits open at all times next to a top-bar Select the
  // coach reaches for constantly, so without this a freshly opened drill
  // showed "Player run" highlighted purple while Select was actually armed
  // — a remembered default masquerading as an active state.
  armed?: boolean
}

export function MarkingsPanel({
  value,
  onChange,
  onClearAll,
  markingCount,
  onClearDrawings,
  drawingCount = 0,
  collapsed = false,
  onToggleCollapsed,
  armed = true,
}: MarkingsPanelProps) {
  const [selectTool, ...drawTools] = MARKING_TOOLS
  return (
    <div className="space-y-1">
      {onToggleCollapsed ? (
        <button
          type="button"
          onClick={onToggleCollapsed}
          aria-expanded={!collapsed}
          className="flex items-center gap-1 rounded text-xs font-medium text-ink-muted transition-colors hover:text-ink"
        >
          <ChevronDown className={`h-3 w-3 shrink-0 transition-transform ${collapsed ? '-rotate-90' : ''}`} />
          Markings &amp; zones
        </button>
      ) : (
        <p className="text-xs font-medium text-ink-muted">Markings &amp; zones</p>
      )}
      {!collapsed && (
        <>
          <MarkingRow tool={selectTool} pressed={armed && value === selectTool.id} onChange={onChange} />
          {/* Select exits drawing rather than placing anything — set apart
              from the thirteen tools that actually draw, so the list reads
              as "one way out, many ways in" instead of fourteen equals. */}
          <div className="my-1.5 border-t border-line" />
          {drawTools.map((tool) => (
            <MarkingRow key={tool.id} tool={tool} pressed={armed && value === tool.id} onChange={onChange} />
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
        </>
      )}
    </div>
  )
}

function MarkingRow({
  tool,
  pressed,
  onChange,
}: {
  tool: (typeof MARKING_TOOLS)[number]
  pressed: boolean
  onChange: (tool: MarkingTool) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(tool.id)}
      aria-pressed={pressed}
      className={
        'flex min-h-11 w-full items-center gap-2 rounded-md px-2 text-left text-sm transition-colors lg:min-h-9 ' +
        (pressed ? 'bg-accent/15 text-accent-ink' : 'text-ink-muted hover:bg-panel-raised hover:text-ink')
      }
    >
      {tool.icon}
      <span className="flex-1">{tool.label}</span>
      {tool.key && (
        <kbd className="rounded border border-line px-1 font-mono text-[10px] uppercase text-ink-muted">
          {tool.key}
        </kbd>
      )}
    </button>
  )
}
