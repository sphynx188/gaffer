import { PageHeader } from '../components/ui/PageHeader'
import { Card } from '../components/ui/Card'
import { DrillLibrary } from '../components/design/DrillLibrary'

export function DrillLibraryPage() {
  return (
    <div>
      <PageHeader title="Drill library" />
      <Card>
        <DrillLibrary />
      </Card>
    </div>
  )
}
