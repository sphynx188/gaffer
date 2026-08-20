-- Migration 009 — Drop player.dob, session.physical_load, session.equipment
--
-- Context: none of these three fields turned out to be worth the form
-- fields asking for them — a coach noted DOB isn't needed at the moment,
-- and physical load / equipment weren't being used either. Same reasoning
-- as migration 008 (team.format): rather than leave unused columns and the
-- UI plumbing that fed them, drop them cleanly. If DOB comes back later
-- (e.g. for age-group eligibility) it can be re-added as its own migration.

alter table player
  drop column dob;

alter table session
  drop column physical_load,
  drop column equipment;
