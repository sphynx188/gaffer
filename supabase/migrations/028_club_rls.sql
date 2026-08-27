-- 028_club_rls.sql — the tenancy security core (spec §5).
-- Policy names to drop (drill/tactic) corrected against Task 0 recon:
--   real names are drill_all_members_or_unscoped / tactic_all_members
--   (NOT the plan-draft guesses drill_all_members / drill_team_members —
--   those guessed names are also dropped, harmlessly, as no-ops).
-- Storage policy names corrected against recon: drill_thumbnail_select/
--   insert/update/delete (NOT the plan-draft "thumbnails members ..." guesses).
-- Probe results (recorded after apply, 2026-08-28, all via execute_sql/curl):
--
-- Per-persona SQL sweep (set_config request.jwt.claims, role authenticated):
--   legacy admin (a88ff958..): drill=8, tactic=3, collection=0, club=1 — own only
--   test account (e13c5237..): drill=9, tactic=2, collection=0, club=1 — own only
--   made-up uuid (00000000..01): drill=0, tactic=0, collection=0, club=0,
--     club_member=0 — nothing, as expected
--   No cross-tenant rows observed in any sweep.
--
-- Share-token re-probe (018/023 suite, curl against $VITE_SUPABASE_URL with
-- $VITE_SUPABASE_ANON_KEY, tokens minted then nulled afterward):
--   valid drill token -> exactly 1 row; tampered token (last char flipped)
--   -> []; no token -> []; valid tactic token -> exactly 1 row.
--   Anon sweep across 15 other tables while holding a valid drill token:
--   every one returned [] (drill_shared_nothing is a non-existent probe
--   table, correctly 404s rather than leaking). Confirmed zero live
--   share_token rows after the probe (both nulled back out).
--
-- Live app sanity (Browser pane, test account): /drills lists all 9 drills
-- unchanged; opened "Full Portrait Test" in the editor, dragged an entity,
-- confirmed "Thumbnail captured" autosave toast, reloaded — new position
-- persisted (drill_club_update path confirmed working end to end).
--
-- get_advisors(security) second opinion: no RLS-disabled findings on any of
-- the 7 new tables; only pre-existing-pattern WARN notices (SECURITY
-- DEFINER helpers reachable by `anon`/`authenticated` via RPC — identical
-- shape to the already-accepted is_team_member/is_team_owner precedent, and
-- every one of this migration's helpers keys off auth.uid(), which is null
-- for anon and can never match a NOT NULL user_id column, so anon always
-- gets `false`/an exception — no information disclosure); one unrelated
-- pre-existing Auth dashboard setting (leaked-password protection).
--
-- Fix applied during review (see collection_access_revoke below): the
-- plan-draft revoke policy let a receiving admin delete ANY grant on a
-- licensed collection, including the source club's own home grants —
-- corrected to require the deleted row's user_id belong to the caller's
-- own (target) club, mirroring the grant policy's join.

-- ---------- helpers (security definer, pinned search_path) ----------
create or replace function is_club_member(cid uuid)
returns boolean language sql security definer stable set search_path = '' as $$
  select exists (select 1 from public.club_member
    where club_id = cid and user_id = (select auth.uid()));
$$;

create or replace function is_club_admin(cid uuid)
returns boolean language sql security definer stable set search_path = '' as $$
  select exists (select 1 from public.club_member
    where club_id = cid and user_id = (select auth.uid()) and role = 'admin');
$$;

