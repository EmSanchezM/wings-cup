# Spec: database

**Domain:** Schema for all 7 tables, constraints, indexes, and REPLICA IDENTITY configuration.
**Slice:** foundation (PR 2 of 3 — `supabase/migrations/00001_schema.sql`)

---

## Purpose

Create the full relational schema that all application slices depend on. Every table, constraint, index, and special configuration (REPLICA IDENTITY FULL on `room_members`) MUST be present after this migration so no follow-up schema migrations are required for slices 2–4.

---

## Requirements

### General

- R-DB-01: All 7 tables MUST be created in a single migration file: `supabase/migrations/00001_schema.sql`.
- R-DB-02: The migration MUST be idempotent where Postgres syntax permits (use `CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`, `CREATE UNIQUE INDEX IF NOT EXISTS`).
- R-DB-03: `supabase db push` applied against a blank Supabase project MUST succeed without errors.

### `profiles`

- R-DB-04: `profiles.id` MUST be `UUID PRIMARY KEY` with a foreign key to `auth.users(id) ON DELETE CASCADE`.
- R-DB-05: `profiles` MUST have: `display_name TEXT NOT NULL`, `avatar_url TEXT`, `auth_provider TEXT NOT NULL`, `is_guest BOOLEAN NOT NULL DEFAULT TRUE`, `is_super_admin BOOLEAN NOT NULL DEFAULT FALSE`, `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`, `updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`.
- R-DB-06: `profiles.is_super_admin` MUST default to `FALSE`; the trigger initializing a new profile MUST set it to `FALSE`.

### `rooms`

- R-DB-07: `rooms.id` MUST be `UUID PRIMARY KEY DEFAULT gen_random_uuid()`.
- R-DB-08: `rooms` MUST have: `name TEXT NOT NULL`, `created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT`, `invite_code TEXT NOT NULL UNIQUE`, `scoring_rules JSONB NOT NULL DEFAULT '{"exact_score":5,"correct_goal_diff":3,"correct_result":1}'`, `status TEXT NOT NULL DEFAULT 'active'`, `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`.
- R-DB-09: `rooms.status` SHOULD have a CHECK constraint limiting values to `('active', 'archived')`.

### `room_members`

- R-DB-10: `room_members` MUST have a composite PRIMARY KEY of `(room_id, user_id)`.
- R-DB-11: `room_members.room_id` MUST reference `rooms(id) ON DELETE CASCADE`; `room_members.user_id` MUST reference `profiles(id) ON DELETE CASCADE`.
- R-DB-12: `room_members` MUST have: `role TEXT NOT NULL DEFAULT 'member'`, `total_points INTEGER NOT NULL DEFAULT 0`, `joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`.
- R-DB-13: `room_members` MUST have `REPLICA IDENTITY FULL` set via `ALTER TABLE room_members REPLICA IDENTITY FULL` in the same migration.

### `matches`

- R-DB-14: `matches.id` MUST be `UUID PRIMARY KEY DEFAULT gen_random_uuid()`.
- R-DB-15: `matches` MUST have: `external_id TEXT UNIQUE`, `home_team TEXT NOT NULL`, `away_team TEXT NOT NULL`, `kickoff_at TIMESTAMPTZ NOT NULL`, `home_score INTEGER`, `away_score INTEGER`, `status TEXT NOT NULL DEFAULT 'scheduled'`, `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`.
- R-DB-16: `matches.status` SHOULD have a CHECK constraint limiting values to `('scheduled', 'live', 'finished', 'cancelled')`.
- R-DB-17: `matches.kickoff_at` MUST have an index: `CREATE INDEX IF NOT EXISTS idx_matches_kickoff_at ON matches(kickoff_at)`.

### `predictions`

- R-DB-18: `predictions.id` MUST be `UUID PRIMARY KEY DEFAULT gen_random_uuid()`.
- R-DB-19: `predictions` MUST have: `room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE`, `user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE`, `match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE`, `predicted_home INTEGER NOT NULL`, `predicted_away INTEGER NOT NULL`, `points INTEGER`, `locked_at TIMESTAMPTZ`, `updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`.
- R-DB-20: `predictions.predicted_home` and `predictions.predicted_away` MUST each have `CHECK (value >= 0 AND value <= 15)` (cap is 15 — user decision B).
- R-DB-21: `predictions` MUST have a UNIQUE constraint on `(room_id, user_id, match_id)`.

### `invitations`

- R-DB-22: `invitations.id` MUST be `UUID PRIMARY KEY DEFAULT gen_random_uuid()`.
- R-DB-23: `invitations` MUST have: `room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE`, `token TEXT NOT NULL UNIQUE`, `created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT`, `used_by_user_id UUID REFERENCES profiles(id)`, `expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days')`, `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`.

