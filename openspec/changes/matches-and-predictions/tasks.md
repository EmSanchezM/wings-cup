# Tasks: matches-and-predictions (Slice 3 of 5)

**Date**: 2026-05-17
**Delivery strategy**: `auto-chain` — 2 chained PRs
**Strict TDD**: ACTIVE (RED → GREEN → REFACTOR)
**Test commands**: `pnpm test:unit` (unit project) | `pnpm test:nuxt` (Nuxt project)

---

## Review Workload Forecast

| Metric | Value |
|--------|-------|
| Estimated changed lines (PR-1) | ~350 |
| Estimated changed lines (PR-2) | ~320 |
| Combined | ~670 |
| 400-line budget risk | Medium (each PR within 400-line limit) |
| Chained PRs recommended | Yes |
| Decision needed before apply | No |
| Chain strategy | stacked-to-main |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: Medium

### Work Units

| Unit | Goal | Branch | Base |
|------|------|--------|------|
| PR-1 | 00014 RLS fix + match seed + types + schemas + 3 handlers + 3 wrappers + match-client + useMatches + admin page + unit tests | `feat/matches-seed-and-admin` | `main` |
| PR-2 | Prediction + leaderboard schemas/types + 2 handlers + GET predictions wrapper + 2 client utils + 2 composables + 2 pages + nav edit + Nuxt test + unit tests | `feat/predictions-and-leaderboard` | `main` (after PR-1 merged) |

---

## PR-1: `feat/matches-seed-and-admin`

### B1 — Migration (MIGRATION)

- [ ] T-01: Write `supabase/migrations/00014_fix_pred_rls.sql` — DROP POLICY IF EXISTS + CREATE POLICY for `pred_insert_own_before_kickoff`, `pred_update_own_unlocked`, `pred_delete_own_unlocked` using `(SELECT auth.uid())` [MIGRATION] (R-DB-32, R-SEC-44)
  - File(s): `supabase/migrations/00014_fix_pred_rls.sql`
  - Acceptance: `supabase db push` succeeds locally; all 3 policies exist on `predictions` with `(SELECT auth.uid())` form; idempotent (can run twice without error)

### B2 — Seed (SETUP)

- [ ] T-02: Add `pnpm seed:matches` script to `package.json` pointing at `supabase db execute --file supabase/seeds/matches.sql` (no `--remote` flag) [SETUP] (R-PS-30)
  - File(s): `package.json`
  - Acceptance: `pnpm seed:matches` exits 0 against local Supabase

- [ ] T-03: Write `supabase/seeds/matches.sql` with 64 INSERT rows for FIFA 2026 — group matches use real team names + `group_name` A–H; knockout matches use placeholder text e.g. "Group A Winner"; all guarded by `ON CONFLICT (external_id) DO NOTHING` [SETUP] (R-PS-30, R-MATCHES-01, R-MATCHES-02, R-MATCHES-03)
  - File(s): `supabase/seeds/matches.sql`
  - Acceptance: `pnpm seed:matches` inserts 64 rows on empty DB; re-run yields 0 new rows; all `stage` values in `{ group, round_of_16, quarter, semi, final, third_place }`

### B3 — Types and Schemas (RED → GREEN → REFACTOR)

- [ ] T-04: Write failing unit tests for `MatchSchema` and `UpdateMatchSchema` — valid parse, invalid stage, status='finished' requires scores, string score rejected [RED] (R-MATCHES-02, R-MATCHES-04)
  - File(s): `tests/unit/match.schema.test.ts`
  - Acceptance: `pnpm test:unit` runs the new describe block; all assertions FAIL (RED)

- [ ] T-05: Add `shared/types/matches.ts` — re-export `Match` from database types; define `MatchListItem`, `MatchUpdate` derived types [CHORE] (R-MATCHES-01, R-MATCHES-04)
  - File(s): `shared/types/matches.ts`
  - Acceptance: File compiles; `Match`, `MatchListItem`, `MatchUpdate` importable from `~~/shared/types/matches`

