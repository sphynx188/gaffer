-- Migration 008 — Drop team.format
--
-- Context: a team's pitch format never actually drove anything — every
-- place it was read just displayed the label back (TeamSwitcher,
-- TeamManagement, TeamOverviewPage, DashboardPage). Drill.pitch_format is
-- the field that actually matters (it picks which pitch shape the Konva
-- canvas renders for that drill) and is set independently per drill, not
-- derived from the team's format. Asking a coach to pick 11-a-side vs
-- small-sided at team-creation time was a decision with no downstream
-- effect, so it's removed rather than kept as an unused, confusing field —
-- creating a team now only asks for a name.

alter table team
  drop column format;
