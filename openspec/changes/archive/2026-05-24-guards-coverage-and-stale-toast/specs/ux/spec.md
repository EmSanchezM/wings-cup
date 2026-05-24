# UX Spec — Delta for guards-coverage-and-stale-toast (Slice 5)

## Overview
NEW capability domain: `ux`. Five new requirements covering the stale-session toast infrastructure and 401-detection wiring across all authenticated composables and components. There are no prior UX requirements in this numbering space.

## Requirements Summary
| Req | Title | Action | Scenarios |
|-----|-------|--------|-----------|
| R-UX-01 | Session Expired Toast Visibility | NEW | 4 |
| R-UX-02 | Session Expired Toast Content & CTA | NEW | 4 |
| R-UX-03 | Inline 401 Detection in Composables | NEW | 4 |
| R-UX-04 | Inline 401 Detection in MatchPredictionCard | NEW | 3 |
| R-UX-05 | Flag Reset Before Navigation | NEW | 2 |

---

## NEW Requirements

### R-UX-01: Session Expired Toast Visibility
**Type**: NEW | **Source**: Stale-session UX gap / explore finding
**Files**: `app/composables/useSessionExpired.ts`, `app/components/SessionExpiredToast.vue`, `app/app.vue`

`useSessionExpired` MUST be a module-level singleton backed by `useState('session-expired', () => false)`. It MUST expose `{ isExpired: Readonly<Ref<boolean>>, setExpired(): void, reset(): void }`. `<SessionExpiredToast />` MUST be mounted in `app/app.vue` inside a `<ClientOnly>` wrapper so it is never server-rendered. The toast element MUST be rendered in the DOM when and only when `isExpired === true`; when `isExpired === false` the component MUST render nothing (no hidden/invisible element).

#### Scenario: Toast hidden when flag is false

- GIVEN `useSessionExpired().isExpired` is `false` (initial state)
- WHEN `app.vue` renders
- THEN no toast element is present in the DOM

#### Scenario: Toast visible after setExpired()

- GIVEN `useSessionExpired().isExpired` is `false`
- WHEN any caller invokes `setExpired()`
- THEN `isExpired` becomes `true`
- AND `<SessionExpiredToast />` renders its card element in the DOM

#### Scenario: Toast disappears after reset()

- GIVEN `isExpired === true` and the toast is visible
- WHEN `reset()` is called
- THEN `isExpired` becomes `false`
- AND the toast element is removed from the DOM

#### Scenario: useState key is 'session-expired'

- GIVEN the `useSessionExpired` composable source is inspected
- WHEN checking the `useState` call
- THEN the key argument MUST be the string `'session-expired'`
- AND the initialiser MUST return `false`

---

### R-UX-02: Session Expired Toast Content & CTA
**Type**: NEW | **Source**: Stale-session UX gap / proposal decision
**Files**: `app/components/SessionExpiredToast.vue`

`<SessionExpiredToast />` MUST contain all of the following elements when rendered:
1. A warning icon (lucide-vue-next, already a project dependency).
2. The exact message text: **"Tu sesión expiró. Volvé a iniciar sesión para continuar."**
3. A dismiss button rendered as `×` that calls `reset()` on click.
4. A CTA button with label **"Volver a iniciar sesión"** that calls `reset()` AND THEN calls `navigateTo('/auth/login')` — in that order.

The card MUST be built from reka-ui primitives (no new runtime npm dependencies). No `vue-sonner`, no `@nuxt/ui`, no external toast library.

#### Scenario: Toast message is exact

- GIVEN the toast is visible (`isExpired === true`)
- WHEN the component renders
- THEN the text "Tu sesión expiró. Volvé a iniciar sesión para continuar." is present in the DOM

#### Scenario: Dismiss button calls reset()

- GIVEN the toast is visible
- WHEN the user clicks the `×` dismiss button
- THEN `reset()` is called
- AND `isExpired` becomes `false`
- AND the toast disappears

#### Scenario: CTA calls reset then navigates

- GIVEN the toast is visible
- WHEN the user clicks "Volver a iniciar sesión"
- THEN `reset()` is called first
- AND THEN `navigateTo('/auth/login')` is called
- AND `isExpired` is `false` at the time navigation occurs

#### Scenario: No new runtime dependencies

- GIVEN the `package.json` is inspected after implementation
- WHEN checking `dependencies` and `devDependencies`
- THEN no entries for `vue-sonner`, `@nuxt/ui`, or any new toast library are present

