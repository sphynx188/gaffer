-- scripts/seed-demo.sql — applied via MCP execute_sql. Idempotent via the
-- existence check on 'FC Barcelona (demo)'. <LEGACY_ADMIN_EMAIL> resolved
-- to maxburatto68@gmail.com per Task 0 recon.
--
-- Correction vs. the plan draft (Task 0 recon / Task 10's Amendment entry):
-- the tactic INSERT column list here includes `description` and
-- `phase_of_play`, which the plan-draft version omitted — real columns on
-- `tactic`, the same silent-omission risk already found and fixed once in
-- migration 030's copy_collection_to_club.
do $$
declare
  v_admin uuid := (select id from auth.users where email = 'barca.admin@gafferdemo.app');
  v_u12   uuid := (select id from auth.users where email = 'barca.u12@gafferdemo.app');
  v_u18   uuid := (select id from auth.users where email = 'barca.u18@gafferdemo.app');
  v_rvc   uuid := (select id from auth.users where email = 'riverside.coach@gafferdemo.app');
  v_legacy_club uuid := (select cm.club_id from club_member cm
      join auth.users u on u.id = cm.user_id
      where u.email = 'maxburatto68@gmail.com' and cm.role = 'admin' limit 1);
  v_barca uuid; v_riverside uuid; v_col uuid; new_id uuid; r record; n int;
  cols text[] := array['U12 Foundation','U14 Passing Block','U18 Tactical','First Team Pressing'];
  prefixes text[] := array['U12','U14','U18','First Team'];
  col_ids uuid[] := array[]::uuid[];
begin
  if v_admin is null then raise exception 'run seed-demo-users.mjs first'; end if;
  if exists (select 1 from club where name = 'FC Barcelona (demo)') then
    raise notice 'already seeded'; return; end if;

  insert into club (name) values ('FC Barcelona (demo)') returning id into v_barca;
  insert into club (name) values ('Riverside Academy') returning id into v_riverside;
  insert into club_member (club_id, user_id, role, display_name) values
    (v_barca, v_admin, 'admin', 'Alex Marino'),
    (v_barca, v_u12,  'coach', 'Sam Whitfield'),
    (v_barca, v_u18,  'coach', 'Jordan Achebe'),
    (v_riverside, v_admin, 'admin', 'Alex Marino'),
    (v_riverside, v_rvc, 'coach', 'Riley Donnelly');

  for n in 1..4 loop
    insert into collection (club_id, name, created_by)
      values (v_barca, cols[n], v_admin) returning id into v_col;
    col_ids := col_ids || v_col;
    -- 4 renamed drill copies per collection from the legacy library
    for r in (select d.* from drill d where d.club_id = v_legacy_club
              order by d.created_at limit 4) loop
      insert into drill (club_id, created_by, name, scene, keyframes,
        duration_seconds, pitch, orientation, objective, description,
        category, subcategory, duration_minutes, players_recommended,
        min_players, max_players, age_min, age_max, difficulty, intensity,
        phase_of_play, session_block, setup_minutes, learning_outcome,
        video_url, coaching, share_token, thumbnail_url)
      values (v_barca, v_admin, prefixes[n] || ' · ' || r.name, r.scene,
        r.keyframes, r.duration_seconds, r.pitch, r.orientation, r.objective,
        r.description, r.category, r.subcategory, r.duration_minutes,
        r.players_recommended, r.min_players, r.max_players, r.age_min,
        r.age_max, r.difficulty, r.intensity, r.phase_of_play,
        r.session_block, r.setup_minutes, r.learning_outcome, r.video_url,
        r.coaching, null, null)
      returning id into new_id;
      insert into collection_drill (collection_id, drill_id) values (v_col, new_id);
    end loop;
  end loop;

  -- one tactic copy into each of the two tactical collections
  for r in (select t.* from tactic t where t.club_id = v_legacy_club
            order by t.created_at limit 2) loop
    insert into tactic (club_id, created_by, team_id, name, scene, keyframes,
      duration_seconds, pitch, sides, phases, view, description, phase_of_play,
      share_token, thumbnail_url)
    values (v_barca, v_admin, null, 'FC · ' || r.name,
      jsonb_set(r.scene, '{entities}', coalesce(
        (select jsonb_agg(e - 'player_id')
         from jsonb_array_elements(r.scene->'entities') e), '[]'::jsonb)),
      r.keyframes, r.duration_seconds, r.pitch, r.sides, r.phases, r.view,
      r.description, r.phase_of_play, null, null)
    returning id into new_id;
    insert into collection_tactic (collection_id, tactic_id)
      values (col_ids[3], new_id);
  end loop;

  -- grants: each coach gets their two collections
  insert into collection_access (collection_id, user_id, granted_by) values
    (col_ids[1], v_u12, v_admin), (col_ids[2], v_u12, v_admin),
    (col_ids[3], v_u18, v_admin), (col_ids[4], v_u18, v_admin);
end $$;
