-- =============================================================================
-- Migration: 00005_rooms_slice2.sql
-- Purpose  : Slice 2 (rooms-and-invitations).
--            (1) Add rooms.prize_description (NOT NULL DEFAULT '').
--            (2) Create on_room_created trigger that inserts the creator into
--                room_members with role='owner', atomically with the room INSERT.
-- Depends  : 00001_schema.sql (rooms, room_members), 00002_rls.sql (rm_insert_self),
--            00003_triggers.sql (SECURITY DEFINER pattern reference).
-- Idempotency: Safe to re-run; uses IF NOT EXISTS / DROP IF EXISTS guards.
-- Rollback : supabase/rollbacks/00006_rollback_slice2.sql (hand-applied).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. rooms.prize_description  [L-1]
-- ---------------------------------------------------------------------------
ALTER TABLE rooms
  ADD COLUMN IF NOT EXISTS prize_description TEXT NOT NULL DEFAULT '';

-- ---------------------------------------------------------------------------
-- 2. handle_room_created()  [L-3]
--    SECURITY DEFINER: at trigger execution time auth.uid() may not be set
--    in the trigger context, so the INSERT runs with the definer's privileges
--    to bypass the rm_insert_self RLS policy. Matches the handle_new_user
--    pattern from 00003_triggers.sql.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION handle_room_created() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.room_members (room_id, user_id, role)
  VALUES (NEW.id, NEW.created_by, 'owner');
  RETURN NEW;
END $$;

-- Trigger name follows R-TR-24 (on_X) — symmetric with on_auth_user_created.
DROP TRIGGER IF EXISTS on_room_created ON rooms;
CREATE TRIGGER on_room_created
  AFTER INSERT ON rooms
  FOR EACH ROW EXECUTE FUNCTION handle_room_created();
