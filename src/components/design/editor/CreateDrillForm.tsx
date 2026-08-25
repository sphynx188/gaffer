import { useState, type FormEvent } from 'react'
import type { Drill, NewDrillInput, PitchOrientation, PitchSize } from '../../../store'
import { PITCH_ORIENTATION_LABELS, PITCH_SIZE_LABELS } from '../../../store'
import { Dropdown } from '../../ui/Dropdown'

const pitchSizeOptions: PitchSize[] = ['full', 'three_quarter', 'half', 'quarter']
const pitchOrientationOptions: PitchOrientation[] = ['portrait', 'landscape']

// Carried over unchanged from the phases-era editor: name, pitch size and
// orientation are still everything a drill needs at creation. createDrill
// seeds the keyframe and the pitch config from these (see drillSlice).
export function CreateDrillForm({
  teamId,
  onCreate,
  onCreated,
}: {
  teamId: string
  onCreate: (input: NewDrillInput) => Promise<Drill | null>
  onCreated: (drill: Drill) => void
}) {
  const [name, setName] = useState('')
  const [pitchSize, setPitchSize] = useState<PitchSize>('full')
  // Portrait matches how a full pitch has always rendered here (narrower
  // than tall) — kept as the default across every size so switching size
  // doesn't also silently switch orientation underneath the coach.
  const [orientation, setOrientation] = useState<PitchOrientation>('portrait')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!name.trim() || submitting) return
    setSubmitting(true)
    const created = await onCreate({
      team_id: teamId,
      name: name.trim(),
      pitch_size: pitchSize,
      orientation,
    })
    setSubmitting(false)
    if (created) {
      setName('')
      onCreated(created)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-2">
      <div>
        <label htmlFor="new-drill-name" className="block text-xs font-medium text-ink-muted">
          New drill name
        </label>
        <input
          id="new-drill-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Rondo warm-up"
          className="mt-1 w-44 rounded-md border border-line bg-panel-raised px-2 py-1.5 text-sm text-ink outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/30"
        />
      </div>
      <div>
        <label htmlFor="new-drill-size" className="block text-xs font-medium text-ink-muted">
          Pitch size
        </label>
        <div className="mt-1">
          <Dropdown
            id="new-drill-size"
            value={pitchSize}
            onChange={(value) => setPitchSize(value as PitchSize)}
            options={pitchSizeOptions.map((s) => ({ value: s, label: PITCH_SIZE_LABELS[s] ?? s }))}
            searchable={false}
            ariaLabel="Pitch size"
          />
        </div>
      </div>
      <div>
        <label htmlFor="new-drill-orientation" className="block text-xs font-medium text-ink-muted">
          Orientation
        </label>
        <div className="mt-1">
          <Dropdown
            id="new-drill-orientation"
            value={orientation}
            onChange={(value) => setOrientation(value as PitchOrientation)}
            options={pitchOrientationOptions.map((o) => ({ value: o, label: PITCH_ORIENTATION_LABELS[o] ?? o }))}
            searchable={false}
            ariaLabel="Orientation"
          />
        </div>
      </div>
      <button
        type="submit"
        disabled={!name.trim() || submitting}
        className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50"
      >
        {submitting ? 'Creating…' : 'Create drill'}
      </button>
    </form>
  )
}
