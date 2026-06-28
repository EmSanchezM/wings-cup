-- =============================================================================
-- Migration: 00022_prediction_advance_pick.sql
-- Purpose  : Let a user pick WHO advances when a knockout tie is decided on
--            penalties. A prediction only stores a scoreline, so a user who
--            predicts a draw has no way to express the eventual winner. This
--            column captures that contingency pick and powers the +1 knockout
--            winner bonus in calculate_points() (00023).
-- Notes    : Stores the SIDE ('home'/'away'), NOT the team name. Knockout slots
--            start as placeholders ('Ganador P{n}') that advance_bracket (00021)
--            rewrites to real names once earlier rounds finish; a stored team
--            name would no longer match at scoring time. The side is immune to
--            that rewrite. Nullable: only set for knockout predictions, optional
--            even there. Idempotent via IF NOT EXISTS / DROP IF EXISTS.
-- Rollback : supabase/rollbacks/00022_rollback_prediction_advance_pick.sql
-- =============================================================================

ALTER TABLE predictions
  ADD COLUMN IF NOT EXISTS predicted_advances TEXT;

ALTER TABLE predictions DROP CONSTRAINT IF EXISTS predictions_advances_check;

ALTER TABLE predictions ADD CONSTRAINT predictions_advances_check
  CHECK (predicted_advances IS NULL OR predicted_advances IN ('home', 'away'));

COMMENT ON COLUMN predictions.predicted_advances IS
  'Tiebreak pick for a knockout match: which side the user expects to advance on penalties. ''home'' | ''away'' | NULL. Powers the +1 winner bonus (00023).';
