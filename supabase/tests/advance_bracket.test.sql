-- =============================================================================
-- pgTAP test: advance_bracket()  (migration 00021)
--
-- Verifies the knockout bracket auto-advance trigger:
--   - winner/loser of a match decided on score propagate into the downstream
--     "Ganador P{n}" / "Perdedor P{n}" slots
--   - a level score falls back to the penalty columns to pick the winner
--   - a level score with no penalty winner leaves placeholders untouched
--   - group-stage matches are ignored (legitimate draws, no bracket slot)
--
-- Run with:  supabase test db
-- Isolated external_ids ('test-NNN') keep assertions clear of seeded rows.
-- The whole test runs in a transaction and ROLLBACKs.
-- =============================================================================
begin;
select plan(6);

-- ---------------------------------------------------------------------------
-- Fixtures
-- ---------------------------------------------------------------------------

-- Feeder matches (sources of winners/losers).
insert into matches (id, external_id, home_team, away_team, kickoff_at, status, stage) values
  ('00000000-0000-0000-0000-0000000000e1', 'test-201', 'Alpha', 'Beta',     now() - interval '2 hours', 'scheduled', 'semi'),
  ('00000000-0000-0000-0000-0000000000e2', 'test-202', 'Gamma', 'Delta',    now() - interval '2 hours', 'scheduled', 'semi'),
  ('00000000-0000-0000-0000-0000000000e3', 'test-203', 'Echo',  'Foxtrot',  now() - interval '2 hours', 'scheduled', 'quarter'),
  ('00000000-0000-0000-0000-0000000000e4', 'test-001', 'Gx',    'Gy',       now() - interval '2 hours', 'scheduled', 'group');

-- Downstream slots holding placeholders.
insert into matches (id, external_id, home_team, away_team, kickoff_at, status, stage) values
  ('00000000-0000-0000-0000-0000000000f1', 'test-301', 'Ganador P201',  'Ganador P202',  now() + interval '1 day', 'scheduled', 'final'),
  ('00000000-0000-0000-0000-0000000000f2', 'test-302', 'Perdedor P201', 'Perdedor P202', now() + interval '1 day', 'scheduled', 'third_place'),
  ('00000000-0000-0000-0000-0000000000f3', 'test-303', 'Ganador P203',  'TBD',           now() + interval '1 day', 'scheduled', 'final'),
  ('00000000-0000-0000-0000-0000000000f4', 'test-304', 'Ganador P1',    'TBD',           now() + interval '1 day', 'scheduled', 'final');

-- ---------------------------------------------------------------------------
-- Act
-- ---------------------------------------------------------------------------

-- 1. Semi decided on score: Alpha 2-1 Beta.
update matches set status = 'finished', home_score = 2, away_score = 1
  where id = '00000000-0000-0000-0000-0000000000e1';

-- 2. Semi level on score, decided on penalties: Gamma 1-1 (4-2) Delta.
update matches set status = 'finished', home_score = 1, away_score = 1,
                   home_penalties = 4, away_penalties = 2
  where id = '00000000-0000-0000-0000-0000000000e2';

-- 3. Quarter level with no penalties: Echo 0-0 Foxtrot (unresolved).
update matches set status = 'finished', home_score = 0, away_score = 0
  where id = '00000000-0000-0000-0000-0000000000e3';

-- 4. Group match drawn: must be ignored entirely.
update matches set status = 'finished', home_score = 1, away_score = 1
  where id = '00000000-0000-0000-0000-0000000000e4';

-- ---------------------------------------------------------------------------
-- Assert
-- ---------------------------------------------------------------------------
select is(
  (select home_team from matches where id = '00000000-0000-0000-0000-0000000000f1'),
  'Alpha',
  'score winner fills Ganador P201');

select is(
  (select home_team from matches where id = '00000000-0000-0000-0000-0000000000f2'),
  'Beta',
  'score loser fills Perdedor P201');

select is(
  (select away_team from matches where id = '00000000-0000-0000-0000-0000000000f1'),
  'Gamma',
  'penalty winner fills Ganador P202');

select is(
  (select away_team from matches where id = '00000000-0000-0000-0000-0000000000f2'),
  'Delta',
  'penalty loser fills Perdedor P202');

select is(
  (select home_team from matches where id = '00000000-0000-0000-0000-0000000000f3'),
  'Ganador P203',
  'tie with no penalty winner leaves the slot as a placeholder');

select is(
  (select home_team from matches where id = '00000000-0000-0000-0000-0000000000f4'),
  'Ganador P1',
  'group-stage match never advances the bracket');

select finish();
rollback;
