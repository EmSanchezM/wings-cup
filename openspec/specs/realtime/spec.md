# Realtime Specification — realtime-match-and-leaderboard (Slice 6)

## Purpose

New capability domain. Wires Supabase Realtime on top of existing `matches` and `room_members` tables so that admin score edits propagate to user-facing pages without manual refresh.

## Requirements Summary

| Req | Title | Type | Scenarios |
|-----|-------|------|-----------:|
| R-RT-01 | Realtime Publication Migration | NEW | 3 |
| R-RT-02 | useMatches Subscribe Contract | MODIFIED | 6 |
| R-RT-03 | useLeaderboard Subscribe Contract | NEW | 4 |
| R-RT-04 | predictions.vue Subscribe Wire | NEW | 5 |
| R-RT-05 | leaderboard.vue Subscribe Wire | NEW | 4 |
| R-RT-06 | Matches-Driven Leaderboard Reload | ADDED | 5 |

---

## Requirements

### R-RT-01: Realtime Publication Migration

**Type**: NEW | **Source**: Proposal §3.1 / explore risk 1
**Files**: `supabase/migrations/00015_realtime_publication.sql`

Migration `00015_realtime_publication.sql` MUST execute `ALTER PUBLICATION supabase_realtime ADD TABLE matches` and `ALTER PUBLICATION supabase_realtime ADD TABLE room_members`. Each statement MUST be idempotent — the migration MUST guard each ADD TABLE via a check against `pg_publication_tables` (e.g., inside a `DO $$ BEGIN IF NOT EXISTS (...) THEN ALTER PUBLICATION ... ADD TABLE ...; END IF; END $$` block) so that re-running the migration on a DB that already has both tables published produces no error and no duplicate entry.

#### Scenario: Clean application

- GIVEN a database with migrations 00001–00014 applied and neither `matches` nor `room_members` in `supabase_realtime`
- WHEN migration 00015 is applied
- THEN both tables appear in `pg_publication_tables` under `pubname = 'supabase_realtime'`
- AND the migration exits without error

#### Scenario: Idempotent re-run

- GIVEN migration 00015 has already been applied
- WHEN migration 00015 is applied a second time
- THEN no error is raised
- AND `pg_publication_tables` still shows exactly one entry per table under `supabase_realtime`

#### Scenario: Publication query confirms tables

- GIVEN migration 00015 applied
- WHEN `SELECT tablename FROM pg_publication_tables WHERE pubname = 'supabase_realtime'` is executed
- THEN the result set includes both `matches` and `room_members`

---

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

### R-RT-03: useLeaderboard Subscribe Contract

**Type**: NEW | **Source**: Proposal §3.3 / decisions 6, 9
**Files**: `app/composables/useLeaderboard.ts`, `tests/unit/use-leaderboard-realtime.test.ts`

`useLeaderboard(roomId)` MUST expose a `subscribe(onUpdate: (payload: RealtimePostgresChangesPayload<RoomMember>) => void): () => void` method. The channel MUST be named `'room-members-${roomId}'` (one channel per room). The `postgres_changes` listener MUST include a server-side filter `room_id=eq.${roomId}` on `{ event: 'UPDATE', schema: 'public', table: 'room_members' }`. Cleanup and reconnect semantics (debounced `load()` on second `SUBSCRIBED`) MUST be identical to R-RT-02.

#### Scenario: Subscribe creates room-scoped channel

- GIVEN `useLeaderboard('room-abc')` is called
- WHEN `subscribe(onUpdate)` is called
- THEN `useSupabaseClient().channel('room-members-room-abc')` is called
- AND the listener config includes `filter: 'room_id=eq.room-abc'`

#### Scenario: Server-side filter present in subscription args

- GIVEN `useLeaderboard(roomId).subscribe(onUpdate)` is active
- WHEN the subscription config object is inspected
- THEN `filter` equals `'room_id=eq.' + roomId`
- AND `table` equals `'room_members'`
- AND `event` equals `'UPDATE'`

#### Scenario: Cleanup removes channel

- GIVEN `subscribe(onUpdate)` was called for `roomId = 'room-xyz'`
- WHEN the returned cleanup function is invoked
- THEN `client.removeChannel` is called with the `'room-members-room-xyz'` channel

#### Scenario: Second SUBSCRIBED triggers debounced load

