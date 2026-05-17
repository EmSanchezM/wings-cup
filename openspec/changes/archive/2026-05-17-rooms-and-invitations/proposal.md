# Proposal: rooms-and-invitations (Slice 2 of 5)

**Date**: 2026-05-15
**Status**: proposed
**Delivery strategy**: `auto-chain` — 2 chained PRs, ~300-500 changed lines combined
**Strict TDD**: ACTIVE (RED-GREEN-REFACTOR; runners: `pnpm test:unit`, `pnpm test:nuxt`)

## Open Questions

None. All six tradeoffs were resolved by the user on 2026-05-15 (see Locked Decisions). Proposal treats them as inputs.

## Intent

Deliver the first user-visible vertical on top of the merged foundation: a logged-in user can create a betting room and share a short, human-friendly invite code; a guest landing on `/join/{code}` sees a public preview, authenticates (magic-link or Google OAuth), and is added to the room atomically. This slice unlocks every downstream slice (matches, predictions, scoring, admin) because nothing else has a target room. It also closes warning **W-03** deferred from foundation by capturing `display_name` on magic-link signup.

## Scope

### In Scope

- Migration `00005_rooms_slice2.sql`: add `prize_description TEXT NOT NULL DEFAULT ''` on `rooms`; create `on_room_created` trigger (AFTER INSERT, SECURITY DEFINER) that inserts the creator into `room_members` with `role='owner'`.
- Server util `generateInviteCode` (6-char base-36 alphanumeric, `crypto.getRandomValues`, retry-on-UNIQUE-conflict, max 3 attempts, no new dependency).
- Zod schemas in `shared/schemas/`: `room.schema.ts` (create payload), `join.schema.ts` (display_name + provider).
- Nitro endpoints: `POST /api/rooms`, `GET /api/rooms`, `GET /api/rooms/[id]`, `GET /api/join/[code]` (public preview via service role), `POST /api/join/[code]` (validate + insert member).
- Pages: `app/pages/rooms/index.vue` (list + create), `app/pages/rooms/[id]/index.vue` (stub for slice 3), `app/pages/join/[code].vue` (public preview + auth choice + display_name capture).
- Composable `useRoom` for client-direct reads (RLS-protected) and create/join calls.
- Post-auth redirect: magic-link uses `emailRedirectTo` with `?next=/join/{code}`; `confirm.vue` reads `next` after PKCE exchange and redirects there before the default `/rooms`.
- Closes **W-03**: magic-link signup now passes `data: { display_name }` to `signInWithOtp` so `handle_new_user` writes a real name.
- Tests: unit (`generateInviteCode`, `room.schema`, `join.schema`) + Nuxt (`join-page`, `rooms` composable, post-auth completion).

### Out of Scope (deferred, do NOT implement here)