-- Readable = admin of the owning club, OR granted + (home member or active
-- license into one of my clubs), OR admin of a club holding an active
-- license (so a receiving admin can see what they're dispersing).
create or replace function can_read_collection(col uuid)
returns boolean language sql security definer stable set search_path = '' as $$
  select exists (
    select 1 from public.collection c
    where c.id = col and (
      public.is_club_admin(c.club_id)
      or exists (select 1 from public.club_license l
                 where l.collection_id = c.id and l.revoked_at is null
                   and public.is_club_admin(l.target_club_id))
      or (
        exists (select 1 from public.collection_access ca
                where ca.collection_id = c.id and ca.user_id = (select auth.uid()))
        and (
          public.is_club_member(c.club_id)
          or exists (select 1 from public.club_license l
                     where l.collection_id = c.id and l.revoked_at is null
                       and public.is_club_member(l.target_club_id))
        )
      )
    )
  );
$$;

create or replace function drill_in_readable_collection(d uuid)
returns boolean language sql security definer stable set search_path = '' as $$
  select exists (select 1 from public.collection_drill cd
    where cd.drill_id = d and public.can_read_collection(cd.collection_id));
$$;

create or replace function tactic_in_readable_collection(t uuid)
returns boolean language sql security definer stable set search_path = '' as $$
  select exists (select 1 from public.collection_tactic ct
    where ct.tactic_id = t and public.can_read_collection(ct.collection_id));
$$;

-- Bootstrap RPC: any signed-in user can found a club and become its admin.
create or replace function create_club(club_name text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare cid uuid;
begin
  if (select auth.uid()) is null then raise exception 'not signed in'; end if;
  if club_name is null or length(trim(club_name)) = 0 then
    raise exception 'club name required'; end if;
  insert into public.club (name) values (trim(club_name)) returning id into cid;
  insert into public.club_member (club_id, user_id, role)
    values (cid, (select auth.uid()), 'admin');
  return cid;
end $$;

-- ---------- club / membership ----------
create policy club_member_read on club for select to authenticated
  using (
    is_club_member(id)
    or exists (select 1 from club_license l
               join collection c on c.id = l.collection_id
               where c.club_id = club.id and l.revoked_at is null
                 and is_club_member(l.target_club_id))  -- see licensor's name
  );

create policy club_member_rows_read on club_member for select to authenticated
  using (is_club_member(club_id));
create policy club_member_admin_insert on club_member for insert to authenticated
  with check (is_club_admin(club_id));
create policy club_member_admin_update on club_member for update to authenticated
  using (is_club_admin(club_id)) with check (is_club_admin(club_id));
create policy club_member_admin_delete on club_member for delete to authenticated
  using (is_club_admin(club_id));

-- ---------- collections ----------
create policy collection_read on collection for select to authenticated
  using (can_read_collection(id));
create policy collection_admin_write on collection for insert to authenticated
  with check (is_club_admin(club_id));
create policy collection_admin_update on collection for update to authenticated
  using (is_club_admin(club_id)) with check (is_club_admin(club_id));
create policy collection_admin_delete on collection for delete to authenticated
  using (is_club_admin(club_id));

create policy collection_drill_read on collection_drill for select to authenticated
  using (can_read_collection(collection_id));
create policy collection_drill_admin_write on collection_drill for insert to authenticated
  with check (is_club_admin((select c.club_id from collection c where c.id = collection_id)));
create policy collection_drill_admin_delete on collection_drill for delete to authenticated
  using (is_club_admin((select c.club_id from collection c where c.id = collection_id)));

create policy collection_tactic_read on collection_tactic for select to authenticated
  using (can_read_collection(collection_id));
create policy collection_tactic_admin_write on collection_tactic for insert to authenticated
  with check (is_club_admin((select c.club_id from collection c where c.id = collection_id)));
create policy collection_tactic_admin_delete on collection_tactic for delete to authenticated
  using (is_club_admin((select c.club_id from collection c where c.id = collection_id)));

-- Grants: home admin, or a receiving admin dispersing a licensed collection
-- to a member of their own club (spec §9 — one grant mechanism).
create policy collection_access_read on collection_access for select to authenticated
  using (
    user_id = (select auth.uid())
    or is_club_admin((select c.club_id from collection c where c.id = collection_id))
    or exists (select 1 from club_license l
               where l.collection_id = collection_access.collection_id
                 and l.revoked_at is null and is_club_admin(l.target_club_id))
  );
create policy collection_access_grant on collection_access for insert to authenticated
  with check (
    is_club_admin((select c.club_id from collection c where c.id = collection_id))
    or exists (select 1 from club_license l
               join club_member m on m.club_id = l.target_club_id
                 and m.user_id = collection_access.user_id
               where l.collection_id = collection_access.collection_id
                 and l.revoked_at is null and is_club_admin(l.target_club_id))
  );
-- Correction (2026-08-28, found in Task 3 review — see migration header and
-- the plan's Amendment log): the plan-draft version of this policy let a
-- receiving admin revoke ANY collection_access row on a licensed collection,
-- including the SOURCE club's own home-coach grants — a cross-tenant write
-- into another club's internal permissions, not just their own dispersals.
-- Fixed by requiring (mirroring collection_access_grant's join) that the
-- row being revoked belongs to a member of the target club the caller
-- actually administers.
create policy collection_access_revoke on collection_access for delete to authenticated
  using (
    is_club_admin((select c.club_id from collection c where c.id = collection_id))
    or exists (select 1 from club_license l
               join club_member m on m.club_id = l.target_club_id
                 and m.user_id = collection_access.user_id
               where l.collection_id = collection_access.collection_id
                 and l.revoked_at is null and is_club_admin(l.target_club_id))
  );

-- ---------- licenses ----------
create policy club_license_read on club_license for select to authenticated
  using (
    is_club_admin((select c.club_id from collection c where c.id = collection_id))
    or is_club_admin(target_club_id)
  );
create policy club_license_grant on club_license for insert to authenticated
  with check (is_club_admin((select c.club_id from collection c where c.id = collection_id)));
create policy club_license_revoke on club_license for update to authenticated
  using (is_club_admin((select c.club_id from collection c where c.id = collection_id)))
  with check (is_club_admin((select c.club_id from collection c where c.id = collection_id)));

-- ---------- documents: club world replaces team world ----------
-- Real names per Task 0 recon: drill_all_members_or_unscoped, tactic_all_members.
-- KEEP drill_shared_read / tactic_shared_read (untouched, anon share-token reads).
drop policy if exists drill_all_members_or_unscoped on drill;
drop policy if exists drill_all_members on drill;
drop policy if exists drill_team_members on drill;
drop policy if exists tactic_all_members on tactic;

create policy drill_club_read on drill for select to authenticated
  using (
    is_club_admin(club_id)
    or created_by = (select auth.uid())
    or drill_in_readable_collection(id)
  );
create policy drill_club_insert on drill for insert to authenticated
  with check (is_club_member(club_id) and created_by = (select auth.uid()));
create policy drill_club_update on drill for update to authenticated
  using (is_club_admin(club_id) or created_by = (select auth.uid()))
  with check (is_club_member(club_id)
              and (is_club_admin(club_id) or created_by = (select auth.uid())));
create policy drill_club_delete on drill for delete to authenticated
  using (is_club_admin(club_id) or created_by = (select auth.uid()));

create policy tactic_club_read on tactic for select to authenticated
  using (
    is_club_admin(club_id)
    or created_by = (select auth.uid())
    or tactic_in_readable_collection(id)
  );
create policy tactic_club_insert on tactic for insert to authenticated
  with check (is_club_member(club_id) and created_by = (select auth.uid()));
create policy tactic_club_update on tactic for update to authenticated
  using (is_club_admin(club_id) or created_by = (select auth.uid()))
  with check (is_club_member(club_id)
              and (is_club_admin(club_id) or created_by = (select auth.uid())));
create policy tactic_club_delete on tactic for delete to authenticated
  using (is_club_admin(club_id) or created_by = (select auth.uid()));

-- ---------- storage: drill-thumbnails, club-visibility ----------
-- Real names per recon: drill_thumbnail_select/insert/update/delete.
drop policy if exists drill_thumbnail_select on storage.objects;
drop policy if exists drill_thumbnail_insert on storage.objects;
drop policy if exists drill_thumbnail_update on storage.objects;
drop policy if exists drill_thumbnail_delete on storage.objects;

create policy thumbnails_visible_read on storage.objects for select to authenticated
  using (bucket_id = 'drill-thumbnails' and (
    name in (select d.id::text || '.png' from drill d)
    or name in (select t.id::text || '.png' from tactic t)
  ));
create policy thumbnails_owner_write on storage.objects for insert to authenticated
  with check (bucket_id = 'drill-thumbnails' and (
    name in (select d.id::text || '.png' from drill d
             where is_club_admin(d.club_id) or d.created_by = (select auth.uid()))
    or name in (select t.id::text || '.png' from tactic t
             where is_club_admin(t.club_id) or t.created_by = (select auth.uid()))
  ));
create policy thumbnails_owner_update on storage.objects for update to authenticated
  using (bucket_id = 'drill-thumbnails' and (
    name in (select d.id::text || '.png' from drill d
             where is_club_admin(d.club_id) or d.created_by = (select auth.uid()))
    or name in (select t.id::text || '.png' from tactic t
             where is_club_admin(t.club_id) or t.created_by = (select auth.uid()))
  ));
create policy thumbnails_owner_delete on storage.objects for delete to authenticated
  using (bucket_id = 'drill-thumbnails' and (
    name in (select d.id::text || '.png' from drill d
             where is_club_admin(d.club_id) or d.created_by = (select auth.uid()))
    or name in (select t.id::text || '.png' from tactic t
             where is_club_admin(t.club_id) or t.created_by = (select auth.uid()))
  ));
