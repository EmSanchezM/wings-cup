-- =============================================================================
-- Migration: 00021_advance_bracket.sql
-- Purpose  : Auto-resolve knockout bracket slots when a match finishes.
--            From the Round of 16 onward, every slot is seeded as a placeholder
--            "Ganador P{n}" (winner of match n) or "Perdedor P{n}" (loser of
--            match n, e.g. the third-place game). The match number is the numeric
--            tail of external_id ('fifa26-073' -> 73). When match n transitions to
--            'finished', this trigger writes the real team names into any slot
--            still holding its placeholder.
--
--            This is intentionally NOT applied to the group -> round_of_32 step:
--            that mapping depends on final group standings plus FIFA's best
--            third-placed allocation table, which a row-level trigger cannot
--            compute. Group matches are skipped (and would also draw legitimately,
--            which has no winner). Round-of-32 slots are resolved out-of-band.
--
-- Winner   : regulation/extra-time score first; a level score falls back to the
--            penalty columns (00020). A tie with no penalty winner leaves the
--            downstream placeholders untouched and raises a WARNING.
--
-- No loop  : the trigger is bound to status/score/penalty columns only, so the
--            home_team/away_team writes it performs never re-fire it.
--
-- Re-runs  : fires on every update to a finished knockout match (not only the
--            first), so penalties entered in a follow-up update still propagate.
--            The UPDATEs only touch slots that STILL hold the placeholder, so they
--            are idempotent. Correcting a result AFTER the downstream slot was
--            already resolved is out of scope -- fix those rows manually.
--
-- Depends  : 00001 (matches), 00020 (home_penalties/away_penalties)
-- Rollback : supabase/rollbacks/00021_rollback_advance_bracket.sql
-- =============================================================================

CREATE OR REPLACE FUNCTION advance_bracket()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
DECLARE
  v_num    INTEGER;
  v_winner TEXT;
  v_loser  TEXT;
BEGIN
  -- Only completed knockout fixtures with a final score are resolvable.
  IF NEW.status <> 'finished' THEN RETURN NEW; END IF;
  IF NEW.stage = 'group' THEN RETURN NEW; END IF;
  IF NEW.home_score IS NULL OR NEW.away_score IS NULL THEN RETURN NEW; END IF;
  IF NEW.external_id IS NULL OR NEW.external_id !~ '-[0-9]+$' THEN RETURN NEW; END IF;

  -- Match number = numeric tail of external_id ('fifa26-073' -> 73).
  v_num := (regexp_match(NEW.external_id, '-([0-9]+)$'))[1]::int;

  v_winner := CASE
    WHEN NEW.home_score > NEW.away_score THEN NEW.home_team
    WHEN NEW.home_score < NEW.away_score THEN NEW.away_team
    WHEN NEW.home_penalties IS NOT NULL
     AND NEW.away_penalties IS NOT NULL
     AND NEW.home_penalties <> NEW.away_penalties
      THEN CASE WHEN NEW.home_penalties > NEW.away_penalties
                THEN NEW.home_team ELSE NEW.away_team END
    ELSE NULL
  END;

  IF v_winner IS NULL THEN
    RAISE WARNING
      'advance_bracket: match % finished level with no penalty winner; downstream slots left as placeholders',
      NEW.external_id;
    RETURN NEW;
  END IF;

  v_loser := CASE WHEN v_winner = NEW.home_team THEN NEW.away_team ELSE NEW.home_team END;

  UPDATE matches SET home_team = v_winner WHERE home_team = 'Ganador P'  || v_num;
  UPDATE matches SET away_team = v_winner WHERE away_team = 'Ganador P'  || v_num;
  UPDATE matches SET home_team = v_loser  WHERE home_team = 'Perdedor P' || v_num;
  UPDATE matches SET away_team = v_loser  WHERE away_team = 'Perdedor P' || v_num;

  RETURN NEW;
END $$;

-- Bound to status/score/penalty columns only (NOT home_team/away_team) so the
-- cascade writes above cannot re-trigger it.
DROP TRIGGER IF EXISTS matches_advance_bracket ON matches;
CREATE TRIGGER matches_advance_bracket
  AFTER UPDATE OF status, home_score, away_score, home_penalties, away_penalties ON matches
  FOR EACH ROW EXECUTE FUNCTION advance_bracket();

COMMENT ON FUNCTION advance_bracket() IS
  'On a knockout match finishing, writes winner/loser into downstream "Ganador P{n}" / "Perdedor P{n}" slots. Skips group stage. See migration 00021.';
