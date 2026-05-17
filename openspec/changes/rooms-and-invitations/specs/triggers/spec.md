# Triggers Spec — Delta for rooms-and-invitations

## Overview

Delta to the `triggers` main spec. Registers the `on_room_created` trigger alongside the existing `handle_new_user` pattern. No existing trigger requirements are modified.

## Requirements

### R-TR-23: `on_room_created` Trigger Function
**Type**: NEW
**Source**: proposal §In Scope / locked decision #3 / §Approach
**Statement**: A PL/pgSQL function `handle_room_created()` MUST be defined in `supabase/migrations/00005_rooms_slice2.sql` with `SECURITY DEFINER`. It MUST insert a row into `public.room_members` with `room_id = NEW.id`, `user_id = NEW.created_by`, `role = 'owner'`, and `joined_at = NOW()`. The function MUST return `NEW`.

**Scenarios**:
- **Given** migration `00005_rooms_slice2.sql` has been applied **When** a new room row is inserted into `public.rooms` **Then** `handle_room_created()` executes within the same transaction and inserts a `room_members` row with `role = 'owner'` and `user_id = rooms.created_by`.
- **Given** `handle_room_created()` raises an exception (e.g., FK constraint failure because `created_by` has no matching profile) **When** the transaction is evaluated **Then** the entire INSERT on `rooms` is rolled back — no orphan room row persists.

### R-TR-24: `on_room_created` Trigger Binding
**Type**: NEW
**Source**: proposal §In Scope / locked decision #3
**Statement**: A trigger named `on_room_created` MUST be bound as `AFTER INSERT ON public.rooms FOR EACH ROW` calling `handle_room_created()`. It MUST be defined in `supabase/migrations/00005_rooms_slice2.sql`. The trigger MUST NOT fire on UPDATE or DELETE.

**Scenarios**:
- **Given** migration `00005_rooms_slice2.sql` has been applied **When** the developer queries `SELECT trigger_name, event_manipulation FROM information_schema.triggers WHERE trigger_name = 'on_room_created'` **Then** a row is returned with `event_manipulation = 'INSERT'`.
- **Given** a room row is UPDATE'd (e.g., `prize_description` is changed) **When** the update executes **Then** no new `room_members` row is inserted (trigger does NOT fire on UPDATE).

### R-TR-25: SECURITY DEFINER Requirement for `handle_room_created`
**Type**: NEW
**Source**: proposal §Risks / §security delta
**Statement**: `handle_room_created()` MUST be declared `SECURITY DEFINER` so that it can INSERT into `room_members` even when the RLS INSERT policy for `room_members` (R-SEC-16) requires `user_id = auth.uid()` — at trigger execution time `auth.uid()` may not be set in the trigger context. SECURITY DEFINER allows the function to execute with its definer's privileges, bypassing the RLS check in that context.

**Scenarios**:
- **Given** a room is created via `POST /api/rooms` using the user-scoped Supabase client **When** `on_room_created` fires **Then** the `room_members` row is inserted successfully without an RLS violation, even though the trigger context does not expose `auth.uid()` as the inserting principal.

## Out of Scope
- Scoring triggers (`on_match_result`, `calculate_points`) — defined in foundation, unchanged.
- `lock_started_predictions` — defined in foundation, unchanged.
- `on_auth_user_created` / `handle_new_user` — defined in foundation; `display_name` capture is handled by the client passing `data: { display_name }` to `signInWithOtp`, not by trigger modification.
