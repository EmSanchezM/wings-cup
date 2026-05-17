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

### R-LEAD-04: Leaderboard Page Navigation
**Type**: NEW
**Source**: C3 / proposal §In Scope
**Statement**: `app/pages/rooms/[id]/leaderboard.vue` MUST be accessible via navigation from `app/pages/rooms/[id]/index.vue`. The room index page MUST be updated to include a link/button to the leaderboard. The leaderboard page MUST be protected — unauthenticated users are redirected to `/login`.

**Scenarios**:
- **Given** an authenticated room member views `rooms/[id]/index.vue` **When** the page renders **Then** a link or button to `rooms/[id]/leaderboard` is visible.
- **Given** an unauthenticated user navigates to `rooms/[id]/leaderboard` **When** the auth guard runs **Then** the user is redirected to `/login`.

## Out of Scope
- Real-time leaderboard updates (deferred to a future slice).
- Historical leaderboard snapshots (deferred).
- Cross-room global ranking (deferred).
