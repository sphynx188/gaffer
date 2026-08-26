-- Migration 019 — fix the drill-thumbnails RLS policies
--
-- Two independent bugs, both traced by hand against the live project rather
-- than guessed:
--
-- 1. The insert/update/delete policies from migration 017 wrote
--    `split_part(name, '.', 1)` inside a correlated subquery
--    `select 1 from public.drill d where ...`. Postgres resolves an
--    unqualified column reference to the *closest* scope first, and `drill`
--    has its own `name` column (the drill's title) — so `name` inside that
--    subquery silently resolved to the drill's title, not the uploaded
--    file's path. Rewritten below as an `in (select d.id::text from ...)`
--    so the outer `name` is read in the policy's own top-level scope, where
--    there is no colliding column to shadow it.
--
-- 2. There was never a SELECT policy on storage.objects for this bucket.
--    Public read of the *finished* thumbnail works regardless (Storage
--    serves public buckets over an unauthenticated route that skips RLS
--    entirely), but the authenticated upload call still does its own
--    internal row lookup to hand the caller back what it just wrote, and
--    with no SELECT policy that lookup is denied — surfacing as the same
--    generic "new row violates row-level security policy" error on every
--    single upload, regardless of team membership. Confirmed by reproducing
--    the insert directly against the live database: it succeeds without a
--    RETURNING clause and fails with one, which only implicates SELECT.

drop policy if exists "drill_thumbnail_insert" on storage.objects;
drop policy if exists "drill_thumbnail_update" on storage.objects;
drop policy if exists "drill_thumbnail_delete" on storage.objects;
drop policy if exists "drill_thumbnail_select" on storage.objects;

create policy "drill_thumbnail_select" on storage.objects
  for select to authenticated
  using (bucket_id = 'drill-thumbnails');

create policy "drill_thumbnail_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'drill-thumbnails'
    and split_part(name, '.', 1) in (
      select d.id::text from public.drill d
      where d.team_id is null or public.is_team_member(d.team_id)
    )
  );

create policy "drill_thumbnail_update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'drill-thumbnails'
    and split_part(name, '.', 1) in (
      select d.id::text from public.drill d
      where d.team_id is null or public.is_team_member(d.team_id)
    )
  );

create policy "drill_thumbnail_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'drill-thumbnails'
    and split_part(name, '.', 1) in (
      select d.id::text from public.drill d
      where d.team_id is null or public.is_team_member(d.team_id)
    )
  );
