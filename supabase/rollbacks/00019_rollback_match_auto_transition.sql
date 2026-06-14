-- =============================================================================
-- Rollback for: 00019_match_auto_transition.sql
--
-- Unschedule the cron job first (only if it was created via the operational
-- note in the migration), then drop the function.
-- =============================================================================

-- Remove the schedule if it exists. Guarded so the rollback works even when
-- pg_cron was never enabled / the job was never created.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron')
     AND EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'match-minute-cron') THEN
    PERFORM cron.unschedule('match-minute-cron');
  END IF;
END $$;

DROP FUNCTION IF EXISTS run_match_minute_cron();
