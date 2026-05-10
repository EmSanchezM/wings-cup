-- =============================================================================
-- Migration: 00004_admin_rls.sql
-- Purpose  : Adds super-admin SELECT policies for `rooms` and `predictions` to
--            close the gaps surfaced by sdd-verify (W-01: R-SEC-11,
--            W-02: R-SEC-24).
--            Super admins must be able to inspect rooms and predictions for the
--            admin-panel slice (slice 5). RLS still gates regular users via the
--            existing member-based policies — these new policies are additive.
-- Depends  : 00002_rls.sql (RLS already enabled on rooms and predictions)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- rooms — super-admin SELECT  (closes W-01 / R-SEC-11)
-- ---------------------------------------------------------------------------
CREATE POLICY "rooms_select_super_admin" ON rooms FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND is_super_admin = TRUE
    )
  );

-- ---------------------------------------------------------------------------
-- predictions — super-admin SELECT  (closes W-02 / R-SEC-24)
-- ---------------------------------------------------------------------------
CREATE POLICY "pred_select_super_admin" ON predictions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND is_super_admin = TRUE
    )
  );
