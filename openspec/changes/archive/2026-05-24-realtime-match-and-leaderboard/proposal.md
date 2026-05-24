# Proposal: realtime-match-and-leaderboard

- **Slice**: 6
- **Date**: 2026-05-24
- **Status**: proposed
- **Branch (planned)**: `feat/realtime-match-and-leaderboard`
- **Inherits**: foundation, rooms-and-invitations, matches-and-predictions, predictions-ux-and-guards, guards-coverage-and-stale-toast

## 1. Problem Statement

After five slices, Wings Cup is feature-complete but feels static. The admin-only scoring path (slice 3) ships updates to the DB, and `calculate_points` propagates them to `room_members.total_points`, but the UI never reflects those changes until the user refreshes:

- Admin updates a match score on `/admin/matches` → users on `/rooms/[id]/predictions` keep seeing the old score and a live form for a match that is already finished.
- Predictions get scored by the trigger → `/rooms/[id]/leaderboard` keeps showing the previous standings until manual reload.

The architecture decision in `architecture/no-external-match-api` makes admin edits the canonical scoring event, which means **realtime is the only way to close the admin → user feedback loop**. This slice wires Supabase Realtime on top of the existing schema and composables without introducing new domains or external dependencies.

## 2. Scope

### IN scope (cristalized decisions 1, 2, 4–7, 9, 10)