- [ ] T-06: Implement `shared/schemas/match.schema.ts` — export `MatchSchema` (read) and `UpdateMatchSchema` (partial PATCH; `.refine` status='finished' ⇒ home_score+away_score non-null) [GREEN] (R-MATCHES-02, R-MATCHES-04)
  - File(s): `shared/schemas/match.schema.ts`
  - Acceptance: `pnpm test:unit` — T-04 tests PASS

- [ ] T-07: Refactor `match.schema.ts` — extract stage enum and status enum into named constants; no behaviour change [REFACTOR] (R-MATCHES-02, R-MATCHES-04)
  - File(s): `shared/schemas/match.schema.ts`
  - Acceptance: `pnpm test:unit` still passes

### B4 — list-matches handler (RED → GREEN → REFACTOR)

- [ ] T-08: Write failing unit tests for `list-matches` — 200 ordered list, 401 unauthenticated, optional stage/group filter [RED] (R-MATCHES-01, R-MATCHES-03, R-SEC-43)
  - File(s): `tests/unit/list-matches.test.ts`
  - Acceptance: `pnpm test:unit` runs new describe; assertions FAIL (RED)

- [ ] T-09: Implement `server/handlers/list-matches.ts` — SELECT with optional stage/group_name filter, ORDER BY kickoff_at ASC; user-context client [GREEN] (R-MATCHES-01, R-MATCHES-03)
  - File(s): `server/handlers/list-matches.ts`
  - Acceptance: `pnpm test:unit` — T-08 tests PASS

- [ ] T-10: Wire `server/api/matches.get.ts` — thin H3 wrapper calling list-matches handler; 401 guard [CHORE] (R-MATCHES-01)
  - File(s): `server/api/matches.get.ts`
  - Acceptance: Handler called; 401 on unauthenticated request

- [ ] T-11: Refactor `list-matches.ts` — document no-op; handler already minimal-and-clean [REFACTOR] (R-MATCHES-01)
  - File(s): `server/handlers/list-matches.ts`
  - Acceptance: `pnpm test:unit` still passes; REFACTOR documented as no-op

### B5 — update-match + lock-now handlers (RED → GREEN → REFACTOR)

- [ ] T-12: Write failing unit tests for `update-match` — 403 non-super-admin, 403 unauthenticated (service role never created), 400 invalid Zod, 404 match not found, 200 success + audit_log row (admin_id, target_type='match', action='matches.update', before_value, after_value), no audit on failure [RED] (R-ADMIN-01, R-ADMIN-02, R-SEC-43, R-SEC-45)
  - File(s): `tests/unit/update-match.test.ts`
  - Acceptance: `pnpm test:unit` runs new describe; all assertions FAIL (RED)

- [ ] T-13: Implement `server/handlers/update-match.ts` — `requireSuperAdmin(event)` FIRST; service-role client; read BEFORE snapshot; `.update()`; INSERT audit_log `{ admin_id, target_id, target_type:'match', action:'matches.update', before_value, after_value }`; skip audit if update fails [GREEN] (R-ADMIN-01, R-ADMIN-02, R-SEC-43, R-SEC-45)
  - File(s): `server/handlers/update-match.ts`
  - Acceptance: `pnpm test:unit` — T-12 tests PASS

- [ ] T-14: Wire `server/api/admin/matches/[id].patch.ts` — thin H3 wrapper; requireSuperAdmin before service role [CHORE] (R-ADMIN-02, R-SEC-43)
  - File(s): `server/api/admin/matches/[id].patch.ts`
  - Acceptance: Wrapper delegates to handler; 403 path confirmed

- [ ] T-15: Write failing unit tests for `lock-started-predictions` — 403 non-super-admin, 200 `{ locked: N }` on RPC success, audit_log row with action='predictions.lock_started' [RED] (R-ADMIN-03, R-ADMIN-01, R-SEC-43, R-SEC-45)
  - File(s): `tests/unit/lock-started-predictions.test.ts`
  - Acceptance: `pnpm test:unit` runs new describe; assertions FAIL (RED)

