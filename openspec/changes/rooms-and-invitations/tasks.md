# Tasks: rooms-and-invitations (Slice 2)

**Date**: 2026-05-15
**Delivery strategy**: `auto-chain` — 2 chained PRs
**Strict TDD**: ACTIVE (RED → GREEN → REFACTOR)
**Test commands**: `pnpm test:unit` (unit project) | `pnpm test:nuxt` (Nuxt project)

---

## Review Workload Forecast

| Metric | Value |
|--------|-------|
| Estimated changed lines (PR-1) | ~260 |
| Estimated changed lines (PR-2) | ~220 |
| Combined | ~480 |
| Chained PRs recommended | Yes |
| 400-line budget risk | Medium |
| Decision needed before apply | No |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: Medium

### Work Units

| Unit | Goal | Branch | Base |
|------|------|--------|------|
| PR-1 | Migration + server utils + schemas + 5 Nitro endpoints + unit tests | `feat/rooms-schema-and-server` | `main` |
| PR-2 | Pages + composable + auth modifications + Nuxt tests | `feat/rooms-and-join-pages` | `main` (after PR-1 merged) |

---

## PR-1: `feat/rooms-schema-and-server`

### B1 — Migration (MIGRATION)

- [ ] T-01: Write migration `00005_rooms_slice2.sql` with ADD COLUMN, CREATE FUNCTION on_room_created, CREATE TRIGGER [MIGRATION] (R-DB-30, R-DB-31, R-TR-23, R-TR-24, R-TR-25, R-SEC-40)
  - File(s): `supabase/migrations/00005_rooms_slice2.sql`, `supabase/migrations/00006_rollback_slice2.sql`
  - Acceptance: `supabase db push` succeeds locally; `rooms` table has `prize_description`; `room_members` trigger function exists

- [ ] T-02: Regenerate TypeScript types after migration [MIGRATION] (R-DB-30, R-DB-31, R-PS-25)
  - File(s): `shared/types/database.types.ts`
  - Acceptance: `pnpm gen-types` completes without error; `Tables<'rooms'>` includes `prize_description: string`

- [ ] T-03: Add `shared/types/rooms.ts` — re-export Room, RoomMember, define RoomListItem, RoomPreview, re-export Zod-derived types [CHORE] (R-PS-25, R-ROOMS-01, R-INV-03)
  - File(s): `shared/types/rooms.ts`
  - Acceptance: File compiles; `Room`, `RoomMember`, `RoomListItem`, `RoomPreview` importable from `~~/shared/types/rooms`

### B2 — generateInviteCode (RED → GREEN → REFACTOR)

- [ ] T-04: Write failing unit tests for `generateInviteCode` — format, charset, length, collision retry (mock client) [RED] (R-INV-01, R-INV-02, R-PS-29)
  - File(s): `tests/unit/invite-code.test.ts`
  - Acceptance: `pnpm test:unit` runs the new describe block; all assertions FAIL (RED)

- [ ] T-05: Implement `generateInviteCode` and `InviteCodeCollisionError` to make tests pass [GREEN] (R-INV-01, R-INV-02, R-PS-26)
  - File(s): `server/utils/invite-code.ts`
  - Acceptance: `pnpm test:unit` — all T-04 tests PASS

- [ ] T-06: Refactor `invite-code.ts` — extract `buildCandidate` pure function; no behaviour change [REFACTOR] (R-INV-01, R-INV-02)
  - File(s): `server/utils/invite-code.ts`
  - Acceptance: `pnpm test:unit` still passes; `buildCandidate` is exported and testable in isolation

### B3 — Zod Schemas (RED → GREEN → REFACTOR)

- [ ] T-07: Write failing unit tests for `room.schema` — accept valid, reject missing name, reject over-length [RED] (R-ROOMS-07, R-PS-25, R-PS-29)
  - File(s): `tests/unit/room.schema.test.ts`
  - Acceptance: `pnpm test:unit` runs; assertions FAIL (RED)

- [ ] T-08: Implement `shared/schemas/room.schema.ts` (`CreateRoomInput` Zod schema) [GREEN] (R-ROOMS-07, R-ROOMS-06, R-PS-25)
  - File(s): `shared/schemas/room.schema.ts`
  - Acceptance: `pnpm test:unit` — T-07 tests PASS

