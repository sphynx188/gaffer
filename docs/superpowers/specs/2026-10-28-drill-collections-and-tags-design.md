# Drill collections and tags — design

Date: 2026-10-28. Status: approved in conversation, awaiting spec review.

## Goal

Every drill is filed under exactly one **collection** (its main type —
1v1, 2v2, Rondo…) chosen when it is created, and can carry any number of
**tags** (Back to goal, 1v1 to shoot…). Collections are how the library is
browsed and shared; tags narrow what's inside one.

Drills only. Tactic collections keep working exactly as they do today.

## Decisions

| Question | Decision |
|---|---|
| What are the main tags? | They **are** collections. Each drill is in exactly one. Hand-picked packs ("U12 Foundation") carry on as ordinary collections. |
| Names | **Collections** (main) and **Tags** (general). |
| Who owns the lists? | Per club. Every club gets a starter set; club admins add, rename and delete. Coaches only pick. |
| Coach visibility | Unchanged: a coach sees their own drills plus collections an admin granted them. |
| Coach filing | A coach may file or move **their own** drill into **any** collection in the club, including ones they cannot open. The drill still shows under their own drills. |
| Tags | One club-wide list, usable on any drill, **optional**. |
| Multi-tag filter | Narrowing: a drill must have **all** picked tags. |
| Licensing | Per collection, live: drills filed into a licensed collection later flow to the licensee too. |
| Unfiled existing drills | Migrated into a per-club **Uncategorised** collection for an admin to sort out. |
| Storage | `drill.collection_id`, NOT NULL (approach A), replacing `collection_drill`. |

## 1. Data model

### `drill.collection_id`
- `uuid not null references collection(id)`, indexed.
- Replaces `collection_drill` for drills. `collection_tactic` is untouched.
- A trigger rejects a `collection_id` whose collection is in another club
  or is not `kind = 'drill'` — the guarantee `collection_drill`'s insert
  policy gave (032) moves here.
- `on delete restrict`: a collection can't be deleted while drills point at
  it. The delete path moves them to Uncategorised first (see §4).

### `collection.is_uncategorised`
- `boolean not null default false`; at most one per club (partial unique
  index on `club_id where is_uncategorised`).
- Cannot be renamed or deleted (enforced in the update/delete policies).
- Not offered by the create-drill picker.

### Tags
- `club_tag (id uuid pk, club_id uuid not null references club on delete cascade, name text not null, created_at)`,
  unique `(club_id, lower(name))`.
- `drill_tag (drill_id uuid references drill on delete cascade, tag_id uuid references club_tag on delete cascade, primary key (drill_id, tag_id))`.
  A trigger rejects a tag from another club than the drill's.
- Drills are fetched with their tag ids embedded
  (`select('*, drill_tag(tag_id)')`) and flattened to `Drill.tag_ids: string[]`.
- Deleting a tag cascades off every drill; renaming touches one row.

