import { useEffect } from 'react'

// Cmd/Ctrl+Z to undo, Cmd/Ctrl+Shift+Z (and Ctrl+Y) to redo — added
// 2026-08-30 after an automated pass found both editors had undo BUTTONS that
// worked and no keyboard path at all: placing a player and pressing Cmd+Z did
// nothing, in a canvas tool where that is the first thing a hand reaches for.
//
// It gets its own hook rather than joining `useTimelineKeys` or
// `useMarkingKeys` because both of those deliberately ignore modified presses
// — `useMarkingKeys` returns early on metaKey/ctrlKey so that plain `C` and
// `V` stay free for Circle and Curve, and `useTimelineKeys` does the same.
// That guard is exactly what leaves this space open, so the modified case
// belongs beside them, not inside them.

function isTypingTarget(target: EventTarget | null): boolean {
  const element = target as HTMLElement | null
  if (!element || typeof element.tagName !== 'string') return false
  const tag = element.tagName.toLowerCase()
  return tag === 'input' || tag === 'textarea' || tag === 'select' || element.isContentEditable === true
}

export function useUndoKeys({
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  enabled = true,
}: {
  onUndo: () => void
  onRedo: () => void
  canUndo: boolean
  canRedo: boolean
  enabled?: boolean
}) {
  useEffect(() => {
    if (!enabled) return
    const onKeyDown = (event: KeyboardEvent) => {
      // Never steal an undo from a text field the coach is typing in — the
      // browser's own undo belongs to the input.
      if (isTypingTarget(event.target)) return
      if (!(event.metaKey || event.ctrlKey) || event.altKey) return
      if (event.defaultPrevented) return

      const key = event.key.toLowerCase()
      // Ctrl+Y is the Windows redo idiom and costs nothing to honour.
      const redo = (key === 'z' && event.shiftKey) || (key === 'y' && !event.shiftKey)
      const undo = key === 'z' && !event.shiftKey
      if (!redo && !undo) return

      // Claimed even when the stack is empty: letting it fall through would
      // hand the press to the browser, which would undo something in a field
      // the coach can't see rather than doing nothing.
      event.preventDefault()
      if (redo && canRedo) onRedo()
      else if (undo && canUndo) onUndo()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onUndo, onRedo, canUndo, canRedo, enabled])
}