---

### R-UX-03: Inline 401 Detection in Composables
**Type**: NEW | **Source**: Stale-session UX gap / explore finding
**Files**: `app/composables/useRoom.ts`, `app/composables/useMatches.ts`, `app/composables/useLeaderboard.ts`
**Supersedes (additive)**: R-LEAD-04 stale-session scenario (slice 4) — that scenario required errors to surface via `error` ref; this requirement changes the 401 path specifically to call `setExpired()` instead.

Each of the three composables (`useRoom`, `useMatches`, `useLeaderboard`) MUST detect `statusCode === 401` inside their `$fetch` error catch blocks. On 401, the composable MUST:
- Call `useSessionExpired().setExpired()`
- Return early without setting `error.value`

All non-401 errors MUST continue to use the existing `error.value` assignment path. The 401 branch MUST be checked before the generic error assignment so it short-circuits correctly.

#### Scenario: useRoom sets expired on 401

- GIVEN the user's JWT has expired
- WHEN `useRoom()` calls its fetch and the server returns 401
- THEN `useSessionExpired().setExpired()` is called
- AND `useRoom().error` is NOT set
- AND execution returns early from the catch block

#### Scenario: useMatches sets expired on 401

- GIVEN the user's JWT has expired
- WHEN `useMatches()` calls its fetch and the server returns 401
- THEN `useSessionExpired().setExpired()` is called
- AND `useMatches().error` is NOT set

#### Scenario: useLeaderboard sets expired on 401

- GIVEN the user's JWT has expired
- WHEN `useLeaderboard()` calls its fetch and the server returns 401
- THEN `useSessionExpired().setExpired()` is called
- AND `useLeaderboard().error` is NOT set

#### Scenario: Non-401 errors still surface via error ref

- GIVEN a server returns a non-401 error (e.g. 500, network error)
- WHEN any of the three composables catches the error
- THEN `error.value` IS set to the error message
- AND `useSessionExpired().setExpired()` is NOT called

---

### R-UX-04: Inline 401 Detection in MatchPredictionCard
**Type**: NEW | **Source**: Stale-session UX gap / proposal decision
**Files**: `app/components/MatchPredictionCard.vue`

`MatchPredictionCard`'s submit handler already handles `statusCode === 423` (locked) and `409` (conflict). It MUST additionally handle `statusCode === 401` by calling `useSessionExpired().setExpired()` and returning early — the card-level error state MUST NOT be set on 401. The 401 case MUST be checked in the same `statusCode` branch as 423/409 to keep the pattern consistent.

#### Scenario: 401 triggers toast not card error

- GIVEN the user submits a prediction and the server returns 401 (expired JWT)
- WHEN the submit handler's catch block runs
- THEN `useSessionExpired().setExpired()` is called
- AND no card-level error message is shown
- AND the `<SessionExpiredToast />` becomes visible

#### Scenario: 423 still sets card-level error

- GIVEN the user submits a prediction and the server returns 423 (locked)
- WHEN the catch block runs
- THEN the existing card-level locked error is shown
- AND `useSessionExpired().setExpired()` is NOT called

#### Scenario: 401 branch coexists with existing statusCode checks

- GIVEN the `MatchPredictionCard.vue` source is inspected
- WHEN checking the submit handler catch block
- THEN a `statusCode === 401` check MUST be present in the same branch structure as the 423/409 checks

---

### R-UX-05: Flag Reset Before Navigation
**Type**: NEW | **Source**: Risk: toast re-appears after re-auth / proposal decision
**Files**: `app/components/SessionExpiredToast.vue` (CTA handler), any future handler that navigates to login

`reset()` MUST be called BEFORE `navigateTo('/auth/login')` in every navigation path that leads from the expired-session flow to the login page. This prevents the toast from re-appearing on the login page or after a successful re-authentication. Any future surface that calls `navigateTo('/auth/login')` as a response to a 401 MUST include the `reset()` call first.

#### Scenario: CTA handler order is reset → navigate

- GIVEN the `SessionExpiredToast.vue` CTA click handler is inspected
- WHEN checking the sequence of calls
- THEN `reset()` appears before `navigateTo('/auth/login')` in the call sequence

#### Scenario: Flag is false when login page mounts

- GIVEN the user clicked the CTA from the toast
- WHEN `/auth/login` renders
- THEN `useSessionExpired().isExpired` is `false`
- AND no toast is present on the login page