- [ ] T-16: Implement `server/handlers/lock-started-predictions.ts` — `requireSuperAdmin(event)` FIRST; `.rpc('lock_started_predictions')`; INSERT audit_log `{ admin_id, action:'predictions.lock_started', after_value:{ locked_count: N } }` [GREEN] (R-ADMIN-03, R-SEC-43, R-SEC-45)
  - File(s): `server/handlers/lock-started-predictions.ts`
  - Acceptance: `pnpm test:unit` — T-15 tests PASS

- [ ] T-17: Wire `server/api/admin/matches/lock-now.post.ts` — thin H3 wrapper; no request body accepted [CHORE] (R-ADMIN-03)
  - File(s): `server/api/admin/matches/lock-now.post.ts`
  - Acceptance: Delegates to handler; body ignored

- [ ] T-18: Refactor both admin handlers — extract shared `writeAuditLog(client, row)` helper; no behaviour change [REFACTOR] (R-SEC-45, R-ADMIN-01)
  - File(s): `server/handlers/update-match.ts`, `server/handlers/lock-started-predictions.ts`
  - Acceptance: `pnpm test:unit` still passes; audit helper importable

### B6 — match-client util + useMatches composable + admin page (CHORE)

- [ ] T-19: Implement `app/utils/match-client.ts` — `makeMatchesClient(fetchImpl: typeof $fetch)` following G-COMP-1; exposes `getMatches(filters?)` and `updateMatch(id, payload)` [CHORE] (R-MATCHES-01, R-ADMIN-02)
  - File(s): `app/utils/match-client.ts`
  - Acceptance: File compiles; functions callable; `fetchImpl` parameter required (no implicit $fetch usage)

- [ ] T-20: Implement `app/composables/useMatches.ts` — reactive `data`, `pending`, `error` refs; calls `makeMatchesClient` [CHORE] (R-MATCHES-01, R-MATCHES-04)
  - File(s): `app/composables/useMatches.ts`
  - Acceptance: File compiles; exports `useMatches()`

- [ ] T-21: Implement `app/pages/admin/matches/index.vue` — list with inline edit controls + "Lock Predictions Now" button; `is_super_admin` guard (redirect to `/` if not); uses `useMatches` composable [CHORE] (R-ADMIN-04, R-ADMIN-03, R-ADMIN-02)
  - File(s): `app/pages/admin/matches/index.vue`
  - Acceptance: Page renders match list; Lock button calls lock-now endpoint; non-super-admin redirected to `/`

### B7 — PR-1 Wrap-Up (CHORE)

- [ ] T-22: Run full suite `pnpm test:unit`; confirm GREEN; verify `package.json` has no new `dependencies` entry (devDeps OK); add `pnpm gen-types` precautionary run note for reviewer [CHORE] (R-PS-31, R-PS-32)
  - File(s): (no changes)
  - Acceptance: Zero failures; `package.json` dependencies block unchanged

---

## PR-2: `feat/predictions-and-leaderboard`

### B8 — Types and Schemas (RED → GREEN → REFACTOR)

- [ ] T-23: Write failing unit tests for `UpsertPredictionSchema` — valid 0/15, -1 fails, 16 fails, locked_at stripped, user_id/room_id rejected [RED] (R-PRED-04)
  - File(s): `tests/unit/prediction.schema.test.ts`
  - Acceptance: `pnpm test:unit` runs new describe; assertions FAIL (RED)

- [ ] T-24: Add `shared/types/predictions.ts` — re-export `Prediction`; define `UpsertPredictionInput`, `PredictionRow` types [CHORE] (R-PRED-01, R-PRED-04)
  - File(s): `shared/types/predictions.ts`
  - Acceptance: File compiles; types importable

- [ ] T-25: Implement `shared/schemas/prediction.schema.ts` — export `UpsertPredictionSchema` with `match_id` (uuid), `predicted_home` (int 0–15), `predicted_away` (int 0–15); strip `locked_at`/`user_id`/`room_id` [GREEN] (R-PRED-04)
  - File(s): `shared/schemas/prediction.schema.ts`
  - Acceptance: `pnpm test:unit` — T-23 tests PASS

