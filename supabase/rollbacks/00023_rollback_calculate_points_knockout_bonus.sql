-- Rollback for 00023_calculate_points_knockout_bonus.sql
-- Restores the calculate_points() body from 00003 (no knockout winner bonus).
CREATE OR REPLACE FUNCTION calculate_points() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  rules JSONB;
  pts   INTEGER;
  pred  RECORD;
BEGIN
  IF NEW.status <> 'finished' OR OLD.status = 'finished' THEN
    RETURN NEW;
  END IF;
  IF NEW.home_score IS NULL OR NEW.away_score IS NULL THEN
    RETURN NEW;
  END IF;

  FOR pred IN
    SELECT p.id, p.user_id, p.room_id,
           p.predicted_home, p.predicted_away,
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
