-- 046_drill_collections_and_tags.sql — every drill in exactly one collection,
-- plus club-wide tags (spec docs/superpowers/specs/2026-10-28-drill-collections-and-tags-design.md).
--
-- Additive and backward-compatible on purpose. 047 drops collection_drill and
-- drill.category/subcategory once the client that reads drill.collection_id is
-- deployed; until then a client from before this migration still works,
-- because drill_collection_guard files a drill inserted with no collection
-- into the club's Uncategorised instead of failing the NOT NULL.
--
-- Coaches may file their OWN drill into ANY drill collection of their club,
-- including ones they were never granted (spec decision): the guard trigger
-- only checks the collection is in the drill's club and is drill-kind, and is
-- security definer so it can see collections the caller's RLS hides.

-- ── Uncategorised ─────────────────────────────────────────────────────────
alter table public.collection add column is_uncategorised boolean not null default false;
create unique index collection_one_uncategorised_per_club on public.collection (club_id) where is_uncategorised;

-- ── Tags ──────────────────────────────────────────────────────────────────
create table public.club_tag (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.club(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 40),
  created_at timestamptz not null default now()
);
create unique index club_tag_club_name_key on public.club_tag (club_id, lower(name));

create table public.drill_tag (
  drill_id uuid not null references public.drill(id) on delete cascade,
  tag_id uuid not null references public.club_tag(id) on delete cascade,
  primary key (drill_id, tag_id)
);
create index drill_tag_tag_id_idx on public.drill_tag (tag_id);

alter table public.club_tag enable row level security;
alter table public.drill_tag enable row level security;

-- ── The drill's collection ────────────────────────────────────────────────
alter table public.drill add column collection_id uuid references public.collection(id) on delete restrict;
create index drill_collection_id_idx on public.drill (collection_id);

