-- Migration 006 — Wrap auth.uid() in (select ...) for the two team policies
-- that call it directly (performance advisor: auth_rls_initplan)
--
-- team_insert_self_owner and team_select_members call auth.uid() directly
-- in their USING/WITH CHECK expressions, which Postgres re-evaluates once
-- per row instead of once per statement. Wrapping it as
-- (select auth.uid()) lets the planner treat it as an initplan, evaluated
-- once per statement — same access semantics, just faster at scale. See
-- https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select
--
-- The is_team_member/is_team_owner-backed policies elsewhere in
-- rls_policies.sql aren't affected by this lint, since their auth.uid()
-- call happens inside a `stable` SQL function rather than inline in the
-- policy expression.

drop policy if exists "team_insert_self_owner" on team;
create policy "team_insert_self_owner" on team
  for insert with check (owner_id = (select auth.uid()));

drop policy if exists "team_select_members" on team;
create policy "team_select_members" on team
  for select using (is_team_member(id) or owner_id = (select auth.uid()));