- [ ] T-09: Write failing unit tests for `join.schema` — magic_link requires display_name; oauth does not [RED] (R-INV-09, R-INV-05, R-PS-29)
  - File(s): `tests/unit/join.schema.test.ts`
  - Acceptance: `pnpm test:unit` runs; assertions FAIL (RED)

- [ ] T-10: Implement `shared/schemas/join.schema.ts` (discriminated union on `provider`) [GREEN] (R-INV-09, R-INV-05, R-PS-25)
  - File(s): `shared/schemas/join.schema.ts`
  - Acceptance: `pnpm test:unit` — T-09 tests PASS

- [ ] T-11: Refactor both schemas — consolidate common field definitions; no behaviour change [REFACTOR] (R-ROOMS-07, R-INV-09)
  - File(s): `shared/schemas/room.schema.ts`, `shared/schemas/join.schema.ts`
  - Acceptance: `pnpm test:unit` still passes

### B4 — POST /api/rooms (RED → GREEN → REFACTOR)

- [ ] T-12: Write failing Nuxt test for `POST /api/rooms` — 201 with valid body; 400 on invalid; 401 when unauthenticated [RED] (R-ROOMS-01, R-ROOMS-04, R-ROOMS-05, R-ROOMS-06, R-PS-29)
  - File(s): `tests/nuxt/rooms-api.test.ts`
  - Acceptance: `pnpm test:nuxt` runs the new describe block; assertions FAIL (RED)

- [ ] T-13: Implement `server/api/rooms/index.post.ts` — Zod parse, generateInviteCode, Supabase insert (user-context client), return created room [GREEN] (R-ROOMS-01, R-ROOMS-04, R-ROOMS-05, R-ROOMS-06, R-SEC-40)
  - File(s): `server/api/rooms/index.post.ts`
  - Acceptance: `pnpm test:nuxt` — T-12 POST tests PASS

- [ ] T-14: Refactor `index.post.ts` — extract error-handling into shared pattern; no behaviour change [REFACTOR] (R-ROOMS-01)
  - File(s): `server/api/rooms/index.post.ts`
  - Acceptance: `pnpm test:nuxt` still passes

### B5 — GET /api/rooms and GET /api/rooms/[id] (RED → GREEN → REFACTOR)

- [ ] T-15: Write failing Nuxt tests for `GET /api/rooms` (returns list) and `GET /api/rooms/[id]` (returns detail; 404 on unknown) [RED] (R-ROOMS-02, R-ROOMS-03, R-PS-29)
  - File(s): `tests/nuxt/rooms-api.test.ts` (same file, new describe blocks)
  - Acceptance: `pnpm test:nuxt` — new assertions FAIL (RED)

- [ ] T-16: Implement `server/api/rooms/index.get.ts` — user-context client, select rooms user is member of, return `RoomListItem[]` [GREEN] (R-ROOMS-02)
  - File(s): `server/api/rooms/index.get.ts`
  - Acceptance: `pnpm test:nuxt` — GET list tests PASS

- [ ] T-17: Implement `server/api/rooms/[id]/index.get.ts` — user-context client, select single room + members, 404 if not found [GREEN] (R-ROOMS-03)
  - File(s): `server/api/rooms/[id]/index.get.ts`
  - Acceptance: `pnpm test:nuxt` — GET detail tests PASS

- [ ] T-18: Refactor GET handlers — shared query helper; no behaviour change [REFACTOR] (R-ROOMS-02, R-ROOMS-03)
  - File(s): `server/api/rooms/index.get.ts`, `server/api/rooms/[id]/index.get.ts`
  - Acceptance: `pnpm test:nuxt` still passes

### B6 — GET /api/join/[code] (RED → GREEN → REFACTOR)

- [ ] T-19: Write failing Nuxt test for `GET /api/join/[code]` — response shape is ONLY `{roomName, creatorName, isActive}`; 404 on unknown code [RED] (R-INV-03, R-SEC-41, R-PS-29)
  - File(s): `tests/nuxt/join-api.test.ts`
  - Acceptance: `pnpm test:nuxt` — assertions FAIL (RED); critically the schema-shape test must fail if extra fields present

- [ ] T-20: Implement `server/api/join/[code].get.ts` — service-role client, hand-built projection `{roomName, creatorName, isActive}`, no RLS bypass risk [GREEN] (R-INV-03, R-SEC-41)
  - File(s): `server/api/join/[code].get.ts`
  - Acceptance: `pnpm test:nuxt` — T-19 tests PASS; extra-fields assertion passes

