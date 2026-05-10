-- =============================================================================
-- Migration: 00001_schema.sql
-- Purpose  : Create all 7 application tables, indexes, and REPLICA IDENTITY
--            configuration. Tables: profiles, rooms, room_members, matches,
--            predictions, invitations, audit_log.
-- Depends  : auth.users (provided by Supabase; always present)
-- Applied  : supabase db push (forward-only; never edit — add 00004_* for fixes)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. profiles — extends auth.users (one row per Supabase user)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS profiles (
  id             UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name   TEXT        NOT NULL,
  avatar_url     TEXT,
  auth_provider  TEXT        NOT NULL CHECK (auth_provider IN ('google', 'magic_link')),
  is_guest       BOOLEAN     NOT NULL DEFAULT TRUE,
  is_super_admin BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Partial index: almost all rows are FALSE; keeps super-admin checks cheap.
CREATE INDEX IF NOT EXISTS idx_profiles_is_super_admin
  ON profiles(is_super_admin)
  WHERE is_super_admin = TRUE;

-- ---------------------------------------------------------------------------
-- 2. rooms
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS rooms (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT        NOT NULL,
  invite_code   TEXT        NOT NULL UNIQUE,
  status        TEXT        NOT NULL DEFAULT 'active'
                              CHECK (status IN ('active', 'closed')),
  scoring_rules JSONB       NOT NULL DEFAULT '{"exact_score":5,"correct_goal_diff":3,"correct_result":1}'::jsonb,
  created_by    UUID        NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ON DELETE RESTRICT on created_by: deleting a profile that owns rooms must
-- fail loudly — slice 5 will offer an ownership-transfer flow.
CREATE INDEX IF NOT EXISTS idx_rooms_invite_code ON rooms(invite_code);
CREATE INDEX IF NOT EXISTS idx_rooms_created_by  ON rooms(created_by);

-- ---------------------------------------------------------------------------
-- 3. room_members — composite PK + REPLICA IDENTITY FULL (slice 4 realtime)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS room_members (
  room_id      UUID        NOT NULL REFERENCES rooms(id)    ON DELETE CASCADE,
  user_id      UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role         TEXT        NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'member')),
  total_points INTEGER     NOT NULL DEFAULT 0,
  joined_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (room_id, user_id)
);

-- REPLICA IDENTITY FULL: realtime UPDATE payloads need OLD-row values to
-- filter room_id client-side without an extra round trip (slice 4).
-- Setting it now avoids a hot-table ALTER later.
ALTER TABLE room_members REPLICA IDENTITY FULL;

-- Composite index supports the leaderboard query (slice 4).
CREATE INDEX IF NOT EXISTS idx_room_members_user_id     ON room_members(user_id);
CREATE INDEX IF NOT EXISTS idx_room_members_room_points ON room_members(room_id, total_points DESC);

-- ---------------------------------------------------------------------------
-- 4. matches
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS matches (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id TEXT        UNIQUE,                    -- API-Football fixture id
  home_team   TEXT        NOT NULL,
  away_team   TEXT        NOT NULL,
  kickoff_at  TIMESTAMPTZ NOT NULL,
  status      TEXT        NOT NULL DEFAULT 'scheduled'
                            CHECK (status IN ('scheduled', 'live', 'finished', 'postponed', 'cancelled')),
  home_score  INTEGER     CHECK (home_score IS NULL OR home_score >= 0),
  away_score  INTEGER     CHECK (away_score IS NULL OR away_score >= 0),
  group_name  TEXT,                                  -- 'A','B',… or NULL for knockout
  stage       TEXT        NOT NULL DEFAULT 'group'
                            CHECK (stage IN ('group', 'round_of_16', 'quarter', 'semi', 'final', 'third_place')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_matches_kickoff_at ON matches(kickoff_at);
CREATE INDEX IF NOT EXISTS idx_matches_status     ON matches(status);

-- Partial UNIQUE: allows manual matches with NULL external_id while still
-- enforcing API-Football idempotency for seeded rows.
CREATE UNIQUE INDEX IF NOT EXISTS idx_matches_external_id
  ON matches(external_id)
  WHERE external_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 5. predictions — score cap 15 [Locked Decision B]
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS predictions (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id        UUID        NOT NULL REFERENCES rooms(id)   ON DELETE CASCADE,
  user_id        UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  match_id       UUID        NOT NULL REFERENCES matches(id)  ON DELETE CASCADE,
  predicted_home INTEGER     NOT NULL CHECK (predicted_home BETWEEN 0 AND 15),
  predicted_away INTEGER     NOT NULL CHECK (predicted_away BETWEEN 0 AND 15),
  points_awarded INTEGER     NOT NULL DEFAULT 0,
  locked_at      TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (room_id, user_id, match_id)
);

-- Partial index: cron job lock_started_predictions() queries
-- WHERE locked_at IS NULL AND kickoff_at <= NOW() every minute.
CREATE INDEX IF NOT EXISTS idx_predictions_room_user ON predictions(room_id, user_id);
CREATE INDEX IF NOT EXISTS idx_predictions_match     ON predictions(match_id);
CREATE INDEX IF NOT EXISTS idx_predictions_unlocked  ON predictions(match_id) WHERE locked_at IS NULL;

-- ---------------------------------------------------------------------------
-- 6. invitations — 7-day expiry default [Locked Decision D]
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS invitations (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id          UUID        NOT NULL REFERENCES rooms(id)    ON DELETE CASCADE,
  token            TEXT        NOT NULL UNIQUE,
  email            TEXT,                              -- optional pre-fill
  created_by       UUID        NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  used_by_user_id  UUID        REFERENCES profiles(id) ON DELETE SET NULL,
  expires_at       TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  used_at          TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_invitations_token   ON invitations(token);
CREATE INDEX IF NOT EXISTS idx_invitations_room_id ON invitations(room_id);

-- ---------------------------------------------------------------------------
-- 7. audit_log
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_log (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id     UUID        NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  action       TEXT        NOT NULL,
  target_type  TEXT        NOT NULL,                 -- 'room','user','match',…
  target_id    UUID,
  before_value JSONB,
  after_value  JSONB,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Composite index: super-admin audit trail queries filter by admin_id
-- and sort by created_at DESC.
CREATE INDEX IF NOT EXISTS idx_audit_log_admin_created
  ON audit_log(admin_id, created_at DESC);
