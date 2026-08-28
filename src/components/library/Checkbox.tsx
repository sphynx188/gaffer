import { Check } from 'lucide-react'

// The Library's row/tile selection box (2026-08-28). Drawn rather than a
// native <input type="checkbox"> for the same reason Dropdown replaced
// <select>: the native control can't be given the app's palette on both
// themes, and this one has to sit legibly on top of a thumbnail as well as
// on a row. `role="checkbox"` on the span keeps it announced correctly —
// the real click target is the row or tile that wraps it, which is why this
// is not itself a button (a button inside the row's button is invalid).
export function Checkbox({ checked, label }: { checked: boolean; label?: string }) {
  return (
    <span
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      className={
        'flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ' +
        (checked ? 'border-accent bg-accent text-white' : 'border-line-strong bg-panel')
      }
    >
      {checked && <Check className="h-3 w-3" strokeWidth={3} />}
    </span>
  )
}
