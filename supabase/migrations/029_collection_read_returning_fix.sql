-- 029_collection_read_returning_fix.sql — fixes a real bug found live in
-- Task 9: INSERT/UPDATE ... RETURNING on `collection` fails RLS even for
-- the row's own creator/admin. Root cause: within the SAME command as an
-- INSERT/UPDATE, a nested SELECT re-querying the SAME table (which is what
-- can_read_collection(id) does internally, looking up collection by id)
-- cannot see the just-changed row — ordinary Postgres same-command
-- self-visibility semantics, not an RLS misconfiguration. drill_club_read
-- and tactic_club_read never hit this because they carry a direct
-- `created_by = (select auth.uid())` clause that's evaluable straight from
-- row values, without re-querying the table — collection_read had no such
-- fallback, so it always went through the self-referential lookup.
--
-- Verified: neither switching the helpers (is_club_member/is_club_admin/
-- can_read_collection) to plpgsql nor to volatile fixed it (both tried
-- live and reverted — see recon notes); adding the same direct-row-value
-- fallback drill/tactic already use does. Does not expand externally
-- observable access: only an admin can ever create a collection
-- (collection_admin_write), and an admin already reads any of their
-- club's collections via can_read_collection's own is_club_admin branch —
-- this fallback only closes the same-command RETURNING gap.
--
-- Re-verified after apply (execute_sql):
--   INSERT ... RETURNING as the test account admin -> succeeds (was 42501).
--   UPDATE ... RETURNING (rename) as the same -> succeeds (was 42501).
--   Per-persona sweep re-run (legacy admin / test account / made-up uuid)
--   on collection -> unchanged from Task 3's baseline, no new cross-tenant
--   visibility introduced by this policy edit.
drop policy if exists collection_read on collection;
create policy collection_read on collection for select to authenticated
  using (created_by = (select auth.uid()) or can_read_collection(id));
