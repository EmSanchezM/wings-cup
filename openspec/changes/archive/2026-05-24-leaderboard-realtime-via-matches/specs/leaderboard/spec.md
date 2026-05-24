# Leaderboard Spec — Delta for leaderboard-realtime-via-matches (Slice 7)

## Overview

Delta. One existing requirement modified: R-LEAD-04 gains a fifth scenario covering matches-driven leaderboard reload (the slice 7 workaround for the broken `room_members` realtime broadcast — see bug #400). R-LEAD-01, R-LEAD-02, R-LEAD-03 are unchanged.

## Requirements Summary

| Req | Title | Type | Scenarios |
|-----|-------|------|-----------| 
| R-LEAD-04 | Leaderboard Page Navigation and Realtime Reorder | MODIFIED | 5 |

---

## MODIFIED Requirements

### R-LEAD-04: Leaderboard Page Navigation and Realtime Reorder

**Type**: MODIFIED | **Source**: C3 + Proposal §3.6 / decisions 1, 7 (slice 6) + Proposal §2–3 / slice 7 workaround
**Files**: `app/pages/rooms/[id]/leaderboard.vue`

(Previously: R-LEAD-04 covered page navigation link and unauthenticated redirect. Extended in slice 4 with auth delegation to `redirectOptions`. Now extended with realtime reorder requirement: page MUST subscribe to `room_members` UPDATEs and reorder within 2 seconds without page refresh. Now further extended with a secondary reload path: when `useLeaderboard.subscribe` is silently broken by a Supabase Realtime + SECURITY DEFINER RLS interaction (bug #400), `leaderboard.vue` MUST additionally subscribe to `useMatches().subscribe()` and call `load()` when any match transitions to `finished`. Both paths MUST coexist: the `useLeaderboard.subscribe` wiring is kept (correct, tested code) and marked as superseded by comment until the server-side bug is resolved.)

`rooms/[id]/leaderboard.vue` MUST be linked from `rooms/[id]/index.vue`. The page MUST redirect unauthenticated users to `/login`. The page MUST subscribe to `room_members` UPDATE events via `useLeaderboard(roomId).subscribe(onUpdate)` in `onMounted` and invoke the returned cleanup function in `onUnmounted`. When an UPDATE payload arrives for any member of the current room, the page MUST update that member's `total_points` in the local standings array and immediately re-sort using the comparator `(a, b) => b.total_points - a.total_points || a.joined_at.localeCompare(b.joined_at)` — matching the server-side `get-leaderboard.ts` order (`total_points DESC, joined_at ASC`). The re-sort MUST complete and be reflected in the DOM within 2 seconds of the realtime event arriving.

Additionally, the page MUST subscribe to `useMatches().subscribe(onMatchUpdate, 'matches-leaderboard-reload')` as a secondary reload trigger (see R-RT-06). When `onMatchUpdate` receives a payload where `payload.new.status === 'finished'`, the page MUST call `useLeaderboard(roomId).load()` after a 300ms debounce. Payloads with any other status (`live`, `scheduled`, `postponed`, `cancelled`) MUST be ignored with no side effects. The matches subscription MUST be cleaned up in `onUnmounted`, including clearing any pending debounce timer.

#### Scenario: Authenticated member views leaderboard link

- GIVEN authenticated member views `rooms/[id]/index.vue`
- WHEN the page renders
- THEN a link or button to the leaderboard is visible

#### Scenario: Unauthenticated redirect

- GIVEN an unauthenticated user navigates to `rooms/[id]/leaderboard`
- WHEN the auth guard evaluates
- THEN the user is redirected to `/login`

#### Scenario: Realtime reorder on points change (room_members path)

- GIVEN the leaderboard page is open with standings `[A:10pts, B:7pts]` and a realtime subscription is active
- WHEN a `room_members` UPDATE event arrives with `{ new: { user_id: B, total_points: 12 } }`
- THEN the standings reorder to `[B:12pts, A:10pts]` within 2 seconds
- AND no page refresh occurs

#### Scenario: Tie-break preserved after realtime update

- GIVEN two members A (joined T1) and B (joined T2, T2 > T1) both reach 10 points after a realtime update
- WHEN the client-side comparator is applied
- THEN A (earlier `joined_at`) is ranked above B
- AND this matches the server-side `get-leaderboard.ts` sort order

#### Scenario: Matches-driven leaderboard reload on finished match

- GIVEN the leaderboard page is open and subscribed to both `useLeaderboard` and `useMatches`
- WHEN a `matches` UPDATE payload arrives with `payload.new.status === 'finished'`
- THEN `useLeaderboard(roomId).load()` is called after a 300ms debounce
- AND the displayed standings reflect the updated `room_members.total_points` within 2 seconds

#### Scenario: Non-finished match transition ignored

- GIVEN the leaderboard page is open with an active matches subscription
- WHEN a `matches` UPDATE payload arrives with `payload.new.status === 'live'` or `'scheduled'`
- THEN `useLeaderboard(roomId).load()` is NOT called
- AND no side effects occur

#### Scenario: Debounce coalesces rapid finished transitions

- GIVEN the leaderboard page is open
- WHEN two `matches` UPDATE payloads with `status === 'finished'` arrive within 300ms
- THEN `useLeaderboard(roomId).load()` is called exactly once after the debounce window
