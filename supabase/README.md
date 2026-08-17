# Supabase setup (Phases 0.2–0.3)

Manual steps (need your Supabase account — can't be scripted from here):

1. Create a new Supabase project at supabase.com/dashboard (free tier). Note
   the pause-after-~1-week-inactivity gotcha and bookmark the project's
   dashboard resume page.
2. Open SQL Editor → New query, paste in `schema.sql` from this folder, run
   it once. This creates all 8 tables, the 3 enums, FK indexes, RLS turned
   on (no policies yet), and the `team_coaches` auto-seed trigger.
3. Sanity check: still in the SQL editor (it runs as the privileged
   `postgres` role, so RLS being on doesn't block this), insert one row into
   `team` manually (any `owner_id`, e.g. a throwaway uuid for now — real auth
   wiring is 0.5) and confirm a matching row appears in `team_coaches`
   automatically. Insert one row per remaining table to confirm no
   constraint errors.
4. Project Settings → API → copy the Project URL and anon public key.
5. In `gaffer/`, copy `.env.example` to `.env.local` and paste those two
   values in.

Definition of Done for 0.2 (per the build guide): all 8 tables exist with
correct types/enums/FKs, and one row per table can be inserted from the SQL
editor without constraint errors.

## Phase 0.3 — RLS policies

`schema.sql` turns RLS on for all 8 tables but adds zero policies, which
means every table is locked down to everyone via the app (anon/authenticated
keys get nothing) until this step is done.

1. Open SQL Editor → New query, paste in `rls_policies.sql` from this
   folder, run it once (same project, after `schema.sql`). This adds two
   `security definer` helper functions (`is_team_member`, `is_team_owner`)
   and a policy per table, all written as `team_coaches` membership checks —
   never `team.owner_id` — so a future multi-coach invite flow only needs UI
   work, not new policies.
2. Test it: Authentication → Users → Add user, twice (any throwaway
   email/password — the SQL editor doesn't care that the real app uses
   magic-link). Then run `rls_test.sql`, which seeds two independent teams
   and uses the SQL editor's JWT-impersonation trick to confirm you only see
   your own team's rows, never the other one's.
3. Known gap, not blocking for MVP: `drill.team_id` can be null
   ("coach-owned", reusable across teams per build guide 2d), but there's no
   `owner_id` column on `drill` to scope *which* coach owns an unscoped one.
   The policy currently lets any authenticated user read/write
   `team_id is null` drills — fine at one coach, needs revisiting (add
   `owner_id`) before a second coach who isn't on every team joins.

Definition of Done for 0.3 (per the build guide): RLS is on for all 8
tables; `rls_test.sql` confirms a second user's team/player rows are
invisible when impersonating the first user.
