import { useEffect, useState, type FormEvent } from 'react'
import { useStore } from '../store'
import type { PlayerNote } from '../store'
import { useSession } from '../hooks/useSession'

interface NewPlayerNoteFormInput {
  player_id: string
  body: string
}

// Stable reference for "no notes yet" — a zustand selector must return the
// *same* value across renders when nothing has actually changed, or
// useSyncExternalStore's snapshot-consistency check throws ("An error
// occurred in the <PlayerNotes> component"). `s.playerNotes[playerId] ?? []`
// looked equivalent but allocated a brand-new array every render for any
// player with zero notes, which is exactly the state right when the panel
// first opens. Reusing this constant instead of an inline `[]` fixes it.
const EMPTY_NOTES: PlayerNote[] = []

// Phase 1.4 — Player development notes (US-6, gaffer_mvp_build_steps.md).
// Mounted inside a PlayerRow (PlayerRoster.tsx) when a coach expands that
// player's "Notes" toggle — this app has no separate routed player-detail
// page yet, so the expandable panel on the roster row stands in for the
// build guide's "player detail view". Definition of Done: notes are
// append-only (no edit/delete control here, matching playerNoteSlice not
// exposing update/delete); a player's full note history is viewable in
// order (newest-first); author + timestamp are visible on every note;
// nothing is ever overwritten.
export function PlayerNotes({ playerId }: { playerId: string }) {
  const { session } = useSession()
  const notes = useStore((s) => s.playerNotes[playerId] ?? EMPTY_NOTES)
  const loading = useStore((s) => s.playerNotesLoading[playerId] ?? false)
  const error = useStore((s) => s.playerNotesError[playerId] ?? null)
  const fetchPlayerNotes = useStore((s) => s.fetchPlayerNotes)
  const addPlayerNote = useStore((s) => s.addPlayerNote)

  useEffect(() => {
    fetchPlayerNotes(playerId)
  }, [playerId, fetchPlayerNotes])

  return (
    <div className="mt-3 space-y-3 border-t border-slate-200 pt-3">
      {error && <p className="text-sm text-red-600">{error}</p>}
      {loading && notes.length === 0 && <p className="text-sm text-slate-400">Loading notes…</p>}
      {!loading && !error && notes.length === 0 && (
        <p className="text-sm text-slate-400">No notes yet — add the first one below.</p>
      )}

      {notes.length > 0 && (
        <ul className="space-y-2">
          {notes.map((note) => (
            <NoteItem key={note.id} note={note} currentUserId={session?.user.id} />
          ))}
        </ul>
      )}

      <AddNoteForm playerId={playerId} onAdd={addPlayerNote} />
    </div>
  )
}

function NoteItem({ note, currentUserId }: { note: PlayerNote; currentUserId?: string }) {
  // Single-coach MVP (gaffer_project_plan_final.md §1) has no users table to
  // join against via PostgREST, so "You" vs. a short id fallback is the only
  // author label available now — good enough to satisfy "author visible"
  // today and cheap to upgrade once multi-coach adds a real display name.
  const author = note.author_id === currentUserId ? 'You' : `Coach ${note.author_id.slice(0, 8)}`
  const timestamp = new Date(note.created_at).toLocaleString()
  return (
    <li className="rounded-md border border-slate-200 px-3 py-2">
      <p className="whitespace-pre-wrap text-sm text-slate-900">{note.body}</p>
      <p className="mt-1 text-xs text-slate-400">
        {author} · {timestamp}
      </p>
    </li>
  )
}

function AddNoteForm({
  playerId,
  onAdd,
}: {
  playerId: string
  onAdd: (input: NewPlayerNoteFormInput) => Promise<PlayerNote | null>
}) {
  const [body, setBody] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!body.trim() || submitting) return
    setSubmitting(true)
    // Every submit inserts a new row (playerNoteSlice.addPlayerNote) — there
    // is no "edit last note" path, so append-only holds even if a coach
    // submits a correction right after a typo.
    const added = await onAdd({ player_id: playerId, body: body.trim() })
    setSubmitting(false)
    if (added) setBody('')
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <label htmlFor={`new-note-${playerId}`} className="block text-xs font-medium text-slate-500">
        Add a note
      </label>
      <textarea
        id={`new-note-${playerId}`}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={2}
        placeholder="e.g. Worked on first touch under pressure — improving."
        className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm text-slate-900 outline-none focus:border-slate-500"
      />
      <button
        type="submit"
        disabled={submitting || !body.trim()}
        className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
      >
        {submitting ? 'Adding…' : 'Add note'}
      </button>
    </form>
  )
}
