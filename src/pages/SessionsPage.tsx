import { PageHeader } from '../components/ui/PageHeader'
import { Card } from '../components/ui/Card'
import { SessionPlanner } from '../components/SessionPlanner'

export function SessionsPage() {
  return (
    <div>
      <PageHeader title="Sessions" />
      <Card>
        <SessionPlanner />
      </Card>
    </div>
  )
}
