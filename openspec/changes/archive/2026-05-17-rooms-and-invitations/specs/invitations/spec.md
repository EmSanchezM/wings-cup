# Invitations Spec — Delta for rooms-and-invitations

## Overview

New capability. Defines invite-code generation semantics, public room preview, and the hybrid guest→member join flow including post-auth redirect contract and open-redirect protection.

## Requirements

### R-INV-01: Invite Code Format and Uniqueness
**Type**: NEW
**Source**: proposal §In Scope / §Risks (collision)
**Statement**: An invite code MUST be exactly 6 characters drawn from the alphabet `[A-Z0-9]` (base-36 uppercase). Every invite code MUST be unique across all rooms (enforced by the UNIQUE constraint on `rooms.invite_code`). The `generateInviteCode()` utility in `server/utils/invite-code.ts` MUST use `crypto.getRandomValues` (no new runtime dependency) and MUST NOT produce lowercase letters or special characters.

**Scenarios**:
- **Given** `generateInviteCode()` is called **When** it returns a value **Then** the value matches `/^[A-Z0-9]{6}$/`.
- **Given** a room with `invite_code = "AB12CD"` already exists **When** the generator produces `"AB12CD"` again on a first attempt **Then** the collision is detected via a DB UNIQUE violation and the generator retries.

### R-INV-02: Invite Code Collision Retry
**Type**: NEW
**Source**: proposal §In Scope / §Risks (collision)
**Statement**: The room-create server handler MUST retry invite-code generation up to **3 attempts** on UNIQUE constraint conflict. If all 3 attempts collide, the endpoint MUST return `409 { error: "invite_code_conflict" }` and MUST NOT insert the room row.

**Scenarios**:
- **Given** the first 2 generated codes collide with existing rows **When** the third attempt produces a unique code **Then** the room is created successfully with the third code.
- **Given** all 3 generated codes collide **When** the third attempt also fails **Then** the endpoint returns `409` and no room row is inserted.

### R-INV-03: Public Room Preview Endpoint
**Type**: NEW
**Source**: proposal §In Scope / §Risks (data leak)
**Statement**: `GET /api/join/[code]` MUST be accessible without authentication. It MUST use the Supabase service-role client (`serverSupabaseServiceRole`) to bypass RLS. The response MUST contain ONLY `{ roomName: string, creatorName: string, isActive: boolean }`. No other room fields (e.g., `scoring_rules`, `prize_description`, `invite_code` itself) MUST be returned. If no room matches the code, the endpoint MUST return `404`.

**Scenarios**:
- **Given** room R has `invite_code = "XY9Z42"`, `name = "Amigos"`, `status = "active"` and creator has `display_name = "Juan"` **When** an unauthenticated client calls `GET /api/join/XY9Z42` **Then** the response is `200 { roomName: "Amigos", creatorName: "Juan", isActive: true }` with no other fields.
- **Given** no room has `invite_code = "XXXXXX"` **When** `GET /api/join/XXXXXX` is called **Then** the endpoint returns `404`.
- **Given** room R has `status = "archived"` **When** `GET /api/join/{R.invite_code}` is called **Then** `isActive` is `false` (the response still returns `200`; the UI decides whether to block joining).

### R-INV-04: Authenticated Join Endpoint
**Type**: NEW
**Source**: proposal §In Scope
**Statement**: `POST /api/join/[code]` MUST require authentication. It MUST validate the invite code against `rooms`, then insert a `room_members` row with `user_id = auth.uid()` and `role = 'member'`. If the user is already a member of that room, the endpoint MUST return `200` (idempotent, not an error). If the room does not exist or `status != 'active'`, the endpoint MUST return `404`.

**Scenarios**:
- **Given** an authenticated user is NOT a member of room R (code `"AB12CD"`) **When** they call `POST /api/join/AB12CD` **Then** a `room_members` row is inserted with `role = 'member'`, `user_id = auth.uid()`, and the response is `200 { roomId: R.id }`.
- **Given** an authenticated user IS already a member of room R **When** they call `POST /api/join/{R.invite_code}` **Then** no duplicate row is inserted and the response is `200 { roomId: R.id }`.
- **Given** the invite code does not match any room **When** `POST /api/join/BADCODE` is called **Then** the endpoint returns `404`.
- **Given** an unauthenticated request reaches `POST /api/join/[code]` **When** the handler checks the session **Then** the endpoint returns `401`.

### R-INV-05: Magic-Link Signup Captures Display Name
**Type**: NEW
**Source**: proposal §In Scope / §Risks (W-03 closure)
**Statement**: When the join page (`/join/[code].vue`) shows the magic-link signup form to an unauthenticated user, it MUST collect a `display_name` field. The `signInWithOtp` call MUST include `data: { display_name }` so that `handle_new_user` stores it in `raw_user_meta_data` and populates `profiles.display_name`. The `display_name` field MUST NOT be requested if `useSupabaseUser()` returns a non-null user.