- Invite code regeneration / rotation UI (locked decision #4).
- `invitations` table email-invite feature — table sits idle in slice 2 (locked decision #5).
- `scoring_rules` customization in the create form — defaults only (locked decision #6).
- `linkIdentity` (anonymous → registered upgrade) — moves to slice 5 settings page.
- Match list, predictions, leaderboards, admin views — slices 3-5.

## Capabilities

### New Capabilities

- `rooms`: create / list / detail of betting rooms; owner membership invariant; `prize_description` field; default `scoring_rules` shape.
- `invitations`: short human-friendly invite code generation, public preview endpoint, hybrid guest→member join flow, post-auth redirect contract.

### Modified Capabilities

- `database`: new column `rooms.prize_description`; new trigger `on_room_created`; migration `00005_rooms_slice2.sql`.
- `triggers`: register `on_room_created` (AFTER INSERT ON rooms, SECURITY DEFINER) alongside existing `handle_new_user`.
- `auth`: magic-link signup now collects and propagates `display_name` via `data` option; `confirm.vue` honors `?next=` query param after PKCE exchange.
- `security`: confirm RLS policies allow owner self-INSERT into `room_members` from the trigger context (SECURITY DEFINER bypass) and that `/api/join/[code]` GET stays public via service-role client.
- `project-setup`: register new shared schemas, new server utils, new pages — no new runtime dependency.

## Approach

Five moving parts, layered foundation-up:

1. **Migration `00005_rooms_slice2.sql`** — additive: `ALTER TABLE rooms ADD COLUMN prize_description ...` + `CREATE FUNCTION on_room_created` + `CREATE TRIGGER`. Atomic owner membership lives in the database, mirroring `handle_new_user`.
2. **Server utilities + schemas** — `generateInviteCode` (pure, deterministic seam for unit tests) and Zod payload schemas shared between client and server (triple-validation: Zod + RLS + DB constraints).
3. **Nitro endpoints** — writes (`POST /api/rooms`, `POST /api/join/[code]`) go through the server for invite-code generation and member-insert orchestration. The public preview `GET /api/join/[code]` uses `serverSupabaseServiceRole` because RLS blocks non-member reads. Authenticated reads (`GET /api/rooms`, `GET /api/rooms/[id]`) are thin pass-throughs; the composable can also read client-direct since RLS is the source of truth.
4. **Pages + composable** — `rooms/index.vue` for list/create, `join/[code].vue` for the hybrid guest flow (preview → auth choice → display_name for magic-link). `useRoom` composable wraps the calls.
5. **Post-auth redirect mechanism** — `signInWithOtp` builds `emailRedirectTo` as `${origin}/auth/confirm?next=/join/${code}`. `confirm.vue` exchanges the PKCE code, then reads `next` from the URL and routes there (falling back to `/rooms`). No cookie / sessionStorage state required.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `supabase/migrations/00005_rooms_slice2.sql` | New | `prize_description` column + `on_room_created` trigger |
| `shared/schemas/room.schema.ts` | New | Zod schema for room creation |
| `shared/schemas/join.schema.ts` | New | Zod schema for join payload (display_name, provider) |
| `server/utils/invite-code.ts` | New | `generateInviteCode` — base-36, retry-on-conflict |
| `server/api/rooms/{index.post,index.get,[id]/index.get}.ts` | New | Room CRUD endpoints |
| `server/api/join/[code].{get,post}.ts` | New | Public preview + authenticated join |
| `app/pages/rooms/index.vue` | New | List + create UI |
| `app/pages/rooms/[id]/index.vue` | New | Stub for slice 3 |
| `app/pages/join/[code].vue` | Modified | Replace foundation stub with full hybrid flow |
| `app/pages/auth/confirm.vue` | Modified | Honor `?next=` after PKCE exchange |
| `app/composables/useRoom.ts` | New | Client wrapper for room/join calls |
| `tests/unit/{invite-code,room.schema,join.schema}.test.ts` | New | Unit suite (RED first) |
| `tests/nuxt/{join-page,rooms}.test.ts` | New | Nuxt suite (RED first) |

## Locked Decisions (accepted by user 2026-05-15 — DO NOT re-litigate)

1. `prize_description` → new column on `rooms`, `TEXT NOT NULL DEFAULT ''` (migration `00005`).
2. Post-auth redirect for magic-link join → `?next=/join/{code}` query param in `emailRedirectTo`; `confirm.vue` reads it after PKCE exchange and redirects before the default `/rooms`.
3. Owner membership on room create → DB trigger `on_room_created` (AFTER INSERT ON rooms, SECURITY DEFINER) — atomic, mirrors `handle_new_user` pattern.
4. Invite code regeneration → DEFERRED (out of scope for slice 2).
5. `invitations` table email-invite feature → DEFERRED (core join uses `rooms.invite_code` only; `invitations` table sits idle).
6. `scoring_rules` customization in create form → DEFERRED (default-only; UI in slice 4 or 5).

## Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Invite code UNIQUE collision under load | Low | Medium | 6 base-36 chars = 2.18B space; retry-on-conflict (max 3); 409 with clear error after retries exhausted. Unit-test the retry path with mocked collisions. |
| `on_room_created` trigger silently fails, leaving owner outside the room | Low | High | Trigger uses SECURITY DEFINER and runs in same transaction as the INSERT — failure rolls back room creation. Integration test: create room, assert membership row exists with `role='owner'`. |
| `?next=` redirect abused as open redirect | Medium | High | `confirm.vue` validates `next` is a same-origin path matching `/^\/join\/[A-Z0-9]{6}$/`; anything else falls back to `/rooms`. Cover with unit test on the validator. |
| Public preview endpoint leaks data via service role | Medium | High | `/api/join/[code]` returns ONLY `{ roomName, creatorName }` — no member list, no IDs, no settings. Endpoint is GET-only, no auth body parsing. Schema-test the response shape. |
| `display_name` capture re-asks an existing user (already has `display_name` from a previous magic-link) | Low | Low | Form is shown only when `useSupabaseUser()` is null. If user is already authed (slice-3+ flow), join skips straight to POST. |
| Magic-link email arrives slow → user clicks while tab closed → `?next=` lost | Low | Medium | `next` lives in the URL, not session state, so it survives tab close. Documented in join page. |

## Strict TDD Plan

Test order matches the dependency graph (pure → composed):

**Phase A (unit tests, `pnpm test:unit`)** — RED first, then GREEN minimal impl:
1. `generateInviteCode` — format (6 chars, `[A-Z0-9]`), distribution sanity, retry path with mocked collisions.
2. `room.schema` — accepts valid create payloads, rejects bad `prize_description` / `name` lengths and missing fields.
3. `join.schema` — accepts magic-link with `display_name`, accepts OAuth without, rejects empty `display_name` for magic-link.

**Phase B (Nuxt tests, `pnpm test:nuxt`)** — RED first, then GREEN with mocked Supabase:
4. `useRoom` composable — create posts to `/api/rooms`, list returns rows, errors surface.
5. `join/[code]` page — preview renders room name + creator; auth choice toggles `display_name` capture; submission calls correct endpoint.
6. Post-auth completion in `confirm.vue` — given `?next=/join/AB12CD`, redirects there; given malformed `next`, falls back to `/rooms`.

REFACTOR after each GREEN; keep tests green between commits.

## Rollback Plan

- **Migration**: `00005` is additive (new column with default, new trigger). Rollback = `ALTER TABLE rooms DROP COLUMN prize_description; DROP TRIGGER on_room_created ON rooms; DROP FUNCTION on_room_created();` in a hot-fix `00006_rollback_slice2.sql`.
- **App code**: revert the merge commit(s) of PR-1 and/or PR-2. Foundation slice keeps working because all changes are additive (new files, new endpoints, new pages). Modified files (`confirm.vue`, `join/[code].vue`) will revert to the foundation stubs.
- **Data**: rooms created during a partial rollback retain their `prize_description` value (`''` by default), so the column does NOT need to be dropped immediately if only app code is rolled back.

## Dependencies

- Foundation slice merged and archived (commits `74ed497`, `1b09bc3`) — DONE.
- `@nuxtjs/supabase` v2.0.6 already installed — no new runtime dependency.
- `crypto.getRandomValues` — Node 19+ / browser — already required by Nuxt 4 baseline.

## Success Criteria

- [ ] Logged-in user creates a room via `/rooms`; row appears in `rooms` table with `prize_description` set; matching `room_members` row exists with `role='owner'`.
- [ ] Invite code is exactly 6 chars, `[A-Z0-9]`, unique across the table; collision retry path is exercised by unit test.
- [ ] Guest visits `/join/{code}` and sees room name + creator name without authentication.
- [ ] Guest signs in via Google OAuth → lands on `/join/{code}` → membership row created with `role='member'`.
- [ ] Guest signs in via magic-link with `display_name` → email arrives with `?next=/join/{code}` → after PKCE exchange, lands on join page → membership row created → `auth.users.raw_user_meta_data->>'display_name'` reflects the captured name.
- [ ] Open-redirect attempt (`?next=https://evil.com`) falls back to `/rooms`.
- [ ] All new tests pass under `pnpm test:unit` and `pnpm test:nuxt`.
- [ ] Combined diff across PR-1 + PR-2 stays within ~300-500 changed lines (auto-chain).
- [ ] No new runtime dependency added to `package.json`.
