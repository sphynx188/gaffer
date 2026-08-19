import { PageHeader } from '../components/ui/PageHeader'
import { Card } from '../components/ui/Card'
import { DrillLibrary } from '../components/design/DrillLibrary'

export function DrillLibraryPage() {
  return (
    <div>
      <PageHeader title="Drill library" description="Browse and search every reusable drill." />
      <Card>
        <DrillLibrary />
      </Card>
    </div>
  )
}
