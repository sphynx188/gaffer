import { FORMATIONS } from './formations'

// Split into its own module rather than living beside a component: a .tsx
// file that exports both a component and a plain function trips oxlint's
// react-refresh rule (same reason buildLibraryGroups.ts sat apart from
// LibraryGroups.tsx). Both the tactics library list and its details rail
// need this label.
/** A built-in formation's label, or the stored key for a coach's own shape. */
export function formationLabel(key: string): string {
  return FORMATIONS.find((f) => f.key === key)?.label ?? key
}
