-- =============================================================================
-- Migration: 00013_fix_rls_auth_uid_wrapper.sql
-- Purpose  : Foundation hotfix #3 (slice 2 smoke, 2026-05-17).
--            Replaces bare `auth.uid()` references inside RLS policies with
--            `(SELECT auth.uid())`. This is the current Supabase-recommended
--            pattern: it lets the planner evaluate auth.uid() once per
--            statement (perf) AND avoids an edge case where WITH CHECK
--            evaluation on INSERT can fail with 42501 even when the bare
--            auth.uid() returns the expected user UUID for SELECT/RPC calls
--            in the same request.
--
--            Diagnostic that confirmed the bug:
--              * SELECT via user-context: auth.uid() returned the user UUID
--              * INSERT (direct or via SECURITY INVOKER function): same UUID
--                captured into a variable, then `created_by = <uuid_var>` is
--                used in the INSERT, yet the policy with bare auth.uid()
--                still raised "new row violates row-level security policy
--                for table rooms" / 42501.
--              * Service-role INSERT worked (bypasses RLS).
--
-- Policies touched:
--   rooms_insert_authenticated  (was: created_by = auth.uid())
--   rooms_update_owner          (was: created_by = auth.uid())
--   rooms_delete_owner          (was: created_by = auth.uid())
--   rm_insert_self              (was: user_id = auth.uid())
--   rm_update_self              (was: user_id = auth.uid())
--   rm_delete_self_or_owner     (was: user_id = auth.uid() OR EXISTS...)
--
--   The SELECT policies that use is_room_member(...) or other functions are
--   already evaluated correctly and are left untouched.
-- Depends  : 00002_rls.sql, 00008_fix_rls_recursion.sql
-- Idempotency: DROP POLICY IF EXISTS + CREATE POLICY.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- rooms
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS rooms_insert_authenticated ON rooms;
CREATE POLICY rooms_insert_authenticated ON rooms FOR INSERT
  WITH CHECK (created_by = (SELECT auth.uid()));

DROP POLICY IF EXISTS rooms_update_owner ON rooms;
CREATE POLICY rooms_update_owner ON rooms FOR UPDATE
  USING (created_by = (SELECT auth.uid()))
  WITH CHECK (created_by = (SELECT auth.uid()));

DROP POLICY IF EXISTS rooms_delete_owner ON rooms;
CREATE POLICY rooms_delete_owner ON rooms FOR DELETE
  USING (created_by = (SELECT auth.uid()));

-- ---------------------------------------------------------------------------
-- room_members
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS rm_insert_self ON room_members;
CREATE POLICY rm_insert_self ON room_members FOR INSERT
  WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS rm_update_self ON room_members;
CREATE POLICY rm_update_self ON room_members FOR UPDATE
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS rm_delete_self_or_owner ON room_members;
CREATE POLICY rm_delete_self_or_owner ON room_members FOR DELETE
  USING (
    user_id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM rooms
      WHERE rooms.id = room_members.room_id
        AND rooms.created_by = (SELECT auth.uid())
    )
  );