- GIVEN the leaderboard channel has already seen one `SUBSCRIBED` event
- WHEN a second `SUBSCRIBED` event arrives
- THEN `load()` is called with 300 ms debounce

---

### R-RT-04: predictions.vue Subscribe Wire

**Type**: NEW | **Source**: Proposal §3.4 / decisions 1, 2, 7
**Files**: `app/pages/rooms/[id]/predictions.vue`

`predictions.vue` MUST call `useMatches().subscribe(onUpdate)` in `onMounted` and store the returned cleanup function. `onUnmounted` MUST invoke the stored cleanup function. On each UPDATE payload, the page MUST find the match in `allMatches.value` by `payload.new.id`, replace the element at that index with `payload.new`, and rely on Vue reactivity to propagate the change to rendered `MatchPredictionCard` components — no page reload. The client-side filter MUST be widened from `status === 'scheduled'` to `status ∈ ['scheduled', 'live', 'finished']`; the local variable MUST be renamed from `scheduledEntries` to `eligibleEntries`. No optimistic updates — the reducer is purely reactive to incoming payloads.

#### Scenario: Subscribe on mount

- GIVEN `predictions.vue` is initialised
- WHEN `onMounted` executes
- THEN `useMatches().subscribe(onUpdate)` is called exactly once
- AND the returned cleanup function is stored

#### Scenario: Cleanup on unmount

- GIVEN `predictions.vue` is mounted with an active subscription
- WHEN the component is unmounted
- THEN the stored cleanup function is invoked

#### Scenario: In-place match replacement on UPDATE payload

- GIVEN `allMatches.value` contains match M with `status: 'scheduled'`
- WHEN an UPDATE payload arrives with `payload.new = { id: M.id, status: 'finished', home_score: 2, away_score: 1, ... }`
- THEN the element for M in `allMatches.value` is replaced with `payload.new`
- AND `MatchPredictionCard` for M receives the updated match as its prop

#### Scenario: Filter includes live and finished matches

- GIVEN `allMatches.value` contains matches with `status` values `['scheduled', 'live', 'finished', 'postponed']`
- WHEN `eligibleEntries` is computed
- THEN only `scheduled`, `live`, and `finished` matches are included
- AND `postponed` matches are excluded

#### Scenario: Card remains visible after status transition

- GIVEN a match card is visible with `status: 'scheduled'`
- WHEN a realtime UPDATE payload changes the match `status` to `'finished'`
- THEN the card remains visible in the list (not removed by the filter)
- AND the card renders in read-only mode

---

### R-RT-05: leaderboard.vue Subscribe Wire

**Type**: NEW | **Source**: Proposal §3.6 / decisions 1, 7
**Files**: `app/pages/rooms/[id]/leaderboard.vue`

`leaderboard.vue` MUST call `useLeaderboard(roomId).subscribe(onUpdate)` in `onMounted` and store the cleanup function. `onUnmounted` MUST invoke it. On each UPDATE payload, the page MUST find the `room_members` entry in `data.value` by `payload.new.user_id`, update its `total_points` to `payload.new.total_points`, and immediately re-sort the array using the comparator `(a, b) => b.total_points - a.total_points || a.joined_at.localeCompare(b.joined_at)` — identical to the `get-leaderboard.ts` server-side order (`total_points DESC, joined_at ASC`).

#### Scenario: Subscribe on mount

- GIVEN `leaderboard.vue` mounts with `roomId`
- WHEN `onMounted` executes
- THEN `useLeaderboard(roomId).subscribe(onUpdate)` is called exactly once

#### Scenario: Cleanup on unmount

- GIVEN `leaderboard.vue` is mounted with an active subscription
- WHEN the component unmounts
- THEN the stored cleanup function is invoked

#### Scenario: Points update and re-sort on payload

- GIVEN `data.value` is `[{ user_id: 'A', total_points: 10, joined_at: T1 }, { user_id: 'B', total_points: 7, joined_at: T2 }]`
- WHEN UPDATE payload arrives with `{ new: { user_id: 'B', total_points: 12, joined_at: T2 } }`
- THEN `data.value[0]` becomes user B with 12 points
- AND `data.value[1]` becomes user A with 10 points (re-sorted descending)

#### Scenario: Tie-break by joined_at

- GIVEN two members have equal `total_points` after a realtime update
- WHEN the client-side comparator is applied
- THEN the member with the earlier `joined_at` is ranked higher (ASC)

---

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
