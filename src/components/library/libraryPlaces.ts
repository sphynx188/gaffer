import type { ClubMemberRow, Collection, CollectionKind } from '../../store'

// The Library's "places" model (2026-08-28 file-manager rework) — replaces
// buildLibraryGroups.ts. Same club-scoping rules, same source data; what
// changes is the shape of the answer. `buildLibraryGroups` returned every
// group at once so the page could stack them all in one scroll, which meant
// a drill filed in a collection rendered twice (once under "My drills",
// once under the collection) with no way to tell where you were. A place is
// somewhere you navigate TO: exactly one is current, its ids are the only
// ones listed, and the sidebar is the map of the rest.
//
// Two deliberate behaviour changes that fall out of that:
//   1. An empty collection still appears. `buildLibraryGroups` dropped any
//      group with no docs (a stacked empty section is just noise), but a
//      folder you just made and haven't filed anything into yet has to be
//      visible or you can't file into it — and its emptiness is now the
//      content of a screen rather than a gap in a list.
//   2. A coach folder holds everything that coach authored in this club,
//      not only their *unfiled* docs. Owner is a property of the doc, not a
//      leftover bucket: "show me everything Sam made" shouldn't silently
//      omit the ones that are also in a collection, the same way "My
//      drills" has never omitted them.
//
// "All" is admin-only (2026-08-28). RLS already made it a different set per
// role — an admin sees every drill in the club, a plain coach sees their own
// plus whatever collections they were granted — so one label covered two
// meanings, and the narrower one read as if it were the club's whole
// library. A coach's root is now their own folder, named after them, with
// their granted collections beneath it; `places[0]` is the root either way,
// which is what the breadcrumb and the default place key off.

export interface LibraryDoc {
  id: string
  created_by: string
  club_id: string
}

export type LibraryPlaceKind = 'all' | 'mine' | 'collection' | 'licensed' | 'coach'

export interface LibraryPlace {
  /** URL token — 'all' | 'mine' | 'c:<id>' | 'l:<id>' | 'u:<userId>'. */
  id: string
  kind: LibraryPlaceKind
  title: string
  /** Every doc id in this place, before search/filters narrow the view. */
  ids: string[]
  /** Set for 'collection' and 'licensed'. */
  collectionId?: string
  /** Set for 'coach'. */
  userId?: string
}

export function placeTokenForCollection(collectionId: string, licensed: boolean): string {
  return `${licensed ? 'l' : 'c'}:${collectionId}`
}

/** "Max" -> "Max's", "Chris" -> "Chris'" — the folder is titled, not addressed. */
function possessive(name: string): string {
  return /s$/i.test(name) ? `${name}'` : `${name}'s`
}

/** The place a tab opens on, and what its breadcrumb's root segment points at. */
export function rootPlaceId(isAdmin: boolean): string {
  return isAdmin ? 'all' : 'mine'
}

export function buildLibraryPlaces(args: {
  docs: LibraryDoc[]
  collections: Collection[]
  collectionDocIds: Record<string, string[]>
  licensedCollectionIds: Set<string> // collections with an active license into selectedClubId
  selectedClubId: string | null
  myUserId: string | null
  isAdmin: boolean
  members: ClubMemberRow[]
  myDisplayName: string | null // names the caller's own folder when they aren't an admin
  kind: CollectionKind
  docLabel: string // 'drills' | 'tactics'
}): LibraryPlace[] {
  const {
    docs,
    collections,
    collectionDocIds,
    licensedCollectionIds,
    selectedClubId,
    myUserId,
    isAdmin,
    members,
    myDisplayName,
    kind,
    docLabel,
  } = args

  const docIds = new Set(docs.map((d) => d.id))
  const idsIn = (collectionId: string) => (collectionDocIds[collectionId] ?? []).filter((id) => docIds.has(id))

  // `collections` is RLS-scoped across every club the caller administers, so
  // "ours" needs an explicit club_id check — otherwise a collection owned by
  // a DIFFERENT club this admin also runs shows up as if it belonged here.
  // The `kind` check is new and now load-bearing: buildLibraryGroups got
  // away without one because a tactic collection simply had no drill ids and
  // fell out as an empty group, and empty groups were dropped. Empty places
  // are kept, so without this filter every tactic collection would appear as
  // an empty folder in the Drills tab.
  const ours = collections
    .filter((c) => c.club_id === selectedClubId && c.kind === kind && !licensedCollectionIds.has(c.id))
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))
  const licensed = collections
    .filter((c) => c.kind === kind && licensedCollectionIds.has(c.id))
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))

  // A licensed collection belongs to the club that granted it, so its docs
  // carry someone else's club_id and a plain `club_id === selectedClubId`
  // test would hide them from "All". They're in this library — they're just
  // not ours — so they're unioned in explicitly.
  const licensedDocIds = new Set<string>()
  for (const c of licensed) for (const id of idsIn(c.id)) licensedDocIds.add(id)

  const places: LibraryPlace[] = []

  if (isAdmin) {
    places.push({
      id: 'all',
      kind: 'all',
      title: `All ${docLabel}`,
      ids: docs.filter((d) => d.club_id === selectedClubId || licensedDocIds.has(d.id)).map((d) => d.id),
    })
  }

  // Titled "My drills" only alongside "All drills", where the contrast is
  // what the word "my" is doing. On its own — a coach's home folder — it's
  // named after them instead, matching how an admin sees the same folder in
  // the Coaches section.
  places.push({
    id: 'mine',
    kind: 'mine',
    title: !isAdmin && myDisplayName ? `${possessive(myDisplayName)} ${docLabel}` : `My ${docLabel}`,
    ids: docs.filter((d) => d.created_by === myUserId && d.club_id === selectedClubId).map((d) => d.id),
  })

  for (const c of ours) {
    places.push({ id: `c:${c.id}`, kind: 'collection', title: c.name, ids: idsIn(c.id), collectionId: c.id })
  }
  for (const c of licensed) {
    places.push({ id: `l:${c.id}`, kind: 'licensed', title: c.name, ids: idsIn(c.id), collectionId: c.id })
  }

  if (isAdmin) {
    for (const member of members) {
      if (member.user_id === myUserId) continue
      const ids = docs.filter((d) => d.created_by === member.user_id && d.club_id === selectedClubId).map((d) => d.id)
      if (ids.length === 0) continue
      places.push({
        id: `u:${member.user_id}`,
        kind: 'coach',
        title: member.display_name ?? 'Unnamed coach',
        ids,
        userId: member.user_id,
      })
    }
  }

  return places
}
