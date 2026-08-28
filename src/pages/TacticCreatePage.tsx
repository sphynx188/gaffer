import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store'
import { PageHeader } from '../components/ui/PageHeader'
import { Card } from '../components/ui/Card'

// `/tactics/new` (2026-08-28) — tactic creation's own front door, split out
// of the Tactics library tab (which used to carry this form inline, back
// when it had "no other front door"). Mirrors `/design`'s role for drills:
// a minimal create-and-land-in-the-editor page, CreatePage's "Tactic" card
// points here now. Kept deliberately just a name field, same as the form it
// replaces — a tactic needs nothing else to exist, formation/pitch/etc. are
// all editor-side decisions.
export function TacticCreatePage() {
  const navigate = useNavigate()
  const createTactic = useStore((s) => s.createTactic)
  const [name, setName] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault()
    if (!name.trim() || submitting) return
    setSubmitting(true)
    const created = await createTactic({ name: name.trim() })
    setSubmitting(false)
    if (created) navigate(`/tactics/${created.id}`)
  }

  return (
    <div>
      <PageHeader title="New tactic" />
      <Card>
        <form onSubmit={handleCreate} className="flex flex-wrap items-end gap-2">
          <div>
            <label htmlFor="new-tactic-name" className="block text-xs font-medium text-ink-muted">
              Tactic name
            </label>
            <input
              id="new-tactic-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. 4-3-3 — Build Up"
              autoFocus
              className="mt-1 w-64 rounded-md border border-line bg-panel-raised px-2 py-1.5 text-sm text-ink outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/30"
            />
          </div>
          <button
            type="submit"
            disabled={!name.trim() || submitting}
            className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50"
          >
            {submitting ? 'Creating…' : 'Create tactic'}
          </button>
        </form>
      </Card>
    </div>
  )
}
