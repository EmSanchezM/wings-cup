# Database Spec — Delta for rooms-and-invitations

## Overview

Delta to the `database` main spec. Adds the `prize_description` column to `rooms` and documents the `on_room_created` trigger binding added in migration `00005_rooms_slice2.sql`.

## Requirements

### R-DB-30: `rooms.prize_description` Column
**Type**: NEW
**Source**: proposal §In Scope / locked decision #1
**Statement**: Migration `00005_rooms_slice2.sql` MUST add a column `prize_description TEXT NOT NULL DEFAULT ''` to the `rooms` table via `ALTER TABLE rooms ADD COLUMN IF NOT EXISTS prize_description TEXT NOT NULL DEFAULT ''`. The migration MUST be idempotent (using `IF NOT EXISTS` or equivalent).

**Scenarios**:
- **Given** migration `00005_rooms_slice2.sql` has been applied **When** the developer queries `SELECT column_name, data_type, column_default FROM information_schema.columns WHERE table_name = 'rooms' AND column_name = 'prize_description'` **Then** a row is returned with `data_type = 'text'` and `column_default = ''`.
- **Given** the column exists and a room is inserted without specifying `prize_description` **When** the INSERT executes **Then** `prize_description` defaults to `''` (empty string), not `NULL`.
- **Given** migration `00005_rooms_slice2.sql` is run a second time (idempotency check) **When** it executes **Then** no error is raised.

### R-DB-31: Migration File `00005_rooms_slice2.sql`
**Type**: NEW
**Source**: proposal §In Scope / §Approach
**Statement**: A single migration file `supabase/migrations/00005_rooms_slice2.sql` MUST contain all DDL changes for this slice: the `ADD COLUMN` for `prize_description`, the `on_room_created` trigger function, and the trigger binding. No other migration files MUST be created for this slice's schema changes. The file MUST apply successfully via `supabase db push` after migrations `00001`–`00004` have been applied.

**Scenarios**:
- **Given** migrations `00001_schema.sql` through `00004_*.sql` have been applied **When** the developer runs `supabase db push` to apply `00005_rooms_slice2.sql` **Then** the migration succeeds without errors.
- **Given** migration `00005_rooms_slice2.sql` has been applied **When** the developer queries the `rooms` table schema **Then** both `prize_description` (new) and `invite_code` (existing) columns are present.

## Out of Scope
- New tables: no new tables are added in this slice (`invitations` table already exists from foundation).
- Type generation re-run: `pnpm gen-types` should be re-run after this migration but is not a formal requirement of this spec (it is a developer workflow step).
- Rollback migration: `00006_rollback_slice2.sql` is documented in the proposal as a hot-fix mechanism but is NOT committed proactively.
