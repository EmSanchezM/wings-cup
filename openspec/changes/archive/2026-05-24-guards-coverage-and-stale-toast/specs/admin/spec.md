# Admin Spec — Delta for guards-coverage-and-stale-toast (Slice 5)

## Overview
Delta. Two new requirements (R-ADMIN-05, R-ADMIN-06) and one modified scenario in R-ADMIN-04. These cover the discriminated `/api/me/is-super-admin` response contract and the corresponding page-level reason handling. R-ADMIN-01..04 from slice 3 (`sdd/matches-and-predictions/spec/admin`) remain in force and are inherited unchanged except where explicitly noted.

## Requirements Summary
| Req | Title | Action | Scenarios |
|-----|-------|--------|-----------|
| R-ADMIN-04 | Admin Matches Page | MODIFIED (scenario added) | 3 (was 2) |
| R-ADMIN-05 | Discriminated /api/me/is-super-admin Response | NEW | 4 |
| R-ADMIN-06 | Admin Page Reason Handling | NEW | 4 |

---

## MODIFIED Requirements

### R-ADMIN-04: Admin Matches Page (scenario addition)
**Type**: MODIFIED | **Source**: CRITICAL gap found in explore — admin silently redirects on 401
**Prior spec**: `sdd/matches-and-predictions/spec/admin` (slice 3, obs #177)

The existing statement ("Page MUST only be reachable by super-admins; others redirected to `/`") remains true. A third scenario is added to cover the expired-session case that was previously unspecified:

#### Scenario (NEW): Expired session triggers toast, not silent redirect

- GIVEN an authenticated user whose JWT has since expired navigates to `/admin/matches`
- WHEN the page's `ensureSuperAdmin()` function receives `reason === 'unauthenticated'` from the API
- THEN `useSessionExpired().setExpired()` is called
- AND the user is NOT silently redirected to `/`
- AND the `<SessionExpiredToast />` becomes visible

---

## NEW Requirements

### R-ADMIN-05: Discriminated /api/me/is-super-admin Response
**Type**: NEW | **Source**: CRITICAL gap — endpoint swallowed 401 (explore finding)
**Files**: `server/api/me/is-super-admin.get.ts`

`GET /api/me/is-super-admin` MUST return a discriminated response object `{ isSuperAdmin: boolean, reason: 'authorized' | 'unauthenticated' | 'forbidden' }` for every call. The three cases MUST map as follows:

| Condition | `isSuperAdmin` | `reason` |
|-----------|----------------|----------|
| JWT missing, invalid, or expired (server throws 401) | `false` | `'unauthenticated'` |
| User authenticated, `is_super_admin !== true` | `false` | `'forbidden'` |
| User authenticated, `is_super_admin === true` | `true` | `'authorized'` |

The endpoint MUST NOT throw an unhandled error for the unauthenticated case; it MUST catch the 401 from `serverSupabaseUser` and return the discriminated `{ isSuperAdmin: false, reason: 'unauthenticated' }` object with HTTP 200. The `reason` field is additive and backward-compatible at the wire level.

#### Scenario: Unauthenticated request returns reason unauthenticated

- GIVEN a request with a missing or expired JWT reaches the endpoint
- WHEN `serverSupabaseUser` throws a 401
- THEN the endpoint catches the error
- AND returns HTTP 200 with `{ isSuperAdmin: false, reason: 'unauthenticated' }`
- AND does NOT propagate the 401 as an unhandled error

#### Scenario: Authenticated non-admin returns reason forbidden

- GIVEN a request with a valid JWT for a user where `is_super_admin` is `false`
- WHEN the handler checks the user record
- THEN the response is HTTP 200 with `{ isSuperAdmin: false, reason: 'forbidden' }`

#### Scenario: Super-admin returns reason authorized

- GIVEN a request with a valid JWT for a user where `is_super_admin` is `true`
- WHEN the handler checks the user record
- THEN the response is HTTP 200 with `{ isSuperAdmin: true, reason: 'authorized' }`

#### Scenario: reason field is always present

- GIVEN any call to `GET /api/me/is-super-admin`
- WHEN the response is received by any caller
- THEN the response body MUST contain a `reason` field with value in `['authorized', 'unauthenticated', 'forbidden']`

---

### R-ADMIN-06: Admin Page Reason Handling
**Type**: NEW | **Source**: CRITICAL gap — admin page did not handle 401 path
**Files**: `app/pages/admin/matches/index.vue`

`app/pages/admin/matches/index.vue` MUST switch on the `reason` field from the `/api/me/is-super-admin` response in its `ensureSuperAdmin()` function:

| `reason` value | Required page behaviour |
|----------------|-------------------------|
| `'authorized'` | Continue to render normally; do nothing else |
| `'forbidden'` | Call `navigateTo('/')` immediately |
| `'unauthenticated'` | Call `useSessionExpired().setExpired()` and stop; do NOT call `navigateTo` |

The page MUST NOT treat `reason === 'unauthenticated'` as equivalent to `reason === 'forbidden'`. Silent redirect on unauthenticated is FORBIDDEN.

#### Scenario: authorized renders the page

- GIVEN the API returns `{ isSuperAdmin: true, reason: 'authorized' }`
- WHEN `ensureSuperAdmin()` evaluates the response
- THEN the page renders normally with match list and controls visible

#### Scenario: forbidden redirects to root

- GIVEN the API returns `{ isSuperAdmin: false, reason: 'forbidden' }`
- WHEN `ensureSuperAdmin()` evaluates the response
- THEN `navigateTo('/')` is called
- AND the page content is not rendered

#### Scenario: unauthenticated sets expired flag, no redirect

- GIVEN the API returns `{ isSuperAdmin: false, reason: 'unauthenticated' }`
- WHEN `ensureSuperAdmin()` evaluates the response
- THEN `useSessionExpired().setExpired()` is called
- AND `navigateTo` is NOT called
- AND the toast becomes visible

#### Scenario: page source handles all three reason values

- GIVEN the `admin/matches/index.vue` source is inspected
- WHEN checking the `ensureSuperAdmin()` function
- THEN explicit handling for all three values (`'authorized'`, `'forbidden'`, `'unauthenticated'`) MUST be present
- AND a fallthrough or unhandled case MUST NOT exist (exhaustive check required)
