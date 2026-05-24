# Admin Spec — matches-and-predictions (Slice 3)

## Overview

New capability. Full spec for super-admin match management: authorisation gate, match mutation endpoint, Lock Predictions Now button, and audit_log write requirement. All admin actions execute under service role after the in-handler is_super_admin check.

## Requirements

### R-ADMIN-01: Super-Admin Authorisation Gate
**Type**: NEW
**Source**: C4 / C5 / C6 / proposal §Approach (R5)
**Statement**: Every admin handler (`update-match`, `lock-started-predictions`) MUST call `requireSuperAdmin(event)` as the FIRST operation. If the caller's profile has `is_super_admin = false` or the session is unauthenticated, the handler MUST return `403` immediately without executing any business logic or database write. The service-role Supabase client MUST NOT be created before the authorisation check passes.

**Scenarios**:
- **Given** a non-super-admin authenticated user calls `PATCH /api/admin/matches/[id]` **When** `requireSuperAdmin(event)` is evaluated **Then** the handler returns `403` and no database mutation occurs.
- **Given** an unauthenticated request reaches `PATCH /api/admin/matches/[id]` **When** the session is checked **Then** the handler returns `403` and the service-role client is never instantiated.
- **Given** a super-admin user calls `PATCH /api/admin/matches/[id]` with a valid payload **When** `requireSuperAdmin(event)` passes **Then** the handler proceeds to the mutation logic.

### R-ADMIN-02: Update Match Endpoint
**Type**: NEW
**Source**: C4
**Statement**: `PATCH /api/admin/matches/[id]` MUST allow a super-admin to update any subset of `{ status, home_score, away_score, home_team, away_team }` on a match row. The endpoint MUST use the service-role Supabase client. The update MUST be validated by `UpdateMatchSchema` before reaching the DB. On success the endpoint MUST return `200` with the updated match row.

**Scenarios**:
- **Given** a super-admin sends `{ status: "finished", home_score: 3, away_score: 1 }` to `PATCH /api/admin/matches/{id}` **When** the update is processed **Then** the match row reflects the new values and the response returns `200` with the full updated object.
- **Given** a super-admin sends `{ status: "live" }` to `PATCH /api/admin/matches/{id}` where the match does not exist **When** Supabase returns zero updated rows **Then** the endpoint returns `404`.
- **Given** a super-admin sends `{ home_score: "two" }` (string, not integer) **When** `UpdateMatchSchema` validates the payload **Then** the endpoint returns `400` and no DB write occurs.

### R-ADMIN-03: Lock Predictions Now Button
**Type**: NEW
**Source**: C5 / D4
**Statement**: `POST /api/admin/matches/lock-now` MUST, after passing the `requireSuperAdmin(event)` gate, call the `lock_started_predictions()` Supabase RPC using the service-role client. On success the endpoint MUST return `200` with `{ locked: <count> }` where `count` is the number of predictions locked. This endpoint MUST NOT accept a request body.

**Scenarios**:
- **Given** there are 5 predictions whose match `kickoff_at <= NOW()` and `locked_at IS NULL` **When** a super-admin calls `POST /api/admin/matches/lock-now` **Then** all 5 predictions have `locked_at` set and the response returns `{ locked: 5 }`.
- **Given** all started predictions are already locked (`locked_at IS NOT NULL`) **When** a super-admin calls `POST /api/admin/matches/lock-now` **Then** the response returns `{ locked: 0 }` without error.
- **Given** a non-super-admin calls `POST /api/admin/matches/lock-now` **When** the authorisation gate runs **Then** the endpoint returns `403` and the RPC is never called.

### R-ADMIN-04: Admin Matches Page
**Type**: NEW
**Source**: C4 / C5 / proposal §In Scope
**Statement**: `app/pages/admin/matches/index.vue` MUST render the full match list with inline edit controls for `status`, `home_score`, `away_score`, `home_team`, `away_team`. It MUST include a prominently placed "Lock Predictions Now" button that calls `POST /api/admin/matches/lock-now`. The page MUST only be reachable by users where `profiles.is_super_admin = true`; unauthorised access MUST redirect to `/`.

