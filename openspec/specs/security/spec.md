# Spec: security

**Domain:** Row Level Security (RLS) policies for all 7 tables and service-role-key safety.
**Slice:** foundation (PR 2 of 3 — `supabase/migrations/00002_rls.sql`)

---

## Purpose

Ensure every table in the public schema has RLS enabled with explicit policies for every CRUD operation. Close the three spec gaps (`matches`, `invitations`, `audit_log`). Guarantee that the service role key never reaches the client bundle.

---

## Requirements

### General RLS

- R-SEC-01: RLS MUST be enabled on all 7 tables: `profiles`, `rooms`, `room_members`, `matches`, `predictions`, `invitations`, `audit_log`.
- R-SEC-02: Any CRUD operation on any table that has no matching policy MUST be denied by default for the `authenticated` role.
- R-SEC-03: The `service_role` bypasses RLS entirely (Supabase default). All write operations performed by cron or admin server endpoints MUST use the service role client.
- R-SEC-04: All RLS policies MUST be defined in `supabase/migrations/00002_rls.sql` — a dedicated file, separate from schema and triggers.

### `profiles` RLS

- R-SEC-05: `profiles` SELECT MUST allow a user to read their own row (`auth.uid() = id`).
- R-SEC-06: `profiles` SELECT MUST allow a user to read `display_name` and `avatar_url` of other profiles where both users are members of the same room. The policy MUST NOT expose `is_super_admin` for cross-user queries.
- R-SEC-07: `profiles` INSERT MUST be restricted to service role only (the `handle_new_user` trigger runs as `SECURITY DEFINER`).
- R-SEC-08: `profiles` UPDATE MUST allow a user to update their own row, but MUST NOT allow the `authenticated` role to modify `is_super_admin`. Enforcement is done via a trigger that resets `is_super_admin` to its current DB value on any UPDATE from the `authenticated` role.
- R-SEC-09: `profiles` DELETE MUST be restricted to service role only.

### `rooms` RLS

- R-SEC-10: `rooms` SELECT MUST allow a user to read rooms where they are a member (via `room_members`).
- R-SEC-11: `rooms` SELECT MUST allow super-admins to read all rooms.
- R-SEC-12: `rooms` INSERT MUST allow any `authenticated` user, but `created_by` MUST equal `auth.uid()`.
- R-SEC-13: `rooms` UPDATE MUST allow only the room owner (`created_by = auth.uid()`).
- R-SEC-14: `rooms` DELETE MUST allow only the room owner.

### `room_members` RLS

- R-SEC-15: `room_members` SELECT MUST allow members of the same room to see each other's rows.
- R-SEC-16: `room_members` INSERT MUST allow any `authenticated` user to join a room. (Invitation token validation is enforced at the application layer in slice 2 — the RLS policy here only ensures the inserting user sets `user_id = auth.uid()`.)
- R-SEC-17: `room_members` UPDATE MUST allow only the member to update their own row. `total_points` MUST NOT be updatable by the `authenticated` role — it is mutated exclusively by the `calculate_points()` trigger (`SECURITY DEFINER`).
- R-SEC-18: `room_members` DELETE MUST allow the member to delete their own row (leave room) OR the room owner to delete any member row.

### `matches` RLS

- R-SEC-19: `matches` SELECT MUST allow any `authenticated` user.
- R-SEC-20: `matches` INSERT MUST be restricted to service role only.
- R-SEC-21: `matches` UPDATE MUST be restricted to service role only.
- R-SEC-22: `matches` DELETE MUST be restricted to service role only.

### `predictions` RLS

- R-SEC-23: `predictions` SELECT MUST allow members of the same room to read predictions in that room.
- R-SEC-24: `predictions` SELECT MUST allow super-admins to read all predictions.
- R-SEC-25: `predictions` INSERT MUST satisfy all of: `user_id = auth.uid()`, the match's `kickoff_at > NOW()`, and the user is a member of the room.
- R-SEC-26: `predictions` UPDATE MUST satisfy all of: `user_id = auth.uid()`, `locked_at IS NULL`, and the match's `kickoff_at > NOW()`.
- R-SEC-27: `predictions` DELETE MUST allow only the owner while `locked_at IS NULL`.

