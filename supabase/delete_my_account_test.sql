-- delete_my_account_test.sql — the SQL tests for migration 042, i.e. the Exit
-- check of gaffer-ios-build-plan.md stage 14 (referenced by the macOS plan's
-- stage 14). Run it in the SQL editor, or through the Supabase MCP server, as
-- one statement.
--
-- ── It cannot leave anything behind ─────────────────────────────────────────
--
-- The block ALWAYS ends by raising `delete_my_account tests passed`, which
-- aborts the surrounding transaction and rolls every seeded row back. That is
-- the pass condition: seeing that exact error means every assertion below held.
-- ANY OTHER error is a real failure. The sentinel is deliberate rather than a
-- trailing `rollback;` — this file seeds throwaway `auth.users` rows and calls a
-- function whose job is deleting accounts, so "nothing persists" must not depend
-- on the caller remembering to wrap it, or on how a client batches statements.
--
-- Same caveat as `rls_test.sql`: impersonation here is `set_config` on
-- `request.jwt.claims`, not PostgREST's real JWT path. `delete_my_account` is
-- SECURITY DEFINER, so the session ROLE is irrelevant to how it behaves — the
-- only thing it takes from the session is `auth.uid()` — but a clean pass here
-- is still necessary rather than sufficient, and stage 15 wires the real call.
do $$
declare
  u_admin_a  uuid := gen_random_uuid();  -- sole admin of a club that has a coach in it
  u_coach    uuid := gen_random_uuid();  -- that coach; owns a legacy team
  u_admin_b  uuid := gen_random_uuid();  -- sole admin AND sole member of their own club
  u_admin_d  uuid := gen_random_uuid();  -- for the delete_club regression
  c_a uuid; c_b uuid; c_d uuid;
  t_legacy uuid;
  p_player uuid;
  d_teamed uuid; d_plain uuid; d_b uuid; d_d uuid;
  tac_teamed uuid;
  n int; msg text; hint_out text;
