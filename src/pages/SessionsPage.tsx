import { PageHeader } from '../components/ui/PageHeader'
import { Card } from '../components/ui/Card'
import { SessionPlanner } from '../components/SessionPlanner'

export function SessionsPage() {
  return (
    <div>
      <PageHeader
        title="Sessions"
        description="Plan a week of training, then attach drills and track availability per session."
      />
      <Card>
        <SessionPlanner />
      </Card>
    </div>
  )
}
