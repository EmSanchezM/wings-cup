-- =============================================================================
-- Migration: 00018_pred_select_lock_for_others.sql
-- Purpose  : Enforce the prediction-secrecy invariant at the DATABASE layer.
--
--            Previously pred_select_room_members (00002) let ANY room member
--            SELECT EVERY prediction row in the room -- including other members'
--            picks that were not yet locked. Because the Supabase anon/user key
--            is exposed in the browser, a member could bypass the Nuxt API and
--            read unlocked picks directly via PostgREST, then copy them before
--            kickoff. That breaks the game's fairness.
--
--            New rule -- a member may read:
--              - ALL of their OWN predictions (locked or not; they author them), OR
--              - other members' predictions ONLY once locked_at IS NOT NULL.
--                locked_at is stamped by lock_started_predictions() (00003) after
--                a match kicks off, so a locked pick can no longer be changed and
--                is therefore safe to reveal.
--
--            Membership is gated via is_room_member() (00008) to avoid recursing
--            into room_members RLS.
--
--            NOTE: pred_select_super_admin (00004) is intentionally left intact
--            -- app super-admins can still read all predictions for the admin
--            surface. This migration closes the hole for regular members, which
--            is the real cheating surface.
--
-- Depends  : 00002_rls.sql (original policy), 00008_fix_rls_recursion.sql (helper)
-- Idempotency: DROP POLICY IF EXISTS + CREATE POLICY (safe to re-run)
-- Rollback : supabase/rollbacks/00018_rollback_pred_select_lock_for_others.sql
-- =============================================================================

DROP POLICY IF EXISTS pred_select_room_members ON predictions;
CREATE POLICY pred_select_room_members ON predictions FOR SELECT
  USING (
    is_room_member(predictions.room_id)
    AND (
      user_id = (SELECT auth.uid())
      OR locked_at IS NOT NULL
    )
  );
