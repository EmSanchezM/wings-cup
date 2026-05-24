# Spec Index — matches-and-predictions (Slice 3 of 5)

**Date**: 2026-05-17
**Status**: complete
**Inherits**: foundation, rooms-and-invitations

## Domain Specs

| Domain | Type | File | Requirements | Scenarios |
|--------|------|------|-------------|-----------|
| matches | NEW (full) | specs/matches/spec.md | 4 (R-MATCHES-01–04) | 11 |
| predictions | NEW (full) | specs/predictions/spec.md | 5 (R-PRED-01–05) | 15 |
| admin | NEW (full) | specs/admin/spec.md | 4 (R-ADMIN-01–04) | 10 |
| leaderboard | NEW (full) | specs/leaderboard/spec.md | 4 (R-LEAD-01–04) | 9 |
| database | DELTA | specs/database/spec.md | 1 (R-DB-32) | 3 |
| security | DELTA | specs/security/spec.md | 3 (R-SEC-43–45) | 9 |
| project-setup | DELTA | specs/project-setup/spec.md | 3 (R-PS-30–32) | 7 |

**Total**: 24 requirements, 64 scenarios

## Coverage Matrix

| Requirement | Capability | Domain | Handler / Page | Test File |
|-------------|-----------|--------|---------------|-----------|
| R-MATCHES-01 | C1 | matches | `list-matches.ts` / `matches.get.ts` | `tests/unit/list-matches.test.ts` |
| R-MATCHES-02 | C1 | matches | `update-match.ts` / `match.schema.ts` | `tests/unit/update-match.test.ts` |
| R-MATCHES-03 | C1 / D2 | matches | `update-match.ts` / `admin/matches/index.vue` | `tests/unit/update-match.test.ts` |
| R-MATCHES-04 | C1 | matches | `match.schema.ts` | `tests/unit/list-matches.test.ts` |
| R-PRED-01 | C2 | predictions | `upsert-prediction.ts` / `rooms/[id]/predictions.vue` | `tests/unit/upsert-prediction.test.ts` |
| R-PRED-02 | C2 | predictions | `upsert-prediction.ts` | `tests/unit/upsert-prediction.test.ts` |
| R-PRED-03 | C2 / D4 | predictions | `upsert-prediction.ts` / RPC | `tests/unit/upsert-prediction.test.ts` |
| R-PRED-04 | C2 | predictions | `prediction.schema.ts` | `tests/unit/upsert-prediction.test.ts` |
| R-PRED-05 | C2 | predictions | `upsert-prediction.ts` | `tests/unit/upsert-prediction.test.ts` |
| R-ADMIN-01 | C4 / C5 / C6 | admin | `update-match.ts` / `lock-started-predictions.ts` | `tests/unit/update-match.test.ts` |
| R-ADMIN-02 | C4 | admin | `update-match.ts` / `admin/matches/[id].patch.ts` | `tests/unit/update-match.test.ts` |
| R-ADMIN-03 | C5 / D4 | admin | `lock-now.post.ts` | `tests/unit/update-match.test.ts` |
| R-ADMIN-04 | C4 / C5 | admin | `admin/matches/index.vue` | `tests/nuxt/predictions.nuxt.test.ts` |
| R-LEAD-01 | C3 / D3 | leaderboard | `get-leaderboard.ts` / `rooms/[id]/leaderboard.vue` | `tests/unit/get-leaderboard.test.ts` |
| R-LEAD-02 | C3 | leaderboard | `get-leaderboard.ts` | `tests/unit/get-leaderboard.test.ts` |
| R-LEAD-03 | C3 | leaderboard | `useLeaderboard.ts` / `leaderboard.schema.ts` | `tests/nuxt/predictions.nuxt.test.ts` |
| R-LEAD-04 | C3 | leaderboard | `rooms/[id]/leaderboard.vue` / `rooms/[id]/index.vue` | `tests/nuxt/predictions.nuxt.test.ts` |
| R-DB-32 | C2 / Risk R1 | database | `00014_fix_pred_rls.sql` | migration smoke test |
| R-SEC-43 | C4 / C5 / C6 | security | `update-match.ts` / `lock-now.post.ts` | `tests/unit/update-match.test.ts` |
| R-SEC-44 | C2 | security | RLS policies (DB layer) | `tests/unit/upsert-prediction.test.ts` |
| R-SEC-45 | C6 / D5 | security | `update-match.ts` / `lock-now.post.ts` | `tests/unit/update-match.test.ts` |
| R-PS-30 | D1 | project-setup | `package.json` seed script | manual / CI check |
| R-PS-31 | all | project-setup | all new files | PR diff check |
| R-PS-32 | — | project-setup | `package.json` dependencies | CI dep-check |

## Delivery Alignment

| PR | Scope | Requirements |
|----|-------|-------------|
| PR-1 `feat/matches-seed-and-admin` | R-DB-32, R-PS-30, R-PS-31 (PR-1 files), R-PS-32, R-MATCHES-01–04, R-ADMIN-01–04, R-SEC-43, R-SEC-45 | 13 reqs |
| PR-2 `feat/predictions-and-leaderboard` | R-PRED-01–05, R-LEAD-01–04, R-SEC-44, R-PS-31 (PR-2 files) | 11 reqs |

## Open Questions

None. Decisions D1–D5 locked by user 2026-05-17. Schema column `stage` (not `phase`) confirmed.

## Patch History

| Patch | Applied | Description |
|-------|---------|-------------|
| P-001 | 2026-05-17 | R-SEC-45: replaced `actor_id`/`payload` with real DB columns `admin_id`/`before_value`/`after_value`/`target_type` |
| P-002 | 2026-05-17 | R-SEC-45: action strings → `matches.update`, `predictions.lock_started`; documented `resource.verb_past` convention |
| P-003 | 2026-05-17 | R-PRED-04, R-PRED-01: renamed `home_score`/`away_score` → `predicted_home`/`predicted_away` in prediction schema/scenarios |
| P-004 | 2026-05-17 | R-PRED-03: locked_at IS NOT NULL case → HTTP 423 Locked (not 409); 409 kept for kickoff gate only |
| P-005 | 2026-05-17 | R-PRED-04: added upper bound 0–15 matching DB CHECK constraint; added 4th scenario |
| P-006 | 2026-05-17 | predictions overview: corrected "composite PK" → "UNIQUE constraint; PK is `id`" |
| P-007 | 2026-05-17 | R-DB-32: expanded from 2 → 3 policies; added `pred_delete_own_unlocked` to migration scope |
