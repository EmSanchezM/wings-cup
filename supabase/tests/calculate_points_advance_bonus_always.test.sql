-- =============================================================================
-- pgTAP test: calculate_points() generalised advance bonus  (migration 00024)
--
-- Verifies the +1 bonus for correctly picking the advancing side on ANY
-- knockout decision method, the delta-based idempotency, and late penalty entry:
--   - knockout decided in regulation + correct pick -> scoreline + 1  (NEW rule)
--   - knockout decided in regulation + wrong pick    -> scoreline only
--   - penalty-decided tie + correct pick             -> scoreline + 1 (regression)
--   - group-stage draw + pick                        -> no bonus ever
--   - penalties entered AFTER finish                 -> match re-scores, bonus applied
--   - re-running the same finish update              -> no double-count (idempotent)
--
-- Run with:  supabase test db
-- Inserting into auth.users fires handle_new_user(), creating the profile.
-- Inserting the room fires the owner-membership trigger. Runs in a tx, ROLLBACKs.
-- =============================================================================
begin;
select plan(8);

-- ---------------------------------------------------------------------------
-- Fixtures
-- ---------------------------------------------------------------------------
insert into auth.users (id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data)
values (
  '00000000-0000-0000-0000-0000000000a1',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'ab@test.local',
  '{"provider":"email"}'::jsonb,
  '{"display_name":"AB Tester"}'::jsonb
);

-- Room with default scoring rules ({exact:5,diff:3,result:1}); the create
-- trigger adds the owner (a1) to room_members at total_points 0.
insert into rooms (id, name, invite_code, created_by)
  values ('00000000-0000-0000-0000-0000000000b1', 'AB Room', 'ABROOM', '00000000-0000-0000-0000-0000000000a1');

-- m1/m2: knockouts decided in regulation; m3: penalty tie; m4: group draw;
-- m5: knockout that will get penalties entered AFTER finishing.
insert into matches (id, external_id, home_team, away_team, kickoff_at, status, stage) values
  ('00000000-0000-0000-0000-0000000000c1', 'test-501', 'Alpha', 'Beta',    now() - interval '2 hours', 'scheduled', 'semi'),
  ('00000000-0000-0000-0000-0000000000c2', 'test-502', 'Gamma', 'Delta',   now() - interval '2 hours', 'scheduled', 'semi'),
  ('00000000-0000-0000-0000-0000000000c3', 'test-503', 'Echo',  'Foxtrot', now() - interval '2 hours', 'scheduled', 'quarter'),
  ('00000000-0000-0000-0000-0000000000c4', 'test-504', 'Golf',  'Hotel',   now() - interval '2 hours', 'scheduled', 'group'),
  ('00000000-0000-0000-0000-0000000000c5', 'test-505', 'India', 'Juliet',  now() - interval '2 hours', 'scheduled', 'semi');

-- Locked predictions (locked_at set so they score).
insert into predictions (room_id, user_id, match_id, predicted_home, predicted_away, predicted_advances, locked_at) values
  -- m1: exact score hit (2-1) AND correct advances pick (home) -> 5 + 1 = 6
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000c1', 2, 1, 'home', now()),
  -- m2: exact score hit (2-1) but WRONG advances pick (away) -> 5 only
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000c2', 2, 1, 'away', now()),
  -- m3: exact draw hit (1-1) + correct advances pick (home) on penalties -> 5 + 1 = 6
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000c3', 1, 1, 'home', now()),
  -- m4: group draw hit (0-0), advances pick set -> 5 only (no bonus in group)
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000c4', 0, 0, 'home', now()),
  -- m5: exact draw hit (1-1) + correct advances pick (home); penalties come later
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000c5', 1, 1, 'home', now());

-- ---------------------------------------------------------------------------
-- Act: finalize each match.
-- ---------------------------------------------------------------------------
-- m1: 2-1 in regulation, home advances. Pick 'home' correct -> bonus (NEW rule).
update matches set status = 'finished', home_score = 2, away_score = 1
  where id = '00000000-0000-0000-0000-0000000000c1';

-- m2: 2-1 in regulation, home advances. Pick 'away' wrong -> no bonus.
update matches set status = 'finished', home_score = 2, away_score = 1
  where id = '00000000-0000-0000-0000-0000000000c2';

-- m3: 1-1, penalties 4-2 -> home advances. Pick 'home' correct -> bonus.
update matches set status = 'finished', home_score = 1, away_score = 1,
                   home_penalties = 4, away_penalties = 2
  where id = '00000000-0000-0000-0000-0000000000c3';

-- m4: 0-0 group draw.
update matches set status = 'finished', home_score = 0, away_score = 0
  where id = '00000000-0000-0000-0000-0000000000c4';

-- m5, step A: finish level 1-1 with NO penalties yet -> no winner, no bonus (5).
update matches set status = 'finished', home_score = 1, away_score = 1
  where id = '00000000-0000-0000-0000-0000000000c5';

-- ---------------------------------------------------------------------------
-- Assert (before late penalties on m5)
-- ---------------------------------------------------------------------------
select is(
  (select points_awarded from predictions where match_id = '00000000-0000-0000-0000-0000000000c1'),
  6,
  'regulation win + correct advances pick = scoreline + 1 (new rule)');

select is(
  (select points_awarded from predictions where match_id = '00000000-0000-0000-0000-0000000000c2'),
  5,
  'regulation win + WRONG advances pick = scoreline only');

select is(
  (select points_awarded from predictions where match_id = '00000000-0000-0000-0000-0000000000c3'),
  6,
  'penalty tie + correct advances pick = scoreline + 1 (regression)');

select is(
  (select points_awarded from predictions where match_id = '00000000-0000-0000-0000-0000000000c4'),
  5,
  'group-stage draw never grants the advance bonus');

select is(
  (select points_awarded from predictions where match_id = '00000000-0000-0000-0000-0000000000c5'),
  5,
  'level knockout with no penalties yet = scoreline only, no winner resolved');

-- ---------------------------------------------------------------------------
-- Act: enter m5 penalties AFTER it already finished -> must re-score to 6.
-- ---------------------------------------------------------------------------
update matches set home_penalties = 3, away_penalties = 2
  where id = '00000000-0000-0000-0000-0000000000c5';

select is(
  (select points_awarded from predictions where match_id = '00000000-0000-0000-0000-0000000000c5'),
  6,
  'penalties entered after finish re-score the match and apply the bonus');

-- Total so far: 6 + 5 + 6 + 5 + 6 = 28.
select is(
  (select total_points from room_members
     where room_id = '00000000-0000-0000-0000-0000000000b1'
       and user_id = '00000000-0000-0000-0000-0000000000a1'),
  28,
  'room_members total reflects each bonus exactly once');

-- ---------------------------------------------------------------------------
-- Act: re-run an identical finish update -> delta 0, no double-count.
-- ---------------------------------------------------------------------------
update matches set status = 'finished', home_score = 2, away_score = 1
  where id = '00000000-0000-0000-0000-0000000000c1';

select is(
  (select total_points from room_members
     where room_id = '00000000-0000-0000-0000-0000000000b1'
       and user_id = '00000000-0000-0000-0000-0000000000a1'),
  28,
  're-running an identical finish update does not double-count (idempotent)');

select finish();
rollback;