### `audit_log`

- R-DB-24: `audit_log.id` MUST be `UUID PRIMARY KEY DEFAULT gen_random_uuid()`.
- R-DB-25: `audit_log` MUST have: `admin_id UUID NOT NULL REFERENCES profiles(id)`, `action TEXT NOT NULL`, `target_table TEXT NOT NULL`, `target_id UUID`, `before_value JSONB`, `after_value JSONB`, `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`.
- R-DB-26: `audit_log` MUST have a composite index: `CREATE INDEX IF NOT EXISTS idx_audit_log_admin_created ON audit_log(admin_id, created_at DESC)`.

### Type generation

- R-DB-27: A `gen-types` pnpm script MUST exist: `supabase gen types typescript --linked > shared/types/database.types.ts`.
- R-DB-28: After running `pnpm gen-types`, `shared/types/database.types.ts` MUST be non-empty and contain type definitions for all 7 tables.
- R-DB-29: `nuxt.config.ts` MUST reference the generated types file via `supabase: { types: './shared/types/database.types.ts' }`.

### RLS Policy Patches (slice 3 — matches-and-predictions)

- R-DB-32: Migration `00014_fix_pred_rls.sql` MUST patch THREE prediction RLS policies to use `(SELECT auth.uid())` instead of bare `auth.uid()`, eliminating the 42501 permission error under the Supabase JIT policy planner. The three policies are: `pred_insert_own_before_kickoff`, `pred_update_own_unlocked`, and `pred_delete_own_unlocked`. This migration MUST be forward-only, idempotent (using `DROP POLICY IF EXISTS` + `CREATE POLICY`), and executed in PR-1 of slice 3.

---

## Scenarios

### S-DB-01: Migration applies cleanly

```
Given a blank Supabase project linked via `supabase link`
When the developer runs `supabase db push`
Then migration 00001_schema.sql applies without errors
And all 7 tables exist in the public schema
```

### S-DB-02: REPLICA IDENTITY FULL on room_members

```
Given the schema migration has been applied
When the developer queries `SELECT relreplident FROM pg_class WHERE relname = 'room_members'`
Then the result is `'f'` (FULL)
```

### S-DB-03: Prediction score cap enforced by DB

```
Given the schema migration has been applied
And a valid profiles, rooms, and matches row exists
When an INSERT into predictions is attempted with predicted_home = 16
Then Postgres raises a CHECK constraint violation
And the row is NOT inserted
```

### S-DB-04: Prediction score boundary accepted

```
Given the schema migration has been applied
When an INSERT into predictions is attempted with predicted_home = 15 and predicted_away = 0
Then the row is inserted successfully
```

### S-DB-05: Invitation expiry default is 7 days

```
Given the schema migration has been applied
When a row is inserted into invitations without specifying expires_at
Then expires_at equals NOW() + 7 days (within a 1-second tolerance)
```

### S-DB-06: rooms invite_code uniqueness

```
Given two rooms exist
When a second INSERT into rooms uses the same invite_code value
Then Postgres raises a unique constraint violation
```

### S-DB-07: predictions unique constraint

```
Given a predictions row exists for (room_id, user_id, match_id)
When a second INSERT uses the same (room_id, user_id, match_id)
Then Postgres raises a unique constraint violation
```

### S-DB-08: Type generation produces output

```
Given the schema migration has been applied and supabase link is configured
When the developer runs `pnpm gen-types`
Then shared/types/database.types.ts is created (or overwritten)
And the file is non-empty
And it contains the string `profiles` (confirming the table is present)
```

### S-DB-09: profiles FK to auth.users

```
Given the schema migration has been applied
When a profiles row is deleted by cascading deletion from auth.users
Then the profiles row is removed (ON DELETE CASCADE enforced)
```

---

## Acceptance criteria

- [ ] `supabase db push` applies `00001_schema.sql` against a blank project with no errors
- [ ] All 7 tables present in public schema
- [ ] `room_members` has `relreplident = 'f'`
- [ ] `predictions.predicted_home` CHECK rejects 16, accepts 15
- [ ] `invitations.expires_at` defaults to `NOW() + 7 days`
- [ ] `predictions(room_id, user_id, match_id)` UNIQUE constraint present
- [ ] `matches.kickoff_at` index exists
- [ ] `audit_log(admin_id, created_at DESC)` index exists
- [ ] `pnpm gen-types` produces non-empty `shared/types/database.types.ts`
- [ ] `nuxt.config.ts` references the generated types file

---

## Out of scope (this slice)

- RLS policies (covered in `security` domain, `00002_rls.sql`)
- Trigger functions (covered in `triggers` domain, `00003_triggers.sql`)
- Seed data
- `tournament_predictions` table (roadmap — not in v1)
- Match sync from external API
