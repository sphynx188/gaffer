import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useStore, PLAYER_POSITIONS, PLAYER_POSITION_LABELS } from '../store'
import type { Player, PlayerPosition } from '../store'
import { PlayerNotes } from './PlayerNotes'
import { toISODate } from '../lib/date'

interface AttendanceStat {
  present: number
  total: number
}

// Shared between the header row and every PlayerRow below so their columns
// actually line up — a plain `flex` row doesn't work for this: flex-grow
// distribution on the "Name" column depends on how many sibling items are
// present (the header has 4 cells, each row has a 5th "Actions" cell), so
// the same `flex-1` computed a different width in each and the columns
// drifted out of alignment. Grid's track widths don't depend on sibling
// count, so this is exact regardless of what's in each row. Only applied at
// `sm:` and up — below that, rows fall back to a wrapping flex stack (see
// PlayerRow) since these fixed column widths don't fit a phone screen.
const ROW_GRID = 'sm:grid sm:grid-cols-[2.5rem_1fr_8rem_10rem_1fr] sm:items-center sm:gap-x-6'

interface PlayerFormValues {
  name?: string
  positions?: PlayerPosition[]
  squad_number?: number | null
}

// Short chip labels — full labels (PLAYER_POSITION_LABELS) are still used
// for the read-only summary line so the roster list stays unambiguous at a
// glance; the picker itself favors compact chips since a player can have
// several selected at once.
const POSITION_CHIP_LABELS: Record<PlayerPosition, string> = {
  goalkeeper: 'GK',
  defender: 'DEF',
  midfielder: 'MID',
  winger: 'WING',
  striker: 'ST',
}

// Multi-select position tag picker (Phase 1 revision — position went from a
// single freeform text field to a fixed set of tags a player can hold more
// than one of, e.g. winger + striker). Implemented as toggleable chips
// rather than a native <select multiple> — a multi-select dropdown is
// notoriously unfriendly on touch (no visible "which are selected" state
// without opening it, awkward multi-pick gesture on a phone at pitch-side),
// while chips show every option and its selected state at once and toggle
// with a single tap.
function PositionTagPicker({
  value,
  onChange,
  idPrefix,
}: {
  value: PlayerPosition[]
  onChange: (next: PlayerPosition[]) => void
  idPrefix: string
}) {
  const toggle = (position: PlayerPosition) => {
    onChange(
      value.includes(position) ? value.filter((p) => p !== position) : [...value, position]
    )
  }

  return (
    <div className="flex flex-wrap gap-1" role="group" aria-label="Position">
      {PLAYER_POSITIONS.map((position) => {
        const selected = value.includes(position)
        return (
          <button
            key={position}
            type="button"
            id={`${idPrefix}-${position}`}
            aria-pressed={selected}
            onClick={() => toggle(position)}
            title={PLAYER_POSITION_LABELS[position]}
            className={
              'rounded-full border px-2 py-1 text-xs font-medium transition-colors ' +
              (selected
                ? 'border-accent bg-accent text-white'
                : 'border-line bg-panel-raised text-ink-muted hover:border-line-strong')
            }
          >
            {POSITION_CHIP_LABELS[position]}
          </button>
        )
      })}
    </div>
  )
}

