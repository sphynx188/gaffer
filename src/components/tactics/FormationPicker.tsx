import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { useStore } from '../../store'
import { Dropdown } from '../ui/Dropdown'
import {
  pickerFormations,
  customFormationId,
  customFormationKey,
  isCustomFormationKey,
  resolveFormation,
  type FormationSlot,
} from './formations'

// The formation picker (TACTICS_BOARD_REWORK_PLAN.md Stage 3.3): a dropdown,
// the selected formation's description under it, and a diagram of the shape.
// Stage 4 mounts this inside SquadPanel — one per side — which is why it takes
// its side's current formation and an onChange rather than reading a tactic.
//
// ── Why the diagram is of the SELECTED formation, not one per row ─────────
// 3.3 asks for "a diagram thumbnail per formation". `Dropdown` is the one
// dropdown pattern in the app (design.md: "any new single-choice control
// should reach for Dropdown") and its option rows are `{ value, label }` text
// by construction. Teaching it to render arbitrary content per row would fork
// a component every picker in the app shares, to show 29 thumbnails a coach
// scrolls past once. Showing the chosen shape full-size instead answers the
// question the thumbnail is for — "what does this actually look like?" — and
// it updates as they arrow through the list.

export function FormationPicker({
  side,
  formationKey,
  onChange,
  onSaveCurrentShape,
}: {
  side: 'home' | 'away'
  formationKey: string
  // Handed the resolved slots as well as the key, so the caller never has to
  // resolve a custom formation a second time.
  onChange: (key: string, slots: FormationSlot[]) => void
  // "Save current shape as formation" (3.4). Omitted when there's nothing on
  // the pitch to save.
  onSaveCurrentShape?: (name: string) => void
}) {
  const customFormations = useStore((s) => s.customFormations)
  const deleteCustomFormation = useStore((s) => s.deleteCustomFormation)
  const [naming, setNaming] = useState(false)
  const [draftName, setDraftName] = useState('')

  const selected = resolveFormation(formationKey, customFormations)

  const options = [
    // The common shapes only, plus whatever this side is already playing —
    // same list the tool row offers, so the two pickers can't disagree about
    // what exists. Anything else stays reachable by being already selected or
    // by saving a custom shape.
    ...pickerFormations(formationKey).map((f) => ({ value: f.key, label: f.label })),
    // Visually separated from the built-ins, per 3.4. The Dropdown's option
    // list is flat, so the separation is carried in the label rather than by a
    // group header the component has no concept of.
    ...customFormations.map((f) => ({ value: customFormationKey(f.id), label: `★ ${f.name}` })),
  ]

  const pick = (key: string) => {
    const resolved = resolveFormation(key, customFormations)
    if (resolved) onChange(key, resolved.slots)
  }

  const saveShape = () => {
    const name = draftName.trim()
    if (!name || !onSaveCurrentShape) return
    onSaveCurrentShape(name)
    setDraftName('')
    setNaming(false)
  }

  return (
    <div className="space-y-2">
      <div>
        <label
          htmlFor={`formation-${side}`}
          className="block text-xs font-medium uppercase tracking-wide text-ink-muted"
        >
          Formation
        </label>
        <div className="mt-1">
          <Dropdown
            id={`formation-${side}`}
            value={formationKey}
            onChange={pick}
            options={options}
            ariaLabel={`${side === 'home' ? 'Home' : 'Away'} team formation`}
            placeholder="Pick a formation"
            emptyMessage="No formations match"
          />
        </div>
      </div>

      {selected && (
        <>
          <FormationDiagram slots={selected.slots} side={side} />
          <p className="text-xs leading-relaxed text-ink-muted">{selected.description}</p>
        </>
      )}

      {selected && isCustomFormationKey(formationKey) && (
        <button
          type="button"
          onClick={() => void deleteCustomFormation(customFormationId(formationKey))}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-md border border-line px-2 text-xs font-medium text-ink-muted transition-colors hover:border-line-strong hover:text-bad lg:min-h-8"
        >
          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
          Delete this formation
        </button>
      )}

      {onSaveCurrentShape &&
        (naming ? (
          <div className="flex flex-wrap items-center gap-1.5">
            <input
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') saveShape()
                if (e.key === 'Escape') setNaming(false)
              }}
              placeholder="Name this shape"
              aria-label="Name this shape"
              autoFocus
              className="min-h-11 w-40 rounded-md border border-line bg-panel-raised px-2 py-1.5 text-sm text-ink outline-none transition-colors focus:border-accent lg:min-h-8"
            />
            <button
              type="button"
              onClick={saveShape}
              disabled={!draftName.trim()}
              className="min-h-11 rounded-md bg-accent px-2.5 text-xs font-medium text-white transition-colors hover:bg-accent-hover disabled:opacity-50 lg:min-h-8"
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => setNaming(false)}
              className="min-h-11 rounded-md border border-line px-2.5 text-xs font-medium text-ink-muted transition-colors hover:border-line-strong lg:min-h-8"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setNaming(true)}
            className="min-h-11 rounded-md border border-line px-2.5 text-xs font-medium text-ink-muted transition-colors hover:border-line-strong hover:text-ink lg:min-h-8"
          >
            Save current shape…
          </button>
        ))}
    </div>
  )
}

// A plan view of the shape. Deliberately drawn here rather than with
// PitchCanvas: this is chrome, not the board, so it uses the UI tokens
// (design.md keeps canvas colors and chrome colors strictly separate) and
// needs none of the canvas's selection, dragging or zoom machinery.
function FormationDiagram({ slots, side }: { slots: FormationSlot[]; side: 'home' | 'away' }) {
  const W = 168
  const H = 108
  const inset = 8
  const px = (x: number) => inset + x * (W - inset * 2)
  const py = (y: number) => inset + y * (H - inset * 2)
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full rounded-md border border-line bg-panel-raised"
      role="img"
      aria-label={`${side === 'home' ? 'Home' : 'Away'} formation shape`}
    >
      <line x1={W / 2} y1={4} x2={W / 2} y2={H - 4} stroke="currentColor" strokeWidth="0.8" className="text-line" />
      <circle cx={W / 2} cy={H / 2} r={14} fill="none" stroke="currentColor" strokeWidth="0.8" className="text-line" />
      {slots.map((slot, i) => (
        <g key={`${slot.role}-${i}`}>
          <circle cx={px(slot.x)} cy={py(slot.y)} r={7} className="fill-accent" />
          <text
            x={px(slot.x)}
            y={py(slot.y) + 2.4}
            textAnchor="middle"
            className="fill-white text-[6px] font-medium"
          >
            {slot.role}
          </text>
        </g>
      ))}
    </svg>
  )
}
