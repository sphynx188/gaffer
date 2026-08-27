import { Card } from '../components/ui/Card'
import { DrillLibrary } from '../components/design/DrillLibrary'

// Nested under LibraryLayout ("/library/drills", 2026-08-28) — its own
// PageHeader moved up to the shared layout, same convention as
// AdminLayout's sub-pages (e.g. CoachesPage).
export function DrillLibraryPage() {
  return (
    <Card>
      <DrillLibrary />
    </Card>
  )
}
