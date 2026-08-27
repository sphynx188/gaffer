import { useEffect, useState, type FormEvent } from 'react'
import { useStore } from '../../store'
import { Card } from '../../components/ui/Card'
import { Badge } from '../../components/ui/Badge'
import { Skeleton } from '../../components/ui/Skeleton'

// Shared grid for the members table's header + rows (design.md convention —
// see ROW_GRID in PlayerRoster.tsx): name, role, joined date.
const ROW_GRID = 'sm:grid sm:grid-cols-[1fr_6rem_10rem] sm:items-center sm:gap-x-4'

const SKELETON_ROWS = [0, 1, 2]

export function CoachesPage() {
  const selectedClubId = useStore((s) => s.selectedClubId)
  const clubMembers = useStore((s) => s.clubMembers)
  const clubDataLoading = useStore((s) => s.clubDataLoading)
  const fetchClubData = useStore((s) => s.fetchClubData)
  const createCoach = useStore((s) => s.createCoach)
  const clubActionError = useStore((s) => s.clubActionError)

  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    void fetchClubData()
  }, [fetchClubData, selectedClubId])

  const sorted = [...clubMembers].sort((a, b) => a.created_at.localeCompare(b.created_at))

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!email.trim() || !password || submitting) return
    setSubmitting(true)
    const userId = await createCoach({ email: email.trim(), password, displayName: displayName.trim() })
    setSubmitting(false)
    if (userId) {
      setDisplayName('')
      setEmail('')
      setPassword('')
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <h2 className="mb-4 text-sm font-semibold text-ink">Create a coach</h2>
        <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-2">
          <div>
            <label htmlFor="coach-name" className="block text-xs font-medium text-ink-muted">
              Display name
            </label>
            <input
              id="coach-name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="e.g. Sam Whitfield"
              className="mt-1 w-48 rounded-md border border-line bg-panel-raised px-2 py-1.5 text-sm text-ink outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/30"
            />
          </div>
          <div>
            <label htmlFor="coach-email" className="block text-xs font-medium text-ink-muted">
              Email
            </label>
            <input
              id="coach-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="coach@example.com"
              className="mt-1 w-56 rounded-md border border-line bg-panel-raised px-2 py-1.5 text-sm text-ink outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/30"
            />
          </div>
          <div>
            <label htmlFor="coach-password" className="block text-xs font-medium text-ink-muted">
              Password
            </label>
            <input
              id="coach-password"
              type="password"
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 6 characters"
              className="mt-1 w-48 rounded-md border border-line bg-panel-raised px-2 py-1.5 text-sm text-ink outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/30"
            />
          </div>
          <button
            type="submit"
            disabled={!email.trim() || password.length < 6 || submitting}
            className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50"
          >
            {submitting ? 'Creating…' : 'Create coach'}
          </button>
        </form>
        {clubActionError && <p className="mt-2 text-sm text-bad">{clubActionError}</p>}
      </Card>

      <Card>
        <h2 className="mb-4 text-sm font-semibold text-ink">Club members</h2>
        {clubDataLoading && clubMembers.length === 0 ? (
          <ul className="space-y-2" aria-busy="true">
            {SKELETON_ROWS.map((row) => (
              <li key={row}>
                <Skeleton className="h-10 w-full rounded-md" />
              </li>
            ))}
          </ul>
        ) : (
          <ul className="space-y-1.5">
            <li className={`hidden px-2 ${ROW_GRID}`}>
              <span className="text-xs font-medium text-ink-muted">Name</span>
              <span className="text-xs font-medium text-ink-muted">Role</span>
              <span className="text-xs font-medium text-ink-muted">Joined</span>
            </li>
            {sorted.map((member) => (
              <li key={member.user_id} className="rounded-md border border-line px-2 py-2">
                <div className={`flex flex-wrap items-center gap-x-4 gap-y-1 ${ROW_GRID}`}>
                  <span className="truncate text-sm text-ink">{member.display_name ?? 'Unnamed coach'}</span>
                  <Badge tone={member.role === 'admin' ? 'ok' : 'neutral'}>{member.role}</Badge>
                  <span className="text-xs text-ink-muted">{new Date(member.created_at).toLocaleDateString()}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}