**Scenarios**:
- **Given** a super-admin navigates to `/admin/matches` **When** the page loads **Then** the match list is displayed with edit controls and the "Lock Predictions Now" button is visible.
- **Given** a regular authenticated user navigates to `/admin/matches` **When** the page guard evaluates `is_super_admin` **Then** the user is redirected to `/` and no match data is fetched.
- **Given** an authenticated user whose JWT has since expired navigates to `/admin/matches` **When** the page's `ensureSuperAdmin()` function receives `reason === 'unauthenticated'` from the API **Then** `useSessionExpired().setExpired()` is called AND the user is NOT silently redirected to `/` AND the `<SessionExpiredToast />` becomes visible.

### R-ADMIN-05: Discriminated /api/me/is-super-admin Response
**Type**: NEW (Slice 5)
**Source**: CRITICAL gap — endpoint swallowed 401 (explore finding)
**Statement**: `GET /api/me/is-super-admin` MUST return a discriminated response object `{ isSuperAdmin: boolean, reason: 'authorized' | 'unauthenticated' | 'forbidden' }` for every call. The three cases MUST map as follows:

| Condition | `isSuperAdmin` | `reason` |
|-----------|---|---|
| JWT missing, invalid, or expired (server throws 401) | `false` | `'unauthenticated'` |
| User authenticated, `is_super_admin !== true` | `false` | `'forbidden'` |
| User authenticated, `is_super_admin === true` | `true` | `'authorized'` |

The endpoint MUST NOT throw an unhandled error for the unauthenticated case; it MUST catch the 401 from `serverSupabaseUser` and return the discriminated object with HTTP 200. The `reason` field is additive and backward-compatible at the wire level.

**Scenarios**:
- **Given** a request with a missing or expired JWT reaches the endpoint **When** `serverSupabaseUser` throws a 401 **Then** the endpoint catches the error AND returns HTTP 200 with `{ isSuperAdmin: false, reason: 'unauthenticated' }`.
- **Given** a request with a valid JWT for a user where `is_super_admin` is `false` **When** the handler checks the user record **Then** the response is HTTP 200 with `{ isSuperAdmin: false, reason: 'forbidden' }`.
- **Given** a request with a valid JWT for a user where `is_super_admin` is `true` **When** the handler checks the user record **Then** the response is HTTP 200 with `{ isSuperAdmin: true, reason: 'authorized' }`.
- **Given** any call to `GET /api/me/is-super-admin` **When** the response is received **Then** the response body MUST contain a `reason` field with value in `['authorized', 'unauthenticated', 'forbidden']`.

### R-ADMIN-06: Admin Page Reason Handling
**Type**: NEW (Slice 5)
**Source**: CRITICAL gap — admin page did not handle 401 path
**Statement**: `app/pages/admin/matches/index.vue` MUST switch on the `reason` field from the `/api/me/is-super-admin` response in its `ensureSuperAdmin()` function. The page MUST NOT treat `reason === 'unauthenticated'` as equivalent to `reason === 'forbidden'`. Silent redirect on unauthenticated is FORBIDDEN.

| `reason` value | Required page behaviour |
|---|---|
| `'authorized'` | Continue to render normally; do nothing else |
| `'forbidden'` | Call `navigateTo('/')` immediately |
| `'unauthenticated'` | Call `useSessionExpired().setExpired()` and stop; do NOT call `navigateTo` |

**Scenarios**:
- **Given** the API returns `{ isSuperAdmin: true, reason: 'authorized' }` **When** `ensureSuperAdmin()` evaluates the response **Then** the page renders normally with match list and controls visible.
- **Given** the API returns `{ isSuperAdmin: false, reason: 'forbidden' }` **When** `ensureSuperAdmin()` evaluates the response **Then** `navigateTo('/')` is called.
- **Given** the API returns `{ isSuperAdmin: false, reason: 'unauthenticated' }` **When** `ensureSuperAdmin()` evaluates the response **Then** `useSessionExpired().setExpired()` is called AND `navigateTo` is NOT called AND the toast becomes visible.
- **Given** the `admin/matches/index.vue` source is inspected **When** checking the `ensureSuperAdmin()` function **Then** explicit handling for all three values (`'authorized'`, `'forbidden'`, `'unauthenticated'`) MUST be present AND a fallthrough or unhandled case MUST NOT exist.

## Out of Scope
- Admin match creation UI (super-admin uses seed file + direct DB for now).
- Bulk match status update (deferred).
- Admin prediction override (deferred).