- [ ] T-26: Write failing unit tests for `LeaderboardEntrySchema` — valid entry shape, missing display_name fails [RED] (R-LEAD-03)
  - File(s): `tests/unit/leaderboard.schema.test.ts`
  - Acceptance: `pnpm test:unit` runs new describe; assertions FAIL (RED)

- [ ] T-27: Add `shared/schemas/leaderboard.schema.ts` — export `LeaderboardEntrySchema` (user_id, display_name, total_points, joined_at); add `shared/types/leaderboard.ts` [GREEN] (R-LEAD-03)
  - File(s): `shared/schemas/leaderboard.schema.ts`, `shared/types/leaderboard.ts`
  - Acceptance: `pnpm test:unit` — T-26 tests PASS

- [ ] T-28: Refactor prediction and leaderboard schemas — no-op documented (schemas already minimal) [REFACTOR] (R-PRED-04, R-LEAD-03)
  - File(s): `shared/schemas/prediction.schema.ts`, `shared/schemas/leaderboard.schema.ts`
  - Acceptance: `pnpm test:unit` still passes; REFACTOR documented as no-op

### B9 — upsert-prediction handler (RED → GREEN → REFACTOR)

- [ ] T-29: Write failing unit tests for `upsert-prediction` — 403 non-member, 409 match already started (kickoff gate), 423 locked_at IS NOT NULL (maps 42501), 201 on insert, 200 on update, room_id from URL never payload [RED] (R-PRED-01, R-PRED-02, R-PRED-03, R-PRED-05, R-SEC-44)
  - File(s): `tests/unit/upsert-prediction.test.ts`
  - Acceptance: `pnpm test:unit` runs new describe; all assertions FAIL (RED)

- [ ] T-30: Implement `server/handlers/upsert-prediction.ts` — verify room membership (403); check `kickoff_at > now()` (409 match_already_started); `.upsert({ room_id, user_id, match_id, predicted_home, predicted_away }, { onConflict: 'room_id,user_id,match_id' }).select().single()`; map 42501 → 423 `prediction_locked`; 201 on insert / 200 on update [GREEN] (R-PRED-01, R-PRED-02, R-PRED-03, R-PRED-05)
  - File(s): `server/handlers/upsert-prediction.ts`
  - Acceptance: `pnpm test:unit` — T-29 tests PASS

- [ ] T-31: Wire `server/api/rooms/[id]/predictions.post.ts` — thin H3 wrapper; 401 guard; room_id from params [CHORE] (R-PRED-01, R-PRED-05)
  - File(s): `server/api/rooms/[id]/predictions.post.ts`
  - Acceptance: Delegates to handler; room_id taken from URL

- [ ] T-32: Wire `server/api/rooms/[id]/predictions.get.ts` — thin H3 wrapper; returns existing predictions for user in room (needed by predictions.vue to pre-fill form; R6) [CHORE] (R-PRED-01)
  - File(s): `server/api/rooms/[id]/predictions.get.ts`
  - Acceptance: Returns predictions for authenticated user in given room

- [ ] T-33: Refactor `upsert-prediction.ts` — extract `PredictionLockedError` class; document no-op for rest [REFACTOR] (R-PRED-03)
  - File(s): `server/handlers/upsert-prediction.ts`
  - Acceptance: `pnpm test:unit` still passes; `PredictionLockedError` exported

### B10 — get-leaderboard handler (RED → GREEN → REFACTOR)

- [ ] T-34: Write failing unit tests for `get-leaderboard` — 403 non-member, 200 ordered by total_points DESC joined_at ASC, empty room returns empty array, defensive profile flatten [RED] (R-LEAD-01, R-LEAD-02)
  - File(s): `tests/unit/get-leaderboard.test.ts`
  - Acceptance: `pnpm test:unit` runs new describe; assertions FAIL (RED)

