-- 025_early_access_signup.sql
--
-- Early-access waitlist for the public landing page (landing-page spec,
-- 2026-08-26). Write-only from the app: anon visitors may INSERT their
-- email and nothing else — no select/update/delete policies exist, so the
-- list is readable only via the dashboard / MCP. The coach's own signed-in
-- role gets no read policy either, deliberately: nothing in the app reads
-- this table.

create table public.early_access_signup (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  created_at timestamptz not null default now(),
  constraint early_access_signup_email_format
    check (email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$')
);

alter table public.early_access_signup enable row level security;

create policy early_access_signup_insert_anyone
  on public.early_access_signup
  for insert
  to anon, authenticated
  with check (true);
