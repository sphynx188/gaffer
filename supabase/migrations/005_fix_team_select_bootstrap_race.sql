-- Migration 005 — Fix team_select_members bootstrap race
--
-- Found while rechecking rls_policies.sql after re-enabling RLS (004).
--
-- team_select_members only allowed `is_team_member(id)`, which requires a
-- team_coaches row — but that row is seeded by the on_team_created AFTER
-- INSERT trigger, which fires *after* PostgREST's RETURNING clause is
-- already computed for the INSERT command. So a freshly created team is
-- genuinely inserted, but RLS's SELECT-visibility check on RETURNING can't
-- see it yet (no team_coaches row exists at that instant) — the row is
-- silently omitted from the response. teamSlice.createTeam does
-- `.insert({...}).select()` (array mode, no `.single()`), so this doesn't
-- surface as a thrown error — it comes back as an empty array where a new
-- team was expected, and the UI silently fails to show the team you just
-- created.
--
-- Same "insert is the one necessary exception" reasoning the original
-- comment already applied to the INSERT policy: allow the row's own
-- owner_id to satisfy SELECT immediately, same as it does for INSERT's
-- WITH CHECK. This does not weaken the policy — it only ever grants a row
-- back to the exact user who owns it, everything else still requires real
-- team_coaches membership.

drop policy if exists "team_select_members" on team;

create policy "team_select_members" on team
  for select using (is_team_member(id) or owner_id = auth.uid());
