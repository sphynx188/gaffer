import { PageHeader } from '../components/ui/PageHeader'
import { Card } from '../components/ui/Card'
import { DrillPreview } from '../components/design/DrillPreview'

export function DesignPage() {
  return (
    <div>
      <PageHeader title="Design" />
      <Card>
        <DrillPreview />
      </Card>
    </div>
  )
}
