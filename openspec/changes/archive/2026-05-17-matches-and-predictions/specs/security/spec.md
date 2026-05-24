# Security Spec — Delta for matches-and-predictions (Slice 3)

## Overview

Delta to the `security` main spec. Three new requirements: in-handler super-admin gate for all admin endpoints (R-SEC-43), prediction RLS post-patch guarantees (R-SEC-44), and audit_log write requirement on every super-admin match mutation (R-SEC-45).

## Requirements

### R-SEC-43: In-Handler Super-Admin Authorisation
**Type**: NEW
**Source**: C4 / C5 / C6 / proposal Risk R5
**Statement**: Every admin server handler MUST call `requireSuperAdmin(event)` as its first instruction. The service-role Supabase client MUST NOT be created if this check fails. Non-super-admin or unauthenticated callers MUST receive `403`. This in-handler check is the primary security boundary for admin operations because the `matches` table intentionally has no write RLS — it relies on service-role-only writes plus this in-handler gate.

**Scenarios**:
- **Given** a regular authenticated user attempts `PATCH /api/admin/matches/[id]` **When** `requireSuperAdmin(event)` runs **Then** `403` is returned, the service-role client is never created, and no audit_log row is written.
- **Given** a super-admin user calls `PATCH /api/admin/matches/[id]` **When** the authorisation check passes **Then** the handler proceeds; if the mutation succeeds an audit_log row is written.
- **Given** the service-role client is instantiated in a non-admin handler (e.g., list-matches) **When** a unit test audits handler code **Then** the test MUST fail — service role MUST only appear in admin handlers.

### R-SEC-44: Prediction RLS Policy Post-Patch Guarantees
**Type**: NEW
**Source**: C2 / R1 (Risk)
**Statement**: After migration 00014 is applied, the following invariants MUST hold: (a) `pred_insert_own_before_kickoff` allows INSERT only when `auth.uid() = user_id` AND `match.kickoff_at > NOW()`; (b) `pred_update_own_unlocked` allows UPDATE only when `auth.uid() = user_id` AND `locked_at IS NULL`; (c) `pred_select_room_members` allows SELECT only to members of the prediction's room; (d) `pred_select_super_admin` allows full SELECT to super-admins.

**Scenarios**:
- **Given** migration 00014 is applied **When** an authenticated non-member attempts to SELECT predictions from a room they do not belong to **Then** zero rows are returned (RLS `pred_select_room_members` hides them).
- **Given** a prediction has `locked_at IS NOT NULL` **When** the prediction owner attempts an UPDATE directly via a DB client (bypassing the handler) **Then** the RLS policy `pred_update_own_unlocked` rejects it with `42501`.
- **Given** a match has `kickoff_at <= NOW()` **When** a user attempts a direct INSERT into `predictions` (bypassing the handler) **Then** `pred_insert_own_before_kickoff` rejects it.

### R-SEC-45: Audit Log on Match Mutations
**Type**: NEW
**Source**: C6 / D5
**Statement**: Every super-admin match mutation (PATCH match, lock-now) MUST write a row to `audit_log` via the service-role client after the operation succeeds. The row MUST contain: `action` (string — see convention below), `admin_id` (super-admin's `user_id`), `target_id` (match id or `null` for lock-now), `target_type` (e.g., `"match"`), `before_value` (snapshot before mutation or `null`), `after_value` (diff/result after mutation), `created_at` (server timestamp). The columns `actor_id` and `payload` do NOT exist on `audit_log` — use `admin_id` and `before_value`/`after_value` respectively. A failed mutation MUST NOT write an audit_log row.

**Action string convention**: actions follow the pattern `<resource>.<verb_past>` where resource is plural (e.g., `matches`, `predictions`). Examples: `matches.update`, `predictions.lock_started`. This convention MUST be followed for all future audit actions.

**Scenarios**:
- **Given** a super-admin calls `PATCH /api/admin/matches/[id]` with `{ status: "finished", home_score: 2 }` and the update succeeds **When** the handler finishes **Then** one `audit_log` row exists with `action = "matches.update"`, `admin_id = superAdmin.id`, `target_id = match.id`, `target_type = "match"`, and `after_value` containing the submitted diff.
- **Given** a super-admin calls `PATCH /api/admin/matches/[id]` but the DB update fails (e.g., match not found) **When** the handler returns `404` **Then** no `audit_log` row is written.
- **Given** a super-admin calls `POST /api/admin/matches/lock-now` **When** the RPC succeeds **Then** one `audit_log` row exists with `action = "predictions.lock_started"` and `after_value = { locked_count: <N> }`.

## Out of Scope
- RLS on `audit_log` itself (no changes to existing audit_log policies in this slice).
- Admin role delegation or permission levels beyond the binary `is_super_admin` flag.
