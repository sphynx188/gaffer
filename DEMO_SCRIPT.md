# Demo script — club tenancy & library platform

For the pitch demo (target: Friday 2026-09-04). Two seeded clubs, four real
logins, real RLS enforcing every visibility rule shown on stage — nothing
here is faked client-side.

## Personas

| Role | Email | Password |
|---|---|---|
| Barca admin (also admins Riverside) | `barca.admin@gafferdemo.app` | `BarcaAdmin2026!` |
| U12 coach | `barca.u12@gafferdemo.app` | `BarcaU12Coach2026!` |
| U18 coach | `barca.u18@gafferdemo.app` | `BarcaU18Coach2026!` |
| Riverside coach | `riverside.coach@gafferdemo.app` | `RiversideCoach2026!` |

Clubs: **FC Barcelona (demo)** (4 collections: U12 Foundation, U14 Passing
Block, U18 Tactical, First Team Pressing — ~16 drills, 2 tactics) and
**Riverside Academy** (near-empty — the "second academy" story).

## The arc

1. **Sign in as the Barca admin.** Tour both libraries — Drill Library and
   Tactic Library each show every collection as a folder (admin sees
   everything in the club), plus every coach's own creations grouped
   separately. This is the "the library is the product" beat.

2. **`/admin/coaches`** — create a coach live, on stage. Fill in a display
   name, a real email, a password; submit. New login works immediately (no
   email confirmation step — disabled on the project).

3. **`/admin/collections`** — pick a collection (e.g. "U12 Foundation"),
   grant it to the coach just created via the "Coach access" toggle at the
   bottom of the page.

4. **Sign in as the U12 coach.** Their library shows exactly their granted
   collections — nothing from other collections, nothing another coach
   created. Open a drill read-only (the card routes straight to the
   viewer, not the editor, since this coach didn't create it and isn't
   admin), play its animation.

5. **Duplicate that drill** ("Duplicate to my drills") — lands as a real,
   independent, editable copy in the coach's own folder.

6. **The coach creates a drill of their own** (`+ New drill` → `/design`).
   It lands in their folder — invisible to any other coach, visible to the
   admin (who sees every coach's folder).

7. **Back as the admin — Transfer.** `/admin/transfer`: pick "U14 Passing
   Block", copy it to Riverside Academy. Switch clubs (the header
   dropdown) — Riverside's library now shows the copy, fully editable, with
   no roster/team references carried over.

8. **Licenses.** `/admin/licenses`: license "First Team Pressing" to
   Riverside Academy. Switch to Riverside, disperse the incoming license to
   Riley (the Riverside coach) via the same per-coach toggle Collections
   uses. Sign in as Riley — their library shows the licensed group with a
   "Licensed" badge, read-only (no edit path — structurally enforced by
   RLS, not a UI restriction).

9. **Revoke at the source.** Back as the admin (Barca side), revoke the
   license. Riley's next reload: the licensed group is gone. Anything Riley
   already duplicated stays — revocation only kills the license, not
   copies already made.

## Reset between rehearsals

Deletes both demo clubs (drill/tactic rows aren't `on delete cascade` off
`club`, so they're deleted explicitly first — everything else cascades),
then re-runs the two seed steps.

```sql
-- via Supabase MCP execute_sql
delete from drill where club_id in (
  select id from club where name in ('FC Barcelona (demo)', 'Riverside Academy'));
delete from tactic where club_id in (
  select id from club where name in ('FC Barcelona (demo)', 'Riverside Academy'));
delete from club where name in ('FC Barcelona (demo)', 'Riverside Academy');
```

```bash
node --env-file=.env.local scripts/seed-demo-users.mjs   # idempotent, safe to re-run
```

Then re-run `scripts/seed-demo.sql` via `execute_sql` (its own existence
check on `'FC Barcelona (demo)'` means it's a no-op unless the clubs were
actually deleted first).
