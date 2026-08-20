import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useStore } from '../store'
import type { Drill, SessionDrill, SessionWithRelations } from '../store'
import { PITCH_FORMAT_LABELS } from '../store'
import { NumberChip } from './ui/NumberChip'

interface AttachmentFormValues {
  planned_duration_minutes: number | null
  notes: string | null
}

// Phase 2d — Save as reusable / attach to session (US-14, US-15,
// gaffer_mvp_build_steps.md). Mounted inside a SessionRow (SessionPlanner.tsx)
// when a coach expands that session's "Drills" toggle — same
// expandable-panel-as-detail-view pattern AvailabilityPanel established for
// the "Availability" toggle on the same row.
//
// US-14 needs nothing here: every drill built via 2a-2c (drillSlice) is
// already reusable by virtue of being a `drill` row, and there is no
// separate "save as template" step anywhere in this app to remove. This
// panel is entirely the US-15 half — pick from every existing drill
// (coach-owned + this session's team), attach it with a planned duration and
// notes specific to *this* use, and reorder/detach afterward. order_index is
// set implicitly (new attachments always land at the end) and adjusted via
// the ↑/↓ buttons below, rather than a manual index field at attach time —
// same "step controls over a raw index input" choice 2c made for phases.
//
// Definition of Done: a coach-owned drill (team_id null) is attachable to any
// team's session with no extra step (the picker below is scoped exactly like
// drillSlice.fetchDrills — "this team OR nobody's team" — so it needs no
// special-casing here); a session can hold multiple attached drills in
// order, each with its own planned_duration_minutes and notes, independent of
// every other session that drill also happens to be attached to.
export function SessionDrillsPanel({ session }: { session: SessionWithRelations }) {
  const drills = useStore((s) => s.drills)
  const fetchDrills = useStore((s) => s.fetchDrills)
  const attachDrillToSession = useStore((s) => s.attachDrillToSession)
  const updateSessionDrill = useStore((s) => s.updateSessionDrill)
  const detachDrillFromSession = useStore((s) => s.detachDrillFromSession)
  const attachLoading = useStore((s) => s.sessionDrillAttachLoading[session.id] ?? false)
  const attachError = useStore((s) => s.sessionDrillAttachError[session.id] ?? null)

  // Drills are scoped by the session's own team_id (not necessarily the
  // currently-selected team — same reasoning AvailabilityPanel documents for
  // its roster lookup), and drillSlice.fetchDrills already applies the
  // "this team OR nobody's team" filter, so every coach-owned drill shows up
  // here regardless of which team is selected elsewhere in the app.
  useEffect(() => {
    fetchDrills(session.team_id)
  }, [session.team_id, fetchDrills])

  const drillsById = useMemo(() => {
    const map = new Map<string, Drill>()
    for (const d of drills) map.set(d.id, d)
    return map
  }, [drills])

  const attachedDrills = session.session_drills // already sorted by order_index (sessionDrillSlice keeps it that way)

  const [selectedDrillId, setSelectedDrillId] = useState('')
  const [plannedDuration, setPlannedDuration] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleAttach = async (e: FormEvent) => {
    e.preventDefault()
    if (!selectedDrillId || submitting) return
    setSubmitting(true)
    const attached = await attachDrillToSession({
      session_id: session.id,
      drill_id: selectedDrillId,
      order_index: attachedDrills.length,
      planned_duration_minutes: plannedDuration ? Number(plannedDuration) : null,
      notes: notes.trim() || null,
    })
    setSubmitting(false)
    if (attached) {
      setSelectedDrillId('')
      setPlannedDuration('')
      setNotes('')
    }
  }

  // Swaps order_index with the adjacent row in the given direction — two
  // per-attachment updates, not a drill edit, so every other session this
  // drill is also attached to is untouched.
  const handleReorder = async (index: number, direction: -1 | 1) => {
    const other = attachedDrills[index + direction]
    const current = attachedDrills[index]
    if (!other || !current) return
    await Promise.all([
      updateSessionDrill(current.id, { order_index: other.order_index }),
      updateSessionDrill(other.id, { order_index: current.order_index }),
    ])
  }

  return (
    <div className="mt-3 border-t border-line pt-3">
      {attachedDrills.length === 0 ? (
        <p className="text-sm text-ink-muted">No drills attached yet.</p>
      ) : (
        <ul className="space-y-2">
          {attachedDrills.map((sessionDrill, index) => (
            <SessionDrillRow
              key={sessionDrill.id}
              sessionDrill={sessionDrill}
              drill={drillsById.get(sessionDrill.drill_id)}
              position={index + 1}
              isFirst={index === 0}
              isLast={index === attachedDrills.length - 1}
              onMove={(direction) => handleReorder(index, direction)}
              onSave={updateSessionDrill}
              onRemove={detachDrillFromSession}
            />
          ))}
        </ul>
      )}

      <form onSubmit={handleAttach} className="mt-3 flex flex-wrap items-end gap-2 border-t border-line pt-3">
        <div className="min-w-40 flex-1">
          <label className="block text-xs font-medium text-ink-muted">Drill</label>
          <select
            value={selectedDrillId}
            onChange={(e) => setSelectedDrillId(e.target.value)}
            className="mt-1 w-full rounded-md border border-line bg-panel-raised px-2 py-1.5 text-sm text-ink outline-none focus:border-accent"
          >
            <option value="">
              {drills.length === 0 ? 'No drills yet — build one in Design above' : 'Select a drill…'}
            </option>
            {drills.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name} ({PITCH_FORMAT_LABELS[d.pitch_format] ?? d.pitch_format})
              </option>
            ))}
          </select>
        </div>
        <div className="w-28">
          <label className="block text-xs font-medium text-ink-muted">Minutes</label>
          <input
            type="number"
            min={1}
            value={plannedDuration}
            onChange={(e) => setPlannedDuration(e.target.value)}
            placeholder="optional"
            className="mt-1 w-full rounded-md border border-line bg-panel-raised px-2 py-1.5 text-sm text-ink outline-none focus:border-accent"
          />
        </div>
        <div className="min-w-32 flex-1">
          <label className="block text-xs font-medium text-ink-muted">Notes</label>
          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. focus on first touch"
            className="mt-1 w-full rounded-md border border-line bg-panel-raised px-2 py-1.5 text-sm text-ink outline-none focus:border-accent"
          />
        </div>
        <button
          type="submit"
          disabled={!selectedDrillId || submitting || attachLoading}
          className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50"
        >
          {submitting || attachLoading ? 'Attaching…' : 'Attach drill'}
        </button>
      </form>
      {attachError && <p className="mt-1 text-sm text-bad">{attachError}</p>}
    </div>
  )
}

