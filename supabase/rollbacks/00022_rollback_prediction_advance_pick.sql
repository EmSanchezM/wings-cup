-- Rollback for 00022_prediction_advance_pick.sql
ALTER TABLE predictions DROP CONSTRAINT IF EXISTS predictions_advances_check;
ALTER TABLE predictions DROP COLUMN IF EXISTS predicted_advances;
