import {
  Circle as CircleIcon,
  Minus,
  MousePointer2,
  MoveUpRight,
  PenLine,
  Ruler,
  Spline,
  Square,
  StickyNote,
  Waves,
} from 'lucide-react'
import type { ReactNode } from 'react'
import type { DrawTool } from '../PitchCanvas'

// The drawing tools (rework plan Stage 6.4). Curved arrows and zones are the
// two Gaffer most obviously lacked — a passing pattern that bends, and a
// pressing trap you can shade in.
//
// A tool is either the selection tool, a marking-placing tool, or the ruler,
// which measures and keeps nothing.
export type MarkingTool = 'select' | 'arrow' | 'pass' | 'line' | 'curve' | 'circle' | 'rect' | 'freehand' | 'zone' | 'ruler' | 'text'

interface ToolSpec {
  id: MarkingTool
  label: string
  icon: ReactNode
  // What the canvas draws for it, if anything. 'select' and 'text' are handled
  // by the editor rather than by the canvas's drawing machine.
  draw: DrawTool | null
  hint: string
}

export const MARKING_TOOLS: ToolSpec[] = [
  { id: 'select', label: 'Select', icon: <MousePointer2 className="h-4 w-4" />, draw: null, hint: '' },
  { id: 'arrow', label: 'Player run', icon: <MoveUpRight className="h-4 w-4" />, draw: 'arrow', hint: 'Drag across the pitch to draw a run' },
  { id: 'pass', label: 'Pass', icon: <MoveUpRight className="h-4 w-4" />, draw: 'arrow', hint: 'Drag across the pitch to draw a pass' },
  { id: 'line', label: 'Line', icon: <Minus className="h-4 w-4" />, draw: 'line', hint: 'Drag across the pitch to draw a line' },
  { id: 'curve', label: 'Curved arrow', icon: <Spline className="h-4 w-4" />, draw: 'curve', hint: 'Tap each point of the curve, then tap the last one again to finish' },
  { id: 'circle', label: 'Circle', icon: <CircleIcon className="h-4 w-4" />, draw: 'circle', hint: 'Drag to size the circle' },
  { id: 'rect', label: 'Rectangle', icon: <Square className="h-4 w-4" />, draw: 'rect', hint: 'Drag to size the rectangle' },
  { id: 'freehand', label: 'Freehand', icon: <Waves className="h-4 w-4" />, draw: 'freehand', hint: 'Drag to draw' },
  { id: 'zone', label: 'Zone', icon: <PenLine className="h-4 w-4" />, draw: 'zone', hint: 'Tap each corner of the zone, then tap the last one again to close it' },
  { id: 'ruler', label: 'Ruler', icon: <Ruler className="h-4 w-4" />, draw: 'ruler', hint: 'Drag to measure — nothing is added to the drill' },
  { id: 'text', label: 'Note', icon: <StickyNote className="h-4 w-4" />, draw: null, hint: 'Tap the pitch to place a note' },
]

export function markingToolSpec(id: MarkingTool): ToolSpec {
  return MARKING_TOOLS.find((tool) => tool.id === id) ?? MARKING_TOOLS[0]
}

