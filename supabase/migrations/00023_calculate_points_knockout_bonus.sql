-- =============================================================================
-- Migration: 00023_calculate_points_knockout_bonus.sql
-- Purpose  : Add a +1 "knockout winner" bonus to calculate_points(). In a
--            knockout, a fixture that ends level (home_score = away_score) and
--            is decided on penalties still has a winner — but the scoreline
--            buckets (exact / goal-diff / result) cannot reward picking it,
--            because the result IS a draw. The bonus rewards a correct
--            predicted_advances (00022) pick in exactly that case.
--
-- When it fires (ALL must hold):
--   - NEW.stage <> 'group'                      (knockouts only)
--   - NEW.home_score = NEW.away_score           (level after regulation/ET)
--   - penalties set and NOT equal               (the tie was decided on pens)
--   - prediction.predicted_advances matches the side that won the shootout
--
-- It does NOT fire when the score is non-level: a winner decided in regulation
-- or extra time already shows in the score, so correct_result rewards it and a
-- penalty bonus would be redundant (and impossible — no penalties were taken).
--
-- The +1 STACKS on top of whatever scoreline bucket the prediction earned, so a
-- user can score e.g. exact_score (draw hit) + 1. The bonus is a fixed +1 by
-- product decision (not part of scoring_rules).
--
-- Re-run safety inherits from the parent trigger's OLD/NEW status guard.
-- Depends  : 00003 (calculate_points), 00020 (penalties), 00022 (predicted_advances)
-- Rollback : supabase/rollbacks/00023_rollback_calculate_points_knockout_bonus.sql
-- =============================================================================

CREATE OR REPLACE FUNCTION calculate_points() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  rules        JSONB;
  pts          INTEGER;
  pred         RECORD;
  pen_decided  BOOLEAN;
  winner_side  TEXT;
BEGIN
  -- Only run when a match transitions TO 'finished' for the first time.
  IF NEW.status <> 'finished' OR OLD.status = 'finished' THEN
    RETURN NEW;
  END IF;
  IF NEW.home_score IS NULL OR NEW.away_score IS NULL THEN
    RETURN NEW;
  END IF;

  -- A knockout tie was decided on penalties when the final score is level and
  -- both penalty columns are set to different values. The winning SIDE is the
  -- one with more shootout goals.
  pen_decided := NEW.stage <> 'group'
    AND NEW.home_score = NEW.away_score
    AND NEW.home_penalties IS NOT NULL
    AND NEW.away_penalties IS NOT NULL
    AND NEW.home_penalties <> NEW.away_penalties;

  winner_side := CASE
    WHEN pen_decided AND NEW.home_penalties > NEW.away_penalties THEN 'home'
    WHEN pen_decided THEN 'away'
    ELSE NULL
  END;

  FOR pred IN
    SELECT p.id, p.user_id, p.room_id,
           p.predicted_home, p.predicted_away, p.predicted_advances,
           r.scoring_rules
    FROM predictions p
    JOIN rooms r ON r.id = p.room_id
    WHERE p.match_id = NEW.id
      AND p.locked_at IS NOT NULL  -- only score locked predictions
  LOOP
    rules := pred.scoring_rules;

    -- Priority order (DOCUMENTED — R-TR-18):
    --   1. exact_score      — exact home AND away score match
    --   2. correct_goal_diff — goal difference matches but not exact score
    --   3. correct_result    — correct W/D/L outcome but neither of the above
    --   4. 0                 — none of the above
    -- A prediction earns ONLY the highest matching bucket.
    pts := CASE
      WHEN pred.predicted_home = NEW.home_score
       AND pred.predicted_away = NEW.away_score
        THEN (rules->>'exact_score')::int

      WHEN (pred.predicted_home - pred.predicted_away)
         = (NEW.home_score - NEW.away_score)
        THEN (rules->>'correct_goal_diff')::int

      WHEN sign(pred.predicted_home - pred.predicted_away)
         = sign(NEW.home_score - NEW.away_score)
        THEN (rules->>'correct_result')::int

      ELSE 0
    END;

    -- Knockout winner bonus (+1, fixed): the tie went to penalties and the user
    -- picked the advancing side. Stacks on top of the scoreline bucket above.
    IF winner_side IS NOT NULL AND pred.predicted_advances = winner_side THEN
      pts := pts + 1;
    END IF;

    UPDATE predictions
      SET points_awarded = pts
      WHERE id = pred.id;

    UPDATE room_members
      SET total_points = total_points + pts
      WHERE room_id = pred.room_id
        AND user_id = pred.user_id;
  END LOOP;

  RETURN NEW;
END $$;
