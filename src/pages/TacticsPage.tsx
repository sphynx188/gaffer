import { PageHeader } from '../components/ui/PageHeader'
import { Card } from '../components/ui/Card'
import { TacticBoard } from '../components/tactics/TacticBoard'

export function TacticsPage() {
  return (
    <div>
      <PageHeader title="Tactics" />
      <Card>
        <TacticBoard />
      </Card>
    </div>
  )
}
