-- supabase/tests/046_collections_tags_test.sql
-- Assertions for migration 046 (drill collections and tags). Run the whole
-- file through the Supabase MCP execute_sql tool. Everything happens inside
-- one transaction that is ROLLED BACK — the probe collection, drill and tag
-- links it creates never persist.
--
-- Persona switching follows 028's header: set_config('request.jwt.claims')
-- then `set local role`. Uses "FC Barcelona (demo)": 1 admin, 2 coaches.
-- Success: the final select returns result = 'passed'. Failure: an error
-- whose message starts with the check id (T1…T16).

begin;

do $$
declare
  cid uuid; admin_id uuid; coach1 uuid; coach2 uuid;
  other_club uuid; other_col uuid; tactic_col uuid; secret_col uuid;
  probe uuid; admin_drill uuid; tag uuid; other_tag uuid; unc uuid;
  n int; ok boolean;
begin
  -- ── Setup, as postgres ────────────────────────────────────────────────
  select id into cid from public.club where name = 'FC Barcelona (demo)';
  select user_id into admin_id from public.club_member where club_id = cid and role = 'admin' order by created_at limit 1;
  select user_id into coach1 from public.club_member where club_id = cid and role <> 'admin' order by created_at limit 1;
  select user_id into coach2 from public.club_member where club_id = cid and role <> 'admin' order by created_at offset 1 limit 1;
  select id into other_club from public.club where id <> cid order by created_at limit 1;
  select id into other_col from public.collection where club_id = other_club and kind = 'drill' limit 1;
  select id into other_tag from public.club_tag where club_id = other_club limit 1;
  select id into tactic_col from public.collection where club_id = cid and kind = 'tactic' limit 1;
  select id into tag from public.club_tag where club_id = cid order by name limit 1;
  select id into admin_drill from public.drill where club_id = cid and created_by = admin_id limit 1;

  if cid is null or admin_id is null or coach1 is null or coach2 is null then
    raise exception 'T0 fixture: FC Barcelona (demo) needs an admin and two coaches';
  end if;

  -- A drill collection no coach has been granted.
  insert into public.collection (club_id, name, kind, created_by)
    values (cid, 'zz rls probe', 'drill', admin_id) returning id into secret_col;

  -- Starter set landed.
  select count(*) into n from public.collection
    where club_id = cid and kind = 'drill' and name in ('1v1','2v1','2v2','3v2','3v3','4v4','Rondo','Possession','Small-sided game','Passing','Finishing','Warm-up','Goalkeeping');
  if n <> 13 then raise exception 'T1 starter collections: expected 13, got %', n; end if;
  select count(*) into n from public.club_tag where club_id = cid and name in ('Back to goal','1v1 to shoot','Wide areas');
  if n <> 3 then raise exception 'T1 starter tags missing, got %', n; end if;

  -- Every drill has a collection.
  select count(*) into n from public.drill where collection_id is null;
  if n <> 0 then raise exception 'T2 % drills without a collection', n; end if;

  -- ── As coach1 ─────────────────────────────────────────────────────────
  perform set_config('request.jwt.claims', json_build_object('sub', coach1, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';

  if not exists (select 1 from public.club_drill_collections(cid) where id = secret_col) then
    raise exception 'T3 picker RPC does not list an ungranted collection';
  end if;
  if exists (select 1 from public.club_drill_collections(other_club)) then
    raise exception 'T4 picker RPC leaked another club''s collections';
  end if;
  if exists (select 1 from public.collection where id = secret_col) then
    raise exception 'T5 coach can read an ungranted collection row';
  end if;

  insert into public.drill (club_id, name, created_by, collection_id)
    values (cid, 'zz rls probe drill', coach1, secret_col) returning id into probe;
  if not exists (select 1 from public.drill where id = probe) then
    raise exception 'T6 coach cannot read their own drill filed in an ungranted collection';
  end if;

  insert into public.drill_tag (drill_id, tag_id) values (probe, tag);
  if not exists (select 1 from public.drill_tag where drill_id = probe) then
    raise exception 'T7 coach cannot tag their own drill';
  end if;

  ok := false;
  begin update public.drill set collection_id = tactic_col where id = probe; exception when others then ok := true; end;
  if tactic_col is not null and not ok then raise exception 'T8 drill accepted a tactic collection'; end if;

  ok := false;
  begin update public.drill set collection_id = other_col where id = probe; exception when others then ok := true; end;
  if other_col is not null and not ok then raise exception 'T9 drill accepted another club''s collection'; end if;

  ok := false;
  begin insert into public.drill_tag (drill_id, tag_id) values (probe, other_tag); exception when others then ok := true; end;
  if other_tag is not null and not ok then raise exception 'T10 drill accepted another club''s tag'; end if;

  if admin_drill is not null then
    update public.drill set collection_id = secret_col where id = admin_drill;
    get diagnostics n = row_count;
    if n <> 0 then raise exception 'T11 coach moved someone else''s drill'; end if;
  end if;

  ok := false;
  begin insert into public.club_tag (club_id, name) values (cid, 'zz coach tag'); exception when others then ok := true; end;
  if not ok then raise exception 'T12 coach created a club tag'; end if;

  -- ── As coach2 ─────────────────────────────────────────────────────────
  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub', coach2, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';

  if exists (select 1 from public.drill where id = probe) or exists (select 1 from public.drill_tag where drill_id = probe) then
    raise exception 'T13 another coach sees a drill in a collection they were not granted';
  end if;

  -- ── As the admin ──────────────────────────────────────────────────────
  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub', admin_id, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';

  if not exists (select 1 from public.drill where id = probe) then
    raise exception 'T14 admin cannot see a coach''s drill';
  end if;

  perform public.delete_drill_collection(secret_col);
  select c.id into unc from public.collection c where c.club_id = cid and c.is_uncategorised;
  if (select collection_id from public.drill where id = probe) is distinct from unc then
    raise exception 'T15 deleting a collection did not move its drill to Uncategorised';
  end if;
  update public.collection set name = 'Renamed' where id = unc;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'T15 admin renamed Uncategorised'; end if;

  -- ── As anon ───────────────────────────────────────────────────────────
  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  execute 'set local role anon';

  ok := false;
  begin perform 1 from public.club_tag limit 1; exception when others then ok := true; end;
  if not ok and exists (select 1 from public.club_tag) then raise exception 'T16 anon reads club_tag'; end if;
  ok := false;
  begin perform 1 from public.drill_tag limit 1; exception when others then ok := true; end;
  if not ok and exists (select 1 from public.drill_tag) then raise exception 'T16 anon reads drill_tag'; end if;
  ok := false;
  begin perform 1 from public.club_drill_collections(cid); exception when others then ok := true; end;
  if not ok then raise exception 'T16 anon can call club_drill_collections'; end if;

  execute 'reset role';
end $$;

select 'passed' as result;

rollback;
