-- =============================================================================
-- Migration: 00024_knockout_advance_bonus_always.sql
-- Purpose  : Generalise the +1 "knockout winner" bonus so it fires whenever a
--            user correctly picks the advancing side of ANY knockout fixture --
--            decided in regulation, extra time, OR penalties -- not only on a
--            penalty-decided tie.
--
--            Product change (supersedes 00023): the previous rule withheld the
--            bonus on non-level scores, arguing correct_result already rewarded
--            the pick. Users experienced that as "I called who advances and got
--            nothing extra". The bonus is now a flat +1 for a correct
--            predicted_advances pick on any knockout, STACKED on the scoreline
--            bucket.
--
-- The advancing side (winner_side) is resolved for every knockout:
--   - home_score > away_score            -> 'home'
--   - home_score < away_score            -> 'away'
--   - level + penalties set & unequal    -> the penalty winner's side
--   - level + no penalties (data error)  -> NULL (no bonus, cannot resolve)
--   - group stage                        -> NULL (never a bonus)
--
-- Two robustness changes over 00003/00023:
--   1. The OLD.status='finished' guard is REMOVED and the trigger now also fires
--      on home_penalties/away_penalties changes. Entering penalties (or
--      correcting a score) on an already-finished match now RE-SCORES it instead
--      of being silently ignored. This closes the original timing bug where a
--      score/penalty entered after the live->finished flip never scored.
--   2. Points are applied as a DELTA (new - old) to room_members.total_points and
--      only when the value actually changes, so the function is fully idempotent:
--      re-runs, corrections, and late penalty entry all converge to the correct
--      total without double-counting.
--
-- NOT handled (out of scope, unchanged from before): un-finishing a match
-- (finished -> live) leaves its awarded points in place until it is finished
-- again, at which point the delta recomputes correctly.
--
-- Historical data: rows already played were recomputed out-of-band with the new
-- rule at deploy time; this migration only changes forward behaviour.
--
-- Depends  : 00003 (calculate_points + trigger), 00020 (penalties),
--            00022 (predicted_advances)
-- Rollback : supabase/rollbacks/00024_rollback_knockout_advance_bonus_always.sql
-- =============================================================================

CREATE OR REPLACE FUNCTION calculate_points() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  pred         RECORD;
  new_pts      INTEGER;
  winner_side  TEXT;
BEGIN
  -- Score any finished match with a final score. No OLD.status guard: re-runs
  -- are made safe by the delta application below, so a score/penalty correction
  -- on an already-finished match is re-scored instead of ignored.
  IF NEW.status <> 'finished' THEN
    RETURN NEW;
  END IF;
  IF NEW.home_score IS NULL OR NEW.away_score IS NULL THEN
    RETURN NEW;
  END IF;

  -- The side that advances, resolved for every knockout decision method.
  -- Group matches (and unresolvable level ties) yield NULL -> never a bonus.
  winner_side := CASE
    WHEN NEW.stage = 'group'               THEN NULL
    WHEN NEW.home_score > NEW.away_score    THEN 'home'
    WHEN NEW.home_score < NEW.away_score    THEN 'away'
    WHEN NEW.home_penalties IS NOT NULL
     AND NEW.away_penalties IS NOT NULL
     AND NEW.home_penalties <> NEW.away_penalties
      THEN CASE WHEN NEW.home_penalties > NEW.away_penalties THEN 'home' ELSE 'away' END
    ELSE NULL
  END;

  FOR pred IN
    SELECT p.id, p.user_id, p.room_id,
           p.points_awarded AS old_pts,
           p.predicted_home, p.predicted_away, p.predicted_advances,
           r.scoring_rules
    FROM predictions p
    JOIN rooms r ON r.id = p.room_id
    WHERE p.match_id = NEW.id
      AND p.locked_at IS NOT NULL  -- only score locked predictions
  LOOP
    -- Scoreline bucket (highest matching only) -- unchanged priority order.
    new_pts := CASE
      WHEN pred.predicted_home = NEW.home_score
       AND pred.predicted_away = NEW.away_score
        THEN (pred.scoring_rules->>'exact_score')::int

      WHEN (pred.predicted_home - pred.predicted_away)
         = (NEW.home_score - NEW.away_score)
        THEN (pred.scoring_rules->>'correct_goal_diff')::int

      WHEN sign(pred.predicted_home - pred.predicted_away)
         = sign(NEW.home_score - NEW.away_score)
        THEN (pred.scoring_rules->>'correct_result')::int

      ELSE 0
    END;

    -- Knockout advance bonus (+1, fixed): correct pick of the advancing side,
    -- ANY decision method. Stacks on top of the scoreline bucket above.
    IF winner_side IS NOT NULL AND pred.predicted_advances = winner_side THEN
      new_pts := new_pts + 1;
    END IF;

    -- Idempotent: write and adjust the running total only by the delta, and only
    -- when it actually changed. Re-runs converge instead of double-counting.
    IF new_pts IS DISTINCT FROM pred.old_pts THEN
      UPDATE predictions
        SET points_awarded = new_pts
        WHERE id = pred.id;

      UPDATE room_members
        SET total_points = total_points + (new_pts - pred.old_pts)
        WHERE room_id = pred.room_id
          AND user_id = pred.user_id;
    END IF;
  END LOOP;

  RETURN NEW;
END $$;

-- Rebind the trigger to also fire on penalty changes so late-entered penalties
-- re-score the match (the delta logic keeps that safe).
DROP TRIGGER IF EXISTS matches_calculate_points ON matches;
CREATE TRIGGER matches_calculate_points
  AFTER UPDATE OF status, home_score, away_score, home_penalties, away_penalties ON matches
  FOR EACH ROW EXECUTE FUNCTION calculate_points();
