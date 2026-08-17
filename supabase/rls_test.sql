-- Phase 0.3 RLS test — run after rls_policies.sql, in the SQL editor.
-- Confirms build guide 0.3's Definition of Done: "a manual test ... confirms
-- cross-team rows are invisible."
--
-- Prerequisite: at least two users exist in auth.users — Authentication ->
-- Users -> Add user, twice (any email/password, throwaway, since the real
-- app uses magic-link but the SQL editor doesn't care how a user got there).
--
-- No manual copy-pasting of uuids required — each impersonation block below
-- looks up the two oldest auth.users rows itself and stashes them in
-- transaction-local settings. Run each numbered step's block as one
-- statement (select the whole block, including its `begin;`/`rollback;`,
-- and run that selection) rather than the whole file at once — the file
-- mixes DDL/DML that only makes sense run in order, one block at a time.
--
-- This has been dry-run end-to-end against a real Postgres instance with a
-- stand-in `auth` schema (not just eyeballed) — the BEGIN/SET LOCAL/ROLLBACK
-- pattern below is what actually scopes auth.uid() correctly. A plain `SET
-- ROLE` / `SELECT set_config(..., false)` without the surrounding
-- transaction can silently no-op depending on how the SQL editor batches
-- statements, so don't simplify this away.

-- ── Step 1: seed two independent teams as postgres (RLS bypassed) ─────────

do $$
declare
  v_user_a uuid;
  v_user_b uuid;
  v_team_a uuid;
  v_team_b uuid;
begin
  select id into v_user_a from auth.users order by created_at limit 1;
  select id into v_user_b from auth.users order by created_at offset 1 limit 1;

  if v_user_a is null or v_user_b is null then
    raise exception 'Need at least two users in auth.users — Authentication -> Users -> Add user, twice.';
  end if;

  insert into team (name, format, owner_id)
    values ('RLS Test — Team A', '11v11', v_user_a) returning id into v_team_a;
  insert into team (name, format, owner_id)
    values ('RLS Test — Team B', 'small_sided', v_user_b) returning id into v_team_b;

  insert into player (team_id, name, position) values (v_team_a, 'Player A1', 'CB');
  insert into player (team_id, name, position) values (v_team_b, 'Player B1', 'ST');

  raise notice 'user_a=%  team_a=%  |  user_b=%  team_b=%', v_user_a, v_team_a, v_user_b, v_team_b;
end $$;

-- ── Step 2: impersonate the older user (A) and confirm read scoping ───────
-- Run this whole block (begin ... rollback) as one selection.

begin;

do $$
declare
  v_user_a uuid;
begin
  select id into v_user_a from auth.users order by created_at limit 1;
  perform set_config('request.jwt.claims', json_build_object('sub', v_user_a, 'role', 'authenticated')::text, true);
end $$;

set local role authenticated;

select name from team order by name;     -- expect: 'RLS Test — Team A' only (plus any of your own real teams) — never 'Team B'
select name from player order by name;   -- expect: 'Player A1' only — never 'Player B1'

rollback;

-- If 'RLS Test — Team B' or 'Player B1' shows up in either result above,
-- the policies are not scoping correctly — stop and debug before building
-- on top of this.

-- ── Step 3: impersonate user A and confirm the insert check rejects a team
-- owned by someone else (this is the one policy that isn't a membership
-- check, so it's worth testing on its own) ────────────────────────────────
-- Run this whole block as one selection too.

begin;

do $$
declare
  v_user_a uuid;
  v_user_b uuid;
begin
  select id into v_user_a from auth.users order by created_at limit 1;
  select id into v_user_b from auth.users order by created_at offset 1 limit 1;
  perform set_config('request.jwt.claims', json_build_object('sub', v_user_a, 'role', 'authenticated')::text, true);
  perform set_config('app.rls_test_user_b', v_user_b::text, true);
end $$;

set local role authenticated;

-- expect: ERROR — "new row violates row-level security policy for table team"
insert into team (name, format, owner_id)
  values ('Sneaky Team', '11v11', current_setting('app.rls_test_user_b')::uuid);

rollback;

-- If that insert succeeds instead of erroring, stop and debug before
-- building on top of this.

-- ── Step 4: cleanup ─────────────────────────────────────────────────────
-- Uncomment and run once you've confirmed both tests above passed. Cascades
-- through player via the FK.

-- delete from team where name like 'RLS Test — Team %';
