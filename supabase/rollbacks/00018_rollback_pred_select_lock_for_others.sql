-- Hand-applied rollback for 00018_pred_select_lock_for_others.sql.
-- Restores the ORIGINAL pred_select_room_members policy (00002), which lets any
-- room member read EVERY prediction in the room -- including unlocked picks.
-- Only use if 00018 introduces a NEW regression; otherwise leave 00018 in place,
-- because the original policy leaks unlocked predictions and enables cheating.

DROP POLICY IF EXISTS pred_select_room_members ON predictions;
CREATE POLICY pred_select_room_members ON predictions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM room_members
      WHERE room_id = predictions.room_id
        AND user_id = auth.uid()
    )
  );
