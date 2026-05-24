# Design: realtime-match-and-leaderboard (Slice 6)

- **Date**: 2026-05-24
- **Status**: complete
- **Inherits**: slice 3 design (`sdd/matches-and-predictions/design`)
- **Strict TDD**: ACTIVE

## 1. Architecture Overview

Supabase Realtime is wired as a **side-effect channel** on top of the existing fetch-based composables. The data path stays identical to slice 3 (REST through Nitro → handlers → Postgres), and Realtime is purely additive — it pushes UPDATE payloads from Postgres directly into the browser client, bypassing Nitro.

```
                      Postgres (matches, room_members)
                              │
                ┌─────────────┴──────────────┐
                │                            │
        supabase_realtime              SECURITY DEFINER
         publication                   triggers / RLS
                │                            │
                ▼                            ▼
        Supabase Realtime              REST (Nitro)
         WebSocket                      └─► initial fetch + load()
                │
                ▼
       useMatches.subscribe()
       useLeaderboard.subscribe()
                │  (returns cleanup fn)
                ▼
       predictions.vue / leaderboard.vue
       (onMounted subscribe → onUnmounted cleanup)
```

No new domains, no new handlers, no new Nitro routes. The only DB artifact is the publication migration. All UI updates happen client-side through Vue reactivity.

## 2. Subscription API Surface (D1, D2, D3)

### 2.1 Decision D1 — Channel naming strategy

**Decision**: Use **static singleton channel names per composable instance**, NOT per-component-instance names.

- `useMatches.subscribe()` → channel `'matches-updates'` (global singleton; matches UPDATE events are not per-room)
- `useLeaderboard(roomId).subscribe()` → channel `'room-members-${roomId}'` (one per room; multiple components on the same room reuse the same channel name)

**Why**: Supabase channels with the same name share a single server-side subscription, which is the desired behaviour: if two components on the same room mount `leaderboard.vue` somehow (impossible in practice but defensively correct), they receive the same stream without duplicating the WebSocket frame on the wire.

**Rejected**: Per-instance channel names (`matches-updates-${nanoid()}`). Would create N parallel server-side subscriptions for the same data — pointless cost.

### 2.2 Decision D2 — One channel per composable instance

**Decision**: Each call to `useMatches()` / `useLeaderboard(roomId)` creates **its own composable closure with its own channel ref**. The composable does NOT multiplex callbacks across multiple subscribers.

If two components call `useMatches()` separately and each calls `subscribe()`, two distinct `client.channel('matches-updates')` calls are made. Supabase deduplicates these server-side, but each closure tracks its own cleanup and `seenSubscribed` flag.

**Why**: simplest mental model, matches the existing `useMatches`/`useLeaderboard` pattern (each call returns fresh refs), and avoids singleton state leaking between pages. Page navigation creates new composable instances naturally.

**Rejected**: a module-level shared channel ref with callback multiplexing. Overengineered — Wings Cup never has two predictions pages mounted simultaneously, and the cleanup logic gets messy with reference counting.

### 2.3 Decision D3 — `subscribe(onUpdate)` is side-effect-only with optional callback

**Decision**: `subscribe(onUpdate?)` returns a cleanup `() => void`. The composable does NOT mutate its own `data.value` reactively from realtime payloads — that responsibility lives in the page reducer. `onUpdate` (when provided) receives the raw `RealtimePostgresChangesPayload<T>`.

