# Tasks: guards-coverage-and-stale-toast (Slice 5 of 5+)

**Date**: 2026-05-24
**Status**: COMPLETE — all T-58..T-79 done
**Branch**: `feat/guards-coverage-and-stale-toast`
**Delivery strategy**: `single-pr`
**Strict TDD**: ACTIVE (RED → GREEN → REFACTOR)
**Test commands**: `pnpm test:unit` | `pnpm test:nuxt`
**Task numbering**: T-58..T-79 (continues from slice 4 T-57)
**Block numbering**: B19..B27 (continues from slice 4 B18)

---

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~160–210 LOC |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | single-pr |
| Chain strategy | N/A |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | All B19–B27 tasks | PR 1 (main) | ~160-210 LOC total; single commit-per-block |

---

## Coverage Matrix

| Requirement | Satisfied by Blocks |
|-------------|---------------------|
| R-UX-01 (toast visibility, useState singleton) | B19, B20, B21 |
| R-UX-02 (toast content, CTA, no new deps) | B20 |
| R-UX-03 (401 detection in 3 composables) | B22 |
| R-UX-04 (401 detection in MatchPredictionCard) | B23 |
| R-UX-05 (reset before navigate) | B20 |
| R-ADMIN-04 (scenario: unauthenticated → toast) | B25 |
| R-ADMIN-05 (discriminated endpoint response) | B24 |
| R-ADMIN-06 (admin page reason switch) | B25 |

---

## B19 — useSessionExpired composable (RED → GREEN)

- [x] T-58: [RED] Create `tests/unit/use-session-expired.test.ts` — 4 unit tests
- [x] T-59: [GREEN] Create `app/composables/useSessionExpired.ts`

## B20 — SessionExpiredToast component (RED → GREEN)

- [x] T-60: [RED] Create `tests/nuxt/session-expired-toast.nuxt.test.ts` — 5 scenarios
- [x] T-61: [GREEN] Create `app/components/SessionExpiredToast.vue`

## B21 — Mount toast in app.vue (CHORE)

- [x] T-62: [CHORE] Add `<ClientOnly><SessionExpiredToast /></ClientOnly>` to `app/app.vue`

## B22 — Composable 401 detection (RED → GREEN)

- [x] T-63: [RED] Add 401 test group to `tests/unit/use-room-401.test.ts`
- [x] T-64: [RED] Create `tests/unit/use-matches.test.ts`
- [x] T-65: [RED] Create `tests/unit/use-leaderboard-401.test.ts`
- [x] T-66: [GREEN] Add 401 branch to `app/composables/useRoom.ts`
- [x] T-67: [GREEN] Add 401 branch to `app/composables/useMatches.ts`
- [x] T-68: [GREEN] Add 401 branch to `app/composables/useLeaderboard.ts`

## B23 — MatchPredictionCard 401 detection (RED → GREEN)

- [x] T-69: [RED] Add 401 scenario to `tests/nuxt/predictions.nuxt.test.ts`
- [x] T-70: [GREEN] Add `statusCode === 401` branch to `app/components/MatchPredictionCard.vue`

## B24 — Admin endpoint discriminated response (RED → GREEN)

- [x] T-71: [RED] Create `tests/unit/handlers/is-super-admin.test.ts`
- [x] T-72: [GREEN] Create `server/handlers/is-super-admin.ts` + rewrite endpoint

## B25 — Admin page reason switch (CHORE)

- [x] T-73: [CHORE] Update `app/pages/admin/matches/index.vue` — switch on `reason`

## B26 — Auth-delegation comments (CHORE)

- [x] T-74: [CHORE] Add auth comment to `app/pages/rooms/index.vue`
- [x] T-75: [CHORE] Add auth comment to `app/pages/rooms/[id]/index.vue`

## B27 — Wrap-up (CHORE)

- [x] T-76: [CHORE] pnpm test:unit — 178/178 GREEN (24 files)
- [x] T-77: [CHORE] pnpm test:nuxt — 21/21 GREEN (3 files)
- [x] T-78: [CHORE] package.json deps unchanged
- [x] T-79: [CHORE] 8 work-unit commits (B19–B26)
