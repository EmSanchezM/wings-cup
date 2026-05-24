# Design: matches-and-predictions (Slice 3 of 5)

**Status**: complete
**Date**: 2026-05-17
**Change name**: matches-and-predictions
**Artifact store**: engram (`sdd/matches-and-predictions/design`) + this file
**Inherits**: foundation, rooms-and-invitations
**Strict TDD**: ACTIVE — every handler / util / schema paired with a failing test (RED → GREEN → REFACTOR; no-op REFACTOR allowed per slice-2 precedent).

This document is the architectural HOW for slice 3. It builds on:
- `openspec/changes/matches-and-predictions/proposal.md` (problem + locked decisions D1–D5)
- The slice-2 design (`sdd/rooms-and-invitations/design`) — Clean Architecture rails, `makeXxxClient($fetch)` pattern, two-step INSERT rationale, RLS hotfix learnings.
- The foundation migrations 00001–00013.

---

## 1. Architecture Overview

```
+---------------------------------------------------------------+
|  Browser (Nuxt 4 SSR + client)                                |
|                                                               |
|  Pages                                                        |
|   - app/pages/admin/matches/index.vue   (super-admin gated)   |
|   - app/pages/rooms/[id]/predictions.vue (member)             |
|   - app/pages/rooms/[id]/leaderboard.vue (member)             |
|   - app/pages/rooms/[id]/index.vue       (adds nav links)     |
|                                                               |
|  Composables                              Client utils         |
|   - useMatches()       <----------+   - makeMatchesClient($f)  |
|   - useLeaderboard()   <----------+   - makeLeaderboardClient  |
|   - usePredictions()   <----------+   - makePredictionClient   |
|     (or extend useRoom)                                       |
+----------------------|----------------------------------------+
                       | $fetch (typed)
                       v
+---------------------------------------------------------------+
|  Nitro server (thin H3 wrappers in server/api/**)             |
|                                                               |
|  GET   /api/matches                       -> list-matches      |
|  PATCH /api/admin/matches/[id]            -> update-match (SR) |
|  POST  /api/admin/matches/lock-now        -> lock-started (SR) |
|  POST  /api/rooms/[id]/predictions        -> upsert-prediction |
|  GET   /api/rooms/[id]/leaderboard        -> get-leaderboard   |
|                                                               |
|  Pure handlers (server/handlers/*.ts) accept injected         |
|  SupabaseClient + identity; throw typed errors.               |
|                                                               |
|  server/utils/auth.ts::requireSuperAdmin(event)               |
|     (foundation; reused — first line of every admin wrapper)  |
+----------------------|----------------------------------------+
                       | Supabase JS (user JWT or service role)
                       v
+---------------------------------------------------------------+
|  Supabase Postgres                                            |
|                                                               |
|  matches               (RLS: SELECT auth, MUTATE service)     |
|  predictions           (RLS: SELECT room-member,              |
|                              INSERT/UPDATE own pre-kickoff —  |
|                              policies re-created in 00014)    |
|  room_members          (existing)                             |
|  profiles              (existing — JOIN for display_name)     |
|  audit_log             (SELECT super-admin, INSERT service)   |
|                                                               |
|  Trigger:  matches_calculate_points  (AFTER UPDATE OF         |
|             status, home_score, away_score — only scores      |
|             predictions WHERE locked_at IS NOT NULL)          |
|  RPC:     lock_started_predictions() RETURNS INTEGER          |
+---------------------------------------------------------------+
```

Slice 3 is a **vertical** through this stack. It does not add tables, indexes, or runtime deps; it adds policies (00014), seed data, four handlers, five endpoints, two composables, three pages, and Zod schemas.

---

## 2. Locked Decisions Table

| ID  | Decision                                | Locked value                                                                 |
| --- | --------------------------------------- | ---------------------------------------------------------------------------- |
| D1  | Seed strategy                           | `pnpm seed:matches` → local Supabase only; `supabase/seeds/matches.sql`; idempotent on `external_id` |
| D2  | Knockout placeholders                   | Text strings `"Group A Winner"`, `"Group A Runner-up"` etc. in `home_team` / `away_team` |
| D3  | Leaderboard tie-break                   | `ORDER BY total_points DESC, joined_at ASC`                                  |
| D4  | "Lock Predictions Now" admin button     | IN scope; calls `lock_started_predictions()` RPC under service role          |
| D5  | Audit log on match mutations            | IN scope; every super-admin `matches` UPDATE writes an `audit_log` row       |
| Inherited | Architecture                      | Clean Architecture — pure handlers + thin H3 wrappers + Zod + composables    |
| Inherited | Migrations                        | Forward-only, idempotent; `00014_fix_pred_rls.sql` is PR-1 task 1            |
| Inherited | Two-step INSERT                   | NOT required for predictions (no AFTER trigger on `predictions.INSERT`)      |
| Inherited | Schema                            | Column is `stage` (NOT `phase`); confirmed in `database.types.ts`            |
| Inherited | External APIs                     | NONE                                                                          |
| Inherited | Deps                              | No new runtime deps (types-only OK)                                          |
| Inherited | Strict TDD                        | `pnpm test:unit`, `pnpm test:nuxt`                                            |

---

## 3. Migration `00014_fix_pred_rls.sql`

PR-1 task 1. Mirrors the pattern from `00013_fix_rls_auth_uid_wrapper.sql`: `DROP POLICY IF EXISTS` + `CREATE POLICY` using `(SELECT auth.uid())`. The two predictions policies are the only ones in 00002 that still use bare `auth.uid()` (`pred_delete_own_unlocked` is also bare — DELETE is not in this slice but we patch it too for consistency).

