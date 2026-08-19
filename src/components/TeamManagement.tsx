import { useEffect, useState, type FormEvent } from 'react'
import { useStore } from '../store'
import type { Team, PitchFormat } from '../store'

const formatOptions: PitchFormat[] = ['11v11', 'small_sided']

const formatLabel: Record<PitchFormat, string> = {
  '11v11': '11-a-side',
  small_sided: 'Small-sided',
}

// Phase 1.1 — Team management (US-3, gaffer_mvp_build_steps.md). Real
// create + edit UI, replacing the throwaway team-creation form from the
// 0.5.1 vertical slice spike. Definition of Done: a team can be created
// with name + format (fixed enum, not free text) and is owned by the
// logged-in coach; editing persists and survives reload — both handled
// here purely by calling the store's existing team actions, which already
// wrap every write through runSupabaseAction's centralized error handling.
export function TeamManagement() {
  const teams = useStore((s) => s.teams)
  const teamsLoading = useStore((s) => s.teamsLoading)
  const teamsError = useStore((s) => s.teamsError)
  const fetchTeams = useStore((s) => s.fetchTeams)
  const createTeam = useStore((s) => s.createTeam)
  const updateTeam = useStore((s) => s.updateTeam)
  const deleteTeam = useStore((s) => s.deleteTeam)

  useEffect(() => {
    fetchTeams()
  }, [fetchTeams])

  return (
    <section className="w-full max-w-lg space-y-4 text-left">
      <h2 className="text-sm font-semibold text-slate-700">Teams</h2>

      {teamsError && <p className="text-sm text-red-600">{teamsError}</p>}
      {teamsLoading && teams.length === 0 && <p className="text-sm text-slate-400">Loading…</p>}

      {teams.length > 0 && (
        <ul className="space-y-2">
          {teams.map((team) => (
            <TeamRow key={team.id} team={team} onSave={updateTeam} onDelete={deleteTeam} />
          ))}
        </ul>
      )}

      <CreateTeamForm onCreate={createTeam} />
    </section>
  )
}

function CreateTeamForm({
  onCreate,
}: {
  onCreate: (input: { name: string; format: PitchFormat }) => Promise<Team | null>
}) {
  const [name, setName] = useState('')
  const [format, setFormat] = useState<PitchFormat>('11v11')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!name.trim() || submitting) return
    setSubmitting(true)
    const created = await onCreate({ name: name.trim(), format })
    setSubmitting(false)
    if (created) setName('')
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-2 border-t border-slate-200 pt-4">
      <div className="flex-1">
        <label htmlFor="new-team-name" className="block text-xs font-medium text-slate-500">
          Team name
        </label>
        <input
          id="new-team-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. U12 Reds"
          className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm text-slate-900 outline-none focus:border-slate-500"
        />
      </div>
      <div>
        <label htmlFor="new-team-format" className="block text-xs font-medium text-slate-500">
          Format
        </label>
        <select
          id="new-team-format"
          value={format}
          onChange={(e) => setFormat(e.target.value as PitchFormat)}
          className="mt-1 rounded-md border border-slate-300 px-2 py-1.5 text-sm text-slate-900 outline-none focus:border-slate-500"
        >
          {formatOptions.map((f) => (
            <option key={f} value={f}>
              {formatLabel[f]}
            </option>
          ))}
        </select>
      </div>
      <button
        type="submit"
        disabled={submitting || !name.trim()}
        className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
      >
        {submitting ? 'Creating…' : 'Create team'}
      </button>
    </form>
  )
}

function TeamRow({
  team,
  onSave,
  onDelete,
}: {
  team: Team
  onSave: (id: string, patch: { name?: string; format?: PitchFormat }) => Promise<Team | null>
  onDelete: (id: string) => Promise<boolean>
}) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(team.name)
  const [format, setFormat] = useState<PitchFormat>(team.format)
  const [saving, setSaving] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const startEdit = () => {
    setName(team.name)
    setFormat(team.format)
    setEditing(true)
  }

  const handleSave = async (e: FormEvent) => {
    e.preventDefault()
    if (!name.trim() || saving) return
    setSaving(true)
    const saved = await onSave(team.id, { name: name.trim(), format })
    setSaving(false)
    if (saved) setEditing(false)
  }

  const handleDelete = async () => {
    if (deleting) return
    setDeleting(true)
    const deleted = await onDelete(team.id)
    setDeleting(false)
    if (deleted) setConfirmingDelete(false)
  }

  if (confirmingDelete) {
    return (
      <li className="rounded-md border border-red-200 bg-red-50 px-3 py-2">
        <p className="text-sm text-red-700">
          Delete <span className="font-medium">{team.name}</span>? Its roster, sessions and drills go with it — this
          can&rsquo;t be undone.
        </p>
        <div className="mt-2 flex items-center gap-2">
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
          >
            {deleting ? 'Deleting…' : 'Delete team'}
          </button>
          <button
            type="button"
            onClick={() => setConfirmingDelete(false)}
            disabled={deleting}
            className="px-2 py-1.5 text-sm text-slate-500"
          >
            Cancel
          </button>
        </div>
      </li>
    )
  }

  if (!editing) {
    return (
      <li className="flex items-center justify-between rounded-md border border-slate-200 px-3 py-2">
        <div>
          <p className="text-sm font-medium text-slate-900">{team.name}</p>
          <p className="text-xs text-slate-500">{formatLabel[team.format]}</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={startEdit}
            className="text-sm text-slate-500 underline underline-offset-2"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={() => setConfirmingDelete(true)}
            className="text-sm text-red-600 underline underline-offset-2"
          >
            Delete
          </button>
        </div>
      </li>
    )
  }

  return (
    <li className="rounded-md border border-slate-300 px-3 py-2">
      <form onSubmit={handleSave} className="flex flex-wrap items-end gap-2">
        <div className="flex-1">
          <label className="block text-xs font-medium text-slate-500">Team name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm text-slate-900 outline-none focus:border-slate-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500">Format</label>
          <select
            value={format}
            onChange={(e) => setFormat(e.target.value as PitchFormat)}
            className="mt-1 rounded-md border border-slate-300 px-2 py-1.5 text-sm text-slate-900 outline-none focus:border-slate-500"
          >
            {formatOptions.map((f) => (
              <option key={f} value={f}>
                {formatLabel[f]}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          disabled={saving || !name.trim()}
          className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button
          type="button"
          onClick={() => setEditing(false)}
          className="px-2 py-1.5 text-sm text-slate-500"
        >
          Cancel
        </button>
      </form>
    </li>
  )
}
