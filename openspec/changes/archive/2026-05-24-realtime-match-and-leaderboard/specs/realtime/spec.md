# Realtime Specification — realtime-match-and-leaderboard (Slice 6)

## Purpose

New capability domain. Wires Supabase Realtime on top of existing `matches` and `room_members` tables so that admin score edits propagate to user-facing pages without manual refresh.

## Requirements Summary

| Req | Title | Type | Scenarios |
|-----|-------|------|-----------:|
| R-RT-01 | Realtime Publication Migration | NEW | 3 |
| R-RT-02 | useMatches Subscribe Contract | NEW | 4 |
| R-RT-03 | useLeaderboard Subscribe Contract | NEW | 4 |
| R-RT-04 | predictions.vue Subscribe Wire | NEW | 5 |
| R-RT-05 | leaderboard.vue Subscribe Wire | NEW | 4 |

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

**Type**: NEW | **Source**: Proposal §3.2 / decision 6
**Files**: `app/composables/useMatches.ts`, `tests/unit/use-matches-realtime.test.ts`

`useMatches()` MUST expose a `subscribe(onUpdate: (payload: RealtimePostgresChangesPayload<Match>) => void): () => void` method. The method MUST create a Supabase channel named exactly `'matches-updates'` with a `postgres_changes` listener for `{ event: 'UPDATE', schema: 'public', table: 'matches' }`. The returned function MUST remove the channel by calling `client.removeChannel(channel)`. A `seenSubscribed` flag MUST be maintained internally: the first `'SUBSCRIBED'` status event is treated as initial connection (no action); any subsequent `'SUBSCRIBED'` event (post-reconnect) MUST trigger a debounced call to `load()` with a 300 ms delay.

#### Scenario: Subscribe creates correct channel

- GIVEN `useMatches()` is called in a component
- WHEN `subscribe(onUpdate)` is called
- THEN `useSupabaseClient().channel('matches-updates')` is called with argument `'matches-updates'`
- AND `.on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'matches' }, handler)` is registered

#### Scenario: Cleanup removes channel

- GIVEN `subscribe(onUpdate)` was called and the returned cleanup function is stored
- WHEN the cleanup function is invoked
- THEN `client.removeChannel(channel)` is called exactly once

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
