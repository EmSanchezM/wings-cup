# UX Spec — Delta for design-system-and-ui (Slice 8)

## Overview
MODIFIED capability `ux` (extends R-UX-01..R-UX-05 from slice 5). Four new requirements: landing (+ Cómo Funciona), predictions visual + points sidebar, admin visual + Select, leaderboard/ranking visual + stats. Layouts adapted from user mockups, rendered dark. Cross-cutting invariant: restyle changes markup/classes; only `predictions.vue` and `leaderboard.vue` may add **read-only derived data**.

## Requirements Summary
| Req | Title | Action | Scenarios |
|-----|-------|--------|-----------|
| R-UX-06 | Landing Page + Cómo Funciona | NEW | 5 |
| R-UX-07 | Predictions Visual + Points Sidebar | NEW | 6 |
| R-UX-08 | Admin Visual + Select (script-invariant) | NEW | 4 |
| R-UX-09 | Leaderboard / Ranking Visual + Stats | NEW | 5 |

---

## NEW Requirements

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