// Phase 1.3 — Player roster CRUD (US-5, gaffer_mvp_build_steps.md). Mirrors
// TeamManagement's create-form + inline-edit-row pattern. Definition of
// Done: a player is attached to exactly one team; name/position tags/squad
// number are editable after creation; no photo field exists. Scoped by the
// store's `selectedTeamId` (teamSlice) — never teams[0] — so switching
// teams via TeamSwitcher shows that team's roster only, per US-4's "data
// from different teams never bleeds together." (dob dropped — see
// supabase/migrations/009_drop_player_dob_and_session_extras.sql — not
// needed at the moment.)
export function PlayerRoster() {
  const selectedTeamId = useStore((s) => s.selectedTeamId)
  const players = useStore((s) => s.players)
  const playersLoading = useStore((s) => s.playersLoading)
  const playersError = useStore((s) => s.playersError)
  const fetchPlayers = useStore((s) => s.fetchPlayers)
  const createPlayer = useStore((s) => s.createPlayer)
  const updatePlayer = useStore((s) => s.updatePlayer)

  // Season attendance stat, below, needs every past session's embedded
  // availability — the same `sessions` array SessionPlanner/Attendance
  // already fetch, just not previously needed on this page.
  const sessions = useStore((s) => s.sessions)
  const fetchSessions = useStore((s) => s.fetchSessions)

  useEffect(() => {
    if (selectedTeamId) {
      fetchPlayers(selectedTeamId)
      fetchSessions(selectedTeamId)
    }
  }, [selectedTeamId, fetchPlayers, fetchSessions])

  // "At the end of the year, how many sessions did they attend and what's
  // the percentage" — counted against sessions that have actually happened
  // (date <= today), not the whole season's schedule including sessions
  // that haven't been run yet, which would understate every player's rate
  // early in the season.
  const todayISO = toISODate(new Date())
  const pastSessions = useMemo(() => sessions.filter((s) => s.date <= todayISO), [sessions, todayISO])
  const attendanceByPlayer = useMemo(() => {
    const map = new Map<string, AttendanceStat>()
    for (const player of players) {
      const present = pastSessions.filter(
        (s) => s.availability.find((a) => a.player_id === player.id)?.status === 'present'
      ).length
      map.set(player.id, { present, total: pastSessions.length })
    }
    return map
  }, [players, pastSessions])

  if (!selectedTeamId) {
    return (
      <section className="space-y-4 text-left">
        <p className="text-sm text-ink-muted">Create a team first to start a roster.</p>
      </section>
    )
  }

  return (
    <section className="space-y-4 text-left">
      {playersError && <p className="text-sm text-bad">{playersError}</p>}
      {playersLoading && players.length === 0 && <p className="text-sm text-ink-muted">Loading…</p>}
      {!playersLoading && !playersError && players.length === 0 && (
        <p className="text-sm text-ink-muted">No players yet — add the first one below.</p>
      )}

      {players.length > 0 && (
        <ul className="space-y-2">
          <li className={`hidden px-3 ${ROW_GRID}`}>
            <span className="text-xs font-medium text-ink-muted">#</span>
            <span className="text-xs font-medium text-ink-muted">Name</span>
            <span className="text-xs font-medium text-ink-muted">Position</span>
            <span className="text-xs font-medium text-ink-muted">Attendance</span>
            <span aria-hidden="true" />
          </li>
          {players.map((player) => (
            <PlayerRow
              key={player.id}
              player={player}
              attendance={attendanceByPlayer.get(player.id)}
              onSave={updatePlayer}
            />
          ))}
        </ul>
      )}

      <CreatePlayerForm teamId={selectedTeamId} onCreate={createPlayer} />
    </section>
  )
}

interface NewPlayerFormInput {
  team_id: string
  name: string
  positions?: PlayerPosition[]
  squad_number?: number | null
}

function CreatePlayerForm({
  teamId,
  onCreate,
}: {
  teamId: string
  onCreate: (input: NewPlayerFormInput) => Promise<Player | null>
}) {
  const [name, setName] = useState('')
  const [positions, setPositions] = useState<PlayerPosition[]>([])
  const [squadNumber, setSquadNumber] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!name.trim() || submitting) return
    setSubmitting(true)
    const created = await onCreate({
      team_id: teamId,
      name: name.trim(),
      positions,
      squad_number: squadNumber ? Number(squadNumber) : null,
    })
    setSubmitting(false)
    if (created) {
      setName('')
      setPositions([])
      setSquadNumber('')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-2 border-t border-line pt-4">
      <div className="min-w-32 flex-1">
        <label htmlFor="new-player-name" className="block text-xs font-medium text-ink-muted">
          Name
        </label>
        <input
          id="new-player-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Alex Smith"
          className="mt-1 w-full rounded-md border border-line bg-panel-raised px-2 py-1.5 text-sm text-ink outline-none focus:border-accent"
        />
      </div>
      <div>
        <span className="block text-xs font-medium text-ink-muted">Position</span>
        <div className="mt-1">
          <PositionTagPicker value={positions} onChange={setPositions} idPrefix="new-player-position" />
        </div>
      </div>
      <div className="w-20">
        <label htmlFor="new-player-squad-number" className="block text-xs font-medium text-ink-muted">
          Squad #
        </label>
        <input
          id="new-player-squad-number"
          type="number"
          min={0}
          value={squadNumber}
          onChange={(e) => setSquadNumber(e.target.value)}
          className="mt-1 w-full rounded-md border border-line bg-panel-raised px-2 py-1.5 text-sm text-ink outline-none focus:border-accent"
        />
      </div>
      <button
        type="submit"
        disabled={submitting || !name.trim()}
        className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50"
      >
        {submitting ? 'Adding…' : 'Add player'}
      </button>
    </form>
  )
}

