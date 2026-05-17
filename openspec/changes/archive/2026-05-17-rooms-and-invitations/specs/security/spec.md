# Security Spec — Delta for rooms-and-invitations

## Overview

Delta to the `security` main spec. Adds three security requirements: (1) SECURITY DEFINER bypass for the owner-insert trigger; (2) service-role usage for the public preview endpoint; (3) open-redirect validation on `?next=`. No existing RLS policies are changed.

## Requirements

### R-SEC-40: SECURITY DEFINER Trigger Bypass Is Intentional
**Type**: NEW
**Source**: proposal §Risks / §security / locked decision #3
**Statement**: The `on_room_created` trigger MUST execute as `SECURITY DEFINER` to insert into `room_members` without being blocked by the RLS INSERT policy (R-SEC-16). This bypass is intentional and auditable: it is scoped to a single, reviewed trigger function (`handle_room_created`) and performs only the owner-membership insert. No authenticated-role user can invoke this bypass directly — it fires exclusively on INSERT into `rooms`.

**Scenarios**:
- **Given** an authenticated user calls `POST /api/rooms` using the user-scoped client **When** `on_room_created` fires in the same transaction **Then** the `room_members` INSERT succeeds despite RLS requiring `user_id = auth.uid()` — the trigger's `SECURITY DEFINER` context allows it.
- **Given** a direct SQL attempt by an authenticated user to call `handle_room_created()` manually **When** the function is invoked outside a trigger context **Then** it MUST NOT produce a useful side-effect because `NEW` is only available inside a trigger — direct invocation is inoperable.

### R-SEC-41: Public Preview Endpoint Uses Service Role (Read-Only)
**Type**: NEW
**Source**: proposal §In Scope / §Risks (data leak)
**Statement**: `GET /api/join/[code]` MUST use `serverSupabaseServiceRole` (Supabase service-role client) to read the room. This is necessary because unauthenticated users have no RLS-granted SELECT on `rooms`. The service-role client MUST only be used in this endpoint and MUST NOT return any fields beyond `{ roomName, creatorName, isActive }`. The endpoint MUST be HTTP GET only — no state-mutating methods are accepted.

**Scenarios**:
- **Given** an unauthenticated request arrives at `GET /api/join/[code]` **When** the handler runs **Then** the service-role client queries `rooms` by `invite_code`, and the response body is strictly `{ roomName: string, creatorName: string, isActive: boolean }` with no additional fields.
- **Given** the endpoint receives a `POST` request **When** the Nitro router evaluates the method **Then** it returns `405 Method Not Allowed`.
- **Given** a room's `scoring_rules`, `prize_description`, or `invite_code` fields would be returned in a full SELECT **When** `GET /api/join/[code]` responds **Then** those fields MUST NOT appear in the JSON body.

### R-SEC-42: Open-Redirect Protection on `?next=`
**Type**: NEW
**Source**: proposal §Risks (open-redirect)
**Statement**: The `?next=` query parameter used by `confirm.vue` (R-AUTH-24) MUST be validated against the same-origin allowlist pattern `/^\/join\/[A-Z0-9]{6}$/` before use as a redirect destination. Any value that: (a) is an absolute URL, (b) contains `://` or starts with `//`, (c) contains path traversal (`..`), or (d) does not match the allowed pattern MUST be rejected and replaced with `/rooms`. This validation MUST be implemented as a pure, side-effect-free function that is independently unit-testable.

**Scenarios**:
- **Given** `next = "/join/AB12CD"` **When** the validation function is called **Then** it returns `"/join/AB12CD"` (the input, unchanged).
- **Given** `next = "https://evil.com/steal"` **When** the validation function is called **Then** it returns `"/rooms"` (fallback).
- **Given** `next = "//evil.com"` **When** the validation function is called **Then** it returns `"/rooms"` (protocol-relative URL rejected).
- **Given** `next = "/join/../admin"` **When** the validation function is called **Then** it returns `"/rooms"` (path traversal rejected).
- **Given** `next = "/join/ab12cd"` (lowercase) **When** the validation function is called **Then** it returns `"/rooms"` (pattern requires `[A-Z0-9]`).

## Out of Scope
- Invitation token validation logic (the `invitations` table is idle in this slice; token-based invitations are a future feature).
- Column-level grants — RLS policies remain the primary enforcement mechanism.
- Admin panel endpoint security (slice 5).
- CORS configuration — handled by Nitro defaults; no custom headers needed for these endpoints.
