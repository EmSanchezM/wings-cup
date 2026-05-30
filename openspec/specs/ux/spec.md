# UX Spec — guards-coverage-and-stale-toast (Slice 5) + design-system-and-ui (Slice 8)

## Overview
Capability domain: `ux`. R-UX-01..R-UX-05 cover the stale-session toast infrastructure and 401-detection wiring across all authenticated composables and components (Slice 5). R-UX-06..R-UX-09 cover the visual identity restyle for landing, predictions, admin, and leaderboard pages (Slice 8).

## Requirements Summary
| Req | Title | Scenarios |
|-----|-------|-----------|
| R-UX-01 | Session Expired Toast Visibility | 4 |
| R-UX-02 | Session Expired Toast Content & CTA | 4 |
| R-UX-03 | Inline 401 Detection in Composables | 4 |
| R-UX-04 | Inline 401 Detection in MatchPredictionCard | 3 |
| R-UX-05 | Flag Reset Before Navigation | 2 |
| R-UX-06 | Landing Page + Cómo Funciona | 5 |
| R-UX-07 | Predictions Visual + Points Sidebar | 6 |
| R-UX-08 | Admin Visual + Select (script-invariant) | 4 |
| R-UX-09 | Leaderboard / Ranking Visual + Stats | 5 |

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

---

### R-UX-06: Landing Page + Cómo Funciona
**Type**: NEW | **Source**: Validation (`index.vue` was `<h1>`) + mockups 1 & 2
**Files**: `app/pages/index.vue`

`app/pages/index.vue` MUST render a full landing page (replacing the placeholder `<h1>`) using design-system tokens (dark). It MUST contain: a brand wordmark including "Wings Cup"; a hero with a headline, a tagline, and a one-line value proposition in Rioplatense Spanish; a primary CTA that is a navigable link to `/auth/login`; a **"Cómo Funciona" section with three steps** (crear liga, invitar amigos, pronosticar); and a footer. Any preview/illustration card MUST be static decorative markup (no live data fetch). It MUST be server-render safe (no `new Date()`/random-driven markup divergence).

#### Scenario: Landing shows the brand and value prop
- GIVEN a visitor opens `/`
- WHEN the page renders
- THEN "Wings Cup" is present AND a tagline/value-proposition text is present

#### Scenario: Primary CTA links to login
- GIVEN the landing is rendered
- WHEN inspecting the primary CTA
- THEN it is a link whose destination is `/auth/login`

#### Scenario: Cómo Funciona has three steps
- GIVEN the landing is rendered
- WHEN inspecting the "Cómo Funciona" section
- THEN three distinct step items are present

#### Scenario: No placeholder remains
- GIVEN `index.vue` after this change
- WHEN inspecting the template
- THEN it is not the bare `<h1>Wings Cup</h1>` AND includes hero + Cómo Funciona + footer

#### Scenario: Server-render safe
- GIVEN the landing renders on the server
- WHEN hydrated on the client
- THEN no hydration mismatch occurs

---

### R-UX-07: Predictions Visual + Points Sidebar
**Type**: NEW | **Source**: Proposal + mockup 3
**Files**: `app/pages/rooms/[id]/predictions.vue`, `app/components/MatchPredictionCard.vue`

`MatchPredictionCard` MUST be restyled to dark tokens (template/classes only): match teams, token-styled score inputs, a status `Badge` (Pendiente/En Vivo/Finalizado per the status→variant map), a live-match left accent border, and a locked/finished readonly treatment driven by the existing reactive flags. Its hardcoded light color literals (`bg-yellow-50`, `bg-red-50`, `bg-green-50`, `bg-gray-50`) MUST be removed. Its `<script setup>` MUST remain functionally unchanged, including **per-card save** (no global save).

`predictions.vue` MUST be restyled (branded header + match list) and MUST add a **"Resumen de Puntos" sidebar**: "Pronósticos completados N/M" (derived from on-page data, no fetch), plus "Puntos acumulados" and "Posición actual" (from a **read-only** leaderboard fetch added to the page, matched to the current user via `useSupabaseUser`). The added fetch MUST be read-only (no new endpoint, no write) and MUST degrade gracefully (sidebar hides/partial) on failure without breaking the cards.

#### Scenario: Card shows teams, status badge, inputs
- GIVEN a scheduled match with no prediction
- WHEN `MatchPredictionCard` renders
- THEN both team names, a status `Badge`, and two score inputs are present

#### Scenario: Hardcoded light colors removed
- GIVEN `MatchPredictionCard.vue` after the restyle
- WHEN scanning its template classes
- THEN no `bg-yellow-50`, `bg-red-50`, `bg-green-50`, or `bg-gray-50` literal remains

