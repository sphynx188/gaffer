-- 031_club_license_read_for_members.sql — found live in Task 11.
-- club_license_read restricted the "I'm on the receiving end" branch to
-- is_club_admin(target_club_id), so a plain coach (not admin) could never
-- read a club_license row targeting their own club. Nothing downstream of
-- ACTUAL document/collection visibility depends on this (can_read_collection
-- is security definer, so its own internal club_license read already
-- bypasses RLS regardless of the caller's role) — but the "Licensed" badge
-- spec §6.3 asks the coach's library to show is a real UI feature that reads
-- licensesIn directly, and licensesIn is a plain (non-security-definer)
-- query subject to this policy. Broadened to is_club_member(target_club_id)
-- — a coach already reads the licensed collection's full contents once
-- granted; knowing it's licensed rather than home-grown isn't sensitive,
-- it's exactly the fact the UI is supposed to show them.
--
-- Minor disclosure accepted: a coach not yet dispersed the collection can
-- now see that a license row exists targeting their club (its raw id/dates)
-- without seeing the collection's name or contents (collection_read still
-- requires can_read_collection/created_by, unaffected by this change) —
-- negligible, and a necessary tradeoff for the badge to render at all.
drop policy if exists club_license_read on club_license;
create policy club_license_read on club_license for select to authenticated
  using (
    is_club_admin((select c.club_id from collection c where c.id = collection_id))
    or is_club_member(target_club_id)
  );
