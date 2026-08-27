-- 026_drop_early_access_signup.sql
-- Landing page removed 2026-08-28 (spec §2.7 / §6.4). No pre-drop dump: Task 0
-- recon confirmed 0 rows in early_access_signup at migration time. Migration
-- 025 created this table; per house rules 025 stays in the repo untouched.
drop table if exists early_access_signup;