#### Scenario: Locked state is visually distinct (script-invariant)
- GIVEN a match whose prediction is locked
- WHEN the card renders
- THEN the inputs are readonly AND a locked indicator is shown
- AND the `<script setup>` (refs, computed, `handleSubmit`, per-card submit) is functionally identical to pre-restyle

#### Scenario: Completados is derived on-page
- GIVEN the predictions page with M eligible matches and N saved predictions
- WHEN the sidebar renders
- THEN "completados" shows N/M computed from already-loaded page data (no extra fetch needed for this figure)

#### Scenario: Points and position come from a read-only leaderboard fetch
- GIVEN the leaderboard fetch succeeds and the current user has an entry
- WHEN the sidebar renders
- THEN "Puntos acumulados" equals the user's `total_points` AND "Posición actual" equals the user's rank
- AND no write request was issued by the page

#### Scenario: Sidebar degrades gracefully
- GIVEN the leaderboard fetch fails
- WHEN the page renders
- THEN the match cards still render and remain interactive
- AND the points/position figures are hidden or shown as unavailable (no thrown error)

---

### R-UX-08: Admin Visual + Select (script-invariant)
**Type**: NEW | **Source**: Proposal — restyle admin, replace native select
**Files**: `app/pages/admin/matches/index.vue`, `app/components/ui/select/*`

The admin matches view MUST be restyled to dark tokens: lock-now panel and match rows on `card` surfaces, status `Badge`, polished inline edit form. The native `<select>` MUST be replaced by a shadcn-vue `Select` (reka-ui based, under `app/components/ui/select/`) bound to the same `editDrafts[id].status` model with the same four values `scheduled`, `live`, `finished`, `postponed`. The `<script setup>` MUST remain functionally unchanged (`ensureSuperAdmin`, `startEdit`, `saveEdit`, `cancelEdit`, `handleLockNow`, all refs).

> Pre-approved fallback: a token-styled native `<select>` satisfies the visual contract if the reka-ui port is disproportionately heavy; the four values + `v-model` binding remain mandatory.

#### Scenario: Status control offers the four values
- GIVEN the admin edit form is open
- WHEN inspecting the status control
- THEN it offers exactly `scheduled`, `live`, `finished`, `postponed` AND is bound to `editDrafts[id].status`

#### Scenario: Rows use card surfaces and status badges
- GIVEN the admin list renders with matches
- WHEN inspecting a match row
- THEN it sits on a `card` surface AND shows a status `Badge`

#### Scenario: Script is unchanged
- GIVEN `admin/matches/index.vue` after the restyle
- WHEN comparing `<script setup>` to pre-restyle
- THEN `ensureSuperAdmin`/`startEdit`/`saveEdit`/`cancelEdit`/`handleLockNow` and refs are functionally identical

#### Scenario: Existing admin tests stay green
- GIVEN pre-existing admin tests
- WHEN the restyle is applied
- THEN they pass without modifying their behavioural assertions

---

### R-UX-09: Leaderboard / Ranking Visual + Stats
**Type**: NEW | **Source**: Proposal + mockup 4
**Files**: `app/pages/rooms/[id]/leaderboard.vue`

`leaderboard.vue` MUST be restyled to dark tokens, adapting mockup 4: ranked rows each with an **initials avatar** derived from `display_name`, position, name, and `total_points`. The row belonging to the current user MUST be **visually highlighted** and labelled "Tú" (current user resolved via `useSupabaseUser`). A **stats panel** MUST show derived figures: "Promedio grupo" (average of `total_points`) and "Partidos restantes" (count of matches with status ≠ `finished`, via a read-only matches load). All additions MUST be read-only; the existing realtime reload behaviour MUST be preserved. Trend arrows, hit counts, and prizes MUST NOT be rendered (deferred — no backing data).

#### Scenario: Rows show initials, name, points
- GIVEN a leaderboard with entries
- WHEN the page renders
- THEN each row shows an initials avatar (from `display_name`), the name, and `total_points`

#### Scenario: Current user row highlighted
- GIVEN the current user has an entry in the leaderboard
- WHEN the page renders
- THEN that row is visually highlighted AND labelled "Tú"

#### Scenario: Stats are derived
- GIVEN a leaderboard and the loaded matches
- WHEN the stats panel renders
- THEN "Promedio grupo" equals the average of entries' `total_points`
- AND "Partidos restantes" equals the count of matches with status ≠ `finished`

#### Scenario: No deferred features rendered
- GIVEN the restyled leaderboard
- WHEN inspecting the rows and panels
- THEN no trend arrows, no "Aciertos" count, and no "Premios del Grupo" panel are present

#### Scenario: Realtime preserved
- GIVEN the existing member + matches-driven realtime reload
- WHEN a relevant update arrives
- THEN the leaderboard still reloads/updates as before (existing tests green)
