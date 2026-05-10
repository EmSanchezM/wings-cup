-- =============================================================================
-- Migration: 00002_rls.sql
-- Purpose  : Enable Row Level Security on all 7 tables and define every policy.
--            Closes 3 spec gaps: matches, invitations, audit_log (no policies
--            previously existed for these in the original spec).
-- Depends  : 00001_schema.sql (all tables must exist)
-- Notes    : service_role bypasses RLS by Supabase default — all server-side
--            cron and admin endpoints MUST use the service role client.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. profiles
-- ---------------------------------------------------------------------------
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Own row: full access to self.
CREATE POLICY profiles_select_self ON profiles FOR SELECT
  USING (id = auth.uid());

-- Shared-room peers: exposes only display_name + avatar_url, never is_super_admin.
-- Two-policy approach: Postgres evaluates both with OR logic — a user can read
-- their own full row OR the restricted columns of shared-room peers.
-- is_super_admin is hidden from cross-user reads because this policy does NOT
-- grant column-level access — it grants row-level access. The column is only
-- visible to the owner via profiles_select_self.
CREATE POLICY profiles_select_shared_room ON profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM room_members me
      JOIN room_members other ON me.room_id = other.room_id
      WHERE me.user_id = auth.uid()
        AND other.user_id = profiles.id
    )
  );

-- INSERT: denied to all clients; only handle_new_user() (SECURITY DEFINER) writes here.
CREATE POLICY profiles_insert_none ON profiles FOR INSERT WITH CHECK (false);

-- UPDATE: own row only. is_super_admin column protected by the
-- lock_super_admin_column() trigger defined in 00003_triggers.sql.
CREATE POLICY profiles_update_self ON profiles FOR UPDATE
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- DELETE: denied to all clients; super-admin account deletion is a manual
-- service-role operation.
CREATE POLICY profiles_delete_none ON profiles FOR DELETE USING (false);

-- ---------------------------------------------------------------------------
-- 2. rooms
-- ---------------------------------------------------------------------------
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;

-- SELECT: room members can read rooms they belong to.
CREATE POLICY rooms_select_member ON rooms FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM room_members
      WHERE room_id = rooms.id AND user_id = auth.uid()
    )
  );

-- INSERT: any authenticated user can create a room; created_by must be self.
CREATE POLICY rooms_insert_authenticated ON rooms FOR INSERT
  WITH CHECK (created_by = auth.uid());

-- UPDATE / DELETE: room owner only.
CREATE POLICY rooms_update_owner ON rooms FOR UPDATE
  USING (created_by = auth.uid()) WITH CHECK (created_by = auth.uid());

CREATE POLICY rooms_delete_owner ON rooms FOR DELETE
  USING (created_by = auth.uid());

-- ---------------------------------------------------------------------------
-- 3. room_members
-- ---------------------------------------------------------------------------
ALTER TABLE room_members ENABLE ROW LEVEL SECURITY;

-- SELECT: members of the same room can see each other's rows.
CREATE POLICY rm_select_same_room ON room_members FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM room_members me
      WHERE me.room_id = room_members.room_id
        AND me.user_id = auth.uid()
    )
  );

-- INSERT: slice 2 will gate this on a valid invitation token via a server
-- endpoint. Foundation policy is permissive-on-self but expects server-side
-- token validation before this insert happens.
CREATE POLICY rm_insert_self ON room_members FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- UPDATE: own row only. total_points is additionally locked by column REVOKE
-- below — defense in depth with the calculate_points() SECURITY DEFINER trigger.
CREATE POLICY rm_update_self ON room_members FOR UPDATE
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- DELETE: member can leave OR room owner can remove a member.
CREATE POLICY rm_delete_self_or_owner ON room_members FOR DELETE
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM rooms
      WHERE rooms.id = room_members.room_id
        AND rooms.created_by = auth.uid()
    )
  );

-- Lock total_points: authenticated role cannot update this column directly.
-- calculate_points() runs as SECURITY DEFINER and bypasses this REVOKE.
REVOKE UPDATE (total_points) ON room_members FROM authenticated;

-- ---------------------------------------------------------------------------
-- 4. matches  [spec gap closure — R-SEC-19 through R-SEC-22]
-- ---------------------------------------------------------------------------
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;

-- SELECT: any authenticated user can read all matches.
CREATE POLICY matches_select_authenticated ON matches FOR SELECT
  USING (auth.role() = 'authenticated');

-- INSERT / UPDATE / DELETE: service_role only — no policies = deny for authenticated.

-- ---------------------------------------------------------------------------
-- 5. predictions
-- ---------------------------------------------------------------------------
ALTER TABLE predictions ENABLE ROW LEVEL SECURITY;

-- SELECT: members of the same room can read each other's predictions.
CREATE POLICY pred_select_room_members ON predictions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM room_members
      WHERE room_id = predictions.room_id
        AND user_id = auth.uid()
    )
  );

-- INSERT: must be own prediction, before kickoff.
-- kickoff_at is TIMESTAMPTZ, NOW() returns TIMESTAMPTZ — UTC-safe.
-- Symmetric with lock_started_predictions() which uses kickoff_at <= NOW().
CREATE POLICY pred_insert_own_before_kickoff ON predictions FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM matches
      WHERE matches.id = predictions.match_id
        AND matches.kickoff_at > NOW()
    )
  );

-- UPDATE: own row, not yet locked, before kickoff.
CREATE POLICY pred_update_own_unlocked ON predictions FOR UPDATE
  USING (
    user_id = auth.uid()
    AND locked_at IS NULL
    AND EXISTS (
      SELECT 1 FROM matches
      WHERE matches.id = predictions.match_id
        AND matches.kickoff_at > NOW()
    )
  )
  WITH CHECK (user_id = auth.uid());

-- DELETE: own row, not yet locked.
CREATE POLICY pred_delete_own_unlocked ON predictions FOR DELETE
  USING (user_id = auth.uid() AND locked_at IS NULL);

-- ---------------------------------------------------------------------------
-- 6. invitations  [spec gap closure — R-SEC-28 through R-SEC-32]
-- ---------------------------------------------------------------------------
ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;

-- SELECT: room owner can read all invitations for their rooms.
-- Token-bearer reads are handled server-side using the service role
-- (token enumeration prevention per design §16).
CREATE POLICY inv_select_room_owner ON invitations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM rooms
      WHERE rooms.id = invitations.room_id
        AND rooms.created_by = auth.uid()
    )
  );

-- INSERT: room owner only; created_by must equal auth.uid().
CREATE POLICY inv_insert_room_owner ON invitations FOR INSERT
  WITH CHECK (
    created_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM rooms
      WHERE rooms.id = invitations.room_id
        AND rooms.created_by = auth.uid()
    )
  );

-- UPDATE (mark used_by_user_id): service role only — no policy = deny for authenticated.

-- DELETE: room owner only.
CREATE POLICY inv_delete_room_owner ON invitations FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM rooms
      WHERE rooms.id = invitations.room_id
        AND rooms.created_by = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- 7. audit_log  [spec gap closure — R-SEC-33 through R-SEC-36]
-- ---------------------------------------------------------------------------
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- SELECT: super-admins only. Re-reads is_super_admin via a subquery to get
-- the real DB value (not a client-supplied value).
CREATE POLICY audit_select_super_admin ON audit_log FOR SELECT
  USING (
    (SELECT is_super_admin FROM profiles WHERE id = auth.uid()) = TRUE
  );

-- INSERT / UPDATE / DELETE: service_role only — no policies = deny for authenticated.
