import { Check } from 'lucide-react'

// The Library's row/tile selection box.
//
// A REAL `<input type="checkbox">`, visually hidden behind the drawn span —
// rewritten 2026-08-30 after an axe pass found the previous version failed
// three ways at once. It was a `role="checkbox"` span with no accessible name
// (so a screen reader announced "checkbox" and nothing else), wrapped in a
// `role="button"` span, sitting inside a row that was itself `role="button"` —
// a widget inside a widget inside a widget, which is invalid and left keyboard
// users landing on controls that could not say what they were.
//
// Drawn rather than relying on the native box for the same reason Dropdown
// replaced `<select>`: the native control can't be given the app's palette on
// both themes, and this one has to sit legibly on a thumbnail as well as on a
// row. The input carries the semantics; the span is `aria-hidden` decoration.
//
// The label swallows click and double-click so that ticking the box never also
// triggers the row's own open-on-double-click.
export function Checkbox({
  checked,
  label,
  onToggle,
  className = '',
}: {
  checked: boolean
  /** Required: this is the control's only accessible name. */
  label: string
  onToggle: () => void
  className?: string
}) {
  return (
    <label
      className={'flex cursor-pointer items-center ' + className}
      onClick={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={onToggle}
        aria-label={label}
        className="peer sr-only"
      />
      <span
        aria-hidden="true"
        className={
          'flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ' +
          'peer-focus-visible:ring-2 peer-focus-visible:ring-accent/50 ' +
          (checked ? 'border-accent bg-accent text-white' : 'border-line-strong bg-panel')
        }
      >
        {checked && <Check className="h-3 w-3" strokeWidth={3} />}
      </span>
    </label>
  )
}