**Scenarios**:
- **Given** an unauthenticated user is on `/join/AB12CD` **When** they submit the magic-link form with `email = "user@test.com"` and `display_name = "Pepe"` **Then** `signInWithOtp` is called with `{ email: "user@test.com", options: { emailRedirectTo: "…/auth/confirm?next=/join/AB12CD", data: { display_name: "Pepe" } } }`.
- **Given** an already-authenticated user is on `/join/AB12CD` **When** the page renders **Then** the `display_name` input is NOT shown and the join proceeds directly to `POST /api/join/AB12CD`.
- **Given** a user signs up via magic-link with `display_name = "Pepe"` **When** `handle_new_user` fires **Then** `profiles.display_name = "Pepe"`.

### R-INV-06: Post-Auth Redirect via `?next=`
**Type**: NEW
**Source**: proposal §In Scope / locked decision #2
**Statement**: When the join page triggers magic-link or Google OAuth sign-in, `emailRedirectTo` (or `redirectTo` for OAuth) MUST encode `?next=/join/{code}` appended to the confirm URL. After PKCE exchange, `confirm.vue` MUST read the `next` query parameter and redirect there before falling back to `/rooms`.

**Scenarios**:
- **Given** a user initiates magic-link sign-in from `/join/AB12CD` **When** `signInWithOtp` is called **Then** `emailRedirectTo` equals `<origin>/auth/confirm?next=/join/AB12CD`.
- **Given** the user clicks the email link and lands on `/auth/confirm?next=/join/AB12CD` **When** PKCE exchange succeeds **Then** `confirm.vue` redirects to `/join/AB12CD`.
- **Given** PKCE exchange succeeds and `next` is absent **When** `confirm.vue` processes the redirect **Then** the user is redirected to `/rooms` (existing default fallback).

### R-INV-07: Open-Redirect Protection
**Type**: NEW
**Source**: proposal §Risks (open-redirect)
**Statement**: `confirm.vue` MUST validate the `next` query parameter against the pattern `/^\/join\/[A-Z0-9]{6}$/` before using it as a redirect destination. Any value that does not match MUST be discarded and the fallback `/rooms` MUST be used instead. This validation MUST be implemented in a pure, unit-testable function.

**Scenarios**:
- **Given** `next = "/join/AB12CD"` **When** the validator runs **Then** it returns `true` and `confirm.vue` redirects to `/join/AB12CD`.
- **Given** `next = "https://evil.com"` **When** the validator runs **Then** it returns `false` and `confirm.vue` redirects to `/rooms`.
- **Given** `next = "/rooms"` (valid path but wrong shape) **When** the validator runs **Then** it returns `false` and `confirm.vue` redirects to `/rooms`.
- **Given** `next = "/join/ab12cd"` (lowercase) **When** the validator runs **Then** it returns `false` (pattern requires uppercase).

### R-INV-08: Join Page Hybrid Flow
**Type**: NEW
**Source**: proposal §In Scope / §Approach
**Statement**: `app/pages/join/[code].vue` MUST implement the complete hybrid guest→member flow: (1) always show the public preview (room name, creator name, active status) from `GET /api/join/[code]`; (2) if user is unauthenticated, offer Google OAuth and magic-link sign-in with `display_name` collection; (3) if user is authenticated, immediately call `POST /api/join/[code]` and redirect to `/rooms/{roomId}`. The page MUST be accessible without authentication (route is excluded from the redirect guard).

**Scenarios**:
- **Given** an unauthenticated user navigates to `/join/AB12CD` **When** the page loads **Then** the public preview (room name, creator name) is rendered and sign-in options are visible.
- **Given** an authenticated user navigates to `/join/AB12CD` **When** the page loads **Then** `POST /api/join/AB12CD` is called automatically and the user is redirected to `/rooms/{roomId}`.
- **Given** `GET /api/join/[code]` returns `404` **When** the join page loads **Then** a "Room not found" message is shown and no sign-in form is rendered.

### R-INV-09: Join Schema Validation
**Type**: NEW
**Source**: proposal §In Scope
**Statement**: `shared/schemas/join.schema.ts` MUST define and export a Zod schema for the magic-link join payload. It MUST require `email` (valid email format), `display_name` (string, 1–50 chars, trimmed), and `inviteCode` (exactly 6 chars, `[A-Z0-9]`). It MUST be usable both client-side and server-side.

**Scenarios**:
- **Given** `{ email: "a@b.com", display_name: "Pepe", inviteCode: "AB12CD" }` **When** the schema parses it **Then** validation passes.
- **Given** `{ email: "not-an-email", display_name: "Pepe", inviteCode: "AB12CD" }` **When** the schema parses it **Then** validation fails on `email`.
- **Given** `{ email: "a@b.com", display_name: "", inviteCode: "AB12CD" }` **When** the schema parses it **Then** validation fails on `display_name` (empty string not allowed).
- **Given** `{ email: "a@b.com", display_name: "Pepe", inviteCode: "ab12cd" }` **When** the schema parses it **Then** validation fails on `inviteCode` (lowercase).

## Out of Scope
- Invite code regeneration (locked decision #4 — deferred).
- `invitations` table email-invite feature (locked decision #5 — `invitations` table sits idle in this slice).
- `linkIdentity` anonymous→registered upgrade (slice 5).
- Invitation expiry or single-use enforcement (not in scope for slice 2 — code-based join uses `rooms.invite_code` which has no expiry).
