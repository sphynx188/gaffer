-- 047_drop_collection_drill_and_category.sql — finishes 046 once the client
-- that reads drill.collection_id is deployed. Backup of everything dropped:
-- ../drill_collections_category_backup_2026-10-28.json (taken before 046).

-- No more silent fallback: a drill must be created with its collection.
create or replace function public.drill_collection_guard()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.collection c
                 where c.id = new.collection_id and c.club_id = new.club_id and c.kind = 'drill') then
    raise exception 'That collection isn''t part of this club.';
  end if;
  return new;
end $$;

-- copy_collection_to_club without category/subcategory.
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
      orientation, objective, description,
      duration_minutes, players_recommended, min_players, max_players,
      age_min, age_max, difficulty, intensity, phase_of_play, session_block,
      setup_minutes, learning_outcome, video_url, video_path, coaching,
      share_token, thumbnail_url)
    values (
      target_club, (select auth.uid()), new_col, r.name, r.scene, r.keyframes,
      r.duration_seconds, r.pitch, r.orientation, r.objective, r.description,
      r.duration_minutes, r.players_recommended,
      r.min_players, r.max_players, r.age_min, r.age_max, r.difficulty,
      r.intensity, r.phase_of_play, r.session_block, r.setup_minutes,
      r.learning_outcome, r.video_url, r.video_path, r.coaching,
      null, null)
    returning id into new_id;

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

drop table public.collection_drill;
drop function if exists public.drill_in_readable_collection(uuid);
alter table public.drill drop column category, drop column subcategory;
