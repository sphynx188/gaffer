import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store'
import type { Team } from '../store'
import { Card } from './ui/Card'
import { Badge } from './ui/Badge'
import { useTeamSummaries, type TeamSummary } from '../hooks/useTeamSummaries'

// Phase 1.1 — Team management (US-3, gaffer_mvp_build_steps.md). Real
// create + edit UI, replacing the throwaway team-creation form from the
// 0.5.1 vertical slice spike. Definition of Done: a team can be created
// and is owned by the logged-in coach; editing persists and survives reload
// — both handled here purely by calling the store's existing team actions,
// which already wrap every write through runSupabaseAction's centralized
// error handling.
//
// Team used to also carry a pitch format (11-a-side / small-sided), picked
// at creation time — dropped (see supabase/migrations/008_drop_team_format.sql)
// once it turned out nothing downstream ever read it: Drill.pitch_size /
// Drill.orientation are the fields that actually drive anything (which
// pitch shape the canvas renders), set independently per drill, never
// derived from the team's format. Creating a team now only asks for a name.
export function TeamManagement() {
  const teams = useStore((s) => s.teams)
  const teamsLoading = useStore((s) => s.teamsLoading)
  const teamsError = useStore((s) => s.teamsError)
  const fetchTeams = useStore((s) => s.fetchTeams)
  const createTeam = useStore((s) => s.createTeam)
  const updateTeam = useStore((s) => s.updateTeam)
  const deleteTeam = useStore((s) => s.deleteTeam)
  const selectTeam = useStore((s) => s.selectTeam)
  const navigate = useNavigate()

  useEffect(() => {
    fetchTeams()
  }, [fetchTeams])

  const teamIds = useMemo(() => teams.map((t) => t.id), [teams])
  const { summaries } = useTeamSummaries(teamIds)

  const handleViewOverview = (id: string) => {
    selectTeam(id)
    navigate('/overview')
  }

  return (
    <section className="space-y-4 text-left">
      {teamsError && <p className="text-sm text-bad">{teamsError}</p>}
      {teamsLoading && teams.length === 0 && <p className="text-sm text-ink-muted">Loading…</p>}

      {teams.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {teams.map((team) => (
            <TeamCard
              key={team.id}
              team={team}
              summary={summaries[team.id]}
              onView={handleViewOverview}
              onSave={updateTeam}
              onDelete={deleteTeam}
            />
          ))}
        </div>
      )}

      <CreateTeamForm onCreate={createTeam} />
    </section>
  )
}

function CreateTeamForm({ onCreate }: { onCreate: (input: { name: string }) => Promise<Team | null> }) {
  const [name, setName] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!name.trim() || submitting) return
    setSubmitting(true)
    const created = await onCreate({ name: name.trim() })
    setSubmitting(false)
    if (created) setName('')
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-2 border-t border-line pt-4">
      <div className="flex-1">
        <label htmlFor="new-team-name" className="block text-xs font-medium text-ink-muted">
          Team name
        </label>
        <input
          id="new-team-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. U12 Reds"
          className="mt-1 w-full rounded-md border border-line bg-panel-raised px-2 py-1.5 text-sm text-ink outline-none focus:border-accent"
        />
      </div>
      <button
        type="submit"
        disabled={submitting || !name.trim()}
        className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50"
      >
        {submitting ? 'Creating…' : 'Create team'}
      </button>
    </form>
  )
}

function TeamCard({
  team,
  summary,
  onView,
  onSave,
  onDelete,
}: {
  team: Team
  summary: TeamSummary | undefined
  onView: (id: string) => void
  onSave: (id: string, patch: { name?: string }) => Promise<Team | null>
  onDelete: (id: string) => Promise<boolean>
}) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(team.name)
  const [saving, setSaving] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const startEdit = () => {
    setName(team.name)
    setEditing(true)
  }

  const handleSave = async (e: FormEvent) => {
    e.preventDefault()
    if (!name.trim() || saving) return
    setSaving(true)
    const saved = await onSave(team.id, { name: name.trim() })
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
      <div className="rounded-lg border border-bad/30 bg-bad/10 p-6">
        <p className="text-sm text-bad">
          Delete <span className="font-medium">{team.name}</span>? Its roster, sessions and drills go with it — this
          can&rsquo;t be undone.
        </p>
        <div className="mt-2 flex items-center gap-2">
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            className="rounded-md bg-bad px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
          >
            {deleting ? 'Deleting…' : 'Delete team'}
          </button>
          <button
            type="button"
            onClick={() => setConfirmingDelete(false)}
            disabled={deleting}
            className="px-2 py-1.5 text-sm text-ink-muted"
          >
            Cancel
          </button>
        </div>
      </div>
    )
  }

  if (!editing) {
    return (
      <Card>
        <button type="button" onClick={() => onView(team.id)} className="w-full text-left">
          <p className="text-base font-semibold text-ink">{team.name}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Badge tone="neutral">{summary?.playerCount ?? 0} players</Badge>
            <Badge tone="neutral">{summary?.upcomingSessionCount ?? 0} upcoming session(s)</Badge>
          </div>
        </button>
        <div className="mt-3 flex items-center gap-3 border-t border-line pt-3">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              startEdit()
            }}
            className="text-sm text-ink-muted underline underline-offset-2"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              setConfirmingDelete(true)
            }}
            className="text-sm text-bad underline underline-offset-2"
          >
            Delete
          </button>
        </div>
      </Card>
    )
  }

  return (
    <div className="rounded-lg border border-line-strong bg-panel p-6">
      <form onSubmit={handleSave} className="flex flex-wrap items-end gap-2">
        <div className="flex-1">
          <label className="block text-xs font-medium text-ink-muted">Team name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full rounded-md border border-line bg-panel-raised px-2 py-1.5 text-sm text-ink outline-none focus:border-accent"
          />
        </div>
        <button
          type="submit"
          disabled={saving || !name.trim()}
          className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button type="button" onClick={() => setEditing(false)} className="px-2 py-1.5 text-sm text-ink-muted">
          Cancel
        </button>
      </form>
    </div>
  )
}
