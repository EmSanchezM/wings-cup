-- =============================================================================
-- Migration: 00008_fix_rls_recursion.sql
-- Purpose  : Foundation hotfix #2 (slice 2 smoke, 2026-05-17).
--            The rm_select_same_room policy on room_members did
--              EXISTS (SELECT 1 FROM room_members me WHERE ...)
--            inside its own RLS USING clause. Each subquery triggered the
--            same policy, producing "infinite recursion detected in policy
--            for relation room_members" on any SELECT that traverses
--            room_members (directly or via rooms_select_member /
--            pred_select_room_members / profiles_select_shared_room).
--
--            Fix: classic Supabase pattern -- a SECURITY DEFINER helper
--            `is_room_member(_room_id)` performs the lookup with the
--            definer's privileges, bypassing RLS on the read. The policy
--            then calls the helper instead of subquerying room_members.
-- Depends  : 00002_rls.sql (original rm_select_same_room policy)
-- Idempotency: CREATE OR REPLACE FUNCTION + DROP POLICY IF EXISTS guards.
-- Rollback : supabase/rollbacks/00009_rollback_fix_rls_recursion.sql
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. is_room_member helper
--    STABLE -- planner may cache per-snapshot
--    SECURITY DEFINER -- bypasses RLS on the inner SELECT, breaking recursion
--    SET search_path = public -- prevents schema-injection attacks
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_room_member(_room_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM room_members
    WHERE room_id = _room_id AND user_id = auth.uid()
  );
$$;

-- ---------------------------------------------------------------------------
-- 2. Replace the recursive policy
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS rm_select_same_room ON room_members;
CREATE POLICY rm_select_same_room ON room_members FOR SELECT
  USING (is_room_member(room_members.room_id));
