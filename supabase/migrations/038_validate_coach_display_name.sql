-- 038_validate_coach_display_name.sql — validates `new_name` in
-- update_club_member_name (035, auth-fixed by 036).
--
-- The function authorized its caller correctly after 036 but never looked at
-- the value being written: NULL, an empty string, whitespace, or a megabyte
-- of text were all accepted straight into `club_member.display_name`, which
-- is unbounded nullable text with no constraint of its own. `create_club`
-- sitting beside it in 033 already validates its one text argument the same
-- way; this brings the rename onto that rule.
--
-- NULL stays legal, and deliberately: both call sites (Settings' own profile
-- card, the Coaches tab) send `name.trim() || null`, so clearing the display
-- name back to "fall back to the email" is a real action, not a mistake.
-- What is rejected is a name that is only whitespace — which would render as
-- a blank row rather than falling back — and anything over 80 characters,
-- which is past any real name and only reachable by calling the RPC directly.
-- Trimming server-side as well as client-side means a direct caller can't
-- store padding the UI would then render as indentation.
create or replace function update_club_member_name(cid uuid, target_user_id uuid, new_name text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  caller uuid := (select auth.uid());
  cleaned text := nullif(trim(new_name), '');
begin
  if caller is null then
    raise exception 'not signed in';
  end if;
  if target_user_id is distinct from caller and not public.is_club_admin(cid) then
    raise exception 'not authorized to rename this coach';
  end if;
  if cleaned is not null and length(cleaned) > 80 then
    raise exception 'display name must be 80 characters or fewer';
  end if;
  update public.club_member set display_name = cleaned
    where club_id = cid and user_id = target_user_id;
end $$;
