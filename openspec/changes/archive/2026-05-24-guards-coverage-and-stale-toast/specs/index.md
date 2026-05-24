# Spec Index — guards-coverage-and-stale-toast (Slice 5 of 5+)

**Date**: 2026-05-24
**Status**: complete
**Branch (planned)**: `feat/guards-coverage-and-stale-toast`
**Inherits**: foundation, rooms-and-invitations, matches-and-predictions, predictions-ux-and-guards

## Scope

This slice introduces ONE new capability domain (`ux`) and extends the existing `admin` domain. No new DB schemas, no new migrations, no new runtime npm dependencies.

## Capability Deltas

| Domain | Topic Key | Action | R-* IDs | Scenarios |
|--------|-----------|--------|---------|-----------|
| `ux` | `sdd/guards-coverage-and-stale-toast/spec/ux` | NEW domain | R-UX-01..05 | 17 |
| `admin` | `sdd/guards-coverage-and-stale-toast/spec/admin` | EXTENDS slice 3 | R-ADMIN-04 (modified), R-ADMIN-05..06 (new) | 11 |

**Total new R-* IDs introduced**: 7 (R-UX-01..05, R-ADMIN-05..06)
**Total modified R-* IDs**: 1 (R-ADMIN-04, scenario addition only)
**Total scenarios**: 28

## Cross-References

| Prior R-* | Slice | Relationship | Notes |
|-----------|-------|--------------|-------|
| R-ADMIN-04 | slice 3 (`sdd/matches-and-predictions/spec/admin`) | MODIFIED | Adds 3rd scenario for `reason === 'unauthenticated'` path; existing 2 scenarios unchanged |
| R-LEAD-04 | slice 4 (`sdd/predictions-ux-and-guards/spec/leaderboard`) | ADDITIVE SUPERSEDE | Slice 4 required stale-session errors to surface via `error` ref. R-UX-03 changes the 401 path specifically to call `setExpired()` instead. Slice 4 spec not modified; slice 5 is the authoritative behaviour for 401. |
| R-SEC-43 | slice 3 (`sdd/matches-and-predictions/spec/security`) | COMPATIBLE | R-SEC-43 governs server-side gate (throw 403/401). R-ADMIN-05 governs the endpoint's catch/discriminate responsibility. No conflict. |

## What is NOT spec'd (intentional)

- Comment-only changes to `app/pages/rooms/index.vue` and `app/pages/rooms/[id]/index.vue` — cosmetic, no formal R-* required.
- `app/pages/join/[code].vue` — explicitly out of scope; intentional reactive UX.
- Any global `$fetch` plugin interception — rejected in proposal.

## Affected Files (informational, not normative)

| File | Requirement(s) |
|------|--------|
| `app/composables/useSessionExpired.ts` (NEW) | R-UX-01 |
| `app/components/SessionExpiredToast.vue` (NEW) | R-UX-01, R-UX-02, R-UX-05 |
| `app/app.vue` | R-UX-01 |
| `app/composables/useRoom.ts` | R-UX-03 |
| `app/composables/useMatches.ts` | R-UX-03 |
| `app/composables/useLeaderboard.ts` | R-UX-03 |
| `app/components/MatchPredictionCard.vue` | R-UX-04 |
| `server/api/me/is-super-admin.get.ts` | R-ADMIN-05 |
| `app/pages/admin/matches/index.vue` | R-ADMIN-04 (modified), R-ADMIN-06 |

## Risks / Spec-Level Assumptions

1. **R-LEAD-04 additive supersede**: slice 4 spec's final scenario stated stale-session errors surface via `error` ref. R-UX-03 changes behaviour for 401 specifically. The slice 4 spec is not retroactively modified — implementation must honour the slice 5 requirement as the authoritative 401 path. Documenting this to avoid confusion during verify.

2. **R-ADMIN-05 HTTP 200 for unauthenticated**: spec mandates HTTP 200 (not 401) for the unauthenticated case to avoid the call site having to catch an error. This is a deliberate API design choice baked in the proposal — not re-debatable.

3. **R-UX-02 exact message string**: the Spanish message text is normative. Implementation must match it verbatim for acceptance.
