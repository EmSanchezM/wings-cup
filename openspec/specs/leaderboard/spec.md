# Leaderboard Spec — matches-and-predictions (Slice 3)

## Overview

New capability. Full spec for per-room standings: SELECT-based query, tie-break rule, and composable contract. Points are maintained by the existing `calculate_points` trigger; this spec covers only the read path.

## Requirements

### R-LEAD-01: Per-Room Leaderboard Endpoint
**Type**: NEW
**Source**: C3
**Statement**: `GET /api/rooms/[id]/leaderboard` MUST return the leaderboard for the specified room. The response MUST be an array of entries ordered by `total_points DESC`, with `joined_at ASC` as the tie-break (D3). Each entry MUST include `user_id`, `display_name`, `total_points`, `joined_at`. The endpoint MUST be accessible to any authenticated room member; non-members MUST receive `403`.

**Scenarios**:
- **Given** room R has 3 members with points `[10, 10, 7]` and `joined_at` values `[T1, T2, T3]` for the two 10-point members **When** a room member calls `GET /api/rooms/R/leaderboard` **Then** the response returns the member who joined at T1 first, the T2 member second, and the 7-point member third.
- **Given** user B is not a member of room R **When** user B calls `GET /api/rooms/R/leaderboard` **Then** the endpoint returns `403`.
- **Given** room R has zero predictions submitted (all members at 0 points) **When** a member calls `GET /api/rooms/R/leaderboard` **Then** the response returns all members ordered by `joined_at ASC` with `total_points = 0` for all.

### R-LEAD-02: Points Source — Calculate Points Trigger
**Type**: NEW
**Source**: C3 / proposal §Approach
**Statement**: The leaderboard endpoint MUST read `room_members.total_points` directly — it MUST NOT compute scores on the fly. The `calculate_points` trigger (AFTER UPDATE on `matches`) is the sole mechanism that updates `total_points`. The leaderboard query MUST use the existing `idx_room_members_room_points` index by ordering on `total_points DESC` within a given `room_id`.

**Scenarios**:
- **Given** match M transitions to `status = 'finished'` via `PATCH /api/admin/matches/[id]` **When** the `calculate_points` trigger fires **Then** `room_members.total_points` for members with correct predictions for M is incremented, and a subsequent leaderboard call reflects the new totals.
- **Given** a room has 100 members **When** `GET /api/rooms/[id]/leaderboard` is called **Then** the query uses the `idx_room_members_room_points` index (confirmed via EXPLAIN ANALYZE in tests) and returns within acceptable latency.

### R-LEAD-03: Leaderboard Zod Schema and Composable
**Type**: NEW
**Source**: C3 / proposal §In Scope
**Statement**: `shared/schemas/leaderboard.schema.ts` MUST define and export `LeaderboardEntrySchema`. `app/composables/useLeaderboard.ts` MUST expose a reactive fetch backed by `GET /api/rooms/[id]/leaderboard`. The composable MUST handle loading, error, and data states. The leaderboard page MUST be at `app/pages/rooms/[id]/leaderboard.vue`.

**Scenarios**:
- **Given** a component uses `useLeaderboard(roomId)` **When** the composable mounts **Then** it calls `GET /api/rooms/{roomId}/leaderboard` and exposes `data`, `pending`, and `error` reactive refs.
- **Given** the leaderboard API returns a network error **When** `useLeaderboard` handles the response **Then** `error` is set and `data` remains empty, preventing a render crash.

### R-LEAD-04: Leaderboard Page Auth Guard
**Type**: MODIFIED
**Source**: S-02 (predictions-ux-and-guards, Slice 4)
(Previously: NEW — "Page MUST be protected, unauthenticated users redirected to `/login`")

`app/pages/rooms/[id]/leaderboard.vue` MUST NOT contain a `useSupabaseUser()` import or any `onMounted` redirect block that checks `user.value`. Authentication enforcement MUST be delegated exclusively to the `@nuxtjs/supabase` module's `redirectOptions.include` list which already covers `/rooms(/*)` routes in `nuxt.config.ts`. The `load()` call from `useLeaderboard()` MUST be invoked inside a plain `onMounted(() => load())`. Stale-session failures (401 from the leaderboard API) MUST surface via the `useLeaderboard().error` ref — they MUST NOT be swallowed silently and MUST NOT trigger a manual `navigateTo` redirect from the page component.

**Scenarios**:
- **Given** a user is not authenticated (no valid session cookie) **When** they navigate to `rooms/[id]/leaderboard` **Then** the `@nuxtjs/supabase` middleware intercepts the navigation AND the user is redirected to the configured login route AND the leaderboard page component is never mounted
- **Given** the `leaderboard.vue` source file is inspected **When** checking for `useSupabaseUser` imports or `navigateTo('/login')` calls inside `onMounted` **Then** neither is present
- **Given** the user is authenticated and navigates to `rooms/[id]/leaderboard` **When** the page component mounts **Then** `onMounted(() => load())` fires immediately AND leaderboard data is fetched from the API
- **Given** the user's JWT has expired mid-session **When** the page is already mounted and `load()` calls the leaderboard API **Then** the API returns 401 AND `useLeaderboard().error` is set to the error value AND no automatic `navigateTo` redirect is triggered from the page component

## Out of Scope
- Real-time leaderboard updates (deferred to a future slice).
- Historical leaderboard snapshots (deferred).
- Cross-room global ranking (deferred).