### `invitations` RLS

- R-SEC-28: `invitations` SELECT MUST allow the room owner to read all invitations for their room.
- R-SEC-29: `invitations` SELECT MUST allow a user to read an invitation by token. Because Supabase RLS cannot filter by a bearer token without application context, this policy SHOULD be permissive for `authenticated` users querying by token — the server endpoint is responsible for using the service role when validating tokens and for not exposing other rows.
- R-SEC-30: `invitations` INSERT MUST allow only the room owner (`created_by = auth.uid()` AND `rooms.created_by = auth.uid()`).
- R-SEC-31: `invitations` UPDATE MUST be restricted to service role only (setting `used_by_user_id`).
- R-SEC-32: `invitations` DELETE MUST allow only the room owner.

### `audit_log` RLS

- R-SEC-33: `audit_log` SELECT MUST be restricted to users where `profiles.is_super_admin = TRUE`.
- R-SEC-34: `audit_log` INSERT MUST be restricted to service role only.
- R-SEC-35: `audit_log` UPDATE MUST be denied for all roles including `authenticated`.
- R-SEC-36: `audit_log` DELETE MUST be denied for all roles including `authenticated`.

### Service role key safety

- R-SEC-37: `NUXT_SUPABASE_SERVICE_KEY` MUST be stored in `runtimeConfig.supabaseServiceKey` (server-only namespace). It MUST NOT appear in `runtimeConfig.public`.
- R-SEC-38: After `nuxt build`, no file under `dist/_nuxt/` MUST contain the literal string `NUXT_SUPABASE_SERVICE_KEY` or any service key value.
- R-SEC-39: `.env.example` MUST document `NUXT_SUPABASE_SERVICE_KEY` with a placeholder value and a comment warning it is server-only.

### Admin Handler Authorisation and Audit Logging (slice 3 — matches-and-predictions)

- R-SEC-43: In-Handler Super-Admin Authorisation. Every admin server handler MUST call `requireSuperAdmin(event)` as its first instruction. The service-role Supabase client MUST NOT be created if this check fails. Non-super-admin or unauthenticated callers MUST receive `403`. This in-handler check is the primary security boundary for admin operations because the `matches` table intentionally has no write RLS — it relies on service-role-only writes plus this in-handler gate.

- R-SEC-44: Prediction RLS Policy Post-Patch Guarantees. After migration 00014 is applied, the following invariants MUST hold: (a) `pred_insert_own_before_kickoff` allows INSERT only when `auth.uid() = user_id` AND `match.kickoff_at > NOW()`; (b) `pred_update_own_unlocked` allows UPDATE only when `auth.uid() = user_id` AND `locked_at IS NULL`; (c) `pred_select_room_members` allows SELECT only to members of the prediction's room; (d) `pred_select_super_admin` allows full SELECT to super-admins.

