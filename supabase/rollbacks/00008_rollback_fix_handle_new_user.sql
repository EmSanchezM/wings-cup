-- Hand-applied rollback for 00007_fix_handle_new_user.sql.
-- Lives OUTSIDE supabase/migrations/ so `supabase db push` does NOT pick it up.
-- To apply manually: psql "$DATABASE_URL" -f supabase/rollbacks/00008_rollback_fix_handle_new_user.sql
--
-- This restores the ORIGINAL handle_new_user from 00003_triggers.sql, which
-- contains the bug (every first-time magic-link signup fails). Only use if
-- 00007 itself introduces a new problem.

CREATE OR REPLACE FUNCTION handle_new_user() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  provider TEXT;
BEGIN
  provider := COALESCE(NEW.raw_app_meta_data->>'provider', 'magic_link');

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
