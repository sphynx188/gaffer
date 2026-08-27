import { useState, type FormEvent } from 'react'
import type { Drill, NewDrillInput, PitchOrientation } from '../../../store'
import { PITCH_ORIENTATION_LABELS } from '../../../store'
import { configFromPreset, findPreset, presetLabel } from '../canvas/pitchPresets'
import { Dropdown } from '../../ui/Dropdown'

// The same four sizes this form has always offered, now as preset ids rather
// than the dropped `pitch_size` enum — `findPreset` still resolves them (see
// LEGACY_PRESETS in pitchPresets.ts), so a drill created here and a drill
// backfilled by migration 013b still describe the same pitch. The full
// ~35-preset table is the editor's Pitch panel's job, not creation's.
const pitchSizeOptions = ['full', 'three_quarter', 'half', 'quarter']
const pitchOrientationOptions: PitchOrientation[] = ['portrait', 'landscape']

// Carried over unchanged from the phases-era editor: name, pitch size and
// orientation are still everything a drill needs at creation. createDrill
// seeds the keyframe; the pitch config is built here (see drillSlice).
// `teamId` dropped (club tenancy, 2026-08-28) — createDrill now reads
// club_id from the caller's selectedClubId itself, not a prop.
export function CreateDrillForm({
  onCreate,
  onCreated,
}: {
  onCreate: (input: NewDrillInput) => Promise<Drill | null>
  onCreated: (drill: Drill) => void
}) {
  const [name, setName] = useState('')
  const [pitchSize, setPitchSize] = useState('full')
  // Portrait matches how a full pitch has always rendered here (narrower
  // than tall) — kept as the default across every size so switching size
  // doesn't also silently switch orientation underneath the coach.
  const [orientation, setOrientation] = useState<PitchOrientation>('portrait')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!name.trim() || submitting) return
    setSubmitting(true)
    const preset = findPreset(pitchSize) ?? findPreset('full')!
    const created = await onCreate({
      name: name.trim(),
      orientation,
      pitch: { ...configFromPreset(preset, orientation), overlays: [] },
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
            onChange={setPitchSize}
            options={pitchSizeOptions.map((s) => ({ value: s, label: presetLabel(s) }))}
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
