import { useCallback, useMemo, useRef, useState } from 'react'

export interface ToggleOptions {
  /** Shift-click: extend from the last clicked row to this one. */
  shift?: boolean
  /** Cmd/Ctrl-click or a checkbox hit: add/remove without clearing the rest. */
  additive?: boolean
}

// Multi-select for the Library's item list (2026-08-28) — the checkbox +
// shift-range + select-all behaviour every file manager has, replacing the
// old admin-only "Select" mode toggle. Selection is no longer a mode: rows
// carry a checkbox that appears on hover/focus (or always, once something is
// selected), so filing several drills doesn't start with finding a button.
//
// `orderedIds` must be the ids in the order they're rendered — that's what
// makes a shift-range mean the same thing the user sees, and it's also what
// the selection is intersected against below.
export function useLibrarySelection(orderedIds: string[]) {
  const [ticked, setTicked] = useState<Set<string>>(() => new Set())
  const anchorRef = useRef<string | null>(null)
  const idsKey = orderedIds.join('|')

  // What's ticked and what's actionable are two different sets: anything
  // filtered out of the view can't take part in a bulk action, or a search
  // typed after ticking would quietly delete rows nobody could see. Derived
  // at render rather than pruned in an effect — an effect here would set
  // state during render's own commit and cascade a second render for every
  // keystroke in the search box.
  const selected = useMemo(() => {
    if (ticked.size === 0) return ticked
    const visible = new Set(idsKey ? idsKey.split('|') : [])
    const next = new Set([...ticked].filter((id) => visible.has(id)))
    return next.size === ticked.size ? ticked : next
  }, [ticked, idsKey])

  const toggle = useCallback(
    (id: string, options: ToggleOptions = {}) => {
      setTicked((current) => {
        const next = new Set(current)
        if (options.shift && anchorRef.current) {
          const from = orderedIds.indexOf(anchorRef.current)
          const to = orderedIds.indexOf(id)
          if (from !== -1 && to !== -1) {
            const [start, end] = from <= to ? [from, to] : [to, from]
            for (let i = start; i <= end; i++) next.add(orderedIds[i])
            return next
          }
        }
        if (next.has(id)) next.delete(id)
        else next.add(id)
        anchorRef.current = id
        return next
      })
    },
    [orderedIds]
  )

  const selectAll = useCallback(() => {
    setTicked(new Set(orderedIds))
    anchorRef.current = orderedIds[orderedIds.length - 1] ?? null
  }, [orderedIds])

  const clear = useCallback(() => {
    setTicked(new Set())
    anchorRef.current = null
  }, [])

  const allSelected = orderedIds.length > 0 && selected.size === orderedIds.length

  return useMemo(
    () => ({ selected, toggle, selectAll, clear, allSelected, count: selected.size }),
    [selected, toggle, selectAll, clear, allSelected]
  )
}
