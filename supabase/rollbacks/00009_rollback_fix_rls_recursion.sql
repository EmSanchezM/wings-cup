-- Hand-applied rollback for 00008_fix_rls_recursion.sql.
-- Restores the ORIGINAL (recursive!) rm_select_same_room policy and drops
-- the is_room_member helper. Only use if 00008 introduces a NEW regression --
-- otherwise leave 00008 in place because the original policy is broken.

DROP POLICY IF EXISTS rm_select_same_room ON room_members;
CREATE POLICY rm_select_same_room ON room_members FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM room_members me
      WHERE me.room_id = room_members.room_id
        AND me.user_id = auth.uid()
    )
  );

DROP FUNCTION IF EXISTS public.is_room_member(UUID);
