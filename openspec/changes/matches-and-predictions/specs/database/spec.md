# Database Spec — Delta for matches-and-predictions (Slice 3)

## Overview

Delta to the `database` main spec. Adds R-DB-32 (migration 00014 patching prediction RLS policies). No new tables are introduced in this slice — `matches`, `predictions`, `audit_log`, and `room_members` already exist from the foundation.

## Requirements

### R-DB-32: Migration `00014_fix_pred_rls.sql`
**Type**: NEW
**Source**: C2 / proposal §Approach (anchor 1) / Risk R1
**Statement**: Migration `00014_fix_pred_rls.sql` MUST patch THREE prediction RLS policies to use `(SELECT auth.uid())` instead of bare `auth.uid()`, eliminating the 42501 permission error under the Supabase JIT policy planner. The three policies are: `pred_insert_own_before_kickoff`, `pred_update_own_unlocked`, and `pred_delete_own_unlocked`. All three use bare `auth.uid()` in the foundation and all three MUST receive the `(SELECT auth.uid())` subquery wrap. This migration MUST be forward-only, idempotent (using `DROP POLICY IF EXISTS` + `CREATE POLICY`), and MUST be the FIRST task of PR-1.

**Scenarios**:
- **Given** migrations 00001–00013 have been applied **When** migration `00014_fix_pred_rls.sql` is applied **Then** no error is raised and all three policies (`pred_insert_own_before_kickoff`, `pred_update_own_unlocked`, `pred_delete_own_unlocked`) exist on the `predictions` table with the corrected `(SELECT auth.uid())` subquery form.
- **Given** migration 00014 has been applied **When** an authenticated room member inserts a prediction before kickoff **Then** the INSERT succeeds without a `42501` error.
- **Given** migration 00014 is run a second time **When** it executes **Then** no error is raised (idempotency via DROP IF EXISTS).

## Out of Scope
- New tables: no new tables are added in this slice.
- Column alterations beyond the RLS policy patch.
- `pnpm gen-types` re-run: developer workflow step, not a formal migration requirement.
- Rollback migration: not committed proactively; documented in the proposal if needed.
