-- =============================================================================
-- Migration: 00003_triggers.sql
-- Purpose  : Define all trigger functions and their table bindings.
--            Functions: set_updated_at, handle_new_user, lock_super_admin_column,
--            calculate_points, lock_started_predictions.
-- Depends  : 00001_schema.sql (tables), 00002_rls.sql (RLS enabled — SECURITY
--            DEFINER functions bypass RLS, so RLS must be on first)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. set_updated_at() — moddatetime (inline; no pg extension needed)
--    Bound to: profiles, predictions BEFORE UPDATE
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END $$;

CREATE TRIGGER profiles_set_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER predictions_set_updated_at
  BEFORE UPDATE ON predictions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- 2. handle_new_user() — profile-on-signup
--    SECURITY DEFINER: runs with owner's privileges, bypassing RLS so it can
--    INSERT into profiles even though the INSERT policy is set to false.
--    Bound to: auth.users AFTER INSERT
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION handle_new_user() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  provider TEXT;
BEGIN
  -- OAuth populates app_metadata.provider; magic-link signup leaves it null.
  -- COALESCE to 'magic_link' as a defensive default (R-TR-08, R-TR-09).
  provider := COALESCE(NEW.raw_app_meta_data->>'provider', 'magic_link');

  INSERT INTO public.profiles (id, display_name, avatar_url, auth_provider, is_guest)
  VALUES (
    NEW.id,
    -- display_name fallback chain: display_name → full_name → name → email prefix
    COALESCE(
      NEW.raw_user_meta_data->>'display_name',
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name',
      split_part(NEW.email, '@', 1)
    ),
    NEW.raw_user_meta_data->>'avatar_url',
    provider,
    provider = 'magic_link'   -- magic-link signup = guest by default (R-TR-05, R-TR-06, R-TR-08)
    -- is_super_admin is NOT set here; defaults to FALSE (R-TR-05, R-DB-06)
  );
  RETURN NEW;
END $$;

-- Trigger name matches R-TR-04 spec requirement: on_auth_user_created
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ---------------------------------------------------------------------------
-- 3. lock_super_admin_column() — prevent is_super_admin mutation by clients
--    BEFORE UPDATE trigger: fires before every profiles UPDATE.
--    Only service_role JWTs carry role='service_role' in their JWT claims.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION lock_super_admin_column() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.is_super_admin IS DISTINCT FROM OLD.is_super_admin THEN
    -- Allow only when the current JWT indicates we're running as service_role.
    -- current_setting returns the JWT claims JSON; anon/authenticated roles
    -- will have role='anon' or role='authenticated', not 'service_role'.
    IF current_setting('request.jwt.claims', true)::jsonb->>'role' <> 'service_role' THEN
      RAISE EXCEPTION 'is_super_admin can only be modified by service role';
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER profiles_lock_super_admin
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION lock_super_admin_column();

-- ---------------------------------------------------------------------------
-- 4. calculate_points() — scoring after match finalizes
--    SECURITY DEFINER: writes to predictions and room_members (bypasses RLS).
--    Bound to: matches AFTER UPDATE OF status, home_score, away_score
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION calculate_points() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  rules JSONB;
  pts   INTEGER;
  pred  RECORD;
BEGIN
  -- Only run when a match transitions TO 'finished' for the first time.
  -- Guard against re-triggering on repeated updates to a finished match.
  IF NEW.status <> 'finished' OR OLD.status = 'finished' THEN
    RETURN NEW;
  END IF;
  IF NEW.home_score IS NULL OR NEW.away_score IS NULL THEN
    RETURN NEW;
  END IF;

  FOR pred IN
    SELECT p.id, p.user_id, p.room_id,
           p.predicted_home, p.predicted_away,
           r.scoring_rules
    FROM predictions p
    JOIN rooms r ON r.id = p.room_id
    WHERE p.match_id = NEW.id
      AND p.locked_at IS NOT NULL  -- only score locked predictions
  LOOP
    rules := pred.scoring_rules;

    -- Priority order (DOCUMENTED — R-TR-18):
    --   1. exact_score      — exact home AND away score match
    --   2. correct_goal_diff — goal difference matches but not exact score
    --   3. correct_result    — correct W/D/L outcome but neither of the above
    --   4. 0                 — none of the above
    -- A prediction earns ONLY the highest matching bucket.
    pts := CASE
      WHEN pred.predicted_home = NEW.home_score
       AND pred.predicted_away = NEW.away_score
        THEN (rules->>'exact_score')::int

      WHEN (pred.predicted_home - pred.predicted_away)
         = (NEW.home_score - NEW.away_score)
        THEN (rules->>'correct_goal_diff')::int

      WHEN sign(pred.predicted_home - pred.predicted_away)
         = sign(NEW.home_score - NEW.away_score)
        THEN (rules->>'correct_result')::int

      ELSE 0
    END;

    UPDATE predictions
      SET points_awarded = pts
      WHERE id = pred.id;

    UPDATE room_members
      SET total_points = total_points + pts
      WHERE room_id = pred.room_id
        AND user_id = pred.user_id;
  END LOOP;

  RETURN NEW;
END $$;

-- Trigger name: matches_calculate_points
-- Fires after status, home_score, or away_score changes on a match row.
CREATE TRIGGER matches_calculate_points
  AFTER UPDATE OF status, home_score, away_score ON matches
  FOR EACH ROW EXECUTE FUNCTION calculate_points();

-- ---------------------------------------------------------------------------
-- 5. lock_started_predictions() — called by Vercel cron (slice 3)
--    NOT a table trigger — standalone function called via service role RPC.
--    Caller: /api/cron/lock-predictions authenticates with CRON_SECRET and
--    invokes via supabase.rpc('lock_started_predictions') using service role.
--    Returns the count of rows locked (for logging — R-TR-22).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION lock_started_predictions() RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  affected INTEGER;
BEGIN
  -- TIMESTAMPTZ + NOW() is UTC-safe; symmetric with pred_insert_own_before_kickoff
  -- RLS policy which uses kickoff_at > NOW().
  UPDATE predictions p
    SET locked_at = NOW()
    FROM matches m
    WHERE p.match_id = m.id
      AND p.locked_at IS NULL
      AND m.kickoff_at <= NOW();

  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END $$;
