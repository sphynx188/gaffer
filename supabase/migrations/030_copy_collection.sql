-- 030_copy_collection.sql — cross-club copy (spec §8).
-- Column lists corrected against Task 0 recon's information_schema output:
--   tactic gained `description` and `phase_of_play` to the plan-draft list,
--   which omitted both — exactly the "silent omission" risk this task's own
--   header warned about (see the plan's Amendment log).
create or replace function copy_collection_to_club(src_collection uuid, target_club uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  src_club uuid; new_col uuid; new_id uuid; r record;
begin
  select club_id into src_club from public.collection where id = src_collection;
  if src_club is null then raise exception 'collection not found'; end if;
  if not (public.is_club_admin(src_club) and public.is_club_admin(target_club)) then
    raise exception 'caller must be an admin of both clubs';
  end if;

  insert into public.collection (club_id, name, description, created_by)
  select target_club, name, description, (select auth.uid())
  from public.collection where id = src_collection
  returning id into new_col;

  for r in
    select d.* from public.drill d
    join public.collection_drill cd on cd.drill_id = d.id
    where cd.collection_id = src_collection
  loop
    insert into public.drill (
      club_id, created_by, name, scene, keyframes, duration_seconds, pitch,
      orientation, objective, description, category, subcategory,
      duration_minutes, players_recommended, min_players, max_players,
      age_min, age_max, difficulty, intensity, phase_of_play, session_block,
      setup_minutes, learning_outcome, video_url, coaching,
      share_token, thumbnail_url)
    values (
      target_club, (select auth.uid()), r.name, r.scene, r.keyframes,
      r.duration_seconds, r.pitch, r.orientation, r.objective, r.description,
      r.category, r.subcategory, r.duration_minutes, r.players_recommended,
      r.min_players, r.max_players, r.age_min, r.age_max, r.difficulty,
      r.intensity, r.phase_of_play, r.session_block, r.setup_minutes,
      r.learning_outcome, r.video_url, r.coaching,
      null, null)
    returning id into new_id;
    insert into public.collection_drill (collection_id, drill_id)
      values (new_col, new_id);
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
      -- strip legacy roster bindings from entities:
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
