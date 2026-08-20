-- Migration 010 — Repurpose availability.status as a roll-call status
--
-- Context: the app had two attendance-shaped concepts that were never
-- actually distinct in use — a pre-session "available/unavailable/
-- unconfirmed" RSVP (AvailabilityPanel) and a coach's ask for a genuine
-- post-session roll call ("present, injured, or away"). Rather than bolt on
-- a second status column, the same (session, player) row now carries one
-- status a coach can set either as an RSVP guess beforehand or as the
-- actual roll-call outcome afterward — 'unconfirmed' is still the seeded
-- default either way.
--
-- Value mapping for existing rows: 'available' -> 'present' (closest
-- equivalent — they said they'd be there); 'unavailable' -> 'away' (no way
-- to know from historical data whether a given "unavailable" row was an
-- injury or something else, so it maps to the more general catch-all — the
-- free-text `reason` column, untouched by this migration, still carries
-- whatever context was recorded). 'unconfirmed' is unchanged.
--
-- Standard Postgres pattern for changing enum values (rename-old /
-- create-new / cast-with-USING / drop-old) rather than ADD VALUE + RENAME
-- VALUE, since this migration both removes and renames values in one pass.

alter type availability_status rename to availability_status_old;

create type availability_status as enum ('unconfirmed', 'present', 'injured', 'away');

alter table availability
  alter column status drop default;

alter table availability
  alter column status type availability_status
  using (
    case status::text
      when 'available' then 'present'
      when 'unavailable' then 'away'
      else 'unconfirmed'
    end
  )::availability_status;

alter table availability
  alter column status set default 'unconfirmed';

drop type availability_status_old;