**Why** (this is opinionated and diverges from the orchestrator's recommendation):
- The spec (R-RT-04, R-RT-05) explicitly places the reducer logic in `predictions.vue` (in-place replace) and `leaderboard.vue` (update + re-sort) — the page already owns the array shape.
- `useMatches.data` is `MatchListItem[]` — pages can choose whether to mirror payloads into it or maintain their own copies. Adding internal reducers would force a coupling between composable and page state shape.
- Symmetric with how `load()` already works: composable owns lifecycle (fetch/subscribe), page owns rendering shape.

**Signature**:

```ts
// useMatches.ts
subscribe(
  onUpdate: (payload: RealtimePostgresChangesPayload<MatchesTable['Row']>) => void
): () => void

// useLeaderboard.ts  (roomId captured by composable closure)
subscribe(
  onUpdate: (payload: RealtimePostgresChangesPayload<RoomMembersTable['Row']>) => void
): () => void
```

`onUpdate` is **required** (not optional). Forcing the page to pass a reducer keeps the side-effect path explicit — no hidden state mutation.

**Rejected**: `onUpdate` optional + composable mutates `data.value` automatically. Would conflict with the leaderboard reducer that must preserve `display_name` (payload doesn't carry it — see §4.2).

## 3. Reconnect Strategy (D4)

### 3.1 Tracking subsequent SUBSCRIBED events

Each `subscribe()` call captures a **closure variable** `seenSubscribed` (initially `false`) and a **debounce timer** ref. The status callback is:

```ts
let seenSubscribed = false
let reloadTimer: ReturnType<typeof setTimeout> | null = null

const statusHandler = (status: string) => {
  if (status !== 'SUBSCRIBED') return  // ignore CHANNEL_ERROR, TIMED_OUT, CLOSED
  if (!seenSubscribed) {
    seenSubscribed = true
    return                              // initial connection — no reload
  }
  // Reconnect path: debounce-call load() at 300 ms
  if (reloadTimer) clearTimeout(reloadTimer)
  reloadTimer = setTimeout(() => {
    void load()
    reloadTimer = null
  }, 300)
}
```

### 3.2 Status events we handle

Only `'SUBSCRIBED'` triggers logic. `'CHANNEL_ERROR'`, `'TIMED_OUT'`, `'CLOSED'` are logged at most (decision: no logging in v1 — the SDK auto-reconnects and the next `'SUBSCRIBED'` will trigger the debounced reload).

### 3.3 What `load()` means

- `useMatches.load()`: re-fetches the full matches list via `client.getMatches()`. Replaces `data.value` wholesale.
- `useLeaderboard.load()`: re-fetches the room leaderboard via `client.getLeaderboard(roomId)`. Replaces `data.value` wholesale.

The wholesale replace is intentional — the slice 3 design already accepts that `load()` clobbers `data.value`. Reconnect is the right time to re-sync from authority, since the client missed events while disconnected.

### 3.4 Cleanup interaction with debounce timer

The cleanup function MUST also clear the pending `reloadTimer`:

```ts
return () => {
  if (reloadTimer) {
    clearTimeout(reloadTimer)
    reloadTimer = null
  }
  client.removeChannel(channel)
}
```

This prevents a late `load()` call firing after `onUnmounted` — which would crash if the component's reactivity context is already torn down.

## 4. State Update Reducers (D5)

### 4.1 `predictions.vue` reducer

`allMatches.value` is `MatchListItem[]`. On UPDATE payload:

```ts
const onMatchUpdate = (payload: RealtimePostgresChangesPayload<Match>) => {
  const updated = payload.new as MatchListItem
  const idx = allMatches.value.findIndex((m) => m.id === updated.id)
  if (idx === -1) return  // not in our list (different room / filtered out at fetch time)
  allMatches.value = [
    ...allMatches.value.slice(0, idx),
    updated,
    ...allMatches.value.slice(idx + 1),
  ]
}
```

**Decision D5a**: use a new array (immutable replace) via `slice + spread`, NOT `splice` mutation.

**Why**: Vue 3 `ref<Array>` reactivity tracks `.value` reassignment robustly. While `splice` also triggers reactivity in Vue 3, the immutable pattern is more aligned with the rest of the codebase (the spec consistently uses functional patterns) and avoids any edge case where the array reference is `readonly` or proxied. The performance cost is negligible at <50 matches.

**Why we keep `payload.new` as-is**: the realtime payload for `matches` includes all columns of the NEW row. `MatchListItem` is a `Pick<Match, ...>` — every field we need is present in the payload. No field-preservation merge needed.

### 4.2 `leaderboard.vue` reducer

`data.value` is `LeaderboardEntry[]` with shape `{ user_id, display_name, total_points, joined_at }`. The payload schema for `room_members` is `{ user_id, room_id, total_points, joined_at, ... }` — **no `display_name`** because it lives in `profiles`.

**Decision D5b**: preserve `display_name` from the existing entry; only `total_points` (and `joined_at` as defense) gets updated from the payload.

```ts
const onMemberUpdate = (payload: RealtimePostgresChangesPayload<RoomMember>) => {
  const upd = payload.new
  if (!upd?.user_id) return
  const idx = data.value.findIndex((e) => e.user_id === upd.user_id)
  if (idx === -1) return
  const merged: LeaderboardEntry = {
    ...data.value[idx],
    total_points: upd.total_points,
    joined_at: upd.joined_at,  // payload is authoritative
  }
  const next = [...data.value.slice(0, idx), merged, ...data.value.slice(idx + 1)]
  next.sort(
    (a, b) =>
      b.total_points - a.total_points ||
      a.joined_at.localeCompare(b.joined_at),
  )
  data.value = next
}
```

**Decision D5c**: assign a brand-new sorted array to `data.value` (`data.value = next`). `.sort()` mutates in place, so reassigning the reference is what triggers downstream renders. We sort the local `next` first, then assign once — single reactivity tick.

**Why match the server comparator exactly**: gate 4 of the proposal requires "two browser tabs show identical ordering". Any divergence in tie-break logic between client-side re-sort and `get-leaderboard.ts` would violate it. Comparator pinned to `(total_points DESC, joined_at ASC)` matches `patterns/postgres-secondary-sort` and `get-leaderboard.ts` exactly.

**Rejected**: relying on the next `load()` to fix the order. Reconnect-only re-fetch isn't enough — the spec mandates within-2s reorder on every UPDATE.

## 5. Mock Test Strategy (D6)

### 5.1 The `useSupabaseClient` stub pattern

Existing tests stub Nuxt auto-imports with `vi.stubGlobal(...)`. Same pattern:

```ts
const mockRemoveChannel = vi.fn()
const mockChannel = {
  on: vi.fn().mockReturnThis(),
  subscribe: vi.fn(),
}
const mockClient = {
  channel: vi.fn(() => mockChannel),
  removeChannel: mockRemoveChannel,
}

vi.stubGlobal('useSupabaseClient', () => mockClient)
```

`channel.on` is chainable (returns `mockChannel`), `channel.subscribe` captures the status callback so tests can invoke it manually.

### 5.2 Tests to write (per the spec)

For each of `tests/unit/use-matches-realtime.test.ts` and `tests/unit/use-leaderboard-realtime.test.ts`:

| Test | Assertion |
|------|-----------:|
| Subscription args | `mockClient.channel` called with `'matches-updates'` / `'room-members-${roomId}'`; `.on('postgres_changes', { event: 'UPDATE', schema: 'public', table: ..., filter?: ... }, cb)` called with correct config |
| Cleanup removes channel | cleanup fn calls `mockRemoveChannel(channel)` exactly once |
| First SUBSCRIBED — no reload | invoke captured `statusCb('SUBSCRIBED')` once; `load()` NOT called |
| Second SUBSCRIBED — debounced reload | invoke `statusCb('SUBSCRIBED')` twice with `vi.useFakeTimers()`; advance 300 ms; `load()` called once |
| Cleanup cancels pending reload | trigger reconnect → call cleanup before timer fires → advance timers → `load()` NOT called |
| Reducer (separate, no channel mocks) | feed payload object directly to the page's reducer / a pure helper; assert state shape |

The reducer is unit-tested **separately** from the subscription wiring, against pure functions (`reducerMatch(payload, prev) → next`). This keeps mock plumbing minimal.

### 5.3 Where reducers live for testability

**Decision D6a**: extract the reducers into pure named functions inside the page `<script setup>` (not exported), AND expose pure equivalents as helpers in the composable module so they can be imported directly by tests.

Concretely:
- `app/composables/useMatches.ts` exports `applyMatchUpdate(prev: MatchListItem[], payload: Match): MatchListItem[]`
- `app/composables/useLeaderboard.ts` exports `applyMemberUpdate(prev: LeaderboardEntry[], payload: RoomMember): LeaderboardEntry[]`

Pages import and call these. Tests import them directly with no mocks needed.

**Why**: avoids needing a Nuxt test environment (`@nuxt/test-utils` + happy-dom) for reducer tests. Stays in plain vitest unit env. Mirrors the slice 3 pattern of separating pure logic from Vue ceremony.

## 6. Migration Design (00015) — D7

**Decision D7**: idempotent via `pg_publication_tables` guard inside a `DO $$ ... $$` block.

```sql
-- 00015_realtime_publication.sql

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'matches'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE matches';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'room_members'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE room_members';
  END IF;
END $$;
```

**Why**:
- `ALTER PUBLICATION ... ADD TABLE` is NOT natively idempotent (PG raises `duplicate_object` if the table is already published).
- `pg_publication_tables` view is the canonical way to introspect membership.
- `EXECUTE 'ALTER PUBLICATION ...'` runs as dynamic SQL inside the `DO` block, which avoids parsing-time errors on environments where the publication doesn't exist (defensive).
- Forward-only — no `DOWN` migration. The slice 3 design and Wings Cup convention is forward-only migrations.
- `REPLICA IDENTITY` is unchanged: `room_members` already has `REPLICA IDENTITY FULL` from 00001; `matches` keeps default (PK-only) — UPDATE payloads carry the full NEW row regardless.

**Deployment**: `supabase db push` against the linked project before merging the code. Documented as **R-DB-33 gating dependency** in the spec.

## 7. MatchPredictionCard Read-Only Mode (D8)

### 7.1 The two independent read-only conditions

| Condition | Source | Badge shown | Inputs |
|-----------|--------|-------------|--------|
| `isLocked` (existing) | `existingPrediction?.locked_at != null` | 🔒 "Predicción bloqueada" | readonly |
| `isReadonly` (new, status-driven) | `match.status !== 'scheduled'` | status badge (see D8a) | readonly |
| Combined (final readonly) | `isLocked || isReadonly` | both can stack; lock takes precedence | readonly |

### 7.2 Decision D8a — Badge variants per status

When `isReadonly` is true but `isLocked` is false (match went live but cron hasn't locked predictions yet), badge mapping:

| `match.status` | Badge variant | Text | Color |
|----------------|---------------|------|-------|
| `'scheduled'` + locked | 🔒 | "Predicción bloqueada" | yellow (existing) |
| `'live'` + not locked | 🔴 | "En vivo" | red (new) |
| `'live'` + locked | 🔒 | "Predicción bloqueada" | yellow (lock wins — predictions already finalized) |
| `'finished'` + not locked | ✅ | "Finalizado" | gray (new) |
| `'finished'` + locked | 🔒 + ✅ | both visible | both (rare in practice — usually locked first) |
| `'postponed'` / `'cancelled'` | n/a | filtered out of `eligibleEntries` | n/a |

**Why this precedence order**: the lock badge (`isLocked`) signals "your prediction is final". The status badge signals "match progress". They're orthogonal; if both apply we render both, but the lock badge is the more actionable for the user (they can't change their prediction either way).

**Spec clarification**: R-PRED-07 scenario "Live match renders read-only" explicitly requires `no lock badge` when `locked_at === null`. The status badge fills that gap visually.

### 7.3 Decision D8b — Final score block

When `match.status === 'finished'`, render below the inputs:

```vue
<div
  v-if="match.status === 'finished'"
  class="rounded-md bg-muted/40 px-3 py-2 text-center text-sm font-mono"
  data-testid="final-score"
>
  Final: {{ match.home_score }} - {{ match.away_score }}
</div>
```

Renders only when `home_score` and `away_score` are non-null (R-MATCHES-04 already enforces this at admin update). `match-update.schema.ts` rejects `status='finished'` with null scores at the API boundary, so the card can assume non-null when status is `'finished'`.

### 7.4 Decision D8c — Submit button visibility

Final condition: `v-if="!isReadonly && !isLocked"` (i.e., scheduled AND not locked).

Currently the template uses `v-if="!isLocked"`. New condition: `v-if="!isLocked && !isReadonly"`. Same `readonly` attribute logic on inputs: `:readonly="isLocked || isReadonly"`.

## 8. Subscription Lifecycle in Pages (D9)

**Decision D9**: standardize the cleanup ref pattern across both pages.

```ts
const cleanup = ref<(() => void) | null>(null)

onMounted(() => {
  cleanup.value = composable.subscribe(reducer)
})

onUnmounted(() => {
  cleanup.value?.()
  cleanup.value = null
})
```

**Why** ref over a plain `let`:
- `ref` is consistent with the rest of the page's reactive state (no mix of patterns).
- Nullable signature (`(() => void) | null`) makes the typecheck explicit about "not yet mounted" vs "active".
- Setting back to `null` on unmount prevents accidental double-cleanup if the ref leaks somewhere.

**Why not a custom composable wrapper (`useSubscription(fn)`)**: 8 lines, used twice, adds another file. Inline pattern is clearer.

## 9. Component Map

### 9.1 Files touched

| File | Action | Reason |
|------|--------|--------|
| `supabase/migrations/00015_realtime_publication.sql` | NEW | R-DB-33 / R-RT-01 |
| `app/composables/useMatches.ts` | EXTEND | add `subscribe()` + export `applyMatchUpdate` helper |
| `app/composables/useLeaderboard.ts` | EXTEND | add `subscribe()` + export `applyMemberUpdate` helper |
| `app/pages/rooms/[id]/predictions.vue` | MODIFY | filter widening, rename to `eligibleEntries`, subscribe lifecycle, reducer wiring |
| `app/pages/rooms/[id]/leaderboard.vue` | MODIFY | subscribe lifecycle, reducer wiring |
| `app/components/MatchPredictionCard.vue` | MODIFY | `isReadonly` computed, status badges, final score block |
| `tests/unit/use-matches-realtime.test.ts` | NEW | subscription args + reducer |
| `tests/unit/use-leaderboard-realtime.test.ts` | NEW | subscription args + filter + reducer |
| `tests/unit/MatchPredictionCard.spec.ts` | EXTEND | new read-only scenarios for `live` and `finished` + status transition |

### 9.2 Files NOT touched

- `app/pages/admin/matches/index.vue` — admin sees its own writes (decision 4 in proposal)
- `server/handlers/**` — no API contract changes
- `server/api/**` — no new routes
- `shared/types/**` — types unchanged; `MatchListItem` already has all needed fields
- `shared/schemas/**` — no payload validation changes
- `nuxt.config.ts` — `@nuxtjs/supabase` realtime is enabled by default in v2; no config change needed
- `supabase/config.toml` — `[realtime] enabled = true` already present

## 10. Data Flow Diagrams

### 10.1 Admin updates a match (happy path)

```
[Admin] PATCH /api/admin/matches/:id { status: 'finished', home_score: 2, away_score: 1 }
   │
   ▼
[update-match.ts handler]
   ├─► UPDATE matches SET status='finished', home_score=2, away_score=1
   │     │
   │     ▼
   │   [calculate_points trigger fires for each prediction in the match]
   │     │
   │     ▼
   │   UPDATE room_members SET total_points = total_points + delta WHERE ...
   │     │
   │     ▼
   │   [supabase_realtime publication emits 2 streams]
   │     ├─► matches UPDATE → channel 'matches-updates' → all open predictions.vue
   │     └─► room_members UPDATE → channel 'room-members-:roomId' → all open leaderboard.vue (in that room)
   │
   └─► INSERT audit_log ...

[User browsers]
   ├─► predictions.vue.onMatchUpdate(payload) → in-place replace in allMatches
   │     │
   │     ▼
   │   MatchPredictionCard re-renders with status='finished', shows final score block + read-only
   │
   └─► leaderboard.vue.onMemberUpdate(payload) → merge total_points, re-sort, reassign data.value
         │
         ▼
       table re-renders with new ordering
```

### 10.2 Reconnect path

```
[Mobile user backgrounds tab → WebSocket times out]
   │
   ▼
[Foreground tab → SDK reconnects automatically]
   │
   ▼
channel emits 'SUBSCRIBED' (2nd time)
   │
   ▼
statusHandler: seenSubscribed === true → debounce 300 ms → load()
   │
   ▼
re-fetch /api/matches or /api/rooms/:id/leaderboard
   │
   ▼
data.value = freshList  (catches any UPDATEs missed while disconnected)
```

## 11. Risks the Apply Phase Should Know

1. **Migration MUST be applied first** — `pnpm db:push` (or equivalent) against the linked project BEFORE the code merges. If skipped, every scenario silently passes locally but breaks in production. Apply phase should call out this deployment step in its commit messages / PR description.
2. **`useSupabaseClient` is a Nuxt auto-import** — must be stubbed in plain vitest unit tests via `vi.stubGlobal`. The existing `useSessionExpired` stub pattern in `tests/unit/use-matches.test.ts` is the template.
3. **Reactivity choice** — pages use `data.value = [...]` reassignment, NOT in-place mutation. If apply phase tries `.splice()` and tests pass anyway, the production page may not re-render in Vue 3 strict mode. Stick to the immutable pattern.
4. **`MatchListItem` field coverage** — slice 6 assumes the realtime payload `payload.new` is shape-compatible with `MatchListItem`. The DB row has `external_id`, which is in `MatchListItem`. If a future schema adds columns not picked into `MatchListItem`, payload spread might pass extras into props (harmless but noisy in vue-tsc). Tests should construct payloads with exactly the `MatchListItem` shape to keep noise out.
5. **Status badge precedence in card** — make sure tests cover all 4 combinations (`scheduled+locked`, `live+not_locked`, `finished+not_locked`, `live+locked` edge). The orthogonal computed approach risks subtle CSS conflicts if both badges render — apply phase should verify visual separation (margin/gap utility).
6. **Final score block requires non-null scores** — if a `finished` match somehow arrives with null scores (data corruption / pre-migration row), the template renders "Final: null - null". Defensive: `v-if="match.status === 'finished' && match.home_score != null && match.away_score != null"`. Pin this in the card test.
7. **Reducer purity** — `applyMatchUpdate` / `applyMemberUpdate` must be **pure functions** (no closure-captured refs). Apply phase: export them as `function applyMatchUpdate(prev, payload) { ... }` taking explicit `prev` parameter; do NOT close over `data.value`.
8. **`payload.new` typing** — Supabase JS v2 types `payload.new` as `T` only when generics are passed: `RealtimePostgresChangesPayload<{ public: { Tables: { matches: { Row: Match } } } }>`. Use a simpler `RealtimePostgresChangesPayload<Match>` alias to keep call sites readable. Document in the composable.
9. **Single PR ~300–400 LOC** — proposal flagged this as near the chained-PR threshold. Apply phase should respect any `delivery_strategy` flag passed from `sdd-tasks`.

## 12. Open Questions

None. All ten cristalized decisions in the proposal have a corresponding architectural choice in this design (D1–D9 + the migration pattern).

## 13. Summary of Cristalized Decisions

| ID | Decision | Locked |
|----|----------|--------|
| D1 | Static channel names: `'matches-updates'`, `'room-members-${roomId}'` | ✅ |
| D2 | One channel per composable instance; no multiplexing | ✅ |
| D3 | `subscribe(onUpdate)` required callback; composable does NOT mutate `data.value` | ✅ |
| D4 | Reconnect = closure flag `seenSubscribed` + 300ms debounce; cleanup clears timer | ✅ |
| D5a | predictions reducer: immutable replace via `slice + spread` (not splice) | ✅ |
| D5b | leaderboard reducer: preserve `display_name`, update `total_points`+`joined_at` | ✅ |
| D5c | leaderboard re-sort: sort local copy, reassign `data.value` once | ✅ |
| D6 | Mock `useSupabaseClient` globally; extract pure reducers (`applyMatchUpdate`, `applyMemberUpdate`) for testability | ✅ |
| D7 | Migration idempotent via `DO $$ ... $$` + `pg_publication_tables` check | ✅ |
| D8a | Card badges: 🔒 lock (existing), 🔴 "En vivo", ✅ "Finalizado"; lock+status can stack | ✅ |
| D8b | Final score block under inputs when `status='finished'` and scores non-null | ✅ |
| D8c | Submit button: `v-if="!isLocked && !isReadonly"` | ✅ |
| D9 | Pages use `ref<(() => void) | null>` cleanup pattern | ✅ |

## 14. Next Steps

- `sdd-tasks` — generate the implementation task list (estimated 12–15 tasks: 1 migration + 2 composables + 2 reducers + 2 pages + 1 card + 3 tests).
- Apply phase should follow strict TDD: tests RED first per task.
