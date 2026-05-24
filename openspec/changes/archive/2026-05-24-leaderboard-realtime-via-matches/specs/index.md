# Spec Index — leaderboard-realtime-via-matches (Slice 7 of 7)

**Date**: 2026-05-24
**Status**: complete
**Branch (planned)**: `feat/leaderboard-realtime-via-matches`
**Inherits**: foundation, rooms-and-invitations, matches-and-predictions, predictions-ux-and-guards, guards-coverage-and-stale-toast, realtime-match-and-leaderboard

## Domain Artifacts

| Domain | Topic Key | Type | R-* IDs |
|--------|-----------|------|---------| 
| leaderboard | `sdd/leaderboard-realtime-via-matches/spec/leaderboard` | DELTA | R-LEAD-04 (MODIFIED) |
| realtime | `sdd/leaderboard-realtime-via-matches/spec/realtime` | DELTA | R-RT-02 (MODIFIED), R-RT-06 (ADDED) |

## Coverage Summary

| Req ID | Title | Action | Scenarios |
|--------|-------|--------|-----------|
| R-LEAD-04 | Leaderboard Page Navigation and Realtime Reorder | MODIFIED — adds 3 new scenarios (finished reload, non-finished ignored, debounce) | 7 total |
| R-RT-02 | useMatches Subscribe Contract | MODIFIED — adds optional `channelName` param + 2 new scenarios | 6 total |
| R-RT-06 | Matches-Driven Leaderboard Reload | ADDED | 5 |

## Cross-References

| Prior R-* | Slice | Relationship |
|-----------|-------|--------------|
| R-LEAD-04 | 6 (realtime-match-and-leaderboard) | Extended with matches-driven reload path |
| R-RT-02 | 6 (realtime-match-and-leaderboard) | Extended with `channelName` optional param |
| R-RT-05 | 6 (realtime-match-and-leaderboard) | Referenced; not modified (kept as-is) |
| bug #400 | — | Context for the workaround; R-RT-06 is its spec-level resolution |

## Assumptions

1. `useMatches()` is a plain factory (not a singleton) — confirmed in explore #401. A second call in `leaderboard.vue` is safe and creates an independent instance.
2. The `calculate_points` DB trigger fires synchronously within the same transaction as the `matches` UPDATE. Supabase Realtime emits post-commit. Therefore `load()` after the `finished` event is guaranteed to see updated `room_members.total_points` — no race.
3. Channel name `'matches-leaderboard-reload'` is treated as developer-responsibility unique. If a future caller also uses this exact name, behavior is undefined (per R-RT-02 extended semantics — same-name collision is developer responsibility).
4. `useLeaderboard.subscribe` (R-RT-05) is kept in place even though it is currently non-functional at runtime. Its code is correct and tested; the bug is server-side (bug #400). This is consistent with proposal §2 (out of scope: removing that wiring).