```sql
-- =============================================================================
-- Migration: 00014_fix_pred_rls.sql
-- Purpose  : Slice 3 RLS hotfix. Replace bare `auth.uid()` in predictions
--            mutation policies with `(SELECT auth.uid())`. Same root cause as
--            00013 — bare auth.uid() in WITH CHECK can raise 42501 even when
--            the user UUID is correct. Pre-emptive fix BEFORE prediction
--            handlers are wired (R1 mitigation).
-- Depends  : 00001_schema.sql, 00002_rls.sql, 00013_fix_rls_auth_uid_wrapper.sql
-- Idempotency: DROP POLICY IF EXISTS + CREATE POLICY.
-- =============================================================================

DROP POLICY IF EXISTS pred_insert_own_before_kickoff ON predictions;
CREATE POLICY pred_insert_own_before_kickoff ON predictions FOR INSERT
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM matches
      WHERE matches.id = predictions.match_id
        AND matches.kickoff_at > NOW()
    )
  );

DROP POLICY IF EXISTS pred_update_own_unlocked ON predictions;
CREATE POLICY pred_update_own_unlocked ON predictions FOR UPDATE
  USING (
    user_id = (SELECT auth.uid())
    AND locked_at IS NULL
    AND EXISTS (
      SELECT 1 FROM matches
      WHERE matches.id = predictions.match_id
        AND matches.kickoff_at > NOW()
    )
  )
  WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS pred_delete_own_unlocked ON predictions;
CREATE POLICY pred_delete_own_unlocked ON predictions FOR DELETE
  USING (user_id = (SELECT auth.uid()) AND locked_at IS NULL);
```

No rollback file is shipped (forward-only); a rollback would simply re-issue the bare-`auth.uid()` form, which is the bug. After `pnpm db:push`, run `pnpm gen-types` (no Insert/Update shape change is expected).

---

## 4. Seed `supabase/seeds/matches.sql` + `pnpm seed:matches`

### 4.1 Seed file shape

- 64 rows total — 48 group-stage + 16 knockout. FIFA 2026 fixture list, hand-curated, **no external API**.
- `external_id` follows the convention `fifa-2026-<sequence>` where sequence is `g01..g48` for group matches and `r16-1..r16-8`, `qf-1..qf-4`, `sf-1..sf-2`, `final`, `third` for knockout. Stable string keys; safe for `ON CONFLICT`.
- Group rows: `home_team` + `away_team` = real country names (ISO-style, English: `"Mexico"`, `"Argentina"` …); `group_name` = `'A'..'L'` (FIFA 2026 has 12 groups per current format, but proposal says `A–H`; we follow proposal — adjust during apply if a different group count is locked by user before seeding).
- Knockout rows: `home_team` and `away_team` use **placeholder text** per **D2**: `"Group A Winner"`, `"Group A Runner-up"`, `"R16 Match 1 Winner"`, `"QF Match 2 Winner"`, etc. Admin substitutes real names via PATCH after each round.
- `status = 'scheduled'`, `home_score = NULL`, `away_score = NULL` at seed time.
- `kickoff_at` = TIMESTAMPTZ with offsets matching FIFA 2026 schedule. Stored UTC; UI renders local.
- `stage` values per CHECK constraint: `'group'`, `'round_of_16'`, `'quarter'`, `'semi'`, `'final'`, `'third_place'`.

Skeleton (one of each kind):

```sql
-- =============================================================================
-- Seed: supabase/seeds/matches.sql
-- Idempotent on external_id (UNIQUE WHERE external_id IS NOT NULL).
-- Re-running this file is safe; ON CONFLICT DO NOTHING keeps existing edits
-- made by admins via /admin/matches.
-- =============================================================================

INSERT INTO matches (external_id, home_team, away_team, kickoff_at, status, group_name, stage)
VALUES
  -- Group A
  ('fifa-2026-g01', 'Mexico',  'Country B', '2026-06-11 18:00:00+00', 'scheduled', 'A', 'group'),
  -- ... 47 more group rows ...

  -- Round of 16
  ('fifa-2026-r16-1', 'Group A Winner', 'Group B Runner-up', '2026-06-27 18:00:00+00', 'scheduled', NULL, 'round_of_16'),
  -- ... 7 more R16 ...

  -- Quarterfinals
  ('fifa-2026-qf-1', 'R16 Match 1 Winner', 'R16 Match 2 Winner', '2026-07-03 18:00:00+00', 'scheduled', NULL, 'quarter'),
  -- ... 3 more QF ...

  -- Semis
  ('fifa-2026-sf-1', 'QF Match 1 Winner', 'QF Match 2 Winner', '2026-07-08 18:00:00+00', 'scheduled', NULL, 'semi'),
  ('fifa-2026-sf-2', 'QF Match 3 Winner', 'QF Match 4 Winner', '2026-07-09 18:00:00+00', 'scheduled', NULL, 'semi'),

  -- Third place + Final
  ('fifa-2026-third', 'SF Match 1 Loser', 'SF Match 2 Loser', '2026-07-12 18:00:00+00', 'scheduled', NULL, 'third_place'),
  ('fifa-2026-final', 'SF Match 1 Winner', 'SF Match 2 Winner', '2026-07-13 19:00:00+00', 'scheduled', NULL, 'final')

ON CONFLICT (external_id) DO NOTHING;
```

### 4.2 `pnpm seed:matches` script

Add to `package.json` scripts:

```json
"seed:matches": "supabase db execute --file supabase/seeds/matches.sql"
```

- Local-only: no `--remote` flag.
- Re-running is safe (idempotent).
- After seed, the row count is observable via `SELECT count(*) FROM matches`.

### 4.3 Why not a SECURITY DEFINER RPC?

A pure SQL file is simpler, version-controlled, and replayable. The seed never runs in production by automation; it is a developer/CI tool only.

---

## 5. Pure handlers (`server/handlers/`)

All handlers follow the slice-2 pattern: pure functions with an injected `SupabaseClient<Database>` plus the minimum identity inputs. They throw raw `Error` for unexpected DB errors; the H3 wrappers translate to HTTP status codes.

### 5.1 `list-matches.ts`

