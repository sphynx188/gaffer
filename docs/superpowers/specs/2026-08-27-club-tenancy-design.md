# Club Tenancy & Library Platform — Design

**Date:** 2026-08-27 (v2 — team/session features shelved, see §2.8) ·
**Status:** Approved design, pending implementation plan
**Source:** `../business_partner_pitch_notes_2026-08-27.md` + Q&A with Max (this session)
**Deadline:** demo-ready by **Friday 2026-09-04** (presentation to a potential
business partner — a professional coach of ~20 years, in talks about running an
academy).

## 1. Context and goal

Gaffer today is a single-coach tool: one account owns teams, and drills/tactics
hang off those teams. The pitch reshapes it into a **multi-tenant club library
platform**: a club owns a permanent library of drills and tactics, an admin
controls which coaches see what, and libraries can move between clubs (copy) or
be licensed to them (read-only, revocable).

The product this cycle is the **library, full stop**. The team-management side
(teams, rosters, sessions, attendance) is **shelved** — removed from the UI but
kept dormant in code and database for later reinstatement (§2.8). What
survives active: the drill and tactic editors, animation and playback, PNG/GIF
export, print cards, public share links — all kept as-is. What's new is the
tenancy layer, the visibility model, and cross-club movement — plus removal of
the public landing page.

The immediate deliverable is a **real, seeded demo**: actual Supabase logins
for admin and coach personas at a fictional club ("FC Barcelona (demo)"), real
RLS enforcing every visibility rule. Nothing faked client-side.

## 2. Product decisions (locked in Q&A, 2026-08-27)

1. **Demo fidelity:** real auth + seeded clubs; RLS does the enforcement.
2. **Clubs only.** The solo-coach mode is retired as a product concept; Max's
   existing account/data migrates into an auto-created club where he is admin.
3. **Visibility mechanism: collections.** Admin curates named collections of
   drills/tactics and grants them per coach. (Age-group scoping is expressed by
   how collections are named/curated, not by a separate rules engine.)
4. **Coach folders:** every coach's own creations land in a folder under their
   name. Admin sees everything in the club. A coach sees **only** their own
   folder plus collections the admin has granted them.
5. **Both libraries:** collections hold **drills and tactics** — the tactic
   library is first-class, not a fast-follow.
