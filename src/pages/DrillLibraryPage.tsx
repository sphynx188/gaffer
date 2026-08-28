import { DrillLibrary } from '../components/design/DrillLibrary'

// Nested under LibraryLayout ("/library/drills", 2026-08-28) — its own
// PageHeader moved up to the shared layout, same convention as
// AdminLayout's sub-pages (e.g. CoachesPage).
//
// No `Card` wrapper since the file-manager rework (2026-08-28): the library
// is now a three-pane shell whose panes carry their own edges (the details
// rail is a panel, the list is a bordered table), so an outer card drew a
// second frame around the whole screen and indented the places rail away
// from the page's own margin for no reason. TacticsPage dropped its own
// identical wrapper in the same change.
export function DrillLibraryPage() {
  return <DrillLibrary />
}
