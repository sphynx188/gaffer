import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { LayoutGrid, List, Plus, Search } from 'lucide-react'
import { useStore } from '../store'
import type { Team } from '../store'
import { Card } from './ui/Card'
import { Badge } from './ui/Badge'
import { Skeleton } from './ui/Skeleton'
import { EmptyState } from './ui/EmptyState'
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
// Fixed placeholder count for the loading skeleton — enough cards to read as
// "a grid is coming" without implying a real team count. Module-level so the
// array reference is stable across renders, same reasoning as SKELETON_ROWS
// in PlayerRoster.
const SKELETON_TEAMS = [0, 1]

// Toolbar redesign (2026-08-23), styled after a Supabase Studio "Projects"
// list reference screenshot: search, a sort control, grid/list view toggle,
// and a primary create action. Status filtering from that reference is
// dropped — teams have no status field, there's nothing to filter by.
type SortKey = 'name' | 'players' | 'newest'
type ViewMode = 'grid' | 'list'

const SORT_LABELS: Record<SortKey, string> = {
  name: 'Name',
  players: 'Player count',
  newest: 'Newest first',
}

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

  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('name')
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [showCreateForm, setShowCreateForm] = useState(false)

  useEffect(() => {
    fetchTeams()
  }, [fetchTeams])

  const teamIds = useMemo(() => teams.map((t) => t.id), [teams])
  const { summaries } = useTeamSummaries(teamIds)

  const visibleTeams = useMemo(() => {
    const query = search.trim().toLowerCase()
    const filtered = query ? teams.filter((t) => t.name.toLowerCase().includes(query)) : teams
    const sorted = [...filtered]
    sorted.sort((a, b) => {
      if (sortKey === 'players') {
        return (summaries[b.id]?.playerCount ?? 0) - (summaries[a.id]?.playerCount ?? 0)
      }
      if (sortKey === 'newest') {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      }
      return a.name.localeCompare(b.name)
    })
    return sorted
  }, [teams, search, sortKey, summaries])

  const handleViewOverview = (id: string) => {
    selectTeam(id)
    navigate('/overview')
  }

  const handleCreate = async (input: { name: string }) => {
    const created = await createTeam(input)
    if (created) setShowCreateForm(false)
    return created
  }

  return (
    <section className="space-y-4 text-left">
      {teamsError && <p className="text-sm text-bad">{teamsError}</p>}

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-48 flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search for a team"
            aria-label="Search for a team"
            className="w-full rounded-md border border-line bg-panel-raised py-1.5 pl-8 pr-2 text-sm text-ink outline-none transition-colors placeholder:text-ink-faint focus:border-accent focus:ring-2 focus:ring-accent/30"
          />
        </div>

        <label className="sr-only" htmlFor="team-sort">
          Sort teams by
        </label>
        <select
          id="team-sort"
          value={sortKey}
          onChange={(e) => setSortKey(e.target.value as SortKey)}
          className="rounded-md border border-line bg-panel-raised px-2 py-1.5 text-sm text-ink outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/30"
        >
          {(Object.keys(SORT_LABELS) as SortKey[]).map((key) => (
            <option key={key} value={key}>
              Sort: {SORT_LABELS[key]}
            </option>
          ))}
        </select>

        <div className="ml-auto flex items-center gap-2">
          <div className="flex items-center rounded-md border border-line bg-panel-raised p-0.5">
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              aria-pressed={viewMode === 'grid'}
              aria-label="Grid view"
              title="Grid view"
              className={`rounded p-1.5 transition-colors ${
                viewMode === 'grid' ? 'bg-accent/15 text-accent' : 'text-ink-faint hover:text-ink'
              }`}
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              aria-pressed={viewMode === 'list'}
              aria-label="List view"
              title="List view"
              className={`rounded p-1.5 transition-colors ${
                viewMode === 'list' ? 'bg-accent/15 text-accent' : 'text-ink-faint hover:text-ink'
              }`}
            >
              <List className="h-4 w-4" />
            </button>
          </div>

          <button
            type="button"
            onClick={() => setShowCreateForm((open) => !open)}
            aria-expanded={showCreateForm}
            className="flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white hover:bg-accent-hover"
          >
            <Plus className="h-4 w-4" />
            New team
          </button>
        </div>
      </div>

      {showCreateForm && <CreateTeamForm onCreate={handleCreate} />}

      {teamsLoading && teams.length === 0 && (
        <div role="status" aria-busy="true">
          <span className="sr-only">Loading teams…</span>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {SKELETON_TEAMS.map((card) => (
              <Card key={card}>
                <Skeleton className="h-5 w-32" />
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Skeleton className="h-5 w-20 rounded-full" />
                  <Skeleton className="h-5 w-32 rounded-full" />
                </div>
                <div className="mt-3 flex items-center gap-3 border-t border-line pt-3">
                  <Skeleton className="h-4 w-10" />
                  <Skeleton className="h-4 w-12" />
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {!teamsLoading && teams.length > 0 && visibleTeams.length === 0 && (
        <EmptyState icon={Search} message={`No teams match “${search}”.`} />
      )}

      {visibleTeams.length > 0 &&
        (viewMode === 'grid' ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {visibleTeams.map((team) => (
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
        ) : (
          <ul className="space-y-2">
            {visibleTeams.map((team) => (
              <TeamRow
                key={team.id}
                team={team}
                summary={summaries[team.id]}
                onView={handleViewOverview}
                onSave={updateTeam}
                onDelete={deleteTeam}
              />
            ))}
          </ul>
        ))}
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
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-2 rounded-lg border border-line p-4">
      <div className="flex-1">
        <label htmlFor="new-team-name" className="block text-xs font-medium text-ink-muted">
          Team name
        </label>
        <input
          id="new-team-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. U12 Reds"
          autoFocus
          className="mt-1 w-full rounded-md border border-line bg-panel-raised px-2 py-1.5 text-sm text-ink outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/30"
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

// Shared editing/deleting state behind both the grid card and list row —
// same fields, same confirm-delete flow, just two different layouts on top.
function useTeamCardState(
  team: Team,
  onSave: (id: string, patch: { name?: string }) => Promise<Team | null>,
  onDelete: (id: string) => Promise<boolean>,
) {
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

  return {
    editing,
    setEditing,
    name,
    setName,
    saving,
    confirmingDelete,
    setConfirmingDelete,
    deleting,
    startEdit,
    handleSave,
    handleDelete,
  }
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
  const {
    editing,
    setEditing,
    name,
    setName,
    saving,
    confirmingDelete,
    setConfirmingDelete,
    deleting,
    startEdit,
    handleSave,
    handleDelete,
  } = useTeamCardState(team, onSave, onDelete)

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
            className="mt-1 w-full rounded-md border border-line bg-panel-raised px-2 py-1.5 text-sm text-ink outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/30"
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

// List-view counterpart to TeamCard — one row per team instead of a card,
// same name/badges/edit/delete, laid out horizontally for the density the
// list toggle is meant to offer.
function TeamRow({
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
  const {
    editing,
    setEditing,
    name,
    setName,
    saving,
    confirmingDelete,
    setConfirmingDelete,
    deleting,
    startEdit,
    handleSave,
    handleDelete,
  } = useTeamCardState(team, onSave, onDelete)

  if (confirmingDelete) {
    return (
      <li className="rounded-lg border border-bad/30 bg-bad/10 p-4">
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
      </li>
    )
  }

  if (editing) {
    return (
      <li className="rounded-lg border border-line-strong bg-panel p-4">
        <form onSubmit={handleSave} className="flex flex-wrap items-end gap-2">
          <div className="flex-1">
            <label className="block text-xs font-medium text-ink-muted">Team name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-md border border-line bg-panel-raised px-2 py-1.5 text-sm text-ink outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/30"
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
      </li>
    )
  }

  return (
    <li className="panel-edge flex flex-wrap items-center gap-3 rounded-xl border border-line bg-panel px-4 py-3">
      <button type="button" onClick={() => onView(team.id)} className="flex flex-1 items-center gap-3 text-left">
        <p className="text-sm font-semibold text-ink">{team.name}</p>
        <Badge tone="neutral">{summary?.playerCount ?? 0} players</Badge>
        <Badge tone="neutral">{summary?.upcomingSessionCount ?? 0} upcoming session(s)</Badge>
      </button>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => startEdit()}
          className="text-sm text-ink-muted underline underline-offset-2"
        >
          Edit
        </button>
        <button
          type="button"
          onClick={() => setConfirmingDelete(true)}
          className="text-sm text-bad underline underline-offset-2"
        >
          Delete
        </button>
      </div>
    </li>
  )
}
