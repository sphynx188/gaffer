import { useMemo, useState, type FormEvent } from 'react'
import { useStore } from '../store'
import type { Availability, AvailabilityStatus, Player, SessionWithRelations } from '../store'
import { Badge } from './ui/Badge'
import { availabilityTone } from './ui/badgeTones'

const STATUS_OPTIONS: AvailabilityStatus[] = ['unconfirmed', 'present', 'injured', 'away']

const STATUS_LABEL: Record<AvailabilityStatus, string> = {
  unconfirmed: 'Unconfirmed',
  present: 'Present',
  injured: 'Injured',
  away: 'Away',
}

interface AvailabilityFormInput {
  status: AvailabilityStatus
  reason?: string | null
}

// Phase 1.6 — Availability per session (US-8, gaffer_mvp_build_steps.md).
// Mounted inside a SessionRow (SessionPlanner.tsx) when a coach expands that
// session's "Availability" toggle — same expandable-panel-as-detail-view
// pattern PlayerNotes established for a player's "Notes" toggle on
// PlayerRoster, since this app still has no separate routed detail page.
// Definition of Done: availability is per (session, player) pair — one row
// per team player, seeded `unconfirmed` by sessionSlice.createSession the
// moment the session exists; reason is optional; responded_at is recorded
// on change (availabilitySlice.updateAvailability stamps it on every save
// from this panel).
export function AvailabilityPanel({ session }: { session: SessionWithRelations }) {
  const players = useStore((s) => s.players)
  const updateAvailability = useStore((s) => s.updateAvailability)

  // Availability rows are seeded per the session's own team_id at creation
  // time (sessionSlice), not the currently-selected team — scoping the
  // roster lookup the same way keeps this panel correct even if it's ever
  // reached for a session belonging to a team other than the one currently
  // selected in TeamSwitcher.
  const teamPlayers = useMemo(
    () => players.filter((p) => p.team_id === session.team_id),
    [players, session.team_id]
  )

  const availabilityByPlayer = useMemo(() => {
    const map = new Map<string, Availability>()
    for (const a of session.availability) map.set(a.player_id, a)
    return map
  }, [session.availability])

  if (teamPlayers.length === 0) {
    return (
      <div className="mt-3 border-t border-line pt-3">
        <p className="text-sm text-ink-muted">No players on the roster yet.</p>
      </div>
    )
  }

  return (
    <div className="mt-3 border-t border-line pt-3">
      <ul className="space-y-2">
        {teamPlayers.map((player) => (
          <AvailabilityRow
            key={player.id}
            player={player}
            availability={availabilityByPlayer.get(player.id)}
            onSave={updateAvailability}
          />
        ))}
      </ul>
    </div>
  )
}

function AvailabilityRow({
  player,
  availability,
  onSave,
}: {
  player: Player
  availability: Availability | undefined
  onSave: (id: string, patch: AvailabilityFormInput) => Promise<Availability | null>
}) {
  const [status, setStatus] = useState<AvailabilityStatus>(availability?.status ?? 'unconfirmed')
  const [reason, setReason] = useState(availability?.reason ?? '')
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!availability || saving || !dirty) return
    setSaving(true)
    const saved = await onSave(availability.id, { status, reason: reason.trim() || null })
    setSaving(false)
    if (saved) setDirty(false)
  }

  // Only reachable for a session created before this feature shipped —
  // sessionSlice now seeds every team player's row at session-creation time,
  // so there's no availability id to write an update against here.
  if (!availability) {
    return (
      <li className="flex items-center justify-between rounded-md border border-line px-3 py-2">
        <p className="text-sm text-ink">{player.name}</p>
        <p className="text-xs text-ink-muted">No availability record</p>
      </li>
    )
  }

  return (
    <li className="rounded-md border border-line px-3 py-2">
      <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-2">
        <div className="min-w-28 flex-1">
          <p className="flex items-center gap-1.5 text-sm font-medium text-ink">
            {player.squad_number != null && (
              <span className="text-ink-muted">#{player.squad_number}</span>
            )}
            {player.name}
            <Badge tone={availabilityTone(availability.status)}>{STATUS_LABEL[availability.status]}</Badge>
          </p>
          <p className="text-xs text-ink-muted">
            {availability.responded_at
              ? `Responded ${new Date(availability.responded_at).toLocaleString()}`
              : 'No response yet'}
          </p>
        </div>
        <div className="w-32">
          <label className="block text-xs font-medium text-ink-muted">Status</label>
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value as AvailabilityStatus)
              setDirty(true)
            }}
            className="mt-1 w-full rounded-md border border-line bg-panel-raised px-2 py-1.5 text-sm text-ink outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/30"
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-32 flex-1">
          <label className="block text-xs font-medium text-ink-muted">Reason (optional)</label>
          <input
            value={reason}
            onChange={(e) => {
              setReason(e.target.value)
              setDirty(true)
            }}
            placeholder="e.g. twisted ankle, family holiday"
            className="mt-1 w-full rounded-md border border-line bg-panel-raised px-2 py-1.5 text-sm text-ink outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/30"
          />
        </div>
        <button
          type="submit"
          disabled={saving || !dirty}
          className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      </form>
    </li>
  )
}