6. **Cross-club transfer — both flavors, both in the demo:**
   - **Copy** between two clubs the same admin belongs to (the "I take over a
     second academy" story). Target club gets its own editable copies.
   - **License**: a collection is granted read-only to another club. It lands
     with the **target club's admin**, who disperses it among their own coaches
     exactly as they disperse home-grown collections. Revocation kills all
     downstream access at once.
7. **Landing page removed** (fully): routes, `src/pages/landing/`,
   `src/lib/waitlist.ts` deleted; `early_access_signup` dropped by a new
   migration. Signed-out visitors go straight to the login screen. The
   historical migration 025 file stays in the repo (migrations are never
   deleted here — drops ship as new migrations; 008/009/010 precedent).
8. **Teams, players, sessions, attendance shelved** (added in v2): the app
   goes full drill-and-tactic library. Shelving means **routes and nav entries
   removed; component code, store slices, database tables, and existing data
   all stay in place, dormant** — reinstating the module later is a matter of
   re-adding routes/nav and re-binding it under clubs, not a rebuild. No
   team-side tables are dropped and no team-side data is deleted.

## 3. Non-goals (this cycle)

Roadmap section (§13) records these; none ship this week: billing or any
monetization surface; native apps; a B2B marketing site; approval/review
workflows for coach-created content; finer-than-club license reach; admin
analytics; offline write queueing; reinstating the team/session module.

## 4. Data model

All schema work follows the house rules: additive numbered migrations under
`supabase/migrations/` applied via the Supabase MCP, `src/store/types.ts`
updated in the same change, destructive drops gated and dumped first
(014/021 precedent). Number references below say "next free number" because a
concurrent session may take numbers.

### 4.1 New tables

```sql
club            (id uuid pk, name text not null, created_at timestamptz)
club_member     (club_id fk, user_id uuid, role text check (role in ('admin','coach')),
                 display_name text, created_at, pk (club_id, user_id))
collection      (id uuid pk, club_id fk not null, name text not null,
                 description text, created_by uuid, created_at)
collection_drill  (collection_id fk, drill_id fk, pk (collection_id, drill_id))
collection_tactic (collection_id fk, tactic_id fk, pk (collection_id, tactic_id))
collection_access (collection_id fk, user_id uuid, granted_by uuid, created_at,
                 pk (collection_id, user_id))
club_license    (id uuid pk, collection_id fk not null, target_club_id fk not null,
                 granted_by uuid, created_at, revoked_at timestamptz null)
```

- A user may belong to **multiple clubs** (`club_member` is a join table) —
  this is what makes cross-club copy possible.
- Two collection join tables, not one polymorphic table — the exact precedent
  `session_drills`/`session_tactics` set.
- `club_license` active = `revoked_at is null`. Source club is derivable from
  `collection.club_id`; it is deliberately not denormalized.
- `collection_access` serves **both** home-club grants and licensed-collection
  dispersal: a grant to a coach outside the collection's club is only honored
  by RLS while an active license connects the collection to that coach's club.
  One grant mechanism, not two; revoking the license silently disables every
  cross-club grant that rode on it.

### 4.2 Changed tables

- `drill`: `+ club_id uuid not null` (backfilled), `+ created_by uuid`
  (backfilled to the account that owns the data today). **Team ownership of
  drills ends**: `drill.team_id` is dropped — as a separate, gated migration
  *after* the library UI rescope ships (same staging as 014/021: additive
  first, UI rewired, then the drop with a pre-drop dump and `pg_depend`
  check).
- `tactic`: `+ club_id uuid not null`, `+ created_by uuid`; `team_id` becomes
  **nullable** and stops being written — with rosters shelved, tactics carry
  no roster binding this cycle (formation-driven generic squads; entities keep
  role/number labels). Existing tactics keep their `team_id` value dormant.
  Visibility is governed by club/collections alone.
- **Untouched and dormant:** `team`, `team_coaches`, `player`, `player_notes`,
  `session`, `availability`, `session_drills`, `session_tactics` — no schema
  change, no data change, existing team-membership RLS left as-is. (The
  `team.club_id` backfill originally considered here is deferred to whenever
  the team module is reinstated.)
- `early_access_signup`: dropped (new migration; dump first if any non-test
  rows exist).

### 4.3 Migration of existing data

One-time backfill inside the additive migration: create a club per existing
account owner (in practice: Max's account and the test account), insert
`club_member(role='admin')`, point every `drill.club_id` and `tactic.club_id`
at it, set `created_by` to the owning account. Nothing is deleted; drills'
jsonb content is untouched. (Standing rule remains: never re-run 013b/020b.)

## 5. Row-level security

The riskiest area of the whole rework; treated with the same discipline as
migrations 018/023.

- **New helpers**, `security definer`, alongside the existing (now-dormant)
  `is_team_member`/`is_team_owner`: `is_club_member(club_id)`,
  `is_club_admin(club_id)`, and `can_read_collection(collection_id)` (member
  grant in home club, OR grant + active license cross-club, OR admin of the
  collection's club).
- **`drill` / `tactic` select:** `is_club_admin(club_id)` OR
  `created_by = auth.uid()` OR the document is in a collection the caller
  `can_read_collection`.
- **Insert:** any club member, constrained to their own club and
  `created_by = auth.uid()`.
- **Update/delete:** admin of the club, or the creator. A drill assigned via
  collection is **read/use, not edit** — a coach can duplicate it into their
  own folder (the existing `duplicateDrill` action, now landing the copy in
  the coach's folder), but cannot modify the club's copy. Licensed material is
  read-only by construction: no write policy path exists for it.
- **Collections/grants/licenses:** club admin full control on their club's
  rows; a coach can read their own grants; a target-club admin can read
  licenses aimed at their club and create `collection_access` rows for their
  own coaches on licensed collections.
- **Share tokens (`/d/:token`, `/t/:token`):** policy shape untouched, but the
  full 018/023 probe suite is **re-run** after the policy rewrite (both
  conjuncts, cross-table sweep as anon, neighbouring-token negatives).
- **Storage (`drill-thumbnails`):** policies rewritten from team-visibility to
  club-visibility, keeping 019/024's `in (select ...)` shape — never a
  correlated subquery (`name`-shadowing trap, written twice already).
- **Dormant team tables:** their RLS stays exactly as it is — they are
  unreachable from the UI but remain correctly protected.
- **Verification protocol:** after every policy change, a SQL/HTTP probe pass
  as each persona (source admin, source coach, target admin, target coach,
  anon) recorded in the migration header, per house precedent.

## 6. Application changes

### 6.1 Store & routing plumbing

- New `clubSlice`: current club, my role, members, collections, grants,
  licenses; a club switcher for multi-club users (admins). `selectedClubId`
  persisted like `selectedTeamId` was, reconciled against the RLS-visible
  membership list on fetch; switching clubs clears club-scoped state.
- Role-aware shell: after login, membership + role resolve before the routed
  app renders. Admins get an **Admin** nav section; coaches see the library
  app. Drill/tactic fetches change from team-scoped to visibility-scoped (RLS
  does the filtering; the client just selects).
- **Shelving (§2.8) in the shell:** the team-scoped tab set and the
  coach-level Dashboard/Teams/Calendar tabs come out of `AppShell`; the
  signed-in app's nav becomes **Drill Library · Tactic Library (· Admin)**,
  with the drill library as the home route. The team-selection machinery
  (`selectedTeamId` and friends) stops driving anything active; the dormant
  slices and page components stay in the tree, unrouted.

### 6.2 Admin console (new `/admin` area)

Plain, token-compliant pages (design.md conventions; no new design system):

1. **Coaches** — list club members; create a coach login live (see §7);
   remove/downgrade membership.
2. **Collections** — CRUD; file drills *and* tactics in/out; per-coach grant
   toggles.
3. **Library** — the admin's all-of-club view of both libraries (the existing
   library components with an "everything + owner folder" lens).
4. **Licenses** — outgoing: grant a collection to another club, revoke;
   incoming: licensed collections received, with the same grant toggles to
   disperse to this club's coaches.
5. **Transfer** — pick a collection, "Copy to [other club I administer]".

### 6.3 Coach experience

The existing library surfaces, rescoped:

- Drill library and tactic library each show **"My drills/tactics"** (own
  folder) plus one group per granted collection; licensed collections carry a
  "Licensed" badge and open read-only (viewer/presentation affordances, no
  edit).
- Creating a drill/tactic lands it in the coach's folder.
- The tactic editor runs **roster-free** this cycle: the squad panel offers
  formations and generic squads (role + number labels) with all roster-binding
  UI hidden. This is also the state copied and licensed tactics arrive in.

### 6.4 Landing page removal

Delete `src/pages/landing/` and `src/lib/waitlist.ts`; `App.tsx`'s signed-out
branch returns to rendering `Login` at `/` (the `/login` route folds back
in; signed-in redirect logic simplifies accordingly). New migration drops
`early_access_signup`. `.claude/launch.json`'s `gaffer-landing` entry goes too.

## 7. Coach account provisioning

Creating a login requires the service-role key, so it cannot happen client-side.
A Supabase **Edge Function** `create-coach` takes email/password/display-name,
verifies the caller's JWT is an admin of the target club, creates the user via
the admin API, and inserts `club_member(role='coach')`. This is also a planned
demo moment: the admin creates a coach live on stage. (Email confirmation is
already disabled on the project, so the new login works immediately.)

## 8. Cross-club copy

`copy_collection_to_club(collection_id, target_club_id)` as a SQL function
(security definer, caller must be admin of **both** clubs): duplicates the
collection row and every member drill/tactic with new ids, `club_id = target`,
`created_by = caller`, tactic `team_id = null` and any legacy `player_id`
stripped from tactic scene entities (roster references would dangle across
clubs; squad numbers and roles are kept). Thumbnails are copied client-side
after the call via the existing download/upload path (demo-scale volumes; the
cut-line fallback is regenerate-on-open).

## 9. Licensing

- Grant: source admin picks a collection + target club → `club_license` row.
- Receive: target admin's Licenses page lists it; they disperse it via the
  standard `collection_access` toggles (§4.1's one-mechanism rule).
- Revoke: source admin sets `revoked_at`; every read across the target club
  dies at once (RLS-checked per query, no cleanup job needed).
- Read-only is structural (no write policies reach licensed rows), not a UI
  flag.

## 10. Demo seed & script

Two seeded clubs, all real logins (password auth), **no teams/rosters/sessions
needed** (§2.8):

- **FC Barcelona (demo)** — admin persona + two coach personas (U12, U18);
  four collections (e.g. "U12 Foundation", "U14 Passing Block", "U18
  Tactical", "First Team Pressing"); ~16 drills and ~4 tactics, built by
  duplicating/renaming existing scenes across age bands so the animations are
  real.
- **Riverside Academy** — same person as Barcelona's admin also admins here
  (the "second academy" story) + one coach login, initially near-empty.

Seed ships as a repeatable script (SQL + a thumbnail pass) so a botched
rehearsal can be reset. A one-page `DEMO_SCRIPT.md` narrates the arc: admin
tours the library → creates a coach live → logs in as U12 coach and sees only
their slice → copies a collection to Riverside → licenses another to
Riverside → Riverside's admin disperses it → revoke, access dies.

## 11. Schedule (8 working days → Fri 2026-09-04)

| Day | Work | Verify |
|---|---|---|
| D1 Aug 28 | Landing removal; shelve team-area routes/nav (§6.1); additive migration (clubs/collections/columns + backfill); RLS helpers + drill/tactic policies | build/lint; SQL probe suite incl. share-token re-probe |
| D2 Aug 29 | `clubSlice`, role routing, club switcher, library-centric shell; `create-coach` Edge Function | live login per persona; created coach can log in |
| D3 Aug 30 | Admin console: Coaches + Collections CRUD | live admin walkthrough |
| D4 Aug 31 | Filing drills/tactics into collections; per-coach grants; admin Library view | grant/revoke flips coach visibility live |
| D5 Sep 1 | Coach library rescope (both libraries), duplicate-into-folder, roster-free tactic editor; then gated `drill.team_id` drop | coach persona sees exactly folder+grants; dump + `pg_depend` before drop |
| D6 Sep 2 | Cross-club copy (function + Transfer UI, thumbnail copy) | copy lands editable in Riverside; source untouched |
| D7 Sep 3 | Licensing: grant/revoke, incoming view, dispersal; read-only surfaces | full license lifecycle live as all four personas |
| D8 Sep 4 | Seed both clubs, `DEMO_SCRIPT.md`, full rehearsal, polish pass, fix-ups | end-to-end demo run clean, fresh tab, zero console errors |

Shelving the team module (v2) removed the session-picker and roster-linkage
work that previously shared D5, so the schedule now carries real slack —
licensing is much less likely to hit its cut-line. **Cut-lines, in order:**
(1) thumbnail copy → regenerate-on-open; (2) licensing → demo copy live, show
licensing as the roadmap slide. Everything through D6 is the centerpiece and
is protected.

## 12. Risks & mitigations

- **RLS rewrite** is the largest risk (a leak here undercuts the very thing
  being pitched). Mitigation: helper-function reuse, per-persona probe suite
  after every change, share-token re-probe, storage-policy shape rule.
- **No test suite** (house reality): every phase ends with a live logged-in
  walkthrough per repo convention, plus `npm run build` + `npm run lint`.
- **`drill.team_id` drop is destructive**: gated, dumped, `pg_depend`-checked —
  and sequenced after the UI stops reading it (014/021 pattern).
- **Roster-free tactic editor** is new editor territory: scoped to hiding
  roster-binding UI while keeping formations/roles/numbers; verified against
  both a fresh tactic and a copied one.
- **Concurrent sessions** have collided in this repo before: every commit
  stages explicit paths; migration numbers are claimed at apply time.
- **Schedule pressure** concentrates in the admin console (most new UI):
  it stays functional-plain per design.md; polish waits for D8.

## 13. Roadmap (post-demo, recorded so the pitch can speak to them)

**Reinstate the team module under clubs** — teams/rosters/sessions/attendance
return as a club-scoped feature (`team.club_id` backfill happens then; tactic
roster-binding returns with it); billing/licensing commerce (paid licenses,
pricing tiers); finer license reach (per-coach targeting by the source club);
approval workflow for coach submissions to the club library; admin analytics
(usage per coach/collection); B2B marketing site (the removed landing's
successor); native apps — iOS via Capacitor over the existing PWA,
macOS/Windows via Tauri; multi-admin clubs with owner/admin distinction.