function SessionDrillRow({
  sessionDrill,
  drill,
  position,
  isFirst,
  isLast,
  onMove,
  onSave,
  onRemove,
}: {
  sessionDrill: SessionDrill
  drill: Drill | undefined
  position: number
  isFirst: boolean
  isLast: boolean
  onMove: (direction: -1 | 1) => void
  onSave: (id: string, patch: AttachmentFormValues) => Promise<SessionDrill | null>
  onRemove: (id: string) => Promise<boolean>
}) {
  const rowLoading = useStore((s) => s.sessionDrillRowLoading[sessionDrill.id] ?? false)
  const rowError = useStore((s) => s.sessionDrillRowError[sessionDrill.id] ?? null)

  const [plannedDuration, setPlannedDuration] = useState(
    sessionDrill.planned_duration_minutes != null ? String(sessionDrill.planned_duration_minutes) : ''
  )
  const [notes, setNotes] = useState(sessionDrill.notes ?? '')
  const [dirty, setDirty] = useState(false)
  const [removing, setRemoving] = useState(false)

  const handleSave = async (e: FormEvent) => {
    e.preventDefault()
    if (!dirty || rowLoading) return
    const saved = await onSave(sessionDrill.id, {
      planned_duration_minutes: plannedDuration ? Number(plannedDuration) : null,
      notes: notes.trim() || null,
    })
    if (saved) setDirty(false)
  }

  const handleRemove = async () => {
    setRemoving(true)
    await onRemove(sessionDrill.id)
    setRemoving(false)
  }

  return (
    <li className="rounded-md border border-line px-3 py-2">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <NumberChip index={position} />
          <p className="text-sm font-medium text-ink">
            {drill ? `${drill.name} (${PITCH_FORMAT_LABELS[drill.pitch_format] ?? drill.pitch_format})` : 'Unknown drill'}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={() => onMove(-1)}
            disabled={isFirst}
            aria-label="Move up"
            className="rounded-md border border-line px-1.5 py-0.5 text-xs text-ink-muted disabled:opacity-30"
          >
            ↑
          </button>
          <button
            type="button"
            onClick={() => onMove(1)}
            disabled={isLast}
            aria-label="Move down"
            className="rounded-md border border-line px-1.5 py-0.5 text-xs text-ink-muted disabled:opacity-30"
          >
            ↓
          </button>
          <button
            type="button"
            onClick={handleRemove}
            disabled={removing}
            className="text-xs text-bad underline underline-offset-2 disabled:opacity-50"
          >
            Remove
          </button>
        </div>
      </div>
      <form onSubmit={handleSave} className="mt-2 flex flex-wrap items-end gap-2">
        <div className="w-24">
          <label className="block text-xs font-medium text-ink-muted">Minutes</label>
          <input
            type="number"
            min={1}
            value={plannedDuration}
            onChange={(e) => {
              setPlannedDuration(e.target.value)
              setDirty(true)
            }}
            className="mt-1 w-full rounded-md border border-line bg-panel-raised px-2 py-1.5 text-sm text-ink outline-none focus:border-accent"
          />
        </div>
        <div className="min-w-32 flex-1">
          <label className="block text-xs font-medium text-ink-muted">Notes</label>
          <input
            value={notes}
            onChange={(e) => {
              setNotes(e.target.value)
              setDirty(true)
            }}
            className="mt-1 w-full rounded-md border border-line bg-panel-raised px-2 py-1.5 text-sm text-ink outline-none focus:border-accent"
          />
        </div>
        <button
          type="submit"
          disabled={!dirty || rowLoading}
          className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50"
        >
          {rowLoading ? 'Saving…' : 'Save'}
        </button>
      </form>
      {rowError && <p className="mt-1 text-sm text-bad">{rowError}</p>}
    </li>
  )
}
