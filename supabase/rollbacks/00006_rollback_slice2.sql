-- Hand-applied rollback for 00005_rooms_slice2.sql.
-- Lives OUTSIDE supabase/migrations/ so `supabase db push` does NOT pick it up.
-- To apply manually: psql "$DATABASE_URL" -f supabase/rollbacks/00006_rollback_slice2.sql
DROP TRIGGER IF EXISTS on_room_created ON rooms;
DROP FUNCTION IF EXISTS handle_room_created();
ALTER TABLE rooms DROP COLUMN IF EXISTS prize_description;
