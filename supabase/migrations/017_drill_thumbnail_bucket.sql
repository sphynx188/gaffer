-- Migration 017 — the drill-thumbnails storage bucket
--
-- Stage 8.5 of DRILL_CREATOR_REWORK_PLAN.md: `stage.toDataURL()` on the Konva
-- stage, uploaded on save, so Stage 9's library cards have something to show
-- other than a name. This project had no storage bucket at all before now.
--
-- Kept in its own numbered file rather than folded into 016: a bucket is a
-- different object with its own RLS, and the repo's convention is one concern
-- per migration.
--
-- Public read. A thumbnail is a line drawing of cones on grass — there is
-- nothing in one worth a signed URL, and public read is what lets a card, a
-- session sheet or a future share link render it with a plain <img src>.
-- Writes are scoped to coaches who can already see the drill: the object is
-- named `<drill id>.png`, so the policy joins back to the drill row and
-- reuses is_team_member() rather than redefining membership inline (CLAUDE.md).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('drill-thumbnails', 'drill-thumbnails', true, 2097152, array['image/png'])
on conflict (id) do nothing;

-- `split_part(name, '.', 1)` is the drill id; a malformed name matches no
-- drill, so it fails closed. The cast is on the drill side to keep the
-- comparison from erroring on a non-uuid object name.
create policy "drill_thumbnail_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'drill-thumbnails'
    and exists (
      select 1 from public.drill d
      where d.id::text = split_part(name, '.', 1)
        and (d.team_id is null or public.is_team_member(d.team_id))
    )
  );

-- Re-capturing a thumbnail is an upsert, which needs update as well as insert.
create policy "drill_thumbnail_update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'drill-thumbnails'
    and exists (
      select 1 from public.drill d
      where d.id::text = split_part(name, '.', 1)
        and (d.team_id is null or public.is_team_member(d.team_id))
    )
  );

create policy "drill_thumbnail_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'drill-thumbnails'
    and exists (
      select 1 from public.drill d
      where d.id::text = split_part(name, '.', 1)
        and (d.team_id is null or public.is_team_member(d.team_id))
    )
  );
