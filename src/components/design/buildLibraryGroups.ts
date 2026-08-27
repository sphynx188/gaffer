import type { ClubMemberRow, Collection } from '../../store'

// Shared grouping logic for both libraries (drill Task 5, tactic Task 6 —
// same shapes, docs are tactics there). Split into its own file — a
// same-named LibraryGroups.tsx would collide on a case-insensitive
// filesystem (macOS/Windows default), and mirrors the existing
// Badge.tsx/badgeTones.ts precedent of keeping a component file's exports
// to just the component (oxlint's react-refresh rule flags a file that
// exports both a component and a plain function).
export interface LibraryGroup {
  key: string
  title: string
  kind: 'mine' | 'collection' | 'licensed' | 'folder'
  ids: string[]
}

// Order: My docs → home collections (a–z) → licensed collections (badged)
// → for admins, one folder per other member with any unfiled docs. A doc
// can appear in more than one group (its own folder AND a collection it's
// filed in) — groups are views over the visible set, not a partition of it.
export function buildLibraryGroups(args: {
  docs: { id: string; created_by: string }[]
  collections: Collection[]
  collectionDocIds: Record<string, string[]>
  licensedCollectionIds: Set<string> // collections whose club_id !== selectedClubId
  myUserId: string | null
  isAdmin: boolean
  members: ClubMemberRow[] // for admin folder titles
  docLabel: string // 'drills' | 'tactics' — only used for the "My ..." group title
}): LibraryGroup[] {
  const { docs, collections, collectionDocIds, licensedCollectionIds, myUserId, isAdmin, members, docLabel } = args
  const docIds = new Set(docs.map((d) => d.id))
  const filedDocIds = new Set<string>()
  for (const ids of Object.values(collectionDocIds)) {
    for (const id of ids) if (docIds.has(id)) filedDocIds.add(id)
  }

  const groups: LibraryGroup[] = []

  const mine = docs.filter((d) => d.created_by === myUserId).map((d) => d.id)
  if (mine.length > 0) groups.push({ key: 'mine', title: `My ${docLabel}`, kind: 'mine', ids: mine })

  const collectionIds = (collectionId: string) =>
    (collectionDocIds[collectionId] ?? []).filter((id) => docIds.has(id))

  const homeCollections = collections
    .filter((c) => !licensedCollectionIds.has(c.id))
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))
  for (const c of homeCollections) {
    const ids = collectionIds(c.id)
    if (ids.length > 0) groups.push({ key: `collection:${c.id}`, title: c.name, kind: 'collection', ids })
  }

  const licensedCollections = collections
    .filter((c) => licensedCollectionIds.has(c.id))
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))
  for (const c of licensedCollections) {
    const ids = collectionIds(c.id)
    if (ids.length > 0) groups.push({ key: `licensed:${c.id}`, title: c.name, kind: 'licensed', ids })
  }

  if (isAdmin) {
    for (const member of members) {
      if (member.user_id === myUserId) continue
      const ids = docs.filter((d) => d.created_by === member.user_id && !filedDocIds.has(d.id)).map((d) => d.id)
      if (ids.length > 0) {
        groups.push({
          key: `folder:${member.user_id}`,
          title: member.display_name ?? 'Unnamed coach',
          kind: 'folder',
          ids,
        })
      }
    }
  }

  return groups
}