- [ ] T-21: Refactor `[code].get.ts` — guard against future accidental spread with type-level assertion [REFACTOR] (R-INV-03, R-SEC-41)
  - File(s): `server/api/join/[code].get.ts`
  - Acceptance: `pnpm test:nuxt` still passes

### B7 — POST /api/join/[code] (RED → GREEN → REFACTOR)

- [ ] T-22: Write failing Nuxt tests for `POST /api/join/[code]` — 200 on valid join; 409 already member; 403 unauthenticated; discriminated body (magic_link vs oauth) [RED] (R-INV-04, R-INV-05, R-INV-09, R-AUTH-23, R-PS-29)
  - File(s): `tests/nuxt/join-api.test.ts` (same file)
  - Acceptance: `pnpm test:nuxt` — new assertions FAIL (RED)

- [ ] T-23: Implement `server/api/join/[code].post.ts` — parse `JoinPayload`, service-role lookup, user-context insert into `room_members`, handle 409 duplicate [GREEN] (R-INV-04, R-INV-05, R-INV-09, R-AUTH-23)
  - File(s): `server/api/join/[code].post.ts`
  - Acceptance: `pnpm test:nuxt` — T-22 tests PASS

- [ ] T-24: Refactor `[code].post.ts` — extract member-insert helper for reuse in slice 3; no behaviour change [REFACTOR] (R-INV-04)
  - File(s): `server/api/join/[code].post.ts`
  - Acceptance: `pnpm test:nuxt` still passes

### B8 — PR-1 Wrap-Up (CHORE)

- [ ] T-25: Run full test suite; verify `pnpm test:unit` and `pnpm test:nuxt` both GREEN; confirm no new runtime dependency in `package.json` [CHORE] (R-PS-24, R-PS-29)
  - File(s): (no changes)
  - Acceptance: Zero failures; `package.json` unchanged

---

## PR-2: `feat/rooms-and-join-pages`

### B9 — confirm.vue ?next= (RED → GREEN → REFACTOR)

- [ ] T-26: Write failing Nuxt test for `confirm.vue` — `?next=/join/AB12CD` redirects to `/join/AB12CD`; malformed next falls back to `/rooms`; no-next-param still redirects to `/rooms` (regression guard) [RED] (R-AUTH-07, R-AUTH-24, R-INV-06, R-INV-07, R-SEC-42, R-PS-29)
  - File(s): `tests/nuxt/confirm-next.test.ts`
  - Acceptance: `pnpm test:nuxt` — all assertions FAIL (RED)

- [ ] T-27: Modify `app/pages/auth/confirm.vue` — after PKCE exchange, read `next` query param, validate against `/^\\/join\\/[A-Z0-9]{6}$/`, redirect or fallback to `/rooms` [GREEN] (R-AUTH-07, R-AUTH-24, R-INV-06, R-INV-07, R-SEC-42)
  - File(s): `app/pages/auth/confirm.vue`
  - Acceptance: `pnpm test:nuxt` — T-26 tests PASS; ~8-line diff

- [ ] T-28: Refactor `confirm.vue` — extract `isSafeNext(url)` as importable util; add `is-safe-next.test.ts` unit test for threat vectors [REFACTOR] (R-INV-07, R-SEC-42)
  - File(s): `app/utils/is-safe-next.ts`, `tests/unit/is-safe-next.test.ts`
  - Acceptance: `pnpm test:unit` and `pnpm test:nuxt` both pass; absolute URL, protocol-relative, path traversal, lowercase code all rejected

### B10 — useRoom Composable (RED → GREEN → REFACTOR)

- [ ] T-29: Write failing Nuxt test for `useRoom` — `createRoom()` POSTs to `/api/rooms`; `fetchRooms()` returns list; `fetchRoom(id)` returns detail; errors surface via `error` ref [RED] (R-ROOMS-01, R-ROOMS-02, R-ROOMS-03, R-PS-28, R-PS-29)
  - File(s): `tests/nuxt/use-room.test.ts`
  - Acceptance: `pnpm test:nuxt` — assertions FAIL (RED); composable must be initialised inside `beforeAll` per Vitest v4 contract

- [ ] T-30: Implement `app/composables/useRoom.ts` — 5 typed exports: `createRoom`, `fetchRooms`, `fetchRoom`, `room` (ref), `error` (ref) [GREEN] (R-ROOMS-01, R-ROOMS-02, R-ROOMS-03, R-PS-28)
  - File(s): `app/composables/useRoom.ts`
  - Acceptance: `pnpm test:nuxt` — T-29 tests PASS

