-- Rollback for 00024_knockout_advance_bonus_always.sql
-- Restores the 00023 behaviour: the +1 bonus fires ONLY on a penalty-decided
-- tie, points are applied by increment (not delta), and the trigger fires only
-- on status/home_score/away_score. WARNING: reverting the delta model to the
-- increment model means totals can drift again on re-runs/corrections.
CREATE OR REPLACE FUNCTION calculate_points() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  rules        JSONB;
  pts          INTEGER;
  pred         RECORD;
  pen_decided  BOOLEAN;
  winner_side  TEXT;
BEGIN
  IF NEW.status <> 'finished' OR OLD.status = 'finished' THEN
    RETURN NEW;
  END IF;
  IF NEW.home_score IS NULL OR NEW.away_score IS NULL THEN
    RETURN NEW;
  END IF;

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
      AND p.locked_at IS NOT NULL
  LOOP
    rules := pred.scoring_rules;

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

-- Restore the narrower trigger binding (no penalty columns).
DROP TRIGGER IF EXISTS matches_calculate_points ON matches;
CREATE TRIGGER matches_calculate_points
  AFTER UPDATE OF status, home_score, away_score ON matches
  FOR EACH ROW EXECUTE FUNCTION calculate_points();
