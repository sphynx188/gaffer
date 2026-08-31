-- 034_club_crest.sql — club crest upload (admin, Settings), shown in the
-- app header and on Home. `club.crest_url` reuses 033's club_admin_update
-- policy (an UPDATE policy covers the whole row, any column) — no new
-- table-level policy needed, only the storage bucket below.
--
-- Public read, same reasoning as drill-thumbnails (017): a club crest is
-- meant to be shown with a plain <img src>, nothing in one is worth a
-- signed URL. Object name is `<club id>.<ext>` (upsert on re-upload), so
-- writes join back to club_member the same way drill-thumbnails joins
-- back to drill — comparing the id as text rather than casting the object
-- name to uuid, so a malformed name fails closed instead of erroring.

alter table club add column crest_url text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('club-crests', 'club-crests', true, 2097152, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do nothing;

create policy "club_crest_read" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'club-crests'
    and exists (
      select 1 from public.club_member cm
      where cm.club_id::text = split_part(name, '.', 1)
        and cm.user_id = (select auth.uid())
    )
  );

create policy "club_crest_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'club-crests'
    and exists (
      select 1 from public.club_member cm
      where cm.club_id::text = split_part(name, '.', 1)
        and cm.user_id = (select auth.uid())
        and cm.role = 'admin'
    )
  );

-- Re-uploading a crest is an upsert, which needs update as well as insert.
create policy "club_crest_update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'club-crests'
    and exists (
      select 1 from public.club_member cm
      where cm.club_id::text = split_part(name, '.', 1)
        and cm.user_id = (select auth.uid())
        and cm.role = 'admin'
    )
  );

create policy "club_crest_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'club-crests'
    and exists (
      select 1 from public.club_member cm
      where cm.club_id::text = split_part(name, '.', 1)
        and cm.user_id = (select auth.uid())
        and cm.role = 'admin'
    )
  );
