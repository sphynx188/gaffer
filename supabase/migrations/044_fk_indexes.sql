-- 044_fk_indexes.sql — the four foreign keys the Supabase performance
-- advisor listed as unindexed (2026-09-09 audit). All four are the referenced
-- side of an `on delete` clause, so each one is walked on every user or club
-- deletion (delete_my_account, delete_club) as well as on the obvious
-- lookups. Row counts are tiny today; this is about not discovering it later.

create index if not exists club_invite_created_by_idx on public.club_invite (created_by);
create index if not exists club_invite_redeemed_by_idx on public.club_invite (redeemed_by);
create index if not exists player_notes_author_id_idx on public.player_notes (author_id);
create index if not exists team_owner_id_idx on public.team (owner_id);
