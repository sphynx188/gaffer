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
  docs: { id: string; created_by: string; club_id: string }[]
  collections: Collection[]
  collectionDocIds: Record<string, string[]>
  licensedCollectionIds: Set<string> // collections with an active license into selectedClubId
  selectedClubId: string | null
  myUserId: string | null
  isAdmin: boolean
  members: ClubMemberRow[] // for admin folder titles
  docLabel: string // 'drills' | 'tactics' — only used for the "My ..." group title
}): LibraryGroup[] {
  const { docs, collections, collectionDocIds, licensedCollectionIds, selectedClubId, myUserId, isAdmin, members, docLabel } =
    args
  const docIds = new Set(docs.map((d) => d.id))
  const filedDocIds = new Set<string>()
  for (const ids of Object.values(collectionDocIds)) {
    for (const id of ids) if (docIds.has(id)) filedDocIds.add(id)
  }

  const groups: LibraryGroup[] = []

  // `docs` is RLS-scoped, not club-scoped (fetchDrills/fetchTactics carry no
  // club_id filter — see clubSlice's comment on why), so an admin of more
  // than one club sees every administered club's docs merged into `docs`.
  // "My drills"/the per-coach folders below are THIS club's personal view,
  // so they need an explicit club_id === selectedClubId filter — without it
  // an admin's own drills from a club they merely also administer bleed
  // into the folder here too (found live rehearsing Task 13's Transfer
  // step: switching to Riverside Academy still showed every Barcelona drill
  // under "My drills").
  const myDocsHere = docs.filter((d) => d.created_by === myUserId && d.club_id === selectedClubId)
  const mine = myDocsHere.map((d) => d.id)
  if (mine.length > 0) groups.push({ key: 'mine', title: `My ${docLabel}`, kind: 'mine', ids: mine })

  const collectionIds = (collectionId: string) =>
    (collectionDocIds[collectionId] ?? []).filter((id) => docIds.has(id))

  // Same club-scoping issue as above: `collections` is RLS-scoped across
  // every club the caller administers, so "home" must also require
  // c.club_id === selectedClubId — otherwise a collection owned by a
  // DIFFERENT club this admin also runs shows up as if it belonged here
  // (the doubled "U14 Passing Block" seen in the same rehearsal step).
  const homeCollections = collections
    .filter((c) => c.club_id === selectedClubId && !licensedCollectionIds.has(c.id))
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
      const ids = docs
        .filter((d) => d.created_by === member.user_id && d.club_id === selectedClubId && !filedDocIds.has(d.id))
        .map((d) => d.id)
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
