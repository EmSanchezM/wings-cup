-- Migration: 00015_realtime_publication.sql
-- Adds matches and room_members to the supabase_realtime publication.
-- Idempotent: guards each ALTER PUBLICATION via pg_publication_tables check.
-- Forward-only — no down migration.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'matches'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE matches';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'room_members'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE room_members';
  END IF;
END $$;
