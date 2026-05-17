-- =============================================================================
-- Migration: 00007_fix_handle_new_user.sql
-- Purpose  : Foundation hotfix discovered during slice 2 smoke (2026-05-17).
--            The handle_new_user trigger (00003_triggers.sql) inserted
--            `auth_provider = NEW.raw_app_meta_data->>'provider'` directly with
--            a fallback to 'magic_link'. Current Supabase Auth sends 'email' for
--            signInWithOtp signups, which violates the CHECK constraint on
--            profiles.auth_provider IN ('google', 'magic_link'). Result: every
--            FIRST-TIME magic-link signup fails with "Database error saving new
--            user" returned by Supabase Auth.
--
--            Fix: normalise the provider to one of the two allowed enum values
--            inside the trigger. 'google' stays 'google'; everything else
--            ('email', NULL, future variants) maps to 'magic_link'.
-- Depends  : 00003_triggers.sql (original handle_new_user definition)
-- Idempotency: CREATE OR REPLACE FUNCTION is idempotent.
-- Rollback : supabase/rollbacks/00008_rollback_fix_handle_new_user.sql
-- =============================================================================

CREATE OR REPLACE FUNCTION handle_new_user() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  provider TEXT;
BEGIN
  -- Supabase Auth sends 'email' for signInWithOtp signups; the profiles CHECK
  -- constraint only allows 'google' or 'magic_link'. Normalise here.
  provider := CASE
    WHEN NEW.raw_app_meta_data->>'provider' = 'google' THEN 'google'
    ELSE 'magic_link'
  END;

  INSERT INTO public.profiles (id, display_name, avatar_url, auth_provider, is_guest)
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data->>'display_name',
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name',
      split_part(NEW.email, '@', 1)
    ),
    NEW.raw_user_meta_data->>'avatar_url',
    provider,
    provider = 'magic_link'
  );
  RETURN NEW;
END $$;
