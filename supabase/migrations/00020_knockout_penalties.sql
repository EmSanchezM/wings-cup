-- =============================================================================
-- Migration: 00020_knockout_penalties.sql
-- Purpose  : Record the penalty-shootout result of a knockout tie.
--            matches only stores home_score / away_score, so a knockout fixture
--            that ends level (home_score = away_score) has no way to express who
--            advanced. The bracket-advance trigger (00021) needs that tiebreak to
--            resolve "Ganador P{n}" / "Perdedor P{n}" downstream slots.
-- Notes    : Both columns are nullable and only set when a tie went to penalties.
--            CHECK enforces: non-negative, and both-or-neither (no half-filled
--            shootout). Idempotent via IF NOT EXISTS / DROP IF EXISTS.
-- Rollback : supabase/rollbacks/00020_rollback_knockout_penalties.sql
-- =============================================================================

ALTER TABLE matches
  ADD COLUMN IF NOT EXISTS home_penalties INTEGER,
  ADD COLUMN IF NOT EXISTS away_penalties INTEGER;

ALTER TABLE matches DROP CONSTRAINT IF EXISTS matches_penalties_check;

ALTER TABLE matches ADD CONSTRAINT matches_penalties_check
  CHECK (
    (home_penalties IS NULL OR home_penalties >= 0)
    AND (away_penalties IS NULL OR away_penalties >= 0)
    AND ((home_penalties IS NULL) = (away_penalties IS NULL))
  );

COMMENT ON COLUMN matches.home_penalties IS
  'Penalty-shootout goals for home_team; NULL unless a knockout tie was decided on penalties.';
COMMENT ON COLUMN matches.away_penalties IS
  'Penalty-shootout goals for away_team; NULL unless a knockout tie was decided on penalties.';