```ts
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../shared/types/database.types'
import type { MatchListItem } from '../../shared/types/matches'

const MATCH_LIST_COLUMNS =
  'id, external_id, home_team, away_team, kickoff_at, status, home_score, away_score, group_name, stage'

export interface ListMatchesDeps {
  supabase: SupabaseClient<Database>
  filter?: { stage?: string; group_name?: string | null }
}

export async function listMatchesHandler(
  deps: ListMatchesDeps,
): Promise<{ matches: MatchListItem[] }> {
  let q = deps.supabase
    .from('matches')
    .select(MATCH_LIST_COLUMNS)
    .order('kickoff_at', { ascending: true })

  if (deps.filter?.stage) q = q.eq('stage', deps.filter.stage)
  if (deps.filter?.group_name !== undefined) {
    q = deps.filter.group_name === null
      ? q.is('group_name', null)
      : q.eq('group_name', deps.filter.group_name)
  }

  const { data, error } = await q
  if (error) throw new Error(error.message)
  return { matches: (data ?? []) as MatchListItem[] }
}
```

- **Read client**: user-context `SupabaseClient` (RLS policy `matches_select_authenticated`).
- Filter is optional; default returns all 64 rows ordered by kickoff.

### 5.2 `update-match.ts`

```ts
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../shared/types/database.types'
import type { Match } from '../../shared/types/matches'
import type { MatchUpdateInput } from '../../shared/schemas/match-update.schema'

export interface UpdateMatchDeps {
  supabaseService: SupabaseClient<Database>   // service-role; bypasses RLS
  adminId: string                              // result of requireSuperAdmin
  matchId: string
  patch: MatchUpdateInput
}

export async function updateMatchHandler(
  deps: UpdateMatchDeps,
): Promise<{ match: Match }> {
  // 1) Snapshot BEFORE (audit_log.before_value).
  const { data: before, error: readErr } = await deps.supabaseService
    .from('matches').select('*').eq('id', deps.matchId).single()
  if (readErr || !before) throw new Error(readErr?.message ?? 'match_not_found')

  // 2) UPDATE — service role bypasses RLS.
  const { data: after, error: updErr } = await deps.supabaseService
    .from('matches').update(deps.patch).eq('id', deps.matchId).select('*').single()
  if (updErr || !after) throw new Error(updErr?.message ?? 'match_update_failed')

  // 3) Audit log row (D5).
  const { error: auditErr } = await deps.supabaseService.from('audit_log').insert({
    admin_id:     deps.adminId,
    action:       'matches.update',
    target_type:  'match',
    target_id:    deps.matchId,
    before_value: before,
    after_value:  after,
  })
  if (auditErr) throw new Error(auditErr.message)

  return { match: after }
}
```