- [ ] T-35: Implement `server/handlers/get-leaderboard.ts` — verify membership (403); SELECT room_members JOIN profiles!inner; ORDER BY total_points DESC, joined_at ASC; defensive flatten on profile (array or object); return `LeaderboardEntry[]` [GREEN] (R-LEAD-01, R-LEAD-02)
  - File(s): `server/handlers/get-leaderboard.ts`
  - Acceptance: `pnpm test:unit` — T-34 tests PASS

- [ ] T-36: Wire `server/api/rooms/[id]/leaderboard.get.ts` — thin H3 wrapper; 401 guard [CHORE] (R-LEAD-01)
  - File(s): `server/api/rooms/[id]/leaderboard.get.ts`
  - Acceptance: Delegates to handler

- [ ] T-37: Refactor `get-leaderboard.ts` — extract profile-flatten helper; document no-op if already clean [REFACTOR] (R-LEAD-01, R-LEAD-02)
  - File(s): `server/handlers/get-leaderboard.ts`
  - Acceptance: `pnpm test:unit` still passes

### B11 — client utils + composables (CHORE)

- [ ] T-38: Implement `app/utils/prediction-client.ts` — `makePredictionClient(fetchImpl: typeof $fetch)`; exposes `upsertPrediction(roomId, payload)` and `getPredictions(roomId)` [CHORE] (R-PRED-01)
  - File(s): `app/utils/prediction-client.ts`
  - Acceptance: File compiles; `fetchImpl` required

- [ ] T-39: Implement `app/utils/leaderboard-client.ts` — `makeLeaderboardClient(fetchImpl: typeof $fetch)`; exposes `getLeaderboard(roomId)` [CHORE] (R-LEAD-01, R-LEAD-03)
  - File(s): `app/utils/leaderboard-client.ts`
  - Acceptance: File compiles; `fetchImpl` required

- [ ] T-40: Implement `app/composables/useLeaderboard.ts` — reactive `data`, `pending`, `error` refs; calls `makeLeaderboardClient`; handles network error (error set, data empty, no crash) [CHORE] (R-LEAD-03)
  - File(s): `app/composables/useLeaderboard.ts`
  - Acceptance: File compiles; exports `useLeaderboard(roomId)`

### B12 — predictions.vue Nuxt test + page + leaderboard page + nav (RED → GREEN → REFACTOR)

- [ ] T-41: Write failing Nuxt test for `rooms/[id]/predictions.vue` — renders prediction form; 423 banner shown when prediction locked; 409 error shown when match already started; submit calls `upsertPrediction`; uses `beforeAll` dynamic import [RED] (R-PRED-01, R-PRED-03, R-ADMIN-04)
  - File(s): `tests/nuxt/predictions.nuxt.test.ts`
  - Acceptance: `pnpm test:nuxt` runs new describe; assertions FAIL (RED)

- [ ] T-42: Implement `app/pages/rooms/[id]/predictions.vue` — prediction form with `predicted_home`/`predicted_away` inputs; 423 locked banner + "predictions are locked" disclaimer; 409 "match already started" message; uses `makePredictionClient` [GREEN] (R-PRED-01, R-PRED-02, R-PRED-03, R-ADMIN-04)
  - File(s): `app/pages/rooms/[id]/predictions.vue`
  - Acceptance: `pnpm test:nuxt` — T-41 tests PASS

- [ ] T-43: Implement `app/pages/rooms/[id]/leaderboard.vue` — standings table ordered by rank; unauthenticated redirect to `/login`; uses `useLeaderboard` [CHORE] (R-LEAD-01, R-LEAD-04)
  - File(s): `app/pages/rooms/[id]/leaderboard.vue`
  - Acceptance: Page renders with correct column order; auth guard redirects correctly

- [ ] T-44: Edit `app/pages/rooms/[id]/index.vue` — replace "Próximamente" stub with 2 NuxtLinks: one to `rooms/[id]/predictions` and one to `rooms/[id]/leaderboard` [CHORE] (R-LEAD-04)
  - File(s): `app/pages/rooms/[id]/index.vue`
  - Acceptance: Both links rendered; existing room detail display unchanged

