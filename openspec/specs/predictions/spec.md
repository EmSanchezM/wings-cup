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

### R-PRED-06: Match Selector Card List Page
**Type**: MODIFIED
**Source**: W-03 (predictions-ux-and-guards, Slice 4) + Proposal §3.4 (realtime-match-and-leaderboard, Slice 6)
**(Previously: filter restricted to `status === 'scheduled'` AND `kickoff_at > now`. New: filter is `status ∈ ['scheduled', 'live', 'finished']`; the `kickoff_at > now` client-side time check is removed because the server-side kickoff gate in `upsert-prediction` handler remains the authoritative guard. The local variable `scheduledEntries` MUST be renamed to `eligibleEntries`.)**

The `rooms/[id]/predictions.vue` page MUST load all matches from `useMatches()` and filter client-side to those with `status ∈ ['scheduled', 'live', 'finished']`, stored in a computed ref named `eligibleEntries`. It MUST also load the user's existing predictions for the room via `predClient.getPredictions(roomId)`. Both fetches MUST be initiated in parallel on `onMounted`. The page MUST join the two arrays client-side by `match_id` and render one `<MatchPredictionCard>` per resulting entry. When `eligibleEntries` is empty the page MUST render the empty-state message "No hay partidos disponibles para pronosticar" and a navigation link to the room leaderboard — it MUST NOT redirect automatically. Per-card error responses (HTTP 423, 409) MUST be displayed inline on the corresponding card and MUST NOT surface as a global page-level error. The page MUST NOT contain any `useSupabaseUser` import; authentication is guaranteed by the module-level `redirectOptions`.

**Scenarios**:
- **Given** the room has matches with `status === 'scheduled'` and the user is authenticated **When** `rooms/[id]/predictions.vue` mounts **Then** one `<MatchPredictionCard>` is rendered per scheduled match, showing home team, away team, kickoff datetime (locale-formatted), and stage
- **Given** the room has matches with `status === 'live'` or `status === 'finished'` **When** the page computes `eligibleEntries` **Then** cards are rendered for those matches AND the cards display in read-only mode (per R-PRED-07)
- **Given** the user has an existing unlocked prediction for match M in room R **When** the page finishes loading and joining data **Then** the card for M has `predictedHome` and `predictedAway` inputs pre-filled with the saved values
- **Given** there are zero matches with `status ∈ ['scheduled', 'live', 'finished']` visible to the page **When** the page finishes loading **Then** the empty-state message "No hay partidos disponibles para pronosticar" is visible AND a link to the room leaderboard is rendered AND no automatic navigation occurs
- **Given** the match list includes matches with `status` of `postponed` or `cancelled` **When** the page applies the client-side filter via `eligibleEntries` **Then** no card is rendered for those matches
- **Given** a match card is visible with `status: 'scheduled'` **When** a realtime UPDATE payload changes the match `status` to `'finished'` **Then** the card remains visible in the list (not removed by the filter) AND the card renders in read-only mode
- **Given** the user submits a prediction for a match whose prediction has `locked_at IS NOT NULL` **When** the server returns HTTP 423 **Then** the error is displayed on that specific card only AND all other cards remain in their current state, unaffected
- **Given** the user submits a prediction for a match whose `kickoff_at <= now()` **When** the server returns HTTP 409 `{ error: "match_already_started" }` **Then** the error is displayed on that specific card only AND all other cards remain in their current state

### R-PRED-07: MatchPredictionCard Component Contract
**Type**: MODIFIED
**Source**: W-03 (predictions-ux-and-guards, Slice 4) + Proposal §3.5 (realtime-match-and-leaderboard, Slice 6)
**(Previously: read-only mode driven solely by `existingPrediction.locked_at`. New: a second independent read-only mode is added for `match.status !== 'scheduled'`. Additionally, when `match.status === 'finished'`, the card MUST display the final score. The `locked_at`-based lock badge remains independent.)**

`app/components/MatchPredictionCard.vue` MUST accept two props: `match: MatchListItem` and `existingPrediction: Prediction | null`. It MUST own its local reactive state for `predictedHome`, `predictedAway`, `submitting`, and `error`. It MUST emit a `submitted` event after a successful upsert call.

**Status-based read-only mode**: A computed `isReadonly` MUST be `true` when `match.status !== 'scheduled'`. When `isReadonly` is `true`, score inputs MUST be `readonly` and the submit button MUST NOT be rendered.

**Lock-based read-only mode**: When `existingPrediction.locked_at` is not null, the component MUST render score inputs as `readonly` and MUST display a lock badge. This behaviour is INDEPENDENT of `isReadonly` — both conditions can be true simultaneously.

**Final score display**: When `match.status === 'finished'`, the card MUST render a final score block showing `{match.home_score} - {match.away_score}` below the prediction inputs.

The component MUST call `predClient.upsertPrediction(roomId, { match_id, predicted_home, predicted_away })` on submit and MUST NOT accept `locked_at` in the payload.

**Scenarios**:
- **Given** `match.status === 'scheduled'` and `existingPrediction.locked_at === null` **When** the user sets scores and clicks submit **Then** `upsertPrediction` is called with `{ match_id: match.id, predicted_home, predicted_away }` AND the `submitted` event is emitted on success AND the card shows a success badge briefly
- **Given** `existingPrediction.locked_at` is not null **When** the card renders **Then** both score inputs have `readonly` attribute AND a lock badge is visible AND no submit button is active
- **Given** `match.status === 'live'` and `existingPrediction.locked_at === null` **When** the card renders **Then** `isReadonly` is `true` AND score inputs have `readonly` attribute AND the submit button is NOT rendered AND no lock badge is displayed (lock badge is driven by `locked_at`, not status)
- **Given** `match.status === 'finished'` and `match.home_score = 2`, `match.away_score = 1` **When** the card renders **Then** `isReadonly` is `true` AND score inputs have `readonly` attribute AND the submit button is NOT rendered AND a final score block displaying "2 - 1" is visible below the inputs
- **Given** the card was rendered with `match.status === 'scheduled'` (submit button visible) **When** the `match` prop is updated to `{ status: 'finished', home_score: 3, away_score: 0 }` **Then** the submit button disappears AND the final score block "3 - 0" becomes visible AND score inputs become `readonly`
- **Given** `match.status === 'scheduled'` and the user clicks submit **When** the upsert call is in flight **Then** `submitting` is true and the submit button is disabled
- **Given** `upsertPrediction` rejects or returns an error status **When** the error is received **Then** `error` is set to the error message AND the error is rendered on the card AND `submitting` is false
- **Given** `existingPrediction` is non-null and has `predicted_home: 2, predicted_away: 1` **When** the card initialises its local state **Then** `predictedHome` is initialised to 2 and `predictedAway` to 1

## Out of Scope
- Prediction deletion endpoint (not in scope for this slice).
- Per-user prediction summary page (deferred).
- Real-time prediction feed (deferred).
