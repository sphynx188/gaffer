-- 032_collection_kind.sql — enforced drill/tactic separation for
-- collections (spec follow-up, 2026-08-28): a collection is now always
-- exactly one kind, never both. Collections management folds into each
-- Library tab (Drills manages drill-kind collections, Tactics manages
-- tactic-kind), replacing the old unified /library/collections page —
-- this migration is what makes that split real at the data layer, not
-- just a UI convention a client could ignore.

create type collection_kind as enum ('drill', 'tactic');
alter table collection add column kind collection_kind;

-- Split any currently-mixed collection (holds both drills and tactics) into
-- two type-pure collections before the column below goes not-null — found
-- live: "Passing Pack" (My Club) and "U18 Tactical" (FC Barcelona demo),
-- neither carrying an active club_license (checked first), so this is a
-- lossless split, not a judgment call. The drill content stays on the
-- original row; a new twin collection takes the tactic content, same club/
-- creator/description, with existing collection_access grants copied
-- across so nobody who could see the mixed collection loses access to
-- either half.
do $$
declare r record; new_id uuid;
begin
  for r in (
    select col.id, col.club_id, col.name, col.created_by, col.description
    from collection col
    where exists (select 1 from collection_drill d where d.collection_id = col.id)
      and exists (select 1 from collection_tactic t where t.collection_id = col.id)
  ) loop
    insert into collection (club_id, name, description, created_by, kind)
      values (r.club_id, r.name || ' (tactics)', r.description, r.created_by, 'tactic')
      returning id into new_id;
    update collection_tactic set collection_id = new_id where collection_id = r.id;
    insert into collection_access (collection_id, user_id, granted_by)
      select new_id, ca.user_id, ca.granted_by from collection_access ca where ca.collection_id = r.id;
  end loop;
end $$;

-- Everything left holds at most one type now. Classify by what it actually
-- has; a collection with nothing filed either way defaults to 'drill' —
-- arbitrary (there's nothing to infer from), but visible and correctable
-- from the Drills tab's collection manager afterward.
update collection set kind = 'tactic'
  where kind is null and exists (select 1 from collection_tactic t where t.collection_id = collection.id);
update collection set kind = 'drill' where kind is null;

alter table collection alter column kind set not null;

-- Enforced at the RLS layer, not just hidden in the UI: a drill can only be
-- filed into a drill-kind collection, a tactic only into a tactic-kind one.
-- Same qual as before (is_club_admin), with the kind check added.
drop policy if exists collection_drill_admin_write on collection_drill;
create policy collection_drill_admin_write on collection_drill for insert to authenticated
  with check (
    is_club_admin((select c.club_id from collection c where c.id = collection_drill.collection_id))
    and (select c.kind from collection c where c.id = collection_drill.collection_id) = 'drill'
  );

drop policy if exists collection_tactic_admin_write on collection_tactic;
create policy collection_tactic_admin_write on collection_tactic for insert to authenticated
  with check (
    is_club_admin((select c.club_id from collection c where c.id = collection_tactic.collection_id))
    and (select c.kind from collection c where c.id = collection_tactic.collection_id) = 'tactic'
  );

-- copy_collection_to_club (migration 030) needs to carry `kind` through —
-- it does an explicit column-list insert, so an added not-null column with
-- no default would otherwise break every cross-club copy.
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

  insert into public.collection (club_id, name, description, created_by, kind)
  select target_club, name, description, (select auth.uid()), kind
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
