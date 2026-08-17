-- Phase 0.2 sanity check — run after schema.sql, in the SQL editor (runs as
-- postgres, so RLS being on doesn't block this).
-- Prerequisite: create at least one user first — Authentication -> Users ->
-- Add user (any email/password is fine, this is throwaway).

do $$
declare
  v_user_id   uuid;
  v_team_id   uuid;
  v_player_id uuid;
  v_session_id uuid;
  v_drill_id  uuid;
begin
  select id into v_user_id from auth.users order by created_at limit 1;
  if v_user_id is null then
    raise exception 'No user found in auth.users - create one first via Authentication -> Users -> Add user.';
  end if;

  -- team (trigger should auto-insert a matching team_coaches row)
  insert into team (name, format, owner_id)
  values ('Sanity Check FC', '11v11', v_user_id)
  returning id into v_team_id;

  -- player
  insert into player (team_id, name, position, dob, squad_number)
  values (v_team_id, 'Test Player', 'CM', '2010-01-01', 8)
  returning id into v_player_id;

  -- player_notes
  insert into player_notes (player_id, author_id, body)
  values (v_player_id, v_user_id, 'First note - settling in well.');

  -- session
  insert into session (team_id, date, duration_minutes, physical_load, equipment, coaching_notes, season_label)
  values (v_team_id, current_date, 60, 3, 'cones, bibs', 'Focus on pressing triggers', 'Autumn 2026')
  returning id into v_session_id;

  -- availability
  insert into availability (session_id, player_id, status, reason)
  values (v_session_id, v_player_id, 'available', null);

  -- drill (uses the real phase JSON shape from the project plan §5)
  insert into drill (team_id, name, pitch_format, phases)
  values (
    v_team_id,
    'Rondo Warm-up',
    'small_sided',
    '[{"id":"phase-1","label":"Initial setup","duration_seconds":30,
       "players":[{"id":"p1","x":0.42,"y":0.61,"team":"attack","number":9,"label":"CF"}],
       "cones":[{"id":"c1","x":0.3,"y":0.5,"color":"orange"}],
       "balls":[{"id":"b1","x":0.5,"y":0.5}],
       "arrows":[{"id":"a1","from":{"x":0.42,"y":0.61},"to":{"x":0.55,"y":0.4},"style":"run"}],
       "annotations":[{"id":"t1","x":0.1,"y":0.1,"text":"Press trigger"}]}]'::jsonb
  )
  returning id into v_drill_id;

  -- session_drills
  insert into session_drills (session_id, drill_id, order_index, planned_duration_minutes, notes)
  values (v_session_id, v_drill_id, 1, 15, 'Warm-up block');

  raise notice 'Sanity check passed. team_id=%, player_id=%, session_id=%, drill_id=%',
    v_team_id, v_player_id, v_session_id, v_drill_id;
end $$;

-- Should show 1 row everywhere, including team_coaches (proves the trigger fired)
select 'team' as tbl, count(*) from team
union all select 'team_coaches', count(*) from team_coaches
union all select 'player', count(*) from player
union all select 'player_notes', count(*) from player_notes
union all select 'session', count(*) from session
union all select 'availability', count(*) from availability
union all select 'drill', count(*) from drill
union all select 'session_drills', count(*) from session_drills;

-- Cleanup (optional): uncomment to remove the test data. Cascades through
-- everything else via the FKs.
-- delete from team where name = 'Sanity Check FC';