-- ── Internal helpers (no client grants) ───────────────────────────────────
create or replace function public.seed_drill_starter_set(cid uuid, creator uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  insert into public.collection (club_id, name, kind, created_by)
  select cid, n, 'drill', creator
  from unnest(array['1v1','2v1','2v2','3v2','3v3','4v4','Rondo','Possession',
                    'Small-sided game','Passing','Finishing','Warm-up','Goalkeeping']) as n
  where not exists (select 1 from public.collection c
                    where c.club_id = cid and c.kind = 'drill' and lower(c.name) = lower(n));

  insert into public.club_tag (club_id, name)
  select cid, n
  from unnest(array['Back to goal','1v1 to pass','1v1 to shoot','1v1 to beat','Turning','Receiving',
                    'First touch','Dribbling','Combination play','Crossing','Pressing','Counter-attack',
                    'Transition','Overloads','Wide areas','Defending']) as n
  on conflict (club_id, lower(name)) do nothing;
end $$;
revoke execute on function public.seed_drill_starter_set(uuid, uuid) from public, anon, authenticated;

-- The club's Uncategorised, created the first time something needs it.
create or replace function public.uncategorised_collection(cid uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare col uuid; creator uuid;
begin
  select id into col from public.collection where club_id = cid and is_uncategorised;
  if col is not null then return col; end if;
  select coalesce(
    (select user_id from public.club_member where club_id = cid and role = 'admin' order by created_at limit 1),
    (select auth.uid())
  ) into creator;
  insert into public.collection (club_id, name, kind, created_by, is_uncategorised)
    values (cid, 'Uncategorised', 'drill', creator, true)
    returning id into col;
  return col;
end $$;
revoke execute on function public.uncategorised_collection(uuid) from public, anon, authenticated;

-- ── Seed every existing club ──────────────────────────────────────────────
do $$
declare r record;
begin
  for r in
    select c.id,
           (select m.user_id from public.club_member m
             where m.club_id = c.id and m.role = 'admin' order by m.created_at limit 1) as admin_id
    from public.club c
  loop
    if r.admin_id is not null then perform public.seed_drill_starter_set(r.id, r.admin_id); end if;
  end loop;
end $$;

-- ── Backfill collection_id ────────────────────────────────────────────────
-- Preflight (plan Task 2 Step 1) confirmed: no drill is in two collections and
-- no link crosses clubs or kinds.
update public.drill d set collection_id = cd.collection_id
  from public.collection_drill cd where cd.drill_id = d.id;
update public.drill d set collection_id = public.uncategorised_collection(d.club_id)
  where d.collection_id is null;

-- ── Guards ────────────────────────────────────────────────────────────────
create or replace function public.drill_collection_guard()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  -- Transitional until 047: a pre-046 client inserts without a collection.
  if new.collection_id is null then
    new.collection_id := public.uncategorised_collection(new.club_id);
  end if;
  if not exists (select 1 from public.collection c
                 where c.id = new.collection_id and c.club_id = new.club_id and c.kind = 'drill') then
    raise exception 'That collection isn''t part of this club.';
  end if;
  return new;
end $$;
create trigger drill_collection_guard
  before insert or update of collection_id, club_id on public.drill
  for each row execute function public.drill_collection_guard();

alter table public.drill alter column collection_id set not null;

create or replace function public.drill_tag_guard()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.drill d join public.club_tag t on t.club_id = d.club_id
                 where d.id = new.drill_id and t.id = new.tag_id) then
    raise exception 'That tag isn''t part of this club.';
  end if;
  return new;
end $$;
create trigger drill_tag_guard
  before insert or update on public.drill_tag
  for each row execute function public.drill_tag_guard();

-- ── Old free-text category/subcategory become tags ────────────────────────
-- Skips values that name one of the club's drill collections ("3v2"), which
-- would only duplicate the collection as a tag.
insert into public.club_tag (club_id, name)
select distinct d.club_id, trim(v.val)
from public.drill d
cross join lateral unnest(array[d.category, d.subcategory]) as v(val)
where v.val is not null and length(trim(v.val)) between 1 and 40
  and not exists (select 1 from public.collection c
                  where c.club_id = d.club_id and c.kind = 'drill' and lower(c.name) = lower(trim(v.val)))
on conflict (club_id, lower(name)) do nothing;

insert into public.drill_tag (drill_id, tag_id)
select distinct d.id, t.id
from public.drill d
cross join lateral unnest(array[d.category, d.subcategory]) as v(val)
join public.club_tag t on t.club_id = d.club_id and lower(t.name) = lower(trim(v.val))
where v.val is not null
on conflict do nothing;

-- ── Policies ──────────────────────────────────────────────────────────────
-- Read follows the column now. Own drills and admins are unchanged.
drop policy if exists drill_club_read on public.drill;
create policy drill_club_read on public.drill for select to authenticated
  using (is_club_admin(club_id) or created_by = (select auth.uid()) or can_read_collection(collection_id));

-- Uncategorised can't be created by hand, renamed or deleted.
drop policy if exists collection_admin_write on public.collection;
create policy collection_admin_write on public.collection for insert to authenticated
  with check (is_club_admin(club_id) and not is_uncategorised);
drop policy if exists collection_admin_update on public.collection;
create policy collection_admin_update on public.collection for update to authenticated
  using (is_club_admin(club_id) and not is_uncategorised)
  with check (is_club_admin(club_id) and not is_uncategorised);
drop policy if exists collection_admin_delete on public.collection;
create policy collection_admin_delete on public.collection for delete to authenticated
  using (is_club_admin(club_id) and not is_uncategorised);

create policy club_tag_read on public.club_tag for select to authenticated
  using (is_club_member(club_id));
create policy club_tag_admin_insert on public.club_tag for insert to authenticated
  with check (is_club_admin(club_id));
create policy club_tag_admin_update on public.club_tag for update to authenticated
  using (is_club_admin(club_id)) with check (is_club_admin(club_id));
create policy club_tag_admin_delete on public.club_tag for delete to authenticated
  using (is_club_admin(club_id));

-- drill_tag rides on the drill's own RLS: readable when the drill is, writable
-- by whoever may edit the drill (drill_club_update's rule).
create policy drill_tag_read on public.drill_tag for select to authenticated
  using (drill_id in (select d.id from public.drill d));
create policy drill_tag_insert on public.drill_tag for insert to authenticated
  with check (drill_id in (select d.id from public.drill d
                           where public.is_club_admin(d.club_id) or d.created_by = (select auth.uid())));
create policy drill_tag_delete on public.drill_tag for delete to authenticated
  using (drill_id in (select d.id from public.drill d
                      where public.is_club_admin(d.club_id) or d.created_by = (select auth.uid())));

-- ── RPCs the client calls ─────────────────────────────────────────────────
-- Names only, for the create/move pickers: a coach can't select collection
-- rows they weren't granted, but may still file into them.
create or replace function public.club_drill_collections(cid uuid)
returns table (id uuid, name text, is_uncategorised boolean)
language sql security definer stable set search_path = '' as $$
  select c.id, c.name, c.is_uncategorised
  from public.collection c
  where c.club_id = cid and c.kind = 'drill' and public.is_club_member(cid)
  order by c.is_uncategorised, lower(c.name);
$$;
revoke execute on function public.club_drill_collections(uuid) from public, anon;
grant execute on function public.club_drill_collections(uuid) to authenticated;

-- Deleting a collection that still holds drills moves them to Uncategorised
-- first, in one transaction (drill.collection_id is ON DELETE RESTRICT).
create or replace function public.delete_drill_collection(col uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare cid uuid; unc boolean;
begin
  select club_id, is_uncategorised into cid, unc from public.collection where id = col and kind = 'drill';
  if cid is null then raise exception 'That collection no longer exists.'; end if;
  if not public.is_club_admin(cid) then raise exception 'Only a club admin can delete a collection.'; end if;
  if unc then raise exception 'Uncategorised can''t be deleted.'; end if;
  if exists (select 1 from public.drill where collection_id = col) then
    update public.drill set collection_id = public.uncategorised_collection(cid) where collection_id = col;
  end if;
  delete from public.collection where id = col;
end $$;
revoke execute on function public.delete_drill_collection(uuid) from public, anon;
grant execute on function public.delete_drill_collection(uuid) to authenticated;

-- ── New clubs get the starter set ─────────────────────────────────────────
create or replace function public.create_club(club_name text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare cid uuid;
begin
  if (select auth.uid()) is null then raise exception 'not signed in'; end if;
  if club_name is null or length(trim(club_name)) = 0 then
    raise exception 'club name required'; end if;
  insert into public.club (name) values (trim(club_name)) returning id into cid;
  insert into public.club_member (club_id, user_id, role)
    values (cid, (select auth.uid()), 'admin');
  perform public.seed_drill_starter_set(cid, (select auth.uid()));
  return cid;
end $$;
-- `create or replace` keeps 043's grants (authenticated only).

-- ── Cross-club copy reads the column and carries tags ─────────────────────
create or replace function public.copy_collection_to_club(src_collection uuid, target_club uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  src_club uuid; new_col uuid; new_id uuid; r record;
begin
  select club_id into src_club from public.collection where id = src_collection;
  if src_club is null then raise exception 'collection not found'; end if;
  if not (public.is_club_admin(src_club) and public.is_club_admin(target_club)) then
    raise exception 'caller must be an admin of both clubs';
  end if;

  insert into public.collection (club_id, name, description, created_by, kind)
  select target_club, name, description, (select auth.uid()), kind
  from public.collection where id = src_collection
  returning id into new_col;

  for r in select d.* from public.drill d where d.collection_id = src_collection loop
    insert into public.drill (
      club_id, created_by, collection_id, name, scene, keyframes, duration_seconds, pitch,
      orientation, objective, description, category, subcategory,
      duration_minutes, players_recommended, min_players, max_players,
      age_min, age_max, difficulty, intensity, phase_of_play, session_block,
      setup_minutes, learning_outcome, video_url, video_path, coaching,
      share_token, thumbnail_url)
    values (
      target_club, (select auth.uid()), new_col, r.name, r.scene, r.keyframes,
      r.duration_seconds, r.pitch, r.orientation, r.objective, r.description,
      r.category, r.subcategory, r.duration_minutes, r.players_recommended,
      r.min_players, r.max_players, r.age_min, r.age_max, r.difficulty,
      r.intensity, r.phase_of_play, r.session_block, r.setup_minutes,
      r.learning_outcome, r.video_url, r.video_path, r.coaching,
      null, null)
    returning id into new_id;

    -- Tags match the target club's by name; missing ones are created.
    insert into public.club_tag (club_id, name)
      select target_club, t.name
      from public.drill_tag dt join public.club_tag t on t.id = dt.tag_id
      where dt.drill_id = r.id
      on conflict (club_id, lower(name)) do nothing;
    insert into public.drill_tag (drill_id, tag_id)
      select new_id, tt.id
      from public.drill_tag dt
      join public.club_tag t on t.id = dt.tag_id
      join public.club_tag tt on tt.club_id = target_club and lower(tt.name) = lower(t.name)
      where dt.drill_id = r.id;
  end loop;

  for r in
    select t.* from public.tactic t
    join public.collection_tactic ct on ct.tactic_id = t.id
    where ct.collection_id = src_collection
  loop
    insert into public.tactic (
      club_id, created_by, team_id, name, scene, keyframes, duration_seconds,
      pitch, sides, phases, view, description, phase_of_play,
      share_token, thumbnail_url)
    values (
      target_club, (select auth.uid()), null, r.name,
      jsonb_set(r.scene, '{entities}', coalesce(
        (select jsonb_agg(e - 'player_id')
         from jsonb_array_elements(r.scene->'entities') e), '[]'::jsonb)),
      r.keyframes, r.duration_seconds, r.pitch, r.sides, r.phases, r.view,
      r.description, r.phase_of_play,
      null, null)
    returning id into new_id;
    insert into public.collection_tactic (collection_id, tactic_id)
      values (new_col, new_id);
  end loop;

  return new_col;
end $$;
