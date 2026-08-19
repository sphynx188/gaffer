-- Migration 002 — Player position: single text field → multi-select tag set
--
-- Context: Phase 1 originally shipped `player.position` as a single freeform
-- text column. This changes it to a fixed set of tags (a player can hold
-- more than one — e.g. a winger who also plays striker), matching the
-- refreshed schema.sql. Run this once, in the Supabase SQL editor, against
-- the already-deployed project (do NOT also re-run schema.sql — it would
-- try to recreate tables that already exist).
--
-- Safe to run whether or not any players exist yet. Old freeform text in
-- `position` is intentionally NOT auto-mapped into the new enum tags —
-- values like "CF" or "attacking mid" don't map cleanly to the five fixed
-- tags, and a bad silent guess is worse than an empty tag set the coach
-- fills in once. The old text is preserved in `position_legacy` so nothing
-- is lost; drop that column later once you've re-tagged the roster.

create type player_position as enum ('goalkeeper', 'defender', 'midfielder', 'winger', 'striker');

alter table player rename column position to position_legacy;

alter table player
  add column positions player_position[] not null default '{}'::player_position[];

comment on column player.position_legacy is
  'Deprecated freeform position text, kept only so old data isn''t lost. Superseded by `positions`. Safe to drop once the roster has been re-tagged: alter table player drop column position_legacy;';

-- Nothing to do for RLS — the existing player policy is unaffected, since it
-- gates on team membership, not on individual columns.
