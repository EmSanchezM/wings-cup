# Spec Index — realtime-match-and-leaderboard (Slice 6 of 6)

**Date**: 2026-05-24
**Status**: complete
**Branch (planned)**: `feat/realtime-match-and-leaderboard`
**Inherits**: foundation, rooms-and-invitations, matches-and-predictions, predictions-ux-and-guards, guards-coverage-and-stale-toast

## Scope

This slice introduces ONE new capability domain (`realtime`) and patches three existing domain specs (`predictions`, `leaderboard`, `database`).

## Domain Deltas

| Topic Key | Domain | Action | R-* IDs | Scenarios |
|-----------|--------|--------|---------|-----------|
| `sdd/realtime-match-and-leaderboard/spec/realtime` | realtime | NEW full spec | R-RT-01..05 | 20 |
| `sdd/realtime-match-and-leaderboard/spec/predictions` | predictions | MODIFIED R-PRED-06, R-PRED-07 | R-PRED-06, R-PRED-07 | 15 |
| `sdd/realtime-match-and-leaderboard/spec/leaderboard` | leaderboard | MODIFIED R-LEAD-04 | R-LEAD-04 | 4 |
| `sdd/realtime-match-and-leaderboard/spec/database` | database | ADDED R-DB-33 | R-DB-33 | 3 |

## R-* Coverage

### New requirements (this slice)
- **R-RT-01**: Realtime Publication Migration — migration idempotency + pg_publication_tables
- **R-RT-02**: useMatches Subscribe Contract — channel name, args, cleanup, reconnect debounce
- **R-RT-03**: useLeaderboard Subscribe Contract — room-scoped channel, server-side filter, cleanup, reconnect
- **R-RT-04**: predictions.vue Subscribe Wire — mount/unmount lifecycle, in-place replace, filter widening
- **R-RT-05**: leaderboard.vue Subscribe Wire — mount/unmount lifecycle, points update + re-sort
- **R-DB-33**: Migration 00015_realtime_publication.sql — migration lineage anchor

### Modified requirements (delta patches)
- **R-PRED-06** (slice 4 origin): filter widened from `scheduled` only → `['scheduled','live','finished']`; computed ref renamed to `eligibleEntries`; kickoff-at client-side time check removed
- **R-PRED-07** (slice 4 origin): added `isReadonly` computed (status-based), final score display for `finished`, status transition scenario; `locked_at` lock badge stays independent
- **R-LEAD-04** (slice 3 origin, slice 4 extended): added realtime reorder scenario — within-2s re-sort on `total_points` change, comparator pinned to `(total_points DESC, joined_at ASC)`

## Cross-References

| Prior Slice | R-* IDs Touched | Reason |
|-------------|----------------|--------|
| matches-and-predictions (slice 3) | R-LEAD-04, R-DB baseline | R-LEAD-04 extended with realtime scenario; R-DB-33 added after R-DB-32 |
| predictions-ux-and-guards (slice 4) | R-PRED-06, R-PRED-07 | Both modified to accommodate realtime filter widening and status-based read-only |
| architecture/no-external-match-api | context only | Admin edits remain the canonical score source; realtime closes the admin→user feedback loop |

## Key Constraints

1. Migration `00015_realtime_publication.sql` MUST deploy before any app code — it is the gating dependency; without it zero events fire.
2. Client-side comparator for re-sort MUST match server-side `get-leaderboard.ts` order: `total_points DESC, joined_at ASC`.
3. Status-based read-only (`isReadonly`) and lock-badge read-only (`locked_at IS NOT NULL`) are independent computed conditions in `MatchPredictionCard`.
4. Reconnect debounce is 300 ms on the second `SUBSCRIBED` status event for both `useMatches` and `useLeaderboard`.
5. Server-side filter `room_id=eq.${roomId}` on `room_members` channel is defense-in-depth on top of RLS.

## Assumptions Made (Risks)

- `matches` REPLICA IDENTITY DEFAULT (PK only) is sufficient — UPDATE payloads carry the full NEW row, which is all the client needs.
- `@nuxtjs/supabase` token refresh automatically propagates to active channels; no manual `onAuthStateChange` handler is specified.
- `postponed` and `cancelled` match statuses exist and are excluded from `eligibleEntries` by the explicit allowlist.
