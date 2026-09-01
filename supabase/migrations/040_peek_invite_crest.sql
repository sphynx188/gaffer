-- 040_peek_invite_crest.sql — `peek_club_invite` also returns the club's
-- crest, so the /join screen can show the club's own mark rather than a
-- generic app shell with its name interpolated into a sentence.
--
-- Still only branding: a name, a role and a crest, all of which the person
-- holding the link is by definition being invited to see. No member list, no
-- email, no ids. Guessing a token remains a 128-bit search.
--
-- Same shape as 039's version otherwise, including returning zero rows for a
-- token that is unknown, expired or already redeemed so the join screen keeps
-- one "no longer valid" state rather than distinguishing cases it should not
-- leak.
create or replace function peek_club_invite(invite_token text)
returns table (club_name text, club_crest_url text, role text)
language sql stable security definer set search_path = '' as $$
  select c.name, c.crest_url, i.role
  from public.club_invite i
  join public.club c on c.id = i.club_id
  where i.token = invite_token
    and i.redeemed_at is null
    and i.expires_at > now();
$$;
