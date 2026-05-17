-- =============================================================================
-- Migration: 00014_fix_pred_rls.sql
-- Purpose  : Patch prediction RLS policies to use (SELECT auth.uid()) instead
--            of bare auth.uid(). Mirrors the rooms/room_members fix in 00013.
--
--            Bare auth.uid() in WITH CHECK / USING can raise 42501 even when
--            the correct user UUID is present in the session (Supabase/PG
--            planner evaluation timing issue on INSERT/UPDATE).
--
--            The (SELECT auth.uid()) subquery form is evaluated once per
--            statement by the planner, avoiding the timing issue.
--
-- Policies patched:
--   pred_insert_own_before_kickoff  (WITH CHECK: user_id = auth.uid())
--   pred_update_own_unlocked        (USING + WITH CHECK: user_id = auth.uid())
--   pred_delete_own_unlocked        (USING: user_id = auth.uid())
--
-- Depends  : 00002_rls.sql
-- Idempotency: DROP POLICY IF EXISTS + CREATE POLICY (safe to re-run)
-- =============================================================================

DROP POLICY IF EXISTS pred_insert_own_before_kickoff ON predictions;
CREATE POLICY pred_insert_own_before_kickoff ON predictions FOR INSERT
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM matches
      WHERE matches.id = predictions.match_id
        AND matches.kickoff_at > NOW()
    )
  );

DROP POLICY IF EXISTS pred_update_own_unlocked ON predictions;
CREATE POLICY pred_update_own_unlocked ON predictions FOR UPDATE
  USING (
    user_id = (SELECT auth.uid())
    AND locked_at IS NULL
    AND EXISTS (
      SELECT 1 FROM matches
      WHERE matches.id = predictions.match_id
        AND matches.kickoff_at > NOW()
    )
  )
  WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS pred_delete_own_unlocked ON predictions;
CREATE POLICY pred_delete_own_unlocked ON predictions FOR DELETE
  USING (user_id = (SELECT auth.uid()) AND locked_at IS NULL);
