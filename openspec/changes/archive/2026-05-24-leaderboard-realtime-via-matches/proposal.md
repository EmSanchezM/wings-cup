# Proposal — leaderboard-realtime-via-matches (Slice 7)

**Date**: 2026-05-24
**Status**: proposed
**Slice**: 7 of 7
**Branch (target)**: feat/leaderboard-realtime-via-matches
**Inherits**: foundation, rooms-and-invitations, matches-and-predictions, predictions-ux-and-guards, guards-coverage-and-stale-toast, realtime-match-and-leaderboard
**Estimated size**: ~90 LOC (single PR)

## 1. Problem Statement

Slice 6 (`realtime-match-and-leaderboard`) verified PASS for `matches` realtime in unit + Nuxt tests, but a manual post-merge smoke uncovered that `room_members` UPDATEs do NOT propagate to the client at runtime even though the subscription mounts cleanly, the server confirms `"Subscribed to PostgreSQL"`, and `room_members` is in publication `supabase_realtime` with `REPLICA IDENTITY FULL`. Only heartbeats arrive afterwards — no `postgres_changes` events.

The probable cause (documented in bug #400) is that the `rm_select_same_room` RLS policy on `room_members` invokes `is_room_member(room_id)` SECURITY DEFINER. Supabase Realtime cannot evaluate that helper correctly in the broadcast RLS context and silently drops the event instead of failing loudly. The `matches` table is unaffected because its RLS is trivial (`auth.role() = 'authenticated'`) and was confirmed working in slice 6 smoke.

The leaderboard page therefore stays stale until a manual refresh — the live UX promised by slice 6 is broken for the only audience that matters (room participants watching standings update). We need a pragmatic frontend workaround that restores live behavior without touching RLS or migrating to Broadcast Changes (both out of scope here).

## 2. Scope

### In scope

- `leaderboard.vue` subscribes to `useMatches().subscribe()` in addition to its existing `useLeaderboard().subscribe()` wiring.
- Filter: ONLY `payload.new.status === 'finished'` triggers a leaderboard reload. `live` / `scheduled` / `postponed` / `cancelled` transitions are ignored (they cannot change `room_members.total_points`).
- Debounce: 300ms, same `let timer / clearTimeout / setTimeout` pattern as D4 from slice 6.
- Subscription cleanup on unmount (clear pending timer + invoke channel cleanup callback).
- Add optional `channelName = 'matches-updates'` parameter to `useMatches.subscribe(onUpdate, channelName?)` to fix a latent channel-name collision when both `predictions.vue` and `leaderboard.vue` are mounted. `leaderboard.vue` passes `'matches-leaderboard-reload'`; `predictions.vue` keeps the default.
- Code comment on `useLeaderboard.subscribe`: kept as-is, marked as "superseded by matches-driven reload due to Supabase Realtime + SECURITY DEFINER RLS interaction; re-enable if/when fixed".
- Unit tests (`tests/unit/use-leaderboard-realtime.test.ts` or new file) covering: finished triggers `load()`, live/scheduled do NOT trigger, debounce coalesces two rapid finished events, cleanup before timer fires cancels the reload.
- Structural Nuxt test assertion that `leaderboard.vue` source contains the new channel name / matches subscription wiring.
- Spec patches:
  - `openspec/specs/leaderboard/spec.md` — extend R-LEAD-04 with a finished-match-driven reload scenario.
  - `openspec/specs/realtime/spec.md` — new R-RT-06 capturing the workaround contract.

### Out of scope (deferred)

- RLS refactor on `room_members` (remove SECURITY DEFINER helper).
- Migration to Supabase "Broadcast Changes from Database" feature.
- A silent `loadSilent()` variant on `useLeaderboard` (would avoid the brief "Cargando tabla…" flicker). Accepted UX for now.
- Per-room filtering of matches events (matches has no `room_id`; global reload across all open leaderboard pages is acceptable at current scale).
- Removing `useLeaderboard.subscribe` infrastructure (kept; correct + tested code).

## 3. Approach

### Frontend workaround (matches-driven leaderboard reload)

The `matches` realtime channel is verified working in production runtime. The `calculate_points` AFTER UPDATE trigger on `matches` runs synchronously in the same DB transaction as the status change; Supabase Realtime emits `postgres_changes` AFTER commit, so by the time the client receives the `finished` event, `room_members.total_points` is already updated in the DB. A simple client-side `load()` re-fetch is guaranteed to see the new values — no race.

#### `app/composables/useMatches.ts` (+2 LOC)

Extend the `subscribe` signature:

```ts
subscribe(onUpdate, channelName = 'matches-updates')
```

`predictions.vue` keeps default behavior; `leaderboard.vue` opts into a distinct channel name. This fixes the latent collision and keeps the API backwards-compatible. No other changes to `useMatches.ts`.

#### `app/pages/rooms/[id]/leaderboard.vue` (~15-20 LOC)

- Import `useMatches` + `MatchListItem` type.
- Instantiate a second `useMatches()` factory call — we use only the `subscribe` method (we don't bind its `data`/`pending` to template, so no state-leak risk).
- Add a `let matchReloadTimer` + handler `onMatchUpdate(payload)`:
  - Early return if `payload.new.status !== 'finished'`.
  - `clearTimeout(matchReloadTimer)` then `setTimeout(() => void load(), 300)`.
- In `onMounted`: wire `matchesCleanup = subscribeMatches(onMatchUpdate, 'matches-leaderboard-reload')`.
- In `onUnmounted`: clear the timer, invoke `matchesCleanup?.()`, null the ref.
- Keep existing `useLeaderboard().subscribe(...)` wiring untouched. Add a code comment above it explaining it is currently superseded.

#### `useLeaderboard.subscribe` (no code change, comment only)

Add a `// NOTE: superseded by matches-driven reload in leaderboard.vue — see bug #400 / R-RT-06. Re-enable as primary source if/when Supabase resolves SECURITY DEFINER + Realtime RLS issue.` comment.

### Tests

- Unit (vitest, no Nuxt runtime): mock the matches subscribe callback; assert `load()` called on finished, not called on live/scheduled, debounced to a single call for two rapid finished events, and cancelled by cleanup.
- Nuxt structural: 1-2 source-string assertions on `leaderboard.vue` (presence of `subscribeMatches` / `'matches-leaderboard-reload'`).

### Specs

- R-LEAD-04 gains a scenario: "Given matches realtime fires with status=finished, leaderboard re-fetches standings within 2s."
- R-RT-06 (new): "leaderboard.vue MUST subscribe to matches UPDATE events; when payload.new.status === 'finished', MUST call useLeaderboard(roomId).load() with 300ms debounce. Channel name MUST be 'matches-leaderboard-reload' to avoid collision with predictions.vue's default 'matches-updates' channel."

## 4. Delivery

Single PR `feat/leaderboard-realtime-via-matches`, ~90 LOC across one composable, one page, two test files, two spec files. No new runtime dependencies. No DB migrations. No RLS changes.

## 5. Risks

1. **Global reload on ANY finished match** (Low / Accepted): a leaderboard for room A reloads when ANY match finishes anywhere. `matches` has no `room_id` so we cannot filter server-side. Acceptable at current scale; per-room filtering can be added later if traffic grows.
2. **`pending` flicker during reload** (Low / Accepted): `useLeaderboard.load()` flips `pending.value = true`, showing "Cargando tabla…" briefly. Acceptable UX (signals an update is happening). A silent variant is out of scope.
3. **Channel name collision** (Mitigated): latent bug from slice 6 (single hardcoded `'matches-updates'` channel name) revealed by this slice's second subscriber. Fix is the `channelName` param — small, backwards-compatible, scoped to slice 7.
4. **Latent server-side bug not fixed** (Acknowledged): the underlying `room_members` realtime + SECURITY DEFINER issue is NOT resolved by this slice. Documented as bug #400 + code comment on `useLeaderboard.subscribe`. Future RLS refactor or Broadcast Changes migration remains a separate slice.

## 6. Acceptance Gates

1. When admin marks a match as `finished` via `/admin/matches`, an open `/rooms/[id]/leaderboard` reloads its standings within ~2s, showing updated `total_points` from the `calculate_points` trigger.
2. When admin marks a match as `live` (not finished), the leaderboard does NOT reload.
3. Two rapid `finished` transitions within 300ms trigger only ONE `load()` call (debounce).
4. Both `predictions.vue` and `leaderboard.vue` mounted simultaneously: each has its own working `matches` subscription on distinct channel names (no collision).
5. `useLeaderboard.subscribe` still exists in code and is marked as superseded via comment.
6. `pnpm test:unit` + `pnpm test:nuxt` green; `npx vue-tsc --noEmit` reports 0 errors.
7. No new runtime dependencies added to `package.json`.

## 7. Next Phases

- `sdd-spec` — emit R-LEAD-04 scenario extension and R-RT-06 requirement.
- `sdd-tasks` — single-PR breakdown (~6-8 work units: useMatches param, leaderboard page wiring, comment on useLeaderboard, unit tests, nuxt structural test, spec patches).
- `sdd-design` — SKIPPED. No architectural decisions remain; all design choices are cristalized in this proposal.
