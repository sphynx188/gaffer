import { PageHeader } from '../components/ui/PageHeader'
import { Card } from '../components/ui/Card'
import { TacticBoard } from '../components/tactics/TacticBoard'

export function TacticsPage() {
  return (
    <div>
      <PageHeader
        title="Tactics"
        description="Place your roster on the pitch and draw movement, passing, and pressing patterns."
      />
      <Card>
        <TacticBoard />
      </Card>
    </div>
  )
}
