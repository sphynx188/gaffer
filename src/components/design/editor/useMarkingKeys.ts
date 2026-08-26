import { useEffect } from 'react'
import { markingToolForKey, type MarkingTool } from './markingTools'

// The tool shortcut map (TACTICS_BOARD_REWORK_PLAN.md Stage 6.2):
// `M A L V N C R Z D X H U S I`, from the plan's published reference.
//
// Shared by both editors rather than living in either, so a key means the same
// thing on a drill board and a tactics board. The bindings themselves are on
// the tools in markingTools.tsx — one table, so a tool and its key can't drift
// apart.
//
// ── On collisions ─────────────────────────────────────────────────────────
// None with the timeline's own keys. `T` and `G` there are the movement
// visualisations, `K` adds a keyframe, `P` adds a phase, and space and the
// arrows drive the transport — no overlap with the fourteen here. `C` and `V`
// look like they clash with copy/paste, but useTimelineKeys returns early on
// Ctrl/Cmd, and this hook ignores any modified press, so the plain keys stay
// free for Circle and Curve.

function isTypingTarget(target: EventTarget | null): boolean {
  const element = target as HTMLElement | null
  if (!element || typeof element.tagName !== 'string') return false
  const tag = element.tagName.toLowerCase()
  return tag === 'input' || tag === 'textarea' || tag === 'select' || element.isContentEditable === true
}

export interface MarkingKeysOptions {
  /** Selects the tool, and switches the editor into the mode that uses it. */
  onSelectTool: (tool: MarkingTool) => void
  enabled?: boolean
}

export function useMarkingKeys({ onSelectTool, enabled = true }: MarkingKeysOptions) {
  useEffect(() => {
    if (!enabled) return

    const onKeyDown = (event: KeyboardEvent) => {
      // A coach naming a phase or typing a note is not reaching for a tool.
      if (isTypingTarget(event.target)) return
      // Modified presses belong to someone else — Ctrl+C is copy, not Circle.
      if (event.metaKey || event.ctrlKey || event.altKey) return
      // The canvas claims some keys for nudging a selection and calls
      // preventDefault when it does; this listener is on window, so it runs
      // after and can stand down. Same guard useTimelineKeys uses.
      if (event.defaultPrevented) return

      const tool = markingToolForKey(event.key)
      if (!tool) return
      onSelectTool(tool)
      event.preventDefault()
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [enabled, onSelectTool])
}
