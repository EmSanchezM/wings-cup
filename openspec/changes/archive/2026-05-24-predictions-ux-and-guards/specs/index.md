# Spec Index — predictions-ux-and-guards (Slice 4 of 5)

**Date**: 2026-05-24
**Status**: complete
**Branch (planned)**: `feat/predictions-ux-and-guards`
**Inherits**: foundation, rooms-and-invitations, matches-and-predictions

## Scope

This slice introduces NO new capability domains. All specs are deltas on domains established in Slice 3 (matches-and-predictions).

## Domain Deltas

| Domain | Change Type | Topic Key | Requirements | Scenarios |
|--------|-------------|-----------|--------------|-----------| 
| predictions | DELTA (ADDED) | sdd/predictions-ux-and-guards/spec/predictions | 2 added (R-PRED-06, R-PRED-07) | 11 |
| leaderboard | DELTA (MODIFIED) | sdd/predictions-ux-and-guards/spec/leaderboard | 1 modified (R-LEAD-04) | 4 |
| project-setup | DELTA (MODIFIED) | sdd/predictions-ux-and-guards/spec/project-setup | 1 modified (R-PS-31) | 3 |

**Total this slice**: 4 requirement operations (2 ADDED, 2 MODIFIED), 18 scenarios.

## Cross-Reference: Slice 3 IDs Touched

| Slice 3 R-ID | This slice action | Reason |
|--------------|------------------|--------|
| R-PRED-01..05 | Inherited unchanged | Backend API contract unchanged; only UI layer added |
| R-LEAD-01..03 | Inherited unchanged | Endpoint, trigger, and schema unchanged |
| R-LEAD-04 | MODIFIED | Replace unreliable `useSupabaseUser + onMounted` guard with module-level redirect reliance |
| R-PS-30 | Confirmed current | Spec text already correct after commit f717cb6; no change needed |
| R-PS-31 | MODIFIED | Remove `audit-entry.schema.ts` from manifest; correct file count 22 → 21; document TS-interface decision |
| R-PS-32 | Inherited unchanged | No new runtime dependencies in this slice |

## Coverage Matrix

| Requirement | Work Item | Page / Component | Test File |
|-------------|-----------|-----------------|-----------| 
| R-PRED-06 | W-03 | `app/pages/rooms/[id]/predictions.vue` | `tests/nuxt/predictions.nuxt.test.ts` |
| R-PRED-07 | W-03 | `app/components/MatchPredictionCard.vue` | `tests/nuxt/predictions.nuxt.test.ts` |
| R-LEAD-04 (patched) | S-02 | `app/pages/rooms/[id]/leaderboard.vue` | `tests/nuxt/predictions.nuxt.test.ts` |
| R-PS-31 (patched) | W-02 | `sdd/matches-and-predictions/spec/project-setup` (engram) | spec accuracy — no test |

## Delivery Alignment

Single PR `feat/predictions-ux-and-guards` to `main`. Estimated ~5 files changed, ~250–350 LOC. Well under the 400-line review budget; chained PRs not needed.

## Spec Assumptions (risks baked into proposals)

1. `kickoff_at > now()` client-side filter is NOT required on the predictions page — server enforces the kickoff gate authoritatively via `upsertPrediction`. Client filter is `status === 'scheduled'` only, which the `useMatches` composable already supports via optional query param.
2. `useMatches()` returns `status` on every `MatchListItem` — confirmed in slice 3 implementation. If the API ever drops `status`, the client-side filter silently shows all matches.
3. Module-level redirect covers full-page navigation only. Client-side route pushes (e.g. `router.push`) after session expiry will NOT trigger the module redirect — stale-session failures degrade gracefully via `useLeaderboard().error`. This is documented as accepted behaviour, consistent with `predictions.vue`.
