-- Rollback for 00020_knockout_penalties.sql
ALTER TABLE matches DROP CONSTRAINT IF EXISTS matches_penalties_check;
ALTER TABLE matches DROP COLUMN IF EXISTS home_penalties;
ALTER TABLE matches DROP COLUMN IF EXISTS away_penalties;
