-- 045_drill_video.sql — a real-life video attached to a drill (2026-10-28).
--
-- The coach uploads an MP4 (or an iPhone .mov) of the drill being run, from a
-- box under the pitch in the editor. It plays on the editor, the read-only
-- view and the public share page, and it has to "stay with the drill wherever
-- it goes": a duplicate, a cross-club collection copy and a share link all
-- carry it.
--
-- ── Why a PRIVATE bucket, unlike drill-thumbnails and club-crests ─────────
-- A thumbnail is a line drawing of cones on grass (017's reasoning). A drill
-- video is footage of real players, and this product is sold to academies —
-- those players are very often children. A public bucket would make every
-- clip readable by anyone holding its URL, forever, with no way to revoke a
-- leaked link. Private plus short-lived signed URLs means a clip is readable
-- exactly as far as the drill row that references it is readable.
--
-- ── Why the read policy keys on `drill.video_path`, not on the object name ─
-- The object lives at `<uploading drill id>/<random>.<ext>`. A duplicate or a
-- cross-club copy gets a NEW drill id but keeps the SAME `video_path` string
-- — copying the reference rather than the bytes, so a copy costs no storage.
-- If the read policy joined the object name's drill id prefix back to `drill`
-- (the thumbnail shape), a coach in the receiving club could see the copied
-- drill but not the source drill, and the video would fail to load on the
-- copy. Keying on "some drill you can read references this exact object"
-- follows the reference instead, so the video goes wherever the drill goes.
--
-- The subquery runs as the caller with `drill`'s own RLS applied — exactly
-- how `thumbnails_visible_read` (028) works — so an authenticated coach reads
-- the videos of drills they can read, and anon reads only the video of the
-- one drill whose share token is in the `x-share-token` header
-- (`drill_shared_read`, 018). No enumeration: `select video_path from drill`
-- as anon returns nothing without a matching token, so the share-shape rule
-- in CLAUDE.md is inherited, not re-implemented.
--
-- HEED 019: `drill` has its own `name` column. Every clause below compares
-- the storage object's `name` with `in (select ...)` at the policy's top
-- level, never inside a correlated `exists`, where `name` would silently
-- resolve to the drill's title.
--
-- ── Deleting ─────────────────────────────────────────────────────────────
-- Because copies share one object, removing a video from one drill must not
-- delete the file while another drill still points at it — and the client
-- can't see other clubs' drills to check. `drill_video_in_use` answers that
-- one question across every drill (security definer), returning only a
-- boolean about a path the caller already holds; the path carries a random
-- uuid, so it can't be used to probe for anything. The delete policy admits
-- the uploader (`owner_id`) or anyone who may edit the drill the object was
-- uploaded to, matching `drill_club_update` (028).

alter table public.drill add column video_path text;

-- 50 MB is the free plan's global per-file ceiling; a bucket limit above it
-- would never be reached. The client checks the same number first so a coach
-- gets a plain message rather than a storage error.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('drill-videos', 'drill-videos', false, 52428800, array['video/mp4', 'video/quicktime'])
on conflict (id) do nothing;

create policy drill_video_read on storage.objects for select to authenticated, anon
  using (bucket_id = 'drill-videos' and name in (
    select d.video_path from public.drill d where d.video_path is not null
  ));

create policy drill_video_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'drill-videos' and split_part(name, '/', 1) in (
    select d.id::text from public.drill d
    where public.is_club_admin(d.club_id) or d.created_by = (select auth.uid())
  ));

create policy drill_video_delete on storage.objects for delete to authenticated
  using (bucket_id = 'drill-videos' and (
    owner_id = (select auth.uid())::text
    or split_part(name, '/', 1) in (
      select d.id::text from public.drill d
      where public.is_club_admin(d.club_id) or d.created_by = (select auth.uid())
    )
  ));

create or replace function public.drill_video_in_use(path text, except_drill uuid)
returns boolean language sql security definer stable set search_path = '' as $$
  select exists (
    select 1 from public.drill
    where video_path = path and id is distinct from except_drill
  );
$$;
revoke execute on function public.drill_video_in_use(text, uuid) from public, anon;
grant execute on function public.drill_video_in_use(text, uuid) to authenticated;

-- copy_collection_to_club (030, then 032 for `kind`) re-declared with
-- `video_path` in its drill column list — the "silent omission" 030's own
-- header warns about. Body otherwise identical to the live definition.
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
      setup_minutes, learning_outcome, video_url, video_path, coaching,
      share_token, thumbnail_url)
    values (
      target_club, (select auth.uid()), r.name, r.scene, r.keyframes,
      r.duration_seconds, r.pitch, r.orientation, r.objective, r.description,
      r.category, r.subcategory, r.duration_minutes, r.players_recommended,
      r.min_players, r.max_players, r.age_min, r.age_max, r.difficulty,
      r.intensity, r.phase_of_play, r.session_block, r.setup_minutes,
      r.learning_outcome, r.video_url, r.video_path, r.coaching,
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
-- `create or replace` keeps the existing grants (043: authenticated only).
