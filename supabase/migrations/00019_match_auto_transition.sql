-- =============================================================================
-- Migration: 00019_match_auto_transition.sql
-- Purpose  : Automate the per-minute match lifecycle an admin used to do by
--            hand: flip kicked-off matches from 'scheduled' to 'live',
--            initialise their scoreboard to 0-0, lock the predictions of
--            started matches, and record every automatic transition in
--            audit_log.
--
--            run_match_minute_cron() is the single entrypoint pg_cron invokes
--            once a minute. It is deliberately a PURE DB function -- no HTTP
--            hop, no shared secret. Prediction blocking is ALREADY enforced to
--            the second by the pred_insert_own_before_kickoff RLS policy
--            (00002_rls.sql, kickoff_at > NOW()), so the minute-granularity lag
--            only delays the cosmetic 'live' flag, never the fairness rule.
--
--            Audit actor: the OLDEST super-admin profile. A cron run has no
--            authenticated user, yet audit_log.admin_id is NOT NULL REFERENCES
--            profiles(id). If no super-admin exists the transition still happens
--            and a WARNING is raised instead of failing the whole batch.
--
--            Only status = 'scheduled' rows are touched, so 'postponed' and
--            'cancelled' matches are never resurrected. COALESCE preserves any
--            score that might already be set.
--
--            Transitioning to 'live' fires matches_calculate_points, but
--            calculate_points() early-returns for any status other than
--            'finished' (00003), so scoring is untouched here.
--
-- Depends  : 00001_schema.sql (matches, audit_log, profiles tables),
--            00003_triggers.sql (lock_started_predictions, calculate_points)
-- Idempotency: CREATE OR REPLACE FUNCTION (safe to re-run). The pg_cron schedule
--            and the pg_cron extension are intentionally NOT created here --
--            enabling pg_cron needs the Supabase Dashboard, and bundling it
--            would break `supabase db push` on projects without it. See the
--            operational note at the bottom of this file.
-- Rollback : supabase/rollbacks/00019_rollback_match_auto_transition.sql
-- =============================================================================

CREATE OR REPLACE FUNCTION run_match_minute_cron()
  RETURNS JSONB
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
DECLARE
  v_actor_id UUID;
  v_started  INTEGER := 0;
  v_locked   INTEGER := 0;
  m_before   matches%ROWTYPE;
  m_after    matches%ROWTYPE;
BEGIN
  -- Audit actor: oldest super-admin (see header). Resolved once per run.
  SELECT id INTO v_actor_id
    FROM profiles
    WHERE is_super_admin = TRUE
    ORDER BY created_at
    LIMIT 1;

  -- 1. Flip kicked-off scheduled matches to live + 0-0, one row at a time so we
  --    can capture before/after for the audit trail (max ~4 rows per jornada).
  FOR m_before IN
    SELECT *
      FROM matches
      WHERE status = 'scheduled'
        AND kickoff_at <= NOW()
      FOR UPDATE
  LOOP
    UPDATE matches
      SET status     = 'live',
          home_score = COALESCE(home_score, 0),
          away_score = COALESCE(away_score, 0)
      WHERE id = m_before.id
      RETURNING * INTO m_after;

    v_started := v_started + 1;

    IF v_actor_id IS NOT NULL THEN
      INSERT INTO audit_log (admin_id, action, target_type, target_id, before_value, after_value)
      VALUES (
        v_actor_id,
        'matches.auto_start',
        'match',
        m_before.id,
        to_jsonb(m_before),
        to_jsonb(m_after)
      );
    ELSE
      RAISE WARNING 'run_match_minute_cron: no super-admin found; transitioned match % without audit', m_before.id;
    END IF;
  END LOOP;

  -- 2. Lock predictions for every started match (reuses the existing function).
  v_locked := lock_started_predictions();

  RETURN jsonb_build_object('started', v_started, 'locked', v_locked);
END $$;

-- Cron-only entrypoint: never expose it through PostgREST. Without this REVOKE,
-- the default PUBLIC EXECUTE grant would let any authenticated user force-start
-- matches via the auto-generated RPC endpoint.
REVOKE ALL ON FUNCTION run_match_minute_cron() FROM PUBLIC;

COMMENT ON FUNCTION run_match_minute_cron() IS
  'pg_cron per-minute entrypoint: scheduled->live + 0-0, locks started predictions, audits each transition with the oldest super-admin as actor. See migration 00019.';

-- =============================================================================
-- OPERATIONAL NOTE -- run ONCE per environment, NOT part of this migration:
--
--   1. Enable pg_cron: Supabase Dashboard -> Database -> Extensions -> pg_cron.
--   2. Schedule the job (Supabase SQL editor, as the postgres role):
--
--        select cron.schedule(
--          'match-minute-cron',
--          '* * * * *',
--          $$ select run_match_minute_cron(); $$
--        );
--
--   To change or remove it later:
--        select cron.unschedule('match-minute-cron');
-- =============================================================================