- **Write client**: `serverSupabaseServiceRole(event)` — bypasses RLS. The handler is pure, so the test injects a mock. The wrapper is the boundary that validates `requireSuperAdmin`.
- **Audit fields use the REAL schema**: `admin_id`, `target_type`, `before_value`, `after_value` (see `database.types.ts` — Gotcha G-AUDIT-1's column list is corrected here).
- **Re-update behaviour**: setting `status='finished'` twice is allowed (the DB CHECK doesn't forbid it), but `calculate_points` guards on `OLD.status = 'finished' → return NEW` so points are awarded ONCE. The audit row still records both updates (intentional; admin trail must show repeat edits).
- **NULL scores**: `MatchUpdateInput` allows `home_score`/`away_score` to be omitted (PATCH semantics) but if `status='finished'` is set, both scores MUST be non-NULL — enforced at the **schema** level (refine), not the handler.

### 5.3 `upsert-prediction.ts`

```ts
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../shared/types/database.types'
import type { Prediction } from '../../shared/types/predictions'
import type { PredictionInput } from '../../shared/schemas/prediction.schema'

export class PredictionLockedError extends Error {
  constructor() { super('prediction_locked'); this.name = 'PredictionLockedError' }
}

export interface UpsertPredictionDeps {
  supabase: SupabaseClient<Database>   // user-context client
  userId: string
  roomId: string
  body: PredictionInput
}

export async function upsertPredictionHandler(
  deps: UpsertPredictionDeps,
): Promise<{ prediction: Prediction }> {
  const { data, error } = await deps.supabase
    .from('predictions')
    .upsert(
      {
        room_id:        deps.roomId,
        user_id:        deps.userId,
        match_id:       deps.body.match_id,
        predicted_home: deps.body.predicted_home,
        predicted_away: deps.body.predicted_away,
      },
      { onConflict: 'room_id,user_id,match_id' },
    )
    .select('*')
    .single()

  if (error) {
    // 23514 = check_violation (CHECK constraint, e.g. score range)
    // 42501 = RLS violation (after-kickoff, locked, or not a room member)
    if (error.code === '42501' || error.code === '23514') {
      throw new PredictionLockedError()
    }
    throw new Error(error.message)
  }
  if (!data) throw new Error('upsert_no_row')
  return { prediction: data }
}
```

- **One step is safe** (per proposal anchor #2): no AFTER trigger on `predictions.INSERT` creates dependent visibility. `pred_select_room_members` uses a SELECT EXISTS against `room_members` — the user-in-room check is already satisfied because the user is a member of `roomId` at the moment of upsert.
- The Postgres error map: `42501` (RLS rejection — most common cause is kickoff already passed, prediction already locked, or user is not a room member) and `23514` (predicted_home/away out of `[0,15]` range — the schema also enforces this but DB is the source of truth). Both translate to HTTP `423 Locked` per proposal §3 C2; the wrapper maps `PredictionLockedError → 423`.
- **Exactly at kickoff**: `kickoff_at > NOW()` is strict — a request landing at the exact second is REJECTED (locked). UI must round down kickoff display by 1s to communicate this.

### 5.4 `get-leaderboard.ts`

```ts
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../shared/types/database.types'
import type { LeaderboardEntry } from '../../shared/types/leaderboard'

const LB_COLUMNS =
  'user_id, total_points, joined_at, profile:profiles!inner(display_name, avatar_url)'

export interface GetLeaderboardDeps {
  supabase: SupabaseClient<Database>   // user-context client; RLS filters
  roomId: string
}

export async function getLeaderboardHandler(
  deps: GetLeaderboardDeps,
): Promise<{ entries: LeaderboardEntry[] }> {
  const { data, error } = await deps.supabase
    .from('room_members')
    .select(LB_COLUMNS)
    .eq('room_id', deps.roomId)
    .order('total_points', { ascending: false })
    .order('joined_at',    { ascending: true })

  if (error) throw new Error(error.message)
  // Shape into LeaderboardEntry[] — flatten profile join.
  const rows = (data ?? []) as Array<{
    user_id: string; total_points: number; joined_at: string
    profile: { display_name: string; avatar_url: string | null } | null
  }>
  return {
    entries: rows.map(r => ({
      user_id:      r.user_id,
      display_name: r.profile?.display_name ?? 'Unknown',
      avatar_url:   r.profile?.avatar_url ?? null,
      total_points: r.total_points,
      joined_at:    r.joined_at,
    })),
  }
}
```

- **D3 tie-break** is applied at SQL level: `total_points DESC, joined_at ASC`. Two members with identical totals → earlier `joined_at` ranks higher.
- The `profiles!inner` join works because `profiles_select_shared_room` (00002) exposes `display_name` + `avatar_url` to any member of the same room.
- Returns flat `LeaderboardEntry[]` for UI ergonomics.

### 5.5 `lock-started-predictions.ts`

```ts
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../shared/types/database.types'

export interface LockStartedDeps {
  supabaseService: SupabaseClient<Database>   // service-role for RPC
  adminId: string
}

export async function lockStartedPredictionsHandler(
  deps: LockStartedDeps,
): Promise<{ locked: number }> {
  const { data, error } = await deps.supabaseService
    .rpc('lock_started_predictions')

  if (error) throw new Error(error.message)

  // Audit (informational — no per-row before/after).
  await deps.supabaseService.from('audit_log').insert({
    admin_id:     deps.adminId,
    action:       'predictions.lock_started',
    target_type:  'predictions',
    target_id:    null,
    before_value: null,
    after_value:  { locked_count: data ?? 0 },
  })

  return { locked: (data as number) ?? 0 }
}
```

- Calls the existing `lock_started_predictions()` RPC (SECURITY DEFINER, returns INTEGER — see 00003 lines 170-186).
- Audit row uses `action='predictions.lock_started'` and stores the count in `after_value`.

---

## 6. Nitro wrappers (`server/api/`)

All are < 30 lines. They (1) auth, (2) parse, (3) pick the right Supabase client, (4) call the handler, (5) map errors.

### 6.1 `GET /api/matches` → `server/api/matches/index.get.ts`

```ts
import { serverSupabaseClient, serverSupabaseUser } from '#supabase/server'
import type { Database } from '~~/shared/types/database.types'
import { listMatchesHandler } from '../../handlers/list-matches'

export default defineEventHandler(async (event) => {
  const user = await serverSupabaseUser(event)
  if (!user?.sub) throw createError({ statusCode: 401, statusMessage: 'unauthenticated' })

  const query = getQuery(event)
  const supabase = await serverSupabaseClient<Database>(event)

  return listMatchesHandler({
    supabase,
    filter: {
      stage:      typeof query.stage === 'string' ? query.stage : undefined,
      group_name: typeof query.group === 'string' ? query.group : undefined,
    },
  })
})
```

### 6.2 `PATCH /api/admin/matches/[id]` → `server/api/admin/matches/[id].patch.ts`

```ts
import { serverSupabaseServiceRole, serverSupabaseUser } from '#supabase/server'
import { requireSuperAdmin } from '../../../utils/auth'
import { matchUpdateSchema } from '~~/shared/schemas/match-update.schema'
import { updateMatchHandler } from '../../../handlers/update-match'
import type { Database } from '~~/shared/types/database.types'

export default defineEventHandler(async (event) => {
  await requireSuperAdmin(event)            // 401 / 403
  const user = await serverSupabaseUser(event)
  const matchId = getRouterParam(event, 'id')!
  const patch = await readValidatedBody(event, matchUpdateSchema.parse)
  const supabaseService = serverSupabaseServiceRole<Database>(event)

  return updateMatchHandler({
    supabaseService,
    adminId: user!.sub,                     // requireSuperAdmin guarantees non-null
    matchId,
    patch,
  })
})
```

- **PATCH** (proposal §4.3 says PATCH; gotchas section says PUT — design follows the proposal: PATCH semantics, partial body).
- `requireSuperAdmin` is the security boundary (Gotcha G-ADMIN-1). Service role bypasses RLS so the in-handler check is the ONLY gate.

### 6.3 `POST /api/admin/matches/lock-now` → `server/api/admin/matches/lock-now.post.ts`

```ts
import { serverSupabaseServiceRole, serverSupabaseUser } from '#supabase/server'
import { requireSuperAdmin } from '../../../utils/auth'
import { lockStartedPredictionsHandler } from '../../../handlers/lock-started-predictions'
import type { Database } from '~~/shared/types/database.types'

export default defineEventHandler(async (event) => {
  await requireSuperAdmin(event)
  const user = await serverSupabaseUser(event)
  const supabaseService = serverSupabaseServiceRole<Database>(event)

  return lockStartedPredictionsHandler({
    supabaseService,
    adminId: user!.sub,
  })
})
```

### 6.4 `POST /api/rooms/[id]/predictions` → `server/api/rooms/[id]/predictions.post.ts`

```ts
import { serverSupabaseClient, serverSupabaseUser } from '#supabase/server'
import type { Database } from '~~/shared/types/database.types'
import { predictionSchema } from '~~/shared/schemas/prediction.schema'
import { upsertPredictionHandler, PredictionLockedError } from '../../../../handlers/upsert-prediction'

export default defineEventHandler(async (event) => {
  const user = await serverSupabaseUser(event)
  if (!user?.sub) throw createError({ statusCode: 401, statusMessage: 'unauthenticated' })

  const roomId = getRouterParam(event, 'id')!
  const body = await readValidatedBody(event, predictionSchema.parse)
  const supabase = await serverSupabaseClient<Database>(event)

  try {
    return await upsertPredictionHandler({ supabase, userId: user.sub, roomId, body })
  } catch (err) {
    if (err instanceof PredictionLockedError) {
      throw createError({ statusCode: 423, statusMessage: 'prediction_locked' })
    }
    throw err
  }
})
```

### 6.5 `GET /api/rooms/[id]/leaderboard` → `server/api/rooms/[id]/leaderboard.get.ts`

```ts
import { serverSupabaseClient, serverSupabaseUser } from '#supabase/server'
import type { Database } from '~~/shared/types/database.types'
import { getLeaderboardHandler } from '../../../../handlers/get-leaderboard'

export default defineEventHandler(async (event) => {
  const user = await serverSupabaseUser(event)
  if (!user?.sub) throw createError({ statusCode: 401, statusMessage: 'unauthenticated' })

  const roomId = getRouterParam(event, 'id')!
  const supabase = await serverSupabaseClient<Database>(event)

  return getLeaderboardHandler({ supabase, roomId })
})
```

---

## 7. Composables and client utils

Following the slice-2 `makeXxxClient($fetch)` pattern, with **`typeof $fetch`** parameter type per Gotcha G-COMP-1.

### 7.1 `app/utils/match-client.ts`

```ts
import type { Match, MatchListItem } from '../../shared/types/matches'
import type { MatchUpdateInput } from '../../shared/schemas/match-update.schema'

export function makeMatchesClient(fetchImpl: typeof $fetch) {
  return {
    async listMatches(filter?: { stage?: string; group?: string }): Promise<MatchListItem[]> {
      const { matches } = await fetchImpl<{ matches: MatchListItem[] }>('/api/matches', {
        query: filter,
      })
      return matches
    },
    async updateMatch(id: string, patch: MatchUpdateInput): Promise<Match> {
      const { match } = await fetchImpl<{ match: Match }>(`/api/admin/matches/${id}`, {
        method: 'PATCH',
        body: patch,
      })
      return match
    },
    async lockNow(): Promise<{ locked: number }> {
      return fetchImpl<{ locked: number }>('/api/admin/matches/lock-now', { method: 'POST' })
    },
  }
}
```

### 7.2 `app/composables/useMatches.ts`

```ts
import { makeMatchesClient } from '../utils/match-client'
export function useMatches() { return makeMatchesClient($fetch) }
```

### 7.3 `app/utils/leaderboard-client.ts` + `app/composables/useLeaderboard.ts`

```ts
import type { LeaderboardEntry } from '../../shared/types/leaderboard'

export function makeLeaderboardClient(fetchImpl: typeof $fetch) {
  return {
    async getLeaderboard(roomId: string): Promise<LeaderboardEntry[]> {
      const { entries } = await fetchImpl<{ entries: LeaderboardEntry[] }>(
        `/api/rooms/${roomId}/leaderboard`,
      )
      return entries
    },
  }
}
```

```ts
// app/composables/useLeaderboard.ts
import { makeLeaderboardClient } from '../utils/leaderboard-client'
export function useLeaderboard() { return makeLeaderboardClient($fetch) }
```

### 7.4 `app/utils/prediction-client.ts` (used inside the page; no separate composable needed but we expose one for symmetry)

```ts
import type { Prediction } from '../../shared/types/predictions'
import type { PredictionInput } from '../../shared/schemas/prediction.schema'

export function makePredictionClient(fetchImpl: typeof $fetch) {
  return {
    async upsertPrediction(roomId: string, body: PredictionInput): Promise<Prediction> {
      const { prediction } = await fetchImpl<{ prediction: Prediction }>(
        `/api/rooms/${roomId}/predictions`,
        { method: 'POST', body },
      )
      return prediction
    },
  }
}
```

`useRoom` is NOT extended in this slice (proposal §4.6 leaves them separate). Decision: keep separate composables — single-responsibility, smaller test surface.

---

## 8. Pages (`app/pages/`)

### 8.1 `app/pages/admin/matches/index.vue`

- `definePageMeta({ middleware: 'super-admin' })` — if the foundation middleware exists; otherwise the page calls `useNuxtApp().$fetch('/api/admin/matches/list')` and lets the 403 bubble (no `/api/admin/matches/list` is in scope; the page uses `/api/matches` and only the PATCH/lock-now endpoints require admin). Server-side `requireSuperAdmin` on PATCH and lock-now is the real gate; the page wrapping is UX-only.
- Loads `useMatches().listMatches()` on mount.
- Renders a table: kickoff (local), home/away (editable for knockout placeholders), score inputs (NULL allowed), status select.
- Each row has a "Save" button calling `useMatches().updateMatch(id, patch)`.
- Top-right "Lock Predictions Now" button calls `useMatches().lockNow()`; toast shows `Locked X predictions`.

### 8.2 `app/pages/rooms/[id]/predictions.vue`

- Loads `useMatches().listMatches()` and the user's existing predictions (via the new endpoint planned — actually we don't list predictions back through a dedicated endpoint, only upsert; the page reads from `useRoom().getRoom(id)` which doesn't expose them either. **Decision**: extend `GET /api/rooms/[id]` in a future slice OR add a one-line `getMyPredictions` call. For this slice, **the page only writes**; existing predictions are surfaced as form pre-fills only when the user revisits and the server returns the most recent upsert. **Open trade-off → resolved**: add a small server seam inside `listMatchesHandler` to optionally return the caller's prediction per match. **REJECTED** — that bloats `list-matches`. Final decision: add a dedicated `GET /api/rooms/[id]/predictions` in PR-2 alongside the upsert endpoint (5 LOC handler), to be tracked as a sub-task in `sdd-tasks`.
- UI: list of upcoming matches grouped by `stage` then sorted by `kickoff_at`. Each match has two inputs (home/away) and a "Save" button.
- On 423 → render banner: "This prediction is locked (match already started). Unlocked predictions are not scored."
- On success → green checkmark on the row.
- Static disclaimer (proposal R3): "Predictions lock when the match starts. Unlocked predictions are not scored."

### 8.3 `app/pages/rooms/[id]/leaderboard.vue`

- Loads `useLeaderboard().getLeaderboard(roomId)` on mount.
- Renders a table: rank, display_name (+ avatar), total_points. Rows ordered by `total_points DESC, joined_at ASC`. Ranks are computed client-side from index.

### 8.4 `app/pages/rooms/[id]/index.vue` (edit)

- Replace the `<section class="rounded-lg border border-dashed p-4">` "Próximamente" stub with two NuxtLinks:
  - `<NuxtLink :to="`/rooms/${roomId}/predictions`">Hacer predicciones</NuxtLink>`
  - `<NuxtLink :to="`/rooms/${roomId}/leaderboard`">Ver tabla</NuxtLink>`

---

## 9. Schemas (`shared/schemas/`) and types (`shared/types/`)

### 9.1 `shared/schemas/match-update.schema.ts`

```ts
import { z } from 'zod'

const STAGE = ['group', 'round_of_16', 'quarter', 'semi', 'final', 'third_place'] as const
const STATUS = ['scheduled', 'live', 'finished', 'postponed', 'cancelled'] as const

export const matchUpdateSchema = z.object({
  status:     z.enum(STATUS).optional(),
  home_score: z.number().int().min(0).max(99).nullable().optional(),
  away_score: z.number().int().min(0).max(99).nullable().optional(),
  home_team:  z.string().trim().min(1).max(60).optional(),
  away_team:  z.string().trim().min(1).max(60).optional(),
  kickoff_at: z.string().datetime({ offset: true }).optional(),
  group_name: z.string().trim().length(1).nullable().optional(),
  stage:      z.enum(STAGE).optional(),
}).refine(
  (p) => !(p.status === 'finished' && (p.home_score == null || p.away_score == null)),
  { message: 'finished_requires_scores' },
)

export type MatchUpdateInput = z.infer<typeof matchUpdateSchema>
```

- The `refine` enforces "no `status=finished` without both scores".
- All fields optional — true PATCH semantics.

### 9.2 `shared/schemas/prediction.schema.ts`

```ts
import { z } from 'zod'

export const predictionSchema = z.object({
  match_id:       z.string().uuid(),
  predicted_home: z.number().int().min(0).max(15),
  predicted_away: z.number().int().min(0).max(15),
})

export type PredictionInput = z.infer<typeof predictionSchema>
```

- Matches the DB CHECK constraint `predicted_home BETWEEN 0 AND 15`.

### 9.3 `shared/types/matches.ts`

```ts
import type { Tables } from './database.types'

export type Match = Tables<'matches'>

export type MatchListItem = Pick<
  Match,
  'id' | 'external_id' | 'home_team' | 'away_team' | 'kickoff_at'
  | 'status' | 'home_score' | 'away_score' | 'group_name' | 'stage'
>

export type { MatchUpdateInput } from '../schemas/match-update.schema'
```

### 9.4 `shared/types/predictions.ts`

```ts
import type { Tables } from './database.types'

export type Prediction = Tables<'predictions'>

export type { PredictionInput } from '../schemas/prediction.schema'
```

### 9.5 `shared/types/leaderboard.ts`

```ts
export interface LeaderboardEntry {
  user_id:      string
  display_name: string
  avatar_url:   string | null
  total_points: number
  joined_at:    string
}
```

A standalone type — no DB row maps 1:1; the JOIN is server-side.

---

## 10. RLS interaction map

| Endpoint | Client | RLS effect |
|----------|--------|------------|
| `GET /api/matches` | user-context | `matches_select_authenticated` — all 64 rows visible to any logged-in user |
| `PATCH /api/admin/matches/[id]` | **service role** | RLS bypassed; `requireSuperAdmin` is the only gate (G-ADMIN-1) |
| `POST /api/admin/matches/lock-now` | **service role** (for RPC + audit insert) | RLS bypassed; `requireSuperAdmin` is the only gate |
| `POST /api/rooms/[id]/predictions` | user-context | `pred_insert_own_before_kickoff` + `pred_update_own_unlocked` (00014-patched) — kickoff and ownership enforced in-DB |
| `GET /api/rooms/[id]/leaderboard` | user-context | `rm_select_same_room` filters to caller's rooms; `profiles_select_shared_room` exposes display_name/avatar for peers |

---

## 11. Edge cases (explicit)

| Case | Behaviour |
|------|-----------|
| Admin sets `status='finished'` twice | Allowed by DB; `calculate_points` runs only on the OLD.status ≠ 'finished' transition → points awarded once; both audit rows recorded |
| Admin sets `status='finished'` with NULL scores | Rejected by `matchUpdateSchema.refine` → 400 before DB hit |
| Admin updates kickoff_at on a row with predictions | Allowed; predictions remain valid; if kickoff moves into the past, calling `lock-now` will lock them |
| Same admin re-updates within seconds | Allowed; one audit row per call |
| Prediction submitted exactly at `kickoff_at` | RLS `kickoff_at > NOW()` is strict → REJECTED with 423 (correct — match has started) |
| Prediction with `predicted_home = 16` | Zod rejects (400); even if Zod were bypassed, DB CHECK rejects with 23514 → mapped to 423 (Locked) — slightly imprecise but acceptable; alternative would be a separate 422 path for CHECK violations (not worth the branching) |
| Unauthenticated GET `/api/matches` | 401 |
| Non-member GET `/api/rooms/[id]/leaderboard` | `rm_select_same_room` returns 0 rows → empty `entries: []`; UI renders "No members yet" (not an error) |
| Two members same total_points + same joined_at | Microsecond-precision `joined_at` makes equality near-impossible; if it happens, Postgres breaks tie by physical row order — acceptable for personal-project scope |
| `calculate_points` awards 0 to a NULL-locked prediction | By design — the trigger skips `locked_at IS NULL` rows (00003 line 118). UI banner communicates this (R3) |
| Seed re-run after admin edits a row | `ON CONFLICT (external_id) DO NOTHING` preserves the edit |
| `lock-now` when no predictions are eligible | RPC returns 0; audit row still written with `after_value: { locked_count: 0 }` |

---

## 12. Test seam table (Strict TDD)

Following slice-2 design §10. Every implementation file gets a paired test. RED states accepted: `Cannot find module …` per Gotcha G-TEST-2.

| Implementation file | Test file | Kind | Why this test |
|---------------------|-----------|------|---------------|
| `server/handlers/list-matches.ts` | `tests/unit/handlers/list-matches.test.ts` | unit | wraps `{ matches }`, orders by kickoff_at, applies optional filters, propagates errors |
| `server/handlers/update-match.ts` | `tests/unit/handlers/update-match.test.ts` | unit | reads before, writes patch, writes audit row with correct columns, propagates errors |
| `server/handlers/upsert-prediction.ts` | `tests/unit/handlers/upsert-prediction.test.ts` | unit | calls `.upsert` with `onConflict: 'room_id,user_id,match_id'`, maps 42501 → `PredictionLockedError`, maps 23514 → `PredictionLockedError`, returns `{ prediction }` |
| `server/handlers/get-leaderboard.ts` | `tests/unit/handlers/get-leaderboard.test.ts` | unit | orders by total_points DESC then joined_at ASC, flattens profile join, returns `{ entries }` |
| `server/handlers/lock-started-predictions.ts` | `tests/unit/handlers/lock-started-predictions.test.ts` | unit | calls RPC `'lock_started_predictions'`, writes audit with `action='predictions.lock_started'`, returns `{ locked: n }` |
| `shared/schemas/match-update.schema.ts` | `tests/unit/match-update.schema.test.ts` | unit | accepts partial bodies, rejects `status='finished'` without scores, rejects out-of-range scores |
| `shared/schemas/prediction.schema.ts` | `tests/unit/prediction.schema.test.ts` | unit | uuid validation, score range `0..15`, integer only |
| `app/utils/match-client.ts` | `tests/unit/match-client.test.ts` | unit | parameters serialise correctly, returns peeled `match`/`matches` |
| `app/utils/leaderboard-client.ts` | `tests/unit/leaderboard-client.test.ts` | unit | calls correct path, returns peeled `entries` |
| `app/utils/prediction-client.ts` | `tests/unit/prediction-client.test.ts` | unit | POSTs to correct path, returns peeled `prediction` |
| `app/pages/rooms/[id]/predictions.vue` | `tests/nuxt/predictions.test.ts` | nuxt | ONE nuxt test for: form submits → 423 banner shown on locked response. Uses `beforeAll(async () => await import(...))` per G-TEST-1 |

**Skipped Nuxt tests** (per G-TEST-1 — "default to SKIPPING when wiring is < 10 lines"):
- `admin/matches/index.vue` — UI is a thin shell over `useMatches()`; handler tests + client tests cover the surface
- `rooms/[id]/leaderboard.vue` — same; the handler test verifies ordering; the page just renders a list

**No DB integration test** for migration 00014 — same precedent as slice 2 (deferred until Supabase test helper is wired).

---

## 13. Risks

| # | Risk | Severity | Mitigation |
|---|------|----------|------------|
| R1 | Bare `auth.uid()` in predictions policies repeats slice-2 42501 | HIGH | Migration 00014 is PR-1 task 1; no prediction code runs against unpatched RLS |
| R2 | Seed file drifts from FIFA's published fixtures | MEDIUM | `ON CONFLICT (external_id) DO NOTHING` keeps re-seeds safe; admin edits survive; git history is the source of truth |
| R3 | `calculate_points` silently awards 0 to unlocked predictions | MEDIUM | UI banner on `/rooms/[id]/predictions`; D4 "Lock Predictions Now" button handles post-kickoff predictions admin-initiated |
| R4 | PR-1 (~320–400 LOC) approaches 400-line guard; seed SQL is dense | MEDIUM | `auto-chain` already chosen; `sdd-tasks` Review Workload Forecast confirms split |
| R5 | Audit-log writes run under service role; a bug bypassing `requireSuperAdmin` would let any caller forge entries | MEDIUM | `requireSuperAdmin(event)` is the first line of every admin wrapper; unit tests for handlers exist BUT we also add a wrapper-level negative test (the 401/403 path) — implementation will mock `serverSupabaseUser` and assert `createError` is thrown |
| R6 (new) | `predictions.vue` lacks a server-side read of the caller's existing predictions; rendering only shows what was submitted in the current session | LOW–MEDIUM | Add a 5-LOC `GET /api/rooms/[id]/predictions` in PR-2 (sub-task) that returns the caller's prediction list; out-of-scope to expand `list-matches` |
| R7 (new) | Stale `database.types.ts` after 00014 (RLS-only change does NOT alter Insert/Update shape, but PATCHing types is part of routine) | LOW | Document in apply-progress: run `pnpm gen-types` after `pnpm db:push`; no app code reads policy metadata so the regen is precautionary |
| R8 (new) | Type-cast in `getLeaderboardHandler` to read `profile.display_name` may need a Supabase-JS shape adjustment depending on `!inner` join return type | LOW | Test asserts on the flattened output; if the join shape returns an array (Supabase JS sometimes does for foreign tables), the handler uses `Array.isArray(r.profile) ? r.profile[0] : r.profile` defensively |

---

## 14. Out of Scope (restated)

- External fixture API or scraping (user-locked)
- Auto-cron locking (manual button only — D4)
- Realtime push of leaderboard / match status (slice 4+)
- Bracket / playoff visualization
- Multi-tournament data model
- Per-match detail page
- New runtime deps (types-only OK if strictly necessary)
- `.env*` edits

---

## 15. Open Questions

NONE. D1–D5 are locked by the proposal. The single design-time trade-off (how to surface existing predictions on the page) is resolved in §8.2 / R6 by adding a 5-LOC GET endpoint in PR-2 as a small sub-task.

---

## 16. Known Gotchas Addressed (Gate P2)

Every gotcha from the orchestrator's injection is enumerated below with the exact place in this design that handles it.

### G-RLS-1 — wrap `auth.uid()` with `(SELECT auth.uid())`
Addressed in §3 (migration 00014). Every new `CREATE POLICY` in slice 3 (three policies: `pred_insert_own_before_kickoff`, `pred_update_own_unlocked`, `pred_delete_own_unlocked`) uses `(SELECT auth.uid())` in both USING and WITH CHECK. References `00013_fix_rls_auth_uid_wrapper.sql` precedent.

### G-RLS-2 — INSERT+RETURNING vs SELECT policies
Addressed in §5.3. `pred_select_room_members` (00002 lines 131-138) is a simple `EXISTS (SELECT 1 FROM room_members WHERE room_id = predictions.room_id AND user_id = auth.uid())`. The user-in-room check is satisfied at INSERT time (the user is already a room member; no AFTER trigger is involved). Therefore `.upsert(...).select().single()` is safe in one step. The slice-2 rooms workaround does NOT apply here.

### G-ADMIN-1 — `requireSuperAdmin` is the only admin gate
Addressed in §6.2 and §6.3. Every admin Nitro wrapper (`PATCH /api/admin/matches/[id]`, `POST /api/admin/matches/lock-now`) calls `await requireSuperAdmin(event)` as the FIRST line. Service role is created AFTER the check passes. R5 in §13 adds wrapper-level negative tests to assert the 401/403 path.

### G-COMP-1 — composables use `typeof $fetch`
Addressed in §7. `makeMatchesClient`, `makeLeaderboardClient`, `makePredictionClient` all use `fetchImpl: typeof $fetch` (mirroring the slice-2 `makeRoomClient` signature in `app/utils/room-client.ts`). No use of `$Fetch` from `ofetch`.

### G-TEST-1 — Vitest v4 Nuxt-component tests need `beforeAll` for dynamic import
Addressed in §12. The single Nuxt test (`tests/nuxt/predictions.test.ts`) uses `beforeAll(async () => { const { default: Page } = await import('../../app/pages/rooms/[id]/predictions.vue') })`. The other two pages have wiring < 10 lines and are intentionally skipped — handler + client unit tests cover the behavioural surface.

### G-TEST-2 — "Cannot find module" is a valid RED
Addressed in §12. The first task in `sdd-tasks` for each new handler / util / schema will be the failing import test. GREEN follows with the minimum implementation. REFACTOR may be a documented no-op when GREEN is already clean (slice-2 precedent: 3 no-op refactors).

### G-AUDIT-1 — `audit_log` schema reminder
Addressed in §5.2 and §5.5. **The actual schema** (per `shared/types/database.types.ts` lines 42-82 and `00001_schema.sql` lines 141-150) uses `admin_id` (NOT `actor_id`), `target_type` (NOT `target_table`), `before_value` (NOT `before`), `after_value` (NOT `after`). The orchestrator's gotcha listed alternative names; this design honours the real database columns and the regenerated TypeScript types. Audit RLS (SELECT super-admin only, INSERT service-role only — 00002 lines 217-222) is correctly listed; admin endpoints use service role so INSERTs go through.

---

## 17. PR split forecast

- **PR-1** `feat/matches-seed-and-admin` (~320–400 LOC, ~13–15 tasks):
  1. Migration `00014_fix_pred_rls.sql` + `pnpm db:push` + `pnpm gen-types`
  2. `shared/types/matches.ts`
  3. `shared/schemas/match-update.schema.ts` + test
  4. `server/handlers/list-matches.ts` + test
  5. `server/handlers/update-match.ts` + test (audit columns asserted)
  6. `server/handlers/lock-started-predictions.ts` + test
  7. `server/api/matches/index.get.ts`
  8. `server/api/admin/matches/[id].patch.ts`
  9. `server/api/admin/matches/lock-now.post.ts`
  10. `app/utils/match-client.ts` + test
  11. `app/composables/useMatches.ts`
  12. `app/pages/admin/matches/index.vue`
  13. `supabase/seeds/matches.sql` (64 rows)
  14. `package.json` `seed:matches` script
  15. (optional) wrapper-level 401/403 test if not folded into handler tests

- **PR-2** `feat/predictions-and-leaderboard` (~280–360 LOC, ~10–12 tasks):
  1. `shared/types/predictions.ts`
  2. `shared/types/leaderboard.ts`
  3. `shared/schemas/prediction.schema.ts` + test
  4. `server/handlers/upsert-prediction.ts` + test
  5. `server/handlers/get-leaderboard.ts` + test
  6. `server/api/rooms/[id]/predictions.post.ts`
  7. `server/api/rooms/[id]/predictions.get.ts` (new — R6 mitigation; ~5 LOC handler `getMyPredictions`)
  8. `server/api/rooms/[id]/leaderboard.get.ts`
  9. `app/utils/prediction-client.ts` + test
  10. `app/utils/leaderboard-client.ts` + test
  11. `app/composables/useLeaderboard.ts`
  12. `app/pages/rooms/[id]/predictions.vue` + nuxt test
  13. `app/pages/rooms/[id]/leaderboard.vue`
  14. `app/pages/rooms/[id]/index.vue` nav edit

`sdd-tasks` will normalise into work-unit commits (test + behaviour together).
