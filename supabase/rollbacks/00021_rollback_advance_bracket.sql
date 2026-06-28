-- Rollback for 00021_advance_bracket.sql
DROP TRIGGER IF EXISTS matches_advance_bracket ON matches;
DROP FUNCTION IF EXISTS advance_bracket();
