-- =============================================================================
-- Migration: 00016_fix_handle_new_user_invite.sql
-- Purpose  : Fix handle_new_user trigger so that admin-invited users receive
--            is_guest = false instead of is_guest = true.
--
--            Root cause (00007): is_guest was set to (provider = 'magic_link').
--            Supabase Auth sends raw_app_meta_data->>'provider' = 'email' for
--            BOTH magic-link OTP signups AND admin invite signups; both normalise
--            to 'magic_link' via 00007 logic, making invited users is_guest = true.
--
--            Fix: discriminate on NEW.invited_at IS NOT NULL, which Supabase Auth
--            sets when inviteUserByEmail is called. Magic-link signInWithOtp
--            signups always have invited_at = NULL.
--
-- New logic:
--   IF NEW.invited_at IS NOT NULL THEN
--     is_guest := false   -- admin-invited user → full member from the start
--   ELSE
--     is_guest := (provider = 'magic_link')  -- existing magic-link / Google logic
--   END IF;
--
-- Preserved: auth_provider normalisation from 00007
--   'google' → 'google'; everything else → 'magic_link'
-- Preserved: trigger binding on_auth_user_created (NOT altered by this migration)
-- Idempotency: CREATE OR REPLACE — safe to run multiple times, no DROP required
-- Depends  : 00007_fix_handle_new_user.sql
-- =============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  provider  TEXT;
  is_guest  BOOLEAN;
BEGIN
  -- Normalise auth provider — Supabase sends 'email' for magic-link and invite flows.
  -- Only 'google' and 'magic_link' are allowed by the profiles CHECK constraint.
  provider := CASE
    WHEN NEW.raw_app_meta_data->>'provider' = 'google' THEN 'google'
    ELSE 'magic_link'
  END;

  -- Discriminate admin-invited users via invited_at (set by inviteUserByEmail).
  -- Magic-link signInWithOtp signups always have invited_at = NULL.
  IF NEW.invited_at IS NOT NULL THEN
    is_guest := false;
  ELSE
    is_guest := (provider = 'magic_link');
  END IF;

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
    is_guest
  );
  RETURN NEW;
END $$;