- [ ] T-45: Refactor `predictions.vue` — extract `PredictionForm` component if form exceeds 30 lines; document no-op otherwise [REFACTOR] (R-PRED-01)
  - File(s): `app/pages/rooms/[id]/predictions.vue`
  - Acceptance: `pnpm test:nuxt` still passes

### B13 — PR-2 Wrap-Up (CHORE)

- [ ] T-46: Run full suite `pnpm test:unit` + `pnpm test:nuxt`; confirm both GREEN; verify `package.json` no new `dependencies` entry [CHORE] (R-PS-31, R-PS-32)
  - File(s): (no changes)
  - Acceptance: Zero failures; manifest check: all 22 new files present

---

## Coverage Matrix

| Requirement | Task(s) |
|-------------|---------|
| R-MATCHES-01 | T-03, T-08, T-09, T-10, T-11, T-19, T-20 |
| R-MATCHES-02 | T-03, T-04, T-06, T-07 |
| R-MATCHES-03 | T-03, T-08, T-09 |
| R-MATCHES-04 | T-04, T-05, T-06, T-07, T-20 |
| R-PRED-01 | T-23, T-24, T-25, T-29, T-30, T-31, T-32, T-38, T-41, T-42 |
| R-PRED-02 | T-29, T-30, T-42 |
| R-PRED-03 | T-29, T-30, T-33, T-41, T-42 |
| R-PRED-04 | T-23, T-24, T-25, T-28 |
| R-PRED-05 | T-29, T-30, T-31 |
| R-ADMIN-01 | T-12, T-13, T-15, T-16, T-18 |
| R-ADMIN-02 | T-12, T-13, T-14, T-19 |
| R-ADMIN-03 | T-15, T-16, T-17 |
| R-ADMIN-04 | T-21, T-41, T-42, T-43 |
| R-LEAD-01 | T-34, T-35, T-36, T-37, T-39, T-43 |
| R-LEAD-02 | T-34, T-35 |
| R-LEAD-03 | T-26, T-27, T-28, T-40 |
| R-LEAD-04 | T-43, T-44 |
| R-DB-32 | T-01 |
| R-SEC-43 | T-12, T-13, T-14, T-15, T-16, T-17, T-21 |
| R-SEC-44 | T-01, T-29, T-30 |
| R-SEC-45 | T-12, T-13, T-15, T-16, T-18 |
| R-PS-30 | T-02, T-03 |
| R-PS-31 | T-22, T-46 |
| R-PS-32 | T-22, T-46 |

Coverage: 24/24 requirements (100%).

---

## Rollback Notes

- **T-01 (migration)**: No rollback script needed — migration is DROP+CREATE of RLS policies only. Re-running with the original bare `auth.uid()` form reverts the fix. No data migration.
- **PR-1 rollback**: Revert merge commit. Seed file and `package.json` script revert with it. Migration must be manually reverted by re-running old policy SQL or restoring from backup.
- **PR-2 rollback**: Revert merge commit. `rooms/[id]/index.vue` reverts to slice-2 nav state (stub links). No DB changes in PR-2.
- **Task-level**: B4 (T-08–T-11) — drop handler + wrapper files, no DB change. B9 (T-29–T-33) — drop handler + wrappers, no DB change. B12 (T-41–T-45) — drop page files, `rooms/[id]/index.vue` reverts manually.

---

## Out-of-Scope Reminders

- External fixture API / scraping (explicitly excluded)
- Automatic cron-based lock of started predictions (deferred — no cron runtime in slice 3)
- Realtime push / live score updates (deferred — future slice)
- Bracket UI (deferred)
- Multi-tournament support (deferred)
- Per-match detail page (deferred)
- New runtime dependencies (types-only devDeps permitted)
- `.env*` edits (no new vars needed)
- `pnpm gen-types` as a formal CI step (reviewer note only, not a task)
- DB integration test for `calculate_points` trigger (no Supabase test helper available yet)