- [ ] T-31: Refactor `useRoom.ts` — tighten TypeScript generics; add JSDoc for public API; no behaviour change [REFACTOR] (R-ROOMS-01, R-ROOMS-02, R-ROOMS-03)
  - File(s): `app/composables/useRoom.ts`
  - Acceptance: `pnpm test:nuxt` still passes

### B11 — rooms/index.vue (RED → GREEN → REFACTOR)

- [ ] T-32: Write failing Nuxt test for `app/pages/rooms/index.vue` — renders room list; shows create-form; on submit calls `createRoom` and navigates [RED] (R-ROOMS-01, R-ROOMS-02, R-ROOMS-05, R-ROOMS-06, R-ROOMS-07, R-PS-27, R-PS-29)
  - File(s): `tests/nuxt/rooms-page.test.ts`
  - Acceptance: `pnpm test:nuxt` — assertions FAIL (RED)

- [ ] T-33: Implement `app/pages/rooms/index.vue` — list + create form; uses `useRoom`; Zod validation for `CreateRoomInput` [GREEN] (R-ROOMS-01, R-ROOMS-02, R-ROOMS-05, R-ROOMS-06, R-ROOMS-07)
  - File(s): `app/pages/rooms/index.vue`
  - Acceptance: `pnpm test:nuxt` — T-32 tests PASS

- [ ] T-34: Refactor `rooms/index.vue` — extract `<RoomCard>` and `<CreateRoomForm>` as components; no behaviour change [REFACTOR] (R-ROOMS-01, R-ROOMS-02)
  - File(s): `app/components/rooms/RoomCard.vue`, `app/components/rooms/CreateRoomForm.vue`, `app/pages/rooms/index.vue`
  - Acceptance: `pnpm test:nuxt` still passes

### B12 — rooms/[id]/index.vue stub (RED → GREEN → REFACTOR)

- [ ] T-35: Write failing Nuxt test for `app/pages/rooms/[id]/index.vue` — renders room name from `useRoom`; shows "coming soon" placeholder for predictions [RED] (R-ROOMS-03, R-PS-27, R-PS-29)
  - File(s): `tests/nuxt/rooms-page.test.ts` (same file, new describe)
  - Acceptance: `pnpm test:nuxt` — assertions FAIL (RED)

- [ ] T-36: Implement `app/pages/rooms/[id]/index.vue` as slice-3 stub — fetch + display room detail; placeholder section for predictions [GREEN] (R-ROOMS-03)
  - File(s): `app/pages/rooms/[id]/index.vue`
  - Acceptance: `pnpm test:nuxt` — T-35 tests PASS

### B13 — join/[code].vue (RED → GREEN → REFACTOR)

- [ ] T-37: Write failing Nuxt test for `app/pages/join/[code].vue` — preview renders `{roomName, creatorName}`; auth-choice shown; magic_link branch shows display_name field; oauth branch hides it; submit calls `POST /api/join/[code]` [RED] (R-INV-03, R-INV-05, R-INV-06, R-INV-08, R-INV-09, R-AUTH-23, R-AUTH-13, R-SEC-41, R-PS-27, R-PS-29)
  - File(s): `tests/nuxt/join-page.test.ts`
  - Acceptance: `pnpm test:nuxt` — assertions FAIL (RED)

- [ ] T-38: Implement `app/pages/join/[code].vue` — replace foundation stub; call `GET /api/join/[code]`; auth choice (OAuth btn / magic-link form); `display_name` field only when unauthenticated + magic_link; pass `?next=/join/{code}` in `emailRedirectTo` [GREEN] (R-INV-03, R-INV-05, R-INV-06, R-INV-08, R-INV-09, R-AUTH-23, R-AUTH-13, R-SEC-41)
  - File(s): `app/pages/join/[code].vue`
  - Acceptance: `pnpm test:nuxt` — T-37 tests PASS

- [ ] T-39: Refactor `join/[code].vue` — split auth-choice into `<JoinAuthChoice>` component; no behaviour change [REFACTOR] (R-INV-08)
  - File(s): `app/components/join/JoinAuthChoice.vue`, `app/pages/join/[code].vue`
  - Acceptance: `pnpm test:nuxt` still passes

### B14 — PR-2 Wrap-Up (CHORE)

