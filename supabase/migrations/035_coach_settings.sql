-- 035_coach_settings.sql — Settings for coaches (non-admins), not just
-- admins: they get "Your profile" (rename themselves) with the admin-only
-- sections (Club, Transfer, Licenses, Danger zone) hidden client-side.
--
-- "Your profile" calls the same store action a club admin uses to rename
-- ANY coach from the Coaches tab (updateCoach → a plain `club_member`
-- update), but `club_member_admin_update` (028) only lets an admin write
-- that table at all — a coach renaming themselves has no row to update
-- under RLS. A blanket "update your own row" policy would let a coach
-- PATCH their own `role` to 'admin' directly against the REST API (RLS
-- can't scope an UPDATE to one column), so this is a security-definer RPC
-- instead — same shape as delete_club (033) — that only ever touches
-- `display_name`, and authorizes either the caller renaming themselves or
-- a club admin renaming someone else, matching what the two existing call
-- sites (Settings' own profile card, the Coaches tab) each need.
create or replace function update_club_member_name(cid uuid, target_user_id uuid, new_name text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if target_user_id <> (select auth.uid()) and not public.is_club_admin(cid) then
    raise exception 'not authorized to rename this coach';
  end if;
  update public.club_member set display_name = new_name
    where club_id = cid and user_id = target_user_id;
end $$;
