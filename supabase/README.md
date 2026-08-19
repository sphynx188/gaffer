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

## Phase 0.5.2 — Re-enable RLS (DONE, 2026-08-19)

RLS was disabled table-by-table on 2026-08-18 as a temporary unblock after
every authenticated write (direct insert and RPC-wrapped) failed with
`42501`, even though the schema/policies checked out correct under manual SQL
simulation — see `gaffer_mvp_build_steps.md` Phase 0.5.2. The policies were
never dropped, so re-enabling was a flip, not a rebuild.

Re-enabling surfaced two real, separate bugs (both fixed, see migrations
005/006 below) — most importantly, `team_select_members` couldn't see a
team you'd just created (the auto-seed trigger that grants membership fires
*after* PostgREST's `RETURNING` is computed), so team creation silently
came back empty. Confirmed fixed with a real write from the app.

If this ever needs to be undone: `disable_rls.sql` (repo root) flips
straight back to the disabled state without touching policies or grants, so
re-running `004_reenable_rls.sql` → `005_...` → `006_...` (or just
`rls_policies.sql`, which reflects the same end state) afterward is a clean
re-apply.

## Migrations (post-launch schema changes)

`schema.sql` is only correct as-is for a *fresh* project. Once a project is
live, apply incremental changes from `migrations/`, in order, each run once
in the SQL editor:

- `002_player_position_tags.sql` — Phase 1 revision: `player.position`
  (single freeform text) → `player.positions` (multi-select tag array:
  goalkeeper/defender/midfielder/winger/striker). The old text is preserved
  in `player.position_legacy` rather than deleted, since old values like
  "CF" don't map cleanly onto the five fixed tags — re-tag each player once,
  then drop `position_legacy` whenever you're ready.
- `003_duplicate_session_rpc.sql` — Phase 3.2 (US-16): adds the
  `duplicate_session(source_session_id, new_date)` Postgres function, called
  via `supabase.rpc()` from `sessionSlice.duplicateSession`. Copies a
  session's `session_drills` line-up into a brand-new session row as one
  transaction (all-or-nothing); does not copy `availability` (the client
  seeds fresh `unconfirmed` rows for the new date instead) and creates no
  new "template" entity. Runs as the caller (no `security definer`), so it's
  authorized entirely by the existing `session_all_members` /
  `session_drills_all_members` RLS policies — a coach can only duplicate a
  session on a team they belong to.
- `004_reenable_rls.sql` — Phase 0.5.2: re-enables RLS on all 8 tables
  (disabled 2026-08-18 as a temporary unblock) and tightens the `anon`
  grant on the `security definer` helper functions. Paired rollback:
  `disable_rls.sql` at the repo root.
- `005_fix_team_select_bootstrap_race.sql` — Phase 0.5.2 follow-up:
  `team_select_members` couldn't see a team immediately after you created
  it (membership isn't seeded until the `on_team_created` trigger fires,
  which happens after PostgREST's `RETURNING` is computed). Adds
  `or owner_id = auth.uid()` to the select policy, mirroring the same
  exception the insert policy already needed.
- `006_optimize_team_policy_auth_calls.sql` — Phase 0.5.2 follow-up:
  performance-only change, wraps `auth.uid()` as `(select auth.uid())` in
  the two `team` policies per the Supabase performance advisor
  (`auth_rls_initplan`).

Note: `rls_test.sql` and `sanity_check.sql` were updated alongside
`004_reenable_rls.sql` to insert into `positions` (array) instead of the
now-renamed `position` column — they were still using the pre-migration-002
column name and would have errored as written.