- R-SEC-45: Audit Log on Match Mutations. Every super-admin match mutation (PATCH match, lock-now) MUST write a row to `audit_log` via the service-role client after the operation succeeds. The row MUST contain: `action` (string — convention: `<resource>.<verb_past>`, resource plural), `admin_id` (super-admin's user_id), `target_id` (match id or null for lock-now), `target_type` (e.g., "match"), `before_value` (snapshot before mutation or null), `after_value` (diff/result after mutation), `created_at` (server timestamp). Action string convention examples: `matches.update`, `predictions.lock_started`. A failed mutation MUST NOT write an audit_log row.

---

## Scenarios

### S-SEC-01: Unauthenticated user cannot read matches

```
Given an unauthenticated client (no session)
When it executes `SELECT * FROM matches`
Then Supabase returns 0 rows (RLS denies without authentication)
```

### S-SEC-02: Authenticated user can read matches

```
Given a user is authenticated
When they execute `SELECT * FROM matches`
Then they receive all rows in the matches table
```

### S-SEC-03: Authenticated user cannot insert a match

```
Given a user is authenticated (not service role)
When they attempt `INSERT INTO matches (...) VALUES (...)`
Then Postgres raises an RLS policy violation
And the row is NOT inserted
```

### S-SEC-04: User cannot read another user's is_super_admin

```
Given user A and user B are both authenticated and share a room
When user A executes `SELECT is_super_admin FROM profiles WHERE id = <user_B_id>`
Then the query returns 0 rows (or NULL for that column via column-level security)
And user A cannot determine whether user B is a super admin
```

### S-SEC-05: User can read own profile

```
Given a user is authenticated
When they execute `SELECT * FROM profiles WHERE id = auth.uid()`
Then they receive their own profile row including is_super_admin
```

### S-SEC-06: User cannot read a profile outside shared rooms

```
Given user A and user C share no rooms
When user A executes `SELECT display_name FROM profiles WHERE id = <user_C_id>`
Then the query returns 0 rows
```

### S-SEC-07: audit_log is not readable by regular user

```
Given a user is authenticated and is_super_admin = FALSE
When they execute `SELECT * FROM audit_log`
Then Postgres returns 0 rows (RLS denies)
```

### S-SEC-08: audit_log is readable by super admin

```
Given a user is authenticated and is_super_admin = TRUE
When they execute `SELECT * FROM audit_log`
Then they receive all rows
```

### S-SEC-09: audit_log cannot be inserted by authenticated user

```
Given a user is authenticated (not service role)
When they attempt `INSERT INTO audit_log (...) VALUES (...)`
Then Postgres raises an RLS policy violation
```

### S-SEC-10: Prediction insert denied after kickoff

```
Given a match has kickoff_at = NOW() - 1 minute
And a user is authenticated and is a member of a room
When they attempt to INSERT a prediction for that match
Then Postgres raises an RLS policy violation
And the row is NOT inserted
```

### S-SEC-11: Prediction update denied when locked

```
Given a prediction exists with locked_at IS NOT NULL
When the owner attempts to UPDATE that prediction
Then Postgres raises an RLS policy violation
```

### S-SEC-12: is_super_admin cannot be toggled by authenticated UPDATE

```
Given a user is authenticated
When they execute `UPDATE profiles SET is_super_admin = TRUE WHERE id = auth.uid()`
Then the UPDATE either fails or the trigger resets is_super_admin to its previous value
And is_super_admin remains FALSE after the statement
```

### S-SEC-13: Service role key absent from build output

```
Given the app is built with `nuxt build`
When the developer searches dist/_nuxt/ for the string "NUXT_SUPABASE_SERVICE_KEY"
Then no file contains that string
```

### S-SEC-14: Invitation insert denied for non-owner

```
Given user A is a member (not owner) of room R
When user A attempts to INSERT an invitation for room R
Then Postgres raises an RLS policy violation
```

---

## Acceptance criteria

- [ ] `ENABLE ROW LEVEL SECURITY` present for all 7 tables in `00002_rls.sql`
- [ ] `SELECT * FROM matches` as unauthenticated returns 0 rows
- [ ] `SELECT * FROM matches` as authenticated returns all rows
- [ ] Authenticated user cannot INSERT into `matches`, `audit_log`, `invitations` (non-owner)
- [ ] `SELECT is_super_admin FROM profiles WHERE id != auth.uid()` returns no data
- [ ] Super-admin can SELECT from `audit_log`; regular user gets 0 rows
- [ ] Prediction INSERT after kickoff is rejected by RLS
- [ ] Prediction UPDATE when locked_at IS NOT NULL is rejected by RLS
- [ ] `is_super_admin` self-UPDATE has no effect (trigger or column grant blocks it)
- [ ] `runtimeConfig.supabaseServiceKey` is NOT under `runtimeConfig.public`
- [ ] No service key string in `dist/_nuxt/*` after build
- [ ] `.env.example` documents `NUXT_SUPABASE_SERVICE_KEY` as server-only

---

## Out of scope (this slice)

- Invitation token validation logic (application-layer, slice 2)
- Admin panel endpoints that write to `audit_log` (slice 5)
- Column-level grants (GRANT/REVOKE on specific columns) — RLS policies are the primary enforcement mechanism here
- Integration test SQL file (documented in README; deferred to slice 2)
