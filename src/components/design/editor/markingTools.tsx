import {
  Circle as CircleIcon,
  Highlighter,
  Minus,
  MousePointer2,
  MoveUpRight,
  PenLine,
  Pentagon,
  Radius,
  Ruler,
  Spline,
  Square,
  StickyNote,
  Sun,
  Waves,
  Workflow,
} from 'lucide-react'
import type { ReactNode } from 'react'
import type { DrawTool } from '../PitchCanvas'

// The drawing tools. Stage 6.1 of TACTICS_BOARD_REWORK_PLAN.md takes the rail
// to parity with Teloframe's, adding Arc, Shape, Multi, Spotlight and
// Highlight.
//
// ── On "9 to 14" ──────────────────────────────────────────────────────────
// The plan says the set goes from 9 to 14. The 14 is the SHORTCUT MAP in its
// §1 — `M A L V N C R Z D X H U S I` — which is Select plus thirteen drawing
// tools. So `Marking.kind` goes from 8 to 13, and this rail covers all 14
// keys. Gaffer's own `pass` (a dashed arrow) and `ruler` (measures, keeps
// nothing) are extras beyond Teloframe's list; they are shipped and useful, so
// they stay and simply have no key of their own.
//
// A tool is either the selection tool, a marking-placing tool, or the ruler,
// which measures and keeps nothing.
export type MarkingTool =
  | 'select'
  | 'arrow'
  | 'pass'
  | 'line'
  | 'curve'
  | 'arc'
  | 'circle'
  | 'rect'
  | 'freehand'
  | 'zone'
  | 'shape'
  | 'multi'
  | 'spotlight'
  | 'highlight'
  | 'ruler'
  | 'text'

interface ToolSpec {
  id: MarkingTool
  label: string
  icon: ReactNode
  // What the canvas draws for it, if anything. 'select' and 'text' are handled
  // by the editor rather than by the canvas's drawing machine.
  draw: DrawTool | null
  hint: string
  /** Single-key shortcut, from the plan's published reference. */
  key?: string
}

export const MARKING_TOOLS: ToolSpec[] = [
  { id: 'select', label: 'Select', icon: <MousePointer2 className="h-4 w-4" />, draw: null, hint: '', key: 'm' },
  { id: 'arrow', label: 'Player run', icon: <MoveUpRight className="h-4 w-4" />, draw: 'arrow', hint: 'Drag across the pitch to draw a run', key: 'a' },
  { id: 'pass', label: 'Pass', icon: <MoveUpRight className="h-4 w-4" />, draw: 'arrow', hint: 'Drag across the pitch to draw a pass' },
  { id: 'line', label: 'Line', icon: <Minus className="h-4 w-4" />, draw: 'line', hint: 'Drag across the pitch to draw a line', key: 'l' },
  { id: 'curve', label: 'Curved arrow', icon: <Spline className="h-4 w-4" />, draw: 'curve', hint: 'Tap each point of the curve, then tap the last one again to finish', key: 'v' },
  { id: 'arc', label: 'Arc', icon: <Radius className="h-4 w-4" />, draw: 'arc', hint: 'Drag between two points to bow an arc between them', key: 'n' },
  { id: 'circle', label: 'Circle', icon: <CircleIcon className="h-4 w-4" />, draw: 'circle', hint: 'Drag to size the circle', key: 'c' },
  { id: 'rect', label: 'Box', icon: <Square className="h-4 w-4" />, draw: 'rect', hint: 'Drag to size the box', key: 'r' },
  { id: 'zone', label: 'Zone', icon: <PenLine className="h-4 w-4" />, draw: 'zone', hint: 'Tap each corner of the zone, then tap the last one again to close it', key: 'z' },
  { id: 'freehand', label: 'Draw', icon: <Waves className="h-4 w-4" />, draw: 'freehand', hint: 'Drag to draw', key: 'd' },
  { id: 'text', label: 'Note', icon: <StickyNote className="h-4 w-4" />, draw: null, hint: 'Tap the pitch to place a note', key: 'x' },
  { id: 'shape', label: 'Shape', icon: <Pentagon className="h-4 w-4" />, draw: 'shape', hint: 'Tap each corner of the shape, then tap the last one again to close it', key: 'h' },
  { id: 'multi', label: 'Multi', icon: <Workflow className="h-4 w-4" />, draw: 'multi', hint: 'Tap each leg of the move, then tap the last point again — the arrowhead lands on the final leg', key: 'u' },
  { id: 'spotlight', label: 'Spotlight', icon: <Sun className="h-4 w-4" />, draw: 'spotlight', hint: 'Drag out from the middle to dim everything outside the circle', key: 's' },
  { id: 'highlight', label: 'Highlight', icon: <Highlighter className="h-4 w-4" />, draw: 'highlight', hint: 'Drag over a player or an area to emphasise it', key: 'i' },
  { id: 'ruler', label: 'Ruler', icon: <Ruler className="h-4 w-4" />, draw: 'ruler', hint: 'Drag to measure — nothing is added to the drill' },
]

export function markingToolSpec(id: MarkingTool): ToolSpec {
  return MARKING_TOOLS.find((tool) => tool.id === id) ?? MARKING_TOOLS[0]
}

/** The tool a single keypress selects, or null if that key isn't bound. */
export function markingToolForKey(key: string): MarkingTool | null {
  const lowered = key.toLowerCase()
  return MARKING_TOOLS.find((tool) => tool.key === lowered)?.id ?? null
}
