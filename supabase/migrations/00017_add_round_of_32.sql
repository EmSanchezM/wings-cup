-- =============================================================================
-- Migration: 00017_add_round_of_32.sql
-- Purpose  : Allow the 'round_of_32' stage on matches.
--            FIFA World Cup 2026 expands to 48 teams / 12 groups, introducing a
--            Round of 32 between the group stage and the Round of 16. The
--            original stage CHECK (00001_schema.sql) predates that format and
--            rejects it, so seeding the real bracket fails without this change.
-- Notes    : Drop + re-add the column CHECK constraint. The inline constraint in
--            00001 is auto-named `matches_stage_check`. Idempotent via IF EXISTS.
-- =============================================================================

ALTER TABLE matches DROP CONSTRAINT IF EXISTS matches_stage_check;

ALTER TABLE matches ADD CONSTRAINT matches_stage_check
  CHECK (stage IN (
    'group',
    'round_of_32',
    'round_of_16',
    'quarter',
    'semi',
    'final',
    'third_place'
  ));