begin
  -- ── Seed ──────────────────────────────────────────────────────────────────
  insert into auth.users (id, email) values
    (u_admin_a, 'test-admin-a@example.invalid'),
    (u_coach,   'test-coach@example.invalid'),
    (u_admin_b, 'test-admin-b@example.invalid'),
    (u_admin_d, 'test-admin-d@example.invalid');

  insert into public.club (name) values ('Test Club A') returning id into c_a;
  insert into public.club (name) values ('Test Club B') returning id into c_b;
  insert into public.club (name) values ('Test Club D') returning id into c_d;

  insert into public.club_member (club_id, user_id, role) values
    (c_a, u_admin_a, 'admin'),
    (c_a, u_coach,   'coach'),
    (c_b, u_admin_b, 'admin'),
    (c_d, u_admin_d, 'admin');

  -- The legacy shape this migration exists for: a team the coach owns, with a
  -- drill and a tactic still carrying its `team_id` (027 demoted that column
  -- but did not drop it, and `drill.team_id`/`tactic.team_id` cascade off
  -- `team`). This is the pair that would vanish if the function deleted the
  -- team without severing the link first.
  -- No explicit `team_coaches` row: 004's `handle_new_team` trigger inserts the
  -- owner's, and (team_id, user_id) is unique — adding one by hand is a 23505.
  insert into public.team (name, owner_id) values ('Test U12 Legacy', u_coach)
    returning id into t_legacy;
  if not exists (select 1 from public.team_coaches
                 where team_id = t_legacy and user_id = u_coach) then
    raise exception 'SETUP: expected handle_new_team to seed the owner''s team_coaches row';
  end if;
  insert into public.player (team_id, name) values (t_legacy, 'Test Player')
    returning id into p_player;
  insert into public.player_notes (player_id, author_id, body)
    values (p_player, u_coach, 'test note');

  insert into public.drill (name, club_id, created_by, team_id)
    values ('Coach drill with a team', c_a, u_coach, t_legacy) returning id into d_teamed;
  insert into public.drill (name, club_id, created_by)
    values ('Coach drill, club-only', c_a, u_coach) returning id into d_plain;
  insert into public.tactic (name, club_id, created_by, team_id, sides)
    values ('Coach tactic with a team', c_a, u_coach, t_legacy,
            '{"home":{"formation":"4-3-3","color":"#111","teamId":null},
              "away":{"formation":"4-4-2","color":"#222","teamId":null}}'::jsonb)
    returning id into tac_teamed;
  insert into public.drill (name, club_id, created_by) values ('B drill', c_b, u_admin_b)
    returning id into d_b;
  insert into public.drill (name, club_id, created_by) values ('D drill', c_d, u_admin_d)
    returning id into d_d;

  -- An invite the coach created, and one an admin addressed TO the coach.
  insert into public.club_invite (token, club_id, created_by, invited_email)
    values ('t' || replace(gen_random_uuid()::text, '-', ''), c_a, u_coach, null);
  insert into public.club_invite (token, club_id, created_by, invited_email)
    values ('t' || replace(gen_random_uuid()::text, '-', ''), c_a, u_admin_a,
            'test-coach@example.invalid');

  -- ── 1. A sole admin with other members is REFUSED ─────────────────────────
  perform set_config('request.jwt.claims',
    json_build_object('sub', u_admin_a, 'role', 'authenticated')::text, true);
  begin
    perform public.delete_my_account();
    raise exception 'FAIL 1: the sole admin of a club with a coach in it was allowed to delete';
  exception when others then
    get stacked diagnostics msg = message_text, hint_out = pg_exception_hint;
    if msg like 'FAIL 1:%' then raise; end if;
    if msg not like '%only admin of Test Club A%' then
      raise exception 'FAIL 1: wrong refusal message: %', msg;
    end if;
    if hint_out is distinct from 'sole_admin' then
      raise exception 'FAIL 1: expected hint sole_admin, got %', coalesce(hint_out, '<null>');
    end if;
  end;
  if not exists (select 1 from auth.users where id = u_admin_a) then
    raise exception 'FAIL 1: a refused delete still removed the account';
  end if;

  -- ── 2. Deleting a coach keeps their boards readable by the club ───────────
  perform set_config('request.jwt.claims',
    json_build_object('sub', u_coach, 'role', 'authenticated')::text, true);
  perform public.delete_my_account();

  if exists (select 1 from auth.users where id = u_coach) then
    raise exception 'FAIL 2: the coach''s auth user survived';
  end if;
  if exists (select 1 from public.club_member where user_id = u_coach) then
    raise exception 'FAIL 2: a club_member row survived';
  end if;

  -- The whole point: both boards are still there, still owned by the club.
  if not exists (select 1 from public.drill where id = d_teamed and club_id = c_a) then
    raise exception 'FAIL 2: the drill that carried team_id was destroyed by the team cascade';
  end if;
  if not exists (select 1 from public.tactic where id = tac_teamed and club_id = c_a) then
    raise exception 'FAIL 2: the tactic that carried team_id was destroyed by the team cascade';
  end if;
  if not exists (select 1 from public.drill where id = d_plain and club_id = c_a) then
    raise exception 'FAIL 2: the club-only drill was destroyed';
  end if;
  -- Severed, not dangling: the vestigial link is gone, the live one is intact.
  if (select team_id from public.drill where id = d_teamed) is not null then
    raise exception 'FAIL 2: drill.team_id was not severed';
  end if;
  if (select team_id from public.tactic where id = tac_teamed) is not null then
    raise exception 'FAIL 2: tactic.team_id was not severed';
  end if;
  -- created_by intentionally still points at the departed uuid (no FK), which
  -- is what keeps the row readable rather than orphaning it.
  if (select created_by from public.drill where id = d_teamed) <> u_coach then
    raise exception 'FAIL 2: created_by was rewritten';
  end if;

  -- The shelved module's own rows went with them.
  if exists (select 1 from public.team where id = t_legacy) then
    raise exception 'FAIL 2: the owned team survived and would block the auth delete';
  end if;
  if exists (select 1 from public.player_notes where author_id = u_coach) then
    raise exception 'FAIL 2: their player notes survived';
  end if;
  if exists (select 1 from public.team_coaches where user_id = u_coach) then
    raise exception 'FAIL 2: a team_coaches row survived and would block the auth delete';
  end if;

  -- Their own invite is gone; the one an ADMIN addressed to them is not.
  if exists (select 1 from public.club_invite where created_by = u_coach) then
    raise exception 'FAIL 2: an invite they created survived';
  end if;
  select count(*) into n from public.club_invite
    where club_id = c_a and invited_email = 'test-coach@example.invalid';
  if n <> 1 then
    raise exception 'FAIL 2: the admin''s invite addressed to them was deleted (found %)', n;
  end if;

  -- ── 3. The same admin is now free to leave ────────────────────────────────
  -- The guard is about who is still in the room, not a standing flag on the
  -- account: with the coach gone, club A has one member and one admin.
  perform set_config('request.jwt.claims',
    json_build_object('sub', u_admin_a, 'role', 'authenticated')::text, true);
  perform public.delete_my_account();
  if exists (select 1 from auth.users where id = u_admin_a) then
    raise exception 'FAIL 3: the last member of a club was still refused';
  end if;

  -- ── 4. A sole admin with no other members succeeds, club and boards stay ──
  perform set_config('request.jwt.claims',
    json_build_object('sub', u_admin_b, 'role', 'authenticated')::text, true);
  perform public.delete_my_account();
  if exists (select 1 from auth.users where id = u_admin_b) then
    raise exception 'FAIL 4: a sole admin with no other members was refused';
  end if;
  if not exists (select 1 from public.club where id = c_b) then
    raise exception 'FAIL 4: the club was deleted along with its last member';
  end if;
  if not exists (select 1 from public.drill where id = d_b and club_id = c_b) then
    raise exception 'FAIL 4: the club''s drill was deleted along with its last member';
  end if;

  -- ── 5. The club's own delete path still works ─────────────────────────────
  perform set_config('request.jwt.claims',
    json_build_object('sub', u_admin_d, 'role', 'authenticated')::text, true);
  perform public.delete_club(c_d);
  if exists (select 1 from public.club where id = c_d) then
    raise exception 'FAIL 5: delete_club left the club behind';
  end if;
  if exists (select 1 from public.drill where id = d_d) then
    raise exception 'FAIL 5: delete_club left the club''s drill behind';
  end if;

  raise exception 'delete_my_account tests passed';
end $$;
