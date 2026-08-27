import { useEffect } from 'react'
import { useStore } from '../store'
import { PageHeader } from '../components/ui/PageHeader'
import { Card } from '../components/ui/Card'

// Club home (2026-08-28) — the app's real landing route now, replacing the
// old straight-to-/drills redirect. Deliberately a light placeholder: club
// name and member count, nothing more. A fuller dashboard (recent activity,
// quick links) is future work, not attempted here.
export function HomePage() {
  const memberships = useStore((s) => s.memberships)
  const selectedClubId = useStore((s) => s.selectedClubId)
  const clubMembers = useStore((s) => s.clubMembers)
  const fetchClubData = useStore((s) => s.fetchClubData)

  // Same pattern as DrillLibrary/TacticsPage: fetchClubData is keyed on
  // selectedClubId purely so switching clubs re-triggers it.
  useEffect(() => {
    void fetchClubData()
  }, [fetchClubData, selectedClubId])

  const club = memberships.find((m) => m.club_id === selectedClubId)?.club

  return (
    <div>
      <PageHeader title={club?.name ?? 'Home'} description="Club home" />
      <Card>
        <p className="text-sm text-ink-muted">
          {clubMembers.length} {clubMembers.length === 1 ? 'member' : 'members'}
        </p>
      </Card>
    </div>
  )
}