### Retired
- `collection_drill` (drills' membership) — dropped once nothing reads it.
- `drill.category`, `drill.subcategory` — free text, superseded by
  collections + tags. Values are converted to tags first (see §5), then the
  columns are dropped and every UI reference stripped in the same change,
  per the 008–010 precedent.
- `AddToCollectionDialog`'s add/remove semantics become **Move**.

## 2. Permissions (RLS)

Reuse the 028 helpers (`is_club_member`, `is_club_admin`,
`can_read_collection`); keep 019's `in (select …)` shape wherever a storage
or correlated policy touches a table with its own `name` column.

- **Drill read** (`drill_club_read`): `drill_in_readable_collection(id)`
  becomes `can_read_collection(collection_id)`. Own drills and admins
  unchanged.
- **Drill insert/update**: existing rules, plus `collection_id` must be in
  the drill's own club (the trigger above). Owners and admins can change
  it — that is "move". No collection-level grant is needed to file into a
  collection.
- **Collection names for the picker**: a security-definer RPC
  `club_drill_collections(club uuid)` returning `(id, name, is_uncategorised)`
  for members of that club — names only, no contents. Coaches can't select
  the `collection` table for collections they weren't granted, so the
  picker can't read it directly.
- **`club_tag`**: read for club members; insert/update/delete for club
  admins.
- **`drill_tag`**: read follows the drill (`drill_id in (select id from drill)`
  under the caller's own RLS); insert/delete for whoever may update the drill.
- **Anon / share links**: no new anon access. The public share page shows
  neither the collection nor the tags — they are a club's own filing, of no
  use to a teammate reading one drill — so `club_tag`, `drill_tag` and
  `collection` stay closed to anon and 018's surface does not grow. The
  signed-in read-only viewer (`DrillViewPage`), which shares that page's
  component, does show them.
- **Licensing**: `can_read_collection` already covers licensees; with live
  membership a licensee sees drills filed later too (accepted).

## 3. Creating and editing a drill

### New drill form
Create → Drill opens a form before the editor (`DesignPage` today starts a
draft immediately):

- **Name** — optional; empty becomes "New drill".
- **Collection** — required; every drill collection in the club except
  Uncategorised, as chips, searchable once there are more than ~8.
- **Tags** — optional; the club's tags as toggle chips, searchable.
- **Create drill** is disabled until a collection is picked.

The draft (`startDrillDraft`) carries `collection_id` and `tag_ids`; the
first save inserts the drill row (as now) and then its `drill_tag` rows.
Leaving without editing still writes nothing.

### Editing later
- The Details drawer (`DrillDetailsDrawer`) gains **Collection** and
  **Tags** at the top, replacing Category / Subcategory.
- Changes go through `updateDrill` (collection) and two new store actions
  `setDrillTags(drillId, tagIds)` — no undo-stack involvement, same as the
  other metadata fields.
- Duplicate (`duplicateDrill`) copies `collection_id` and tags.
- `copy_collection_to_club` (cross-club): the copied drills go into the new
  collection in the target club (as today), and their tags are matched to
  the target club's tags by case-insensitive name, creating any missing.

### Tours
`tourSteps.ts` (drill editor) and `appTourSteps.ts` (founder script) get a
line about choosing a collection.

## 4. Library

- **Sidebar**: as today (admins see every collection; coaches see their
  root + granted collections). Each collection shows a drill count.
  Uncategorised is shown to admins only, last, and only while non-empty.
- **Tag filter row**: directly under the library toolbar. Chips for tags
  used by drills in the current place, with counts. Multiple picks narrow
  (drill must have all). Part of the place's filter state, cleared on place
  change.
- **Filter panel**: Category removed; the rest stay.
- **Cards / table**: show the collection name (in All / My drills / coach
  folders) and tag names. The table's Category column becomes Collection.
- **Search**: also matches collection and tag names.
- **Bulk actions**: "Add to collection" → **Move to collection** (single
  choice, works on a selection). "Remove from collection" is removed.
- **Admin — collections**: create / rename / delete from the sidebar as
  today. Deleting a non-empty collection moves its drills to Uncategorised,
  via a security-definer RPC `delete_drill_collection(id)` that does the
  move and the delete in one transaction, after a confirm that states the
  count. Uncategorised offers neither rename nor delete.
- **Admin — tags**: a **Manage tags** sidebar entry opens a dialog to add,
  rename and delete; delete confirms with the number of drills using it.

UI polish is expected to follow once it's usable.

## 5. Starter set and migration

### Starter set
Seeded for every existing club (only names it doesn't already have,
case-insensitive) and for new clubs inside `create_club`.

- **Collections (kind `drill`)**: 1v1, 2v1, 2v2, 3v2, 3v3, 4v4, Rondo,
  Possession, Small-sided game, Passing, Finishing, Warm-up, Goalkeeping.
- **Tags**: Back to goal, 1v1 to pass, 1v1 to shoot, 1v1 to beat, Turning,
  Receiving, First touch, Dribbling, Combination play, Crossing, Pressing,
  Counter-attack, Transition, Overloads, Wide areas, Defending.

### Migration steps (one numbered migration, applied via the Supabase MCP)
1. Dump `collection_drill` and every non-null `drill.category` /
   `drill.subcategory` to a JSON file outside the repo
   (`../drill_collections_category_backup_2026-10-28.json`), as with 014/021.
2. Create `club_tag`, `drill_tag`, `collection.is_uncategorised`, policies,
   triggers, RPCs.
3. Seed the starter set into every club.
4. Add `drill.collection_id` (nullable), fill it from `collection_drill`
   (live data: no drill is in more than one), create Uncategorised in each
   club with unfiled drills (18 today) and file them there, then
   `set not null`.
5. Convert `category` / `subcategory` values into tags on their drills,
   skipping values that equal a collection name in that club (e.g. "3v2").
6. Rewrite `drill_club_read`, `copy_collection_to_club`, and anything else
   reading `collection_drill` for drills (`clubSlice` fetch/add/remove,
   `HomePage`, `CoachesPage`, `DrillLibrary`, `AddToCollectionDialog`).
7. Drop `collection_drill`, `drill.category`, `drill.subcategory`.

## Testing

- **RLS sweeps** via `execute_sql` with `request.jwt.claims` set, as
  recorded in 028's header — admin, plain coach, a user from another club,
  anon:
  - a coach files their own drill into a collection they weren't granted;
    the insert succeeds, they still read the drill, and a second coach
    without that grant does not;
  - a coach cannot move someone else's drill, nor file into another club's
    collection or a tactic collection;
  - the picker RPC returns names only, and only for the caller's club;
  - anon with a share token reads exactly the shared drill and nothing new.
- **Migration checks**: drill count per club unchanged; every drill has a
  collection; per-collection counts match the pre-migration
  `collection_drill`; Uncategorised holds exactly the previously unfiled
  drills; converted tags match the backed-up category text.
- **Browser walkthrough** (signed in): create with collection + tags, edit
  them in Details, move in bulk, filter by two tags, delete a non-empty
  collection, manage tags, duplicate, and a licensed collection showing a
  newly filed drill in the receiving club.
- `npm run build` and `npm run lint` clean.

## Out of scope

- Tactics (collections, tags) — unchanged.
- Per-collection tag lists.
- UI polish beyond functional layouts.