- [ ] T-40: Run full test suite (`pnpm test:unit` + `pnpm test:nuxt`); verify GREEN; confirm `package.json` no new runtime dep [CHORE] (R-PS-24, R-PS-29)
  - File(s): (no changes)
  - Acceptance: Zero failures

- [ ] T-41: Manual smoke in browser — create room, copy invite link, open incognito, preview, sign in via magic-link, confirm redirect lands on room page [CHORE] (R-INV-06, R-INV-08, R-AUTH-24)
  - File(s): (no changes)
  - Acceptance: Full happy path works end-to-end; orchestrator surfaces this to user before merge

---

## Coverage Matrix

| Requirement | Task(s) |
|-------------|---------|
| R-ROOMS-01 | T-12, T-13, T-14, T-29, T-30, T-32, T-33 |
| R-ROOMS-02 | T-15, T-16, T-18, T-29, T-30, T-31, T-32, T-33 |
| R-ROOMS-03 | T-15, T-17, T-18, T-29, T-30, T-31, T-35, T-36 |
| R-ROOMS-04 | T-12, T-13 |
| R-ROOMS-05 | T-12, T-13, T-32, T-33 |
| R-ROOMS-06 | T-08, T-12, T-13, T-32, T-33 |
| R-ROOMS-07 | T-07, T-08, T-11, T-32, T-33 |
| R-INV-01 | T-04, T-05, T-06 |
| R-INV-02 | T-04, T-05, T-06 |
| R-INV-03 | T-19, T-20, T-21, T-37, T-38 |
| R-INV-04 | T-22, T-23, T-24 |
| R-INV-05 | T-09, T-10, T-22, T-23, T-37, T-38 |
| R-INV-06 | T-26, T-27, T-37, T-38 |
| R-INV-07 | T-26, T-27, T-28 |
| R-INV-08 | T-37, T-38, T-39 |
| R-INV-09 | T-09, T-10, T-22, T-23, T-37, T-38 |
| R-DB-30 | T-01, T-02, T-03 |
| R-DB-31 | T-01, T-02 |
| R-TR-23 | T-01 |
| R-TR-24 | T-01 |
| R-TR-25 | T-01 |
| R-AUTH-23 | T-22, T-23, T-37, T-38 |
| R-AUTH-24 | T-26, T-27 |
| R-AUTH-13 | T-37, T-38 |
| R-AUTH-07 | T-26, T-27 |
| R-SEC-40 | T-01, T-13 |
| R-SEC-41 | T-19, T-20, T-21, T-37, T-38 |
| R-SEC-42 | T-26, T-27, T-28 |
| R-PS-24 | T-25, T-40 |
| R-PS-25 | T-02, T-08, T-10 |
| R-PS-26 | T-05 |
| R-PS-27 | T-33, T-36, T-38 |
| R-PS-28 | T-29, T-30 |
| R-PS-29 | T-04, T-07, T-09, T-12, T-15, T-19, T-22, T-25, T-26, T-29, T-32, T-35, T-37, T-40 |

**Coverage**: 32/32 requirements covered (100%).

---

## Rollback Notes

- **Migration rollback**: `supabase/migrations/00006_rollback_slice2.sql` drops the trigger, trigger function, and `prize_description` column. Apply after hotfix window. Existing rooms keep `prize_description=''` if only app code reverts.
- **PR-1 rollback**: Revert `feat/rooms-schema-and-server` merge commit. Migration must be rolled back separately before revering app code. No PR-2 pages depend on PR-1 until it merges.
- **PR-2 rollback**: Revert `feat/rooms-and-join-pages` merge commit. `confirm.vue` and `join/[code].vue` revert to foundation stubs. Foundation flow unaffected (additive only).
- **Task-level**: If B6 (T-19–T-21) fails, drop `server/api/join/[code].get.ts` — no DB change involved. If B9 (T-26–T-28) fails, revert only `confirm.vue` 8-line diff — `confirm.vue` regression is isolated.

---

## Out-of-Scope Reminders (do NOT implement in sdd-apply)

- Invite code regeneration UI (deferred — locked decision #4)
- `invitations` table email-invite feature (deferred — locked decision #5; table sits idle)
- `scoring_rules` customization in create form (deferred — locked decision #6; defaults only)
- `linkIdentity` anonymous→registered upgrade (deferred — slice 5)
- Match list, predictions, leaderboards, admin views (slices 3–5)
- DB integration test for `on_room_created` trigger (deferred — no Supabase test helper yet)
