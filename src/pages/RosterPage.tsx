import { PageHeader } from '../components/ui/PageHeader'
import { Card } from '../components/ui/Card'
import { PlayerRoster } from '../components/PlayerRoster'

export function RosterPage() {
  return (
    <div>
      <PageHeader title="Roster" description="Manage players, positions, and development notes." />
      <Card>
        <PlayerRoster />
      </Card>
    </div>
  )
}
