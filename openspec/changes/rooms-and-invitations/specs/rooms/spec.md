# Rooms Spec — Delta for rooms-and-invitations

## Overview

New capability. Defines create / list / detail semantics for betting rooms, including the `prize_description` field, default `scoring_rules`, owner membership invariant, and invite-code attachment.

## Requirements

### R-ROOMS-01: Room Creation
**Type**: NEW
**Source**: proposal §In Scope / §Capabilities
**Statement**: Any authenticated user MUST be able to create a betting room by submitting a name and optional `prize_description`. The server MUST atomically generate a unique 6-character invite code (`[A-Z0-9]`), insert the room row, and rely on the `on_room_created` trigger to insert the owner as a member with `role = 'owner'`. The entire operation MUST be exposed via `POST /api/rooms` (Nitro, server-only).

**Scenarios**:
- **Given** an authenticated user submits `{ name: "Amigos", prize_description: "Una birra" }` to `POST /api/rooms` **When** the request is processed **Then** a room row is inserted with `created_by = auth.uid()`, a unique 6-char `invite_code`, `prize_description = "Una birra"`, and `scoring_rules` equal to the default JSONB; a matching `room_members` row with `role = 'owner'` also exists; the response returns `201` with the new room object.
- **Given** an authenticated user submits a room name longer than 100 characters **When** `POST /api/rooms` validates the payload via Zod **Then** the endpoint returns `400` and no room row is inserted.
- **Given** the invite-code generator produces a code that already exists (UNIQUE conflict) **When** the server retries up to 3 times **Then** on a successful retry a unique code is found and the room is created; if all 3 attempts collide the endpoint returns `409` with `{ error: "invite_code_conflict" }`.

### R-ROOMS-02: Room List
**Type**: NEW
**Source**: proposal §In Scope
**Statement**: `GET /api/rooms` MUST return all rooms where the authenticated user is a member, ordered by `created_at DESC`. RLS on `rooms` (member-based SELECT policy, R-SEC-10) MUST be the enforcement mechanism — the endpoint uses the user-scoped Supabase client.

**Scenarios**:
- **Given** user A is a member of 2 rooms and user B is a member of 1 different room **When** user A calls `GET /api/rooms` **Then** the response contains exactly the 2 rooms that include user A, in descending creation order.
- **Given** an unauthenticated request reaches `GET /api/rooms` **When** the Nitro handler checks the session **Then** the endpoint returns `401`.

### R-ROOMS-03: Room Detail
**Type**: NEW
**Source**: proposal §In Scope
**Statement**: `GET /api/rooms/[id]` MUST return the full room row if the authenticated user is a member of that room. RLS (R-SEC-10) enforces access. Non-member requests MUST receive `404` (not `403`, to avoid confirming room existence).

**Scenarios**:
- **Given** user A is a member of room R **When** user A calls `GET /api/rooms/{R.id}` **Then** the response contains the complete room object including `prize_description`, `scoring_rules`, and `invite_code`.
- **Given** user B is NOT a member of room R **When** user B calls `GET /api/rooms/{R.id}` **Then** the endpoint returns `404`.

### R-ROOMS-04: Owner Membership Invariant
**Type**: NEW
**Source**: proposal §Approach / locked decision #3
**Statement**: The system MUST guarantee that every room has exactly one `room_members` row with `role = 'owner'` corresponding to `rooms.created_by`. This MUST be enforced by the `on_room_created` trigger (see triggers delta, R-TR-23), NOT by application code. If the trigger fails, the entire room INSERT MUST roll back.

**Scenarios**:
- **Given** a room is created successfully **When** the database is queried for `room_members` where `room_id = newRoom.id` AND `role = 'owner'` **Then** exactly one row is returned and its `user_id` equals the room's `created_by`.
- **Given** the `on_room_created` trigger raises an exception (e.g., FK violation) **When** the transaction is evaluated **Then** no room row persists (full rollback).

### R-ROOMS-05: Default Scoring Rules
**Type**: NEW
**Source**: proposal §Capabilities / locked decision #6
**Statement**: A room MUST be created with `scoring_rules` defaulting to `{"exact_score": 5, "correct_goal_diff": 3, "correct_result": 1}` as defined by the DB column default. The create endpoint MUST NOT accept `scoring_rules` from the client payload in this slice — customization is deferred.

**Scenarios**:
- **Given** a client sends `POST /api/rooms` with a `scoring_rules` field in the body **When** Zod validates the payload **Then** the `scoring_rules` field is stripped (or the schema rejects it) and the DB default is used.
- **Given** a room is created without specifying `scoring_rules` **When** the row is inserted **Then** `rooms.scoring_rules` equals `{"exact_score": 5, "correct_goal_diff": 3, "correct_result": 1}`.

### R-ROOMS-06: Prize Description
**Type**: NEW
**Source**: proposal §In Scope / locked decision #1
**Statement**: `rooms.prize_description` MUST be a `TEXT NOT NULL DEFAULT ''` column (added in migration `00005_rooms_slice2.sql`). The create-room Zod schema MUST accept an optional string for `prize_description` (empty string allowed) and pass it to the INSERT. The field MUST be included in list and detail API responses.

**Scenarios**:
- **Given** a user creates a room without specifying `prize_description` **When** the row is inserted **Then** `prize_description` is `''` (empty string, not NULL).
- **Given** a user creates a room with `prize_description = "Pizza para todos"` **When** `GET /api/rooms/[id]` is called **Then** the response includes `prize_description: "Pizza para todos"`.

### R-ROOMS-07: Room Schema Validation
**Type**: NEW
**Source**: proposal §In Scope
**Statement**: `shared/schemas/room.schema.ts` MUST define and export a Zod schema for the room create payload. It MUST validate `name` (string, 1–100 chars, trimmed) and `prize_description` (optional string, max 500 chars, defaults to `''`). It MUST be usable both client-side and server-side (no Node-only imports).

**Scenarios**:
- **Given** `{ name: "Test Room" }` **When** the schema parses it **Then** validation passes and `prize_description` defaults to `''`.
- **Given** `{ name: "" }` **When** the schema parses it **Then** validation fails with an error on `name`.
- **Given** `{ name: "R", prize_description: "x".repeat(501) }` **When** the schema parses it **Then** validation fails with an error on `prize_description`.

## Out of Scope
- Invite code regeneration (locked decision #4).
- `scoring_rules` customization form (locked decision #6 — deferred to slice 4/5).
- Room archival / deletion UI.
- Match list within room detail (`app/pages/rooms/[id]/index.vue` is a stub in this slice).
