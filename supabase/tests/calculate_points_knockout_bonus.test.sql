-- =============================================================================
-- pgTAP test: calculate_points() knockout winner bonus  (migration 00023)
--
-- Verifies the +1 bonus for picking the side that advances on penalties:
--   - knockout tie decided on penalties + correct predicted_advances -> +1 on
--     top of the scoreline bucket (exact draw 5 + 1 = 6)
--   - correct scoreline but WRONG advances pick -> no bonus
--   - correct advances pick with a match decided in regulation (non-level
--     score) -> +1 as well (rule generalised in 00024; previously no bonus)
--   - group-stage draw -> never a bonus even with a pick
--
-- Run with:  supabase test db
-- Inserting into auth.users fires handle_new_user(), creating the profile.
-- Inserting the room fires the owner-membership trigger. Runs in a tx, ROLLBACKs.
-- =============================================================================
begin;
select plan(5);

-- ---------------------------------------------------------------------------
-- Fixtures
-- ---------------------------------------------------------------------------
insert into auth.users (id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data)
values (
  '00000000-0000-0000-0000-0000000000a1',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'kb@test.local',
  '{"provider":"email"}'::jsonb,
  '{"display_name":"KB Tester"}'::jsonb
);

-- Room with default scoring rules ({exact:5,diff:3,result:1}); the create
-- trigger adds the owner (a1) to room_members at total_points 0.
insert into rooms (id, name, invite_code, created_by)
  values ('00000000-0000-0000-0000-0000000000b1', 'KB Room', 'KBROOM', '00000000-0000-0000-0000-0000000000a1');

-- m1/m2: knockout ties; m3: knockout decided in regulation; m4: group draw.
insert into matches (id, external_id, home_team, away_team, kickoff_at, status, stage) values
  ('00000000-0000-0000-0000-0000000000c1', 'test-401', 'Alpha', 'Beta',    now() - interval '2 hours', 'scheduled', 'semi'),
  ('00000000-0000-0000-0000-0000000000c2', 'test-402', 'Gamma', 'Delta',   now() - interval '2 hours', 'scheduled', 'semi'),
  ('00000000-0000-0000-0000-0000000000c3', 'test-403', 'Echo',  'Foxtrot', now() - interval '2 hours', 'scheduled', 'quarter'),
  ('00000000-0000-0000-0000-0000000000c4', 'test-404', 'Golf',  'Hotel',   now() - interval '2 hours', 'scheduled', 'group');

-- Locked predictions (locked_at set so they score).
insert into predictions (room_id, user_id, match_id, predicted_home, predicted_away, predicted_advances, locked_at) values
  -- m1: exact draw hit (1-1) AND correct advances pick (home) -> 5 + 1 = 6
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000c1', 1, 1, 'home', now()),
  -- m2: exact draw hit (1-1) but WRONG advances pick (away) -> 5 only
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000c2', 1, 1, 'away', now()),
  -- m3: exact score hit (2-1) + correct advances pick (home) in regulation -> 5 + 1 = 6 (00024)
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000c3', 2, 1, 'home', now()),
  -- m4: group draw hit (0-0), advances pick set -> 5 only (no bonus in group)
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000c4', 0, 0, 'home', now());

-- ---------------------------------------------------------------------------
-- Act: finalize each match.
-- ---------------------------------------------------------------------------
-- m1: 1-1, penalties 4-2 -> home advances. Pick 'home' is correct -> bonus.
update matches set status = 'finished', home_score = 1, away_score = 1,
                   home_penalties = 4, away_penalties = 2
  where id = '00000000-0000-0000-0000-0000000000c1';

-- m2: 1-1, penalties 5-3 -> home advances. Pick 'away' is wrong -> no bonus.
update matches set status = 'finished', home_score = 1, away_score = 1,
                   home_penalties = 5, away_penalties = 3
  where id = '00000000-0000-0000-0000-0000000000c2';

-- m3: 2-1 in regulation, no penalties.
update matches set status = 'finished', home_score = 2, away_score = 1
  where id = '00000000-0000-0000-0000-0000000000c3';

-- m4: 0-0 group draw.
update matches set status = 'finished', home_score = 0, away_score = 0
  where id = '00000000-0000-0000-0000-0000000000c4';

-- ---------------------------------------------------------------------------
-- Assert
-- ---------------------------------------------------------------------------
select is(
  (select points_awarded from predictions where match_id = '00000000-0000-0000-0000-0000000000c1'),
  6,
  'penalty tie + exact draw + correct advances pick = 5 + 1 bonus');

select is(
  (select points_awarded from predictions where match_id = '00000000-0000-0000-0000-0000000000c2'),
  5,
  'penalty tie + exact draw + WRONG advances pick = 5, no bonus');

select is(
  (select points_awarded from predictions where match_id = '00000000-0000-0000-0000-0000000000c3'),
  6,
  'match decided in regulation + correct advances pick = exact score + 1 (00024)');

select is(
  (select points_awarded from predictions where match_id = '00000000-0000-0000-0000-0000000000c4'),
  5,
  'group-stage draw never grants the knockout bonus');

-- Total across all four matches: 6 + 5 + 6 + 5 = 22 (two bonuses: m1 pens, m3 regulation).
select is(
  (select total_points from room_members
     where room_id = '00000000-0000-0000-0000-0000000000b1'
       and user_id = '00000000-0000-0000-0000-0000000000a1'),
  22,
  'room_members total reflects the two +1 bonuses across the four matches');

select finish();
rollback;
