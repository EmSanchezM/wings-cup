# Predictions Spec — matches-and-predictions (Slice 3)

## Overview

New capability. Full spec for the prediction lifecycle: room-scoped upsert, kickoff gate, locked_at semantics, and UNIQUE constraint enforcement. Predictions are scoped to `(user_id, room_id, match_id)`.

> **Schema note**: The `predictions` table uses `predicted_home` / `predicted_away` as column names (not `home_score` / `away_score`). The `UpsertPredictionSchema` MUST use these DB-aligned names. The names `home_score` / `away_score` exist on the `matches` table (the actual result scores entered by admins via `MatchUpdateSchema`) — do NOT confuse the two.
>
> **Constraint note**: Predictions use a UNIQUE constraint on `(room_id, user_id, match_id)`, not a composite PK. The actual PK is `id` (UUID). Upsert conflict target is `'room_id,user_id,match_id'`.

## Requirements

### R-PRED-01: Room-Scoped Prediction Upsert
**Type**: NEW
**Source**: C2
**Statement**: `POST /api/rooms/[id]/predictions` MUST upsert a prediction row keyed on `(user_id, room_id, match_id)` using `.upsert({ ... }, { onConflict: 'room_id,user_id,match_id' }).select().single()`. The caller MUST be an authenticated member of the room. The endpoint MUST return `201` on insert and `200` on update, with the full prediction row.

**Scenarios**:
- **Given** user A is a member of room R and match M has `status = 'scheduled'` **When** user A calls `POST /api/rooms/R/predictions` with `{ match_id: M.id, predicted_home: 2, predicted_away: 1 }` **Then** a prediction row is created, `locked_at` is `NULL`, and the response returns the prediction object.
- **Given** user A has an existing prediction for match M in room R **When** user A calls `POST /api/rooms/R/predictions` with updated `predicted_home`/`predicted_away` scores **Then** the existing row is updated (not duplicated) and `locked_at` remains `NULL` if still before kickoff.
- **Given** user A is NOT a member of room R **When** user A calls `POST /api/rooms/R/predictions` **Then** the endpoint returns `403`.

### R-PRED-02: Kickoff Gate — No Predictions After Kickoff
**Type**: NEW
**Source**: C2 / proposal §Approach
**Statement**: The `pred_insert_own_before_kickoff` and `pred_update_own_unlocked` RLS policies (patched in migration 00014) MUST enforce that a user cannot insert or update a prediction once `matches.kickoff_at <= NOW()`. The server handler MUST additionally check `match.kickoff_at > now()` and return `409` with `{ error: "match_already_started" }` before attempting the upsert, providing a user-friendly error message layer above RLS.

**Scenarios**:
- **Given** a match has `kickoff_at` in the past (`kickoff_at <= NOW()`) **When** a room member submits a prediction via `POST /api/rooms/[id]/predictions` **Then** the handler returns `409` with `{ error: "match_already_started" }` and no row is inserted or updated.
- **Given** a match has `kickoff_at` exactly 1 minute in the future **When** a room member submits a prediction **Then** the upsert succeeds and returns the prediction.
- **Given** the handler kickoff check is bypassed (e.g., direct DB call) for a started match **When** the RLS policy `pred_insert_own_before_kickoff` is evaluated **Then** the INSERT is rejected with a `42501` permission error.

### R-PRED-03: Locked Predictions — locked_at Semantics
**Type**: NEW
**Source**: C2 / D4
**Statement**: A prediction's `locked_at` field MUST be set by the `lock_started_predictions()` RPC, NOT by application code. Application code MUST NOT write to `locked_at` directly. A prediction with `locked_at IS NOT NULL` MUST be treated as read-only — the `pred_update_own_unlocked` RLS policy MUST reject any update where `locked_at IS NOT NULL`.

**Scenarios**:
- **Given** a prediction exists with `locked_at IS NULL` **When** `lock_started_predictions()` RPC is called by a super-admin **Then** all predictions whose associated match has `kickoff_at <= NOW()` have their `locked_at` set to the current timestamp.
- **Given** a prediction has `locked_at IS NOT NULL` **When** a room member attempts `POST /api/rooms/[id]/predictions` for that match **Then** the RLS policy `pred_update_own_unlocked` rejects the update (42501) and the handler MUST convert it to **HTTP 423 Locked** (`{ error: "prediction_locked" }`). Note: 423 (Locked) is reserved exclusively for the `locked_at IS NOT NULL` case; 409 (Conflict) is used only for the kickoff gate (R-PRED-02).
- **Given** a prediction payload includes a `locked_at` field **When** `UpdatePredictionSchema` parses it **Then** the field is stripped and never passed to the upsert.

### R-PRED-04: Prediction Zod Schema
**Type**: NEW
**Source**: C2 / proposal §In Scope
**Statement**: `shared/schemas/prediction.schema.ts` MUST define and export `UpsertPredictionSchema` accepting `match_id` (UUID, required), `predicted_home` (integer in range 0–15, required), `predicted_away` (integer in range 0–15, required). Field names MUST match the DB column names (`predictions.predicted_home`, `predictions.predicted_away`). The upper bound of 15 mirrors the DB CHECK constraint `BETWEEN 0 AND 15` on both columns. The schema MUST NOT accept `locked_at`, `user_id`, or `room_id` from the client.

> **Distinction**: `predicted_home`/`predicted_away` are the prediction fields (on `predictions` table). `home_score`/`away_score` are the actual match result fields (on `matches` table, written by admin via `MatchUpdateSchema`). These are different schemas with different field names.

**Scenarios**:
- **Given** `{ match_id: "uuid", predicted_home: 0, predicted_away: 0 }` **When** parsed by `UpsertPredictionSchema` **Then** validation passes.
- **Given** `{ match_id: "uuid", predicted_home: -1, predicted_away: 2 }` **When** parsed by `UpsertPredictionSchema` **Then** validation fails with an error on `predicted_home`.
- **Given** `{ match_id: "uuid", predicted_home: 16, predicted_away: 2 }` **When** parsed by `UpsertPredictionSchema` **Then** validation fails with an error on `predicted_home` (exceeds upper bound of 15).
- **Given** `{ match_id: "uuid", predicted_home: 1, predicted_away: 1, locked_at: "2026-06-01" }` **When** parsed by `UpsertPredictionSchema` **Then** `locked_at` is absent from the parsed output.

### R-PRED-05: Room Membership Guard
**Type**: NEW
**Source**: C2 / proposal §Security
**Statement**: The prediction endpoint `POST /api/rooms/[id]/predictions` MUST verify that the authenticated user is a member of the target room before performing the upsert. This check MUST happen in the server handler (not only RLS), returning `403` for non-members. The `room_id` in the prediction row MUST be taken from the URL path parameter, not from the client payload.

**Scenarios**:
- **Given** user A is a member of room R **When** user A calls `POST /api/rooms/R/predictions` with a valid payload **Then** the inserted prediction has `room_id = R` regardless of any `room_id` in the payload.
- **Given** user B is not a member of room R **When** user B calls `POST /api/rooms/R/predictions` **Then** the handler returns `403` before reaching the upsert logic.

## Out of Scope
- Prediction deletion endpoint (not in scope for this slice).
- Per-user prediction summary page (deferred).
- Real-time prediction feed (deferred).
