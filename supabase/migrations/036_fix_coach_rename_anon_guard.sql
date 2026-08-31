-- 036_fix_coach_rename_anon_guard.sql — closes a real hole in 035's
-- update_club_member_name: `target_user_id <> (select auth.uid())`
-- evaluates to NULL, not true, when the caller is anon (auth.uid() is
-- NULL for anon), and `IF NULL THEN ... END IF` in plpgsql silently does
-- NOT execute the exception — it just falls through. That let an
-- unauthenticated caller invoke the RPC directly against
-- /rest/v1/rpc/update_club_member_name and rename any coach at any club,
-- with no auth check actually running. Every other helper in this file
-- sidesteps the same NULL-vs-anon trap by putting `auth.uid()` inside a
-- SELECT's WHERE clause (where a NULL comparison excludes the row rather
-- than skipping a branch) — this is the one place it landed inside an IF
-- instead, and that shape needs an explicit NULL check up front, not a
-- null-safe operator; `IS DISTINCT FROM` alone would have left anon's
-- NULL caller still comparing against a NOT NULL club_member row and
-- (correctly) failing on `is_club_admin`, but relying on that instead of
-- rejecting "not signed in" outright is exactly the fragile shape that
-- broke the first time.
create or replace function update_club_member_name(cid uuid, target_user_id uuid, new_name text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  caller uuid := (select auth.uid());
begin
  if caller is null then
    raise exception 'not signed in';
  end if;
  if target_user_id is distinct from caller and not public.is_club_admin(cid) then
    raise exception 'not authorized to rename this coach';
  end if;
  update public.club_member set display_name = new_name
    where club_id = cid and user_id = target_user_id;
end $$;