1. Migration `00015_realtime_publication.sql` adding `matches` and `room_members` to the `supabase_realtime` publication (decision 5 — the #1 blocker; without this, ZERO events fire).
2. `useMatches.subscribe(onUpdate)` — extends the existing composable with a subscription lifecycle returning a cleanup function (decision 6).
3. `useLeaderboard(roomId).subscribe(onUpdate)` — same pattern, with server-side channel filter `room_id=eq.${roomId}` (decisions 6 + 9).
4. `app/pages/rooms/[id]/predictions.vue` — widen filter to include `scheduled | live | finished`, rename `scheduledEntries` to `eligibleEntries`, subscribe on mount, cleanup on unmount, in-place replace on UPDATE payload (decisions 1, 2, 7).
5. `MatchPredictionCard.vue` — read-only mode when `match.status !== 'scheduled'`; render final score `{home_score} - {away_score}` when status is `finished`; no submit button when read-only. Existing `isLocked` (driven by `prediction.locked_at`) stays untouched (decision 2).
6. `app/pages/rooms/[id]/leaderboard.vue` — subscribe on mount, cleanup on unmount, client-side re-sort with comparator `(total_points DESC, joined_at ASC)` matching `get-leaderboard.ts` (decisions 1, 7; `patterns/postgres-secondary-sort`).
7. Reconnect handling: on the **second** `SUBSCRIBED` status event, debounce-call `load()` with 300 ms (decision 8).
8. Tests:
   - `tests/unit/use-matches-realtime.test.ts` — assert subscription args (channel name, event, schema, table) + unit-test the reducer separately (decision 10).
   - `tests/unit/use-leaderboard-realtime.test.ts` — same, plus server-side filter `room_id=eq.${roomId}` and re-sort behaviour (decision 10).
   - `MatchPredictionCard.spec.ts` extended for read-only mode on `live` / `finished`.

### OUT of scope (cristalized decisions 3, 4; explore risks 4, 5, 6)

- Admin page subscription (`/admin/matches`) — decision 4. Admin already sees the result of its own write.
- Explicit JWT refresh handler / `onAuthStateChange` wiring — decision 3. Rely on `@nuxtjs/supabase` built-in refresh; revisit only if smoke test fails.
- Optimistic UI updates — decision 7 says reactive, not optimistic.
- Presence / typing indicators, broadcast channels for peer prediction visibility.
- CSS transitions or animations on leaderboard reorder.
- Backfilling missed events while the user was offline beyond the simple `load()` re-fetch on reconnect.
- Touching `predictions.locked_at` from realtime — the lock badge stays cron-driven (explore risk: acceptable v1 behaviour).

## 3. Approach (per work item)

### 3.1 Migration `00015_realtime_publication.sql`

Idempotent guard via `DO $$ ... $$` and `pg_publication_tables` check before each `ALTER PUBLICATION supabase_realtime ADD TABLE …` for `matches` and `room_members`. `room_members` already has `REPLICA IDENTITY FULL` from `00001_schema.sql`; `matches` keeps default REPLICA IDENTITY (PK only) — UPDATE payloads include NEW row values, which is enough for this slice.

Deployment: `supabase db push` against the linked project — must run on production before the app code is merged or events will silently never fire.

### 3.2 `useMatches.subscribe(onUpdate)`

```
const client = useSupabaseClient()
const channel = client.channel('matches-updates')
  .on('postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'matches' },
      (payload) => onUpdate(payload.new))
  .subscribe(statusHandler)
return () => { client.removeChannel(channel) }
```

`statusHandler` tracks `seenSubscribed` flag. First `'SUBSCRIBED'` = initial connection (no-op). Any subsequent `'SUBSCRIBED'` = reconnect → debounced `load()` with 300 ms (decision 8).

### 3.3 `useLeaderboard(roomId).subscribe(onUpdate)`

Same shape, plus:
- channel name `leaderboard-${roomId}` (one channel per room)
- listener filter: `{ event: 'UPDATE', schema: 'public', table: 'room_members', filter: 'room_id=eq.' + roomId }` (decision 9 — defense in depth on top of RLS)
- reducer: find entry by `user_id`, set `total_points = payload.new.total_points`, re-sort with `(total_points DESC, joined_at ASC)` — same as `get-leaderboard.ts` (`patterns/postgres-secondary-sort`).

### 3.4 `predictions.vue`

- Rename `scheduledEntries` → `eligibleEntries`; widen filter from `status === 'scheduled'` to `['scheduled','live','finished'].includes(status)`.
- `onMounted`: call `subscribe((newMatch) => { … in-place replace in allMatches.value … })`. Vue reactivity propagates to `MatchPredictionCard`.
- `onUnmounted`: invoke the cleanup function.
- No optimistic updates; the reducer is purely reactive to the payload (decision 7).

### 3.5 `MatchPredictionCard.vue`

- Add `isReadonly = computed(() => props.match.status !== 'scheduled')`.
- `isLocked` stays as-is (driven by `existingPrediction?.locked_at`).
- Inputs receive `readonly` (or `disabled`) when `isReadonly`. Submit button hidden when readonly.
- When `match.status === 'finished'`, render `Final: {home_score} - {away_score}` block below the inputs.

### 3.6 `leaderboard.vue`

- `onMounted` → subscribe with the room-scoped channel; `onUnmounted` → cleanup. Reducer = update entry in place + re-sort.

### 3.7 Testing

- Global `useSupabaseClient` stub via `vi.stubGlobal` (decision 10) — same pattern as `useSessionExpired` stubs already in the suite.
- Assert subscription args explicitly (channel name, `postgres_changes` config object including filter for leaderboard).
- Reducer unit tests are independent of channel mocks: feed payload objects, assert resulting state.

## 4. Delivery Strategy

Single PR: `feat/realtime-match-and-leaderboard`.

Estimated change: ~300–400 LOC total (migration + 2 composables + 2 pages + `MatchPredictionCard` widening + 3 test files). This is near the 400-line chained-PR threshold — let `sdd-tasks` produce the final Review Workload Forecast and the orchestrator decide between single PR and chained slices.

## 5. Acceptance Gates

1. Admin updates a match score via `/admin/matches`; a separate user on `/rooms/[id]/predictions` (same room, match present in their predictions list) sees the new score **without refresh, within 2 seconds**.
2. When the admin sets `status = 'finished'`, the card on the user's `predictions.vue` switches to read-only and shows the final score; the card does **not** disappear (filter widening — decision 2).
3. When `calculate_points` updates `room_members.total_points`, an open `/rooms/[id]/leaderboard` page reorders **within 2 seconds**.
4. Two browser tabs (same user, same room) on `/leaderboard` show identical ordering after a points update — no divergence (deterministic comparator — `patterns/postgres-secondary-sort`).
5. `pnpm test:unit` and `pnpm test:nuxt` green; `npx vue-tsc --noEmit` reports 0 errors.
6. No new runtime dependencies in `package.json`.

## 6. Risks (carried from exploration + decisions)

- **Migration must reach production** — `supabase db push` against linked project before merge. If skipped, zero events fire and gates 1, 2, 3 all fail silently.
- **JWT mid-channel expiry** — relying on `@nuxtjs/supabase` auto-refresh (decision 3). If the SDK does not propagate the new token to the Realtime channel, users with >1h sessions see stale state silently. Mitigation: deferred to follow-up if smoke testing surfaces it.
- **Reconnect storm on flaky mobile networks** — debounced `load()` (300 ms, decision 8) mitigates but does not fully prevent N rapid re-fetches.
- **`predictions.vue` filter widening** — `MatchPredictionCard` tests must cover read-only mode for both `live` and `finished` (gate 2). Easy to miss the `live` case.
- **Realtime is mock-tested only** — no integration test against local Supabase (decision 10). Integration smoke is manual via two browser sessions before merge.
- **`useSupabaseClient` global stubbing** — needs to work uniformly in vitest unit env and `@nuxt/test-utils` env. Existing patterns cover this, but the stub plumbing is the most likely place for test friction.

## 7. Decisions Baked In (all 10)

1. ✅ Scope = `matches` UPDATEs + `room_members.total_points` changes, surfaces = `predictions.vue` + `leaderboard.vue`.
2. ✅ Filter widening + read-only `MatchPredictionCard` for non-`scheduled` matches.
3. ✅ Rely on `@nuxtjs/supabase` token refresh; no explicit handler.
4. ✅ Admin page subscription OUT of scope.
5. ✅ Migration `00015_realtime_publication.sql` REQUIRED.
6. ✅ `subscribe(onUpdate)` returning cleanup, on existing composables.
7. ✅ Reactive (not optimistic) in-place replace + client-side re-sort.
8. ✅ Debounced `load()` on second `SUBSCRIBED` event (300 ms).
9. ✅ Server-side channel filter `room_id=eq.${roomId}` on `room_members`.
10. ✅ Mock `useSupabaseClient` globally; assert subscription args + reducer unit-tested separately.

## 8. Next Steps

- `sdd-spec` — formalize the contract for `subscribe()` (return type, lifecycle, reconnect semantics) and the card read-only behaviour.
- `sdd-design` — likely valuable: subscription lifecycle, reconnect/debounce logic, and stubbing strategy have real architectural shape worth pinning down before tasks.