function PlayerRow({
  player,
  attendance,
  onSave,
}: {
  player: Player
  attendance: AttendanceStat | undefined
  onSave: (id: string, patch: PlayerFormValues) => Promise<Player | null>
}) {
  const [editing, setEditing] = useState(false)
  const [notesOpen, setNotesOpen] = useState(false)
  const [name, setName] = useState(player.name)
  const [positions, setPositions] = useState<PlayerPosition[]>(player.positions ?? [])
  const [squadNumber, setSquadNumber] = useState(
    player.squad_number != null ? String(player.squad_number) : ''
  )
  const [saving, setSaving] = useState(false)

  const startEdit = () => {
    setName(player.name)
    setPositions(player.positions ?? [])
    setSquadNumber(player.squad_number != null ? String(player.squad_number) : '')
    setEditing(true)
  }

  const handleSave = async (e: FormEvent) => {
    e.preventDefault()
    if (!name.trim() || saving) return
    setSaving(true)
    const saved = await onSave(player.id, {
      name: name.trim(),
      positions,
      squad_number: squadNumber ? Number(squadNumber) : null,
    })
    setSaving(false)
    if (saved) setEditing(false)
  }

  if (!editing) {
    const positionSummary = (player.positions ?? []).map((p) => PLAYER_POSITION_LABELS[p]).join(', ')
    return (
      <li className="rounded-md border border-line px-3 py-2">
        <div className={`flex flex-wrap items-center gap-x-6 gap-y-2 ${ROW_GRID}`}>
          <span className="text-sm text-ink-muted">
            {player.squad_number != null ? `#${player.squad_number}` : '—'}
          </span>
          <span className="text-sm font-medium text-ink">{player.name}</span>
          <span className="text-xs text-ink-muted">{positionSummary || '—'}</span>
          <span className="text-xs text-ink-muted">
            {attendance && attendance.total > 0
              ? `${attendance.present}/${attendance.total} (${Math.round((attendance.present / attendance.total) * 100)}%)`
              : '—'}
          </span>
          <div className="ml-auto flex flex-wrap items-center gap-x-3 gap-y-1">
            <button
              type="button"
              onClick={() => setNotesOpen((open) => !open)}
              className="text-sm text-ink-muted underline underline-offset-2"
            >
              {notesOpen ? 'Hide notes' : 'Notes'}
            </button>
            <button
              type="button"
              onClick={startEdit}
              className="text-sm text-ink-muted underline underline-offset-2"
            >
              Edit
            </button>
          </div>
        </div>
        {notesOpen && <PlayerNotes playerId={player.id} />}
      </li>
    )
  }

  return (
    <li className="rounded-md border border-line-strong px-3 py-2">
      <form onSubmit={handleSave} className="flex flex-wrap items-end gap-2">
        <div className="min-w-32 flex-1">
          <label className="block text-xs font-medium text-ink-muted">Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full rounded-md border border-line bg-panel-raised px-2 py-1.5 text-sm text-ink outline-none focus:border-accent"
          />
        </div>
        <div>
          <span className="block text-xs font-medium text-ink-muted">Position</span>
          <div className="mt-1">
            <PositionTagPicker value={positions} onChange={setPositions} idPrefix={`edit-player-${player.id}-position`} />
          </div>
        </div>
        <div className="w-20">
          <label className="block text-xs font-medium text-ink-muted">Squad #</label>
          <input
            type="number"
            min={0}
            value={squadNumber}
            onChange={(e) => setSquadNumber(e.target.value)}
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
        <button
          type="button"
          onClick={() => setEditing(false)}
          className="px-2 py-1.5 text-sm text-ink-muted"
        >
          Cancel
        </button>
      </form>
    </li>
  )
}
