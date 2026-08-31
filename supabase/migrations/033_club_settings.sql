-- 033_club_settings.sql — Settings redesign backend (single-scroll Club
-- profile + Danger zone sections). `club` had a select policy only (028);
-- renaming a club needs an update policy, and deleting one needs an explicit
-- ordered RPC rather than a bare `delete from club`, because `drill.club_id`
-- and `tactic.club_id` were added in 027 WITHOUT `on delete cascade` (every
-- other club_id/target_club_id FK in 027 has it — club_member, collection,
-- club_license.target_club_id — these two are the only exceptions), so a
-- direct delete would fail on FK violation for any club that actually has
-- content. Everything downstream of drill/tactic (collection_drill,
-- collection_tactic, session_drills, session_tactics — all confirmed
-- cascade in schema.sql/020/027) cleans up once the drill/tactic rows
-- themselves are gone, and collection/club_member/club_license cascade
-- straight off `club` itself.

create policy club_admin_update on club for update to authenticated
  using (is_club_admin(id)) with check (is_club_admin(id));

-- Admin-only, explicit ordered delete (see header). Security definer so it
-- can delete drill/tactic rows the caller may not individually own, same
-- shape as create_club's bootstrap privilege.
create or replace function delete_club(cid uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_club_admin(cid) then
    raise exception 'not an admin of this club';
  end if;
  delete from public.tactic where club_id = cid;
  delete from public.drill where club_id = cid;
  delete from public.club where id = cid;
end $$;
