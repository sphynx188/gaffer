-- Upgrade Phase 2A (UPGRADE_IMPLEMENTATION_PLAN.md): replaces the 2-value
-- `pitch_format` enum ('11v11' | 'small_sided') with two independent
-- dimensions — pitch_size (full/three_quarter/half/quarter) and
-- orientation (portrait/landscape) — so the Drill Creator can offer the
-- roadmap's 4 sizes x 2 orientations instead of just 2 fixed shapes.
--
-- Backfill: '11v11' -> 'full' (closest existing equivalent), everything
-- else ('small_sided') -> 'quarter' (closest existing equivalent — the old
-- small-sided markings become the new 'quarter' markings, see
-- pitchGeometry.ts). New rows always default orientation to 'landscape'.
-- No production data at time of writing (0 rows in `drill`), so this
-- backfill is a formality, not a real data-preservation concern.

create type pitch_size as enum ('full', 'three_quarter', 'half', 'quarter');
create type pitch_orientation as enum ('portrait', 'landscape');

alter table drill add column pitch_size pitch_size;
alter table drill add column orientation pitch_orientation not null default 'landscape';

update drill set pitch_size = case when pitch_format = '11v11' then 'full'::pitch_size else 'quarter'::pitch_size end;

alter table drill alter column pitch_size set not null;
alter table drill drop column pitch_format;
drop type pitch_format; -- unused after this (team.format, the only other user, was dropped in 008)
