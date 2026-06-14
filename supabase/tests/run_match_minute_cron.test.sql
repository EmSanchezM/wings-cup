-- =============================================================================
-- pgTAP test: run_match_minute_cron()  (migration 00019)
--
-- Verifies the per-minute cron entrypoint that replaces the manual admin steps:
--   - scheduled matches whose kickoff has passed flip to 'live' with a 0-0 board
--   - future matches and non-'scheduled' (postponed/cancelled) matches are left alone
--   - predictions on started matches get locked
--   - every automatic transition is written to audit_log with the super-admin actor
--
-- Run with:  supabase test db
-- The whole test runs inside a transaction and ROLLBACKs, so it never pollutes
-- the seeded local database.
-- =============================================================================
begin;
select plan(8);

-- ---------------------------------------------------------------------------
-- Fixtures. Hard-coded UUIDs keep every assertion isolated from seed rows.
-- ---------------------------------------------------------------------------

-- Super-admin. Inserting into auth.users fires handle_new_user(), which creates
-- the profile row; we then flip is_super_admin under a service_role JWT claim to
-- satisfy the lock_super_admin_column() guard trigger.
insert into auth.users (id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data)
values (
  '00000000-0000-0000-0000-0000000000a1',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'cronadmin@test.local',
  '{"provider":"email"}'::jsonb,
  '{"display_name":"Cron Admin"}'::jsonb
);

set local "request.jwt.claims" = '{"role":"service_role"}';
update profiles
  set is_super_admin = true
  where id = '00000000-0000-0000-0000-0000000000a1';

-- Matches:
--   b1 = scheduled, kicked off 1 minute ago   -> must go live 0-0
--   b2 = scheduled, kicks off in 1 hour        -> untouched
--   b3 = postponed, "kicked off" 1 minute ago  -> must NOT be resurrected
insert into matches (id, home_team, away_team, kickoff_at, status) values
  ('00000000-0000-0000-0000-0000000000b1', 'Home A', 'Away A', now() - interval '1 minute', 'scheduled'),
  ('00000000-0000-0000-0000-0000000000b2', 'Home B', 'Away B', now() + interval '1 hour',   'scheduled'),
  ('00000000-0000-0000-0000-0000000000b3', 'Home C', 'Away C', now() - interval '1 minute', 'postponed');

-- A room + a prediction on the started match, to prove locking happens.
-- (room_members is irrelevant here: pgTAP runs as a superuser so RLS is bypassed,
-- and the on_room_created trigger handles owner membership if it needs to.)
insert into rooms (id, name, invite_code, created_by)
  values ('00000000-0000-0000-0000-0000000000c1', 'Test Room', 'TESTCRON1', '00000000-0000-0000-0000-0000000000a1');

insert into predictions (id, room_id, user_id, match_id, predicted_home, predicted_away)
  values (
    '00000000-0000-0000-0000-0000000000d1',
    '00000000-0000-0000-0000-0000000000c1',
    '00000000-0000-0000-0000-0000000000a1',
    '00000000-0000-0000-0000-0000000000b1',
    2, 1
  );

-- ---------------------------------------------------------------------------
-- Act
-- ---------------------------------------------------------------------------
select run_match_minute_cron();

-- ---------------------------------------------------------------------------
-- Assert
-- ---------------------------------------------------------------------------
select is(
  (select status from matches where id = '00000000-0000-0000-0000-0000000000b1'),
  'live',
  'past scheduled match transitions to live');

select is(
  (select home_score from matches where id = '00000000-0000-0000-0000-0000000000b1'),
  0,
  'started match home_score initialised to 0');

select is(
  (select away_score from matches where id = '00000000-0000-0000-0000-0000000000b1'),
  0,
  'started match away_score initialised to 0');

select is(
  (select status from matches where id = '00000000-0000-0000-0000-0000000000b2'),
  'scheduled',
  'future match is left scheduled');

select is(
  (select status from matches where id = '00000000-0000-0000-0000-0000000000b3'),
  'postponed',
  'postponed match is not resurrected to live');

select isnt(
  (select locked_at from predictions where id = '00000000-0000-0000-0000-0000000000d1'),
  null,
  'prediction on the started match gets locked');

select is(
  (select count(*)::int from audit_log
     where action = 'matches.auto_start'
       and target_id = '00000000-0000-0000-0000-0000000000b1'),
  1,
  'exactly one audit row for the auto transition');

select is(
  (select admin_id from audit_log
     where action = 'matches.auto_start'
       and target_id = '00000000-0000-0000-0000-0000000000b1'),
  '00000000-0000-0000-0000-0000000000a1'::uuid,
  'audit actor is the super-admin profile');

select finish();
rollback;
