# Realtime Spec — Delta for leaderboard-realtime-via-matches (Slice 7)

## Overview

Delta. Two changes: R-RT-02 is modified to add an optional `channelName` parameter to `useMatches.subscribe()` (backwards-compatible). R-RT-06 is a new requirement capturing the matches-driven leaderboard reload contract. R-RT-01, R-RT-03, R-RT-04, R-RT-05 are unchanged.

## Requirements Summary

| Req | Title | Type | Scenarios |
|-----|-------|------|-----------| 
| R-RT-02 | useMatches Subscribe Contract | MODIFIED | 6 |
| R-RT-06 | Matches-Driven Leaderboard Reload | ADDED | 5 |

---

## MODIFIED Requirements

### R-RT-02: useMatches Subscribe Contract

**Type**: MODIFIED | **Source**: Proposal §3.2 / decision 6 (slice 6) + Proposal §3 / slice 7 channel-name fix
**Files**: `app/composables/useMatches.ts`, `tests/unit/use-matches-realtime.test.ts`

(Previously: R-RT-02 required `subscribe(onUpdate)` to create a channel named exactly `'matches-updates'`. Now extended: `subscribe` MUST accept an optional second parameter `channelName: string = 'matches-updates'`. When `channelName` is provided, the channel MUST use that name instead of the default. All other semantics — postgres_changes listener, cleanup, reconnect debounce — are unchanged. Existing callers passing no second argument MUST continue to work identically.)

`useMatches()` MUST expose a `subscribe(onUpdate: (payload: RealtimePostgresChangesPayload<Match>) => void, channelName: string = 'matches-updates'): () => void` method. When called, the method MUST create a Supabase channel using the provided `channelName` with a `postgres_changes` listener for `{ event: 'UPDATE', schema: 'public', table: 'matches' }`. The returned function MUST remove the channel by calling `client.removeChannel(channel)`. A `seenSubscribed` flag MUST be maintained internally: the first `'SUBSCRIBED'` status event is treated as initial connection (no action); any subsequent `'SUBSCRIBED'` event (post-reconnect) MUST trigger a debounced call to `load()` with a 300 ms delay.

#### Scenario: Subscribe creates correct channel with default name

- GIVEN `useMatches()` is called in a component and `subscribe(onUpdate)` is called without a second argument
- WHEN the subscription is established
- THEN `useSupabaseClient().channel('matches-updates')` is called with argument `'matches-updates'`
- AND `.on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'matches' }, handler)` is registered

#### Scenario: Subscribe uses custom channel name when provided

- GIVEN `useMatches()` is called and `subscribe(onUpdate, 'matches-leaderboard-reload')` is called
- WHEN the subscription is established
- THEN `useSupabaseClient().channel('matches-leaderboard-reload')` is called
- AND `.on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'matches' }, handler)` is registered

#### Scenario: Two simultaneous subscriptions with different channel names

- GIVEN `predictions.vue` calls `subscribe(onUpdateA)` (default channel `'matches-updates'`)
- AND `leaderboard.vue` calls `subscribe(onUpdateB, 'matches-leaderboard-reload')` concurrently
- WHEN a `matches` UPDATE event fires on the DB
- THEN both `onUpdateA` and `onUpdateB` receive the payload independently
- AND neither subscription interferes with the other

#### Scenario: Cleanup removes channel

- GIVEN `subscribe(onUpdate, channelName)` was called and the returned cleanup function is stored
- WHEN the cleanup function is invoked
- THEN `client.removeChannel(channel)` is called exactly once for the channel with that name

#### Scenario: First SUBSCRIBED status — no reload

- GIVEN `subscribe(onUpdate)` was called and no SUBSCRIBED event has been seen yet
- WHEN the channel emits status `'SUBSCRIBED'` for the first time
- THEN `load()` is NOT called

#### Scenario: Second SUBSCRIBED status — debounced reload

- GIVEN the channel has already emitted `'SUBSCRIBED'` once (initial connection)
- WHEN the channel emits `'SUBSCRIBED'` a second time (reconnect)
- THEN `load()` is called after 300 ms debounce

---

## ADDED Requirements

### R-RT-06: Matches-Driven Leaderboard Reload

**Type**: ADDED | **Source**: Slice 7 proposal §2–3, bug #400 workaround
**Files**: `app/pages/rooms/[id]/leaderboard.vue`, `tests/unit/use-leaderboard-realtime.test.ts`, `tests/nuxt/leaderboard.nuxt.test.ts`

`app/pages/rooms/[id]/leaderboard.vue` MUST subscribe to `useMatches().subscribe(onMatchUpdate, 'matches-leaderboard-reload')` in `onMounted`, in addition to the existing `useLeaderboard(roomId).subscribe(onUpdate)` wiring (R-RT-05). The channel name `'matches-leaderboard-reload'` MUST be distinct from `predictions.vue`'s default channel `'matches-updates'` to prevent callback routing conflicts.

The `onMatchUpdate` callback MUST:
1. Inspect `payload.new.status`. If the value is NOT `'finished'`, MUST return immediately with no side effects.
2. If `payload.new.status === 'finished'`: clear any pending reload timer, then start a 300ms timer that calls `useLeaderboard(roomId).load()` once the window expires.

The cleanup function returned by `subscribeMatches` MUST be invoked in `onUnmounted`. Any pending debounce timer MUST also be cleared in `onUnmounted`. The `useLeaderboard.subscribe` wiring (R-RT-05) MUST remain in place and MUST be annotated with a code comment noting it is currently superseded by this matches-driven path due to bug #400.

#### Scenario: Finished match triggers debounced reload

- GIVEN `leaderboard.vue` is mounted and `subscribe(onMatchUpdate, 'matches-leaderboard-reload')` is active
- WHEN a `matches` UPDATE payload arrives with `payload.new.status === 'finished'`
- THEN `useLeaderboard(roomId).load()` is called after 300ms
- AND standings display the values updated by the `calculate_points` trigger

#### Scenario: Live or scheduled match does not trigger reload

- GIVEN `leaderboard.vue` is mounted with the matches subscription active
- WHEN a `matches` UPDATE payload arrives with `payload.new.status === 'live'` or `'scheduled'`
- THEN `onMatchUpdate` returns immediately
- AND `load()` is NOT called

#### Scenario: Debounce coalesces two rapid finished events into one reload

- GIVEN `leaderboard.vue` is mounted
- WHEN two `finished` payloads arrive within 300ms of each other
- THEN the first pending timer is cleared and reset
- AND `load()` is called exactly once after the final 300ms window

#### Scenario: Cleanup before timer fires cancels the reload

- GIVEN a `finished` payload has been received and the 300ms timer is pending
- WHEN `onUnmounted` fires (component torn down) before the timer expires
- THEN the timer is cleared
- AND `load()` is NOT called

#### Scenario: Both subscriptions active simultaneously (no collision)

- GIVEN `leaderboard.vue` is mounted with both `useLeaderboard.subscribe` and `useMatches.subscribe('matches-leaderboard-reload')` active
- WHEN any realtime event fires
- THEN each subscription's callback is routed to its own handler independently
- AND no channel-name conflict occurs between `'room-members-{roomId}'`, `'matches-updates'`, and `'matches-leaderboard-reload'`
