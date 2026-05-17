# Exploration: rooms-and-invitations (Slice 2 of 5)

**Date**: 2026-05-15
**Status**: complete
**Engram**: `sdd/rooms-and-invitations/explore` (observation #144)

## Recommendation

Use `rooms.invite_code` as the join URL mechanism (permanent, no expiry). Generate codes server-side with base-36 crypto (no new dependency, retry-on-conflict). Expose ONE public-safe Nitro preview endpoint (`GET /api/join/[code]`) using `serverSupabaseServiceRole` so non-members can see room name + creator before logging in. Collect `display_name` in the join form for magic-link users only — closes W-03 deferred from foundation. Fix the post-auth redirect by encoding the invite code into the magic-link `emailRedirectTo` as `?next=/join/{code}` and reading it in `confirm.vue`. Use a `SECURITY DEFINER` DB trigger `on_room_created` for atomic owner membership creation. Defer `linkIdentity` (guest → registered upgrade UI) to slice 5. Add `prize_description` via migration `00005`.

**Strict TDD active**: write failing unit tests for `generateInviteCode` and Zod schemas FIRST, then failing Nuxt tests for the join page BEFORE implementing it. RED → GREEN → REFACTOR.

---

## Current State (verified against actual code)

What foundation delivered, directly relevant to this slice:

- `rooms` table: `id`, `name`, `invite_code TEXT NOT NULL UNIQUE`, `status CHECK('active','closed')`, `scoring_rules JSONB DEFAULT '{"exact_score":5,...}'`, `created_by`, `created_at`. **No `prize_description` column.**
- `invitations` table: `id`, `room_id`, `token TEXT NOT NULL UNIQUE`, `email` (optional), `created_by`, `used_by_user_id`, `expires_at` (7d default), `used_at`. Separate from `rooms.invite_code`.
- `room_members`: composite PK `(room_id, user_id)`, `role CHECK('owner','member')` (default `'member'`), `total_points`, `joined_at`. REPLICA IDENTITY FULL set.
- RLS on `rooms` SELECT: members-only (`EXISTS room_members`) + super-admin. No public-read path. A non-member CANNOT read the room from the client.
- RLS on `invitations` SELECT: owner-only. No token-bearer public read (foundation design §16 decision: server-side only).
- RLS on `room_members` INSERT: `user_id = auth.uid()` only. Token validation is APPLICATION-LAYER.
- `handle_new_user` trigger reads `raw_user_meta_data->>'display_name'` (fallback chain: `full_name` → `name` → email prefix). Works for magic-link IF the OTP `data` object includes `display_name`.
- **W-03 (foundation verify, deferred)**: `login.vue` sends OTP WITHOUT `data: { display_name }`. The join page (this slice) is the designated fix point.
- W-01/W-02 (super-admin SELECT): RESOLVED via `00004_admin_rls.sql`.
- Auth providers live: Google OAuth (`is_guest=false`) + Magic Link (`is_guest=true`).
- `/join/[code].vue` is a stub — excluded from redirect guard via `redirectOptions.exclude: ['/join/*']`.
- `server/utils/auth.ts`: `requireCronSecret` and `requireSuperAdmin` established. Pattern: `serverSupabaseServiceRole(event)`.
- shadcn-vue: `Button` and `Input` components available. No Form, Dialog, Card, or Sheet yet.
- Test infra: Vitest v4, `pnpm test:unit` (unit project, node env) + `pnpm test:nuxt` (nuxt env with Nuxt runtime).

**Critical gap**: `prize_description` — mentioned in the v0 design memo AND in the slice scope, but **absent from `00001_schema.sql`**. Needs migration.

**Two join mechanisms in the schema:**
1. `rooms.invite_code` — short 6-char human-friendly code, on the room itself, used in `/join/{code}` URL. Permanent.
2. `invitations.token` — longer UUID-style token in a dedicated table, with optional `email` pre-fill, `expires_at` (7d), `used_by_user_id`. Per-person invite auditing.

---

## Affected Areas

| File/Path | Status | Reason |
|-----------|--------|--------|
| `supabase/migrations/00005_rooms_slice2.sql` | NEW | Add `prize_description TEXT`, `on_room_created` owner trigger |
| `shared/schemas/room.schema.ts` | NEW | Zod: create-room input |
| `shared/schemas/join.schema.ts` | NEW | Zod: invite code format (6 chars, A-Z0-9) |
| `server/utils/invite-code.ts` | NEW | `generateInviteCode()` pure function |
| `server/api/rooms/index.post.ts` | NEW | Create room (Nitro, generates code, inserts row) |
| `server/api/rooms/index.get.ts` | NEW | List my rooms (RLS filters) |
| `server/api/rooms/[id]/index.get.ts` | NEW | Room detail for members |
| `server/api/join/[code].get.ts` | NEW | Public preview: `{roomName, creatorName}` via service role |
| `server/api/join/[code].post.ts` | NEW | Join: validate code + insert room_member |
| `app/pages/rooms/index.vue` | NEW | Rooms list page |
| `app/pages/rooms/[id]/index.vue` | NEW | Room detail (stub for slice 3) |
| `app/pages/join/[code].vue` | REPLACE | Full join flow |
| `app/pages/auth/confirm.vue` | EDIT | Read `?next=` query param after PKCE exchange |
| `app/pages/auth/login.vue` | EDIT | Pass `data: { display_name }` only when from join flow |
| `app/composables/useRoom.ts` | NEW | Room CRUD composable |
| `shared/types/database.types.ts` | REGENERATE | After migration |
| `tests/unit/invite-code.test.ts` | NEW | Strict TDD |
| `tests/unit/room.schema.test.ts` | NEW | Strict TDD |
| `tests/nuxt/join-page.test.ts` | NEW | Strict TDD |
| `tests/nuxt/rooms.test.ts` | NEW | Strict TDD |

---

## Approaches Compared

### Decision 1: `prize_description` — add or drop?

| Approach | Pros | Cons | Effort |
|----------|------|------|--------|
| A. Migration `00005` adds column | Matches intent; core UX feature ("12 alitas BBQ") | One migration, re-gen types | Low |
| B. Drop from scope | No schema change | Kills the soul of the product | Low |
| C. Store in `scoring_rules` JSONB | No column | Semantically wrong | Medium (bad) |

**Recommendation: A.** `prize_description` is THE defining feature of the app per the v0 memo. Suggest `TEXT NOT NULL DEFAULT ''`.

### Decision 2: Invite code generation

| Approach | Pros | Cons | Effort |
|----------|------|------|--------|
| A. `crypto.randomBytes(3).toString('hex').toUpperCase()` — hex only | Built-in, always 6 chars | Only A-F letters | Low |
| B. Custom base-36 from `crypto.getRandomValues` | Full A-Z0-9, ~2.1B combos, verbal-safe | Tiny custom code | Low |
| C. nanoid with custom alphabet | Battle-tested | New dependency | Low |
| D. Word-list ("blue-fox-42") | Memorable | Length mismatch vs. AB12CD spec | Medium |

**Recommendation: B.** 36^6 ≈ 2.1B combos. Retry on UNIQUE conflict (max 3). Store uppercase; compare case-insensitively.

### Decision 3: Join page preview (pre-auth)

| Approach | Pros | Cons | Effort |
|----------|------|------|--------|
| A. Server endpoint with service role returns `{roomName, creatorName}` | Good UX | One extra endpoint | Low |
| B. Generic "You've been invited!" without info | Simple | Poor UX | Low |
| C. Client reads room after auth | No endpoint | Complex redirect dance, breaks magic-link | Medium |

**Recommendation: A.** `GET /api/join/[code]` — no auth required, exposes only `{ roomName, creatorName, isActive }`.

### Decision 4: `display_name` capture

| Approach | Pros | Cons | Effort |
|----------|------|------|--------|
| A. Join form collects `display_name`, passes via `data: { display_name }` in `signInWithOtp` | Closes W-03 | Only for new magic-link users in join flow | Low |
| B. Post-auth onboarding step for all users | Catches all cases | Extra page; redirect complexity | Medium |

**Recommendation: A.** Join form shows `display_name` only when user picks magic-link. Google OAuth gets name from Google metadata. Returning users keep existing `display_name` (trigger only fires on new INSERT).

### Decision 5: Post-auth redirect for magic-link join (CRITICAL)

The join page `/join/AB12CD` is excluded from the redirect guard. When a user submits magic-link from the join page, they click the email link, land at `/auth/confirm`, and the module's default redirect goes to `/rooms` — **the join is LOST**.

| Approach | Pros | Cons | Effort |
|----------|------|------|--------|
| A. `emailRedirectTo: '/auth/confirm?next=/join/AB12CD'` — `confirm.vue` reads `?next=` and redirects there before finalizing | Simple; no extra storage | `confirm.vue` must read `?next=` | Low |
| B. `sessionStorage` before OTP | Same-tab only | Breaks if user opens magic link in another browser | Low |
| C. Cookie | Survives cross-tab | Cookie management complexity | Medium |
| D. Custom OTP redirect to dedicated endpoint | Atomic server-side | Endpoint complexity, allowed-URLs config | High |

**Recommendation: A.** Standard Next.js/Nuxt pattern. Trivial to implement and test.

### Decision 6: Owner membership creation

| Approach | Pros | Cons | Effort |
|----------|------|------|--------|
| A. App-layer: Nitro endpoint does `INSERT rooms` then `INSERT room_members` | Explicit | Not atomic (rare failure window) | Low |
| B. DB trigger `on_room_created` (AFTER INSERT, SECURITY DEFINER) | Atomic, mirrors `handle_new_user` pattern | New migration | Low-Medium |
| C. RPC function wraps both INSERTs | Atomic | New function + migration | Medium |

**Recommendation: B.** Atomic, consistent with existing trigger pattern, keeps Nitro endpoint clean.

### Decision 7: `linkIdentity` — slice 2 or defer?

| Approach | Pros | Cons | Effort |
|----------|------|------|--------|
| A. Implement in slice 2 | Closes R-AUTH-16/17 | Adds scope; UX belongs in settings, not join | Medium |
| B. Defer to slice 5 (settings/admin) | Focused slice 2 | R-AUTH-16/17 unimplemented until slice 5 | Low |

**Recommendation: B.** Guest can join + predict without linking. Upgrade is a settings concern.

### Decision 8: `scoring_rules` in room create form

| Approach | Pros | Cons | Effort |
|----------|------|------|--------|
| A. Default only in slice 2 | Simple form | Not customizable | Low |
| B. Customization UI in slice 2 | Full feature | Form complexity, more TDD scenarios | Medium |

**Recommendation: A.** Zod schema already exists. Customization UI in slice 4/5.

### Decision 9: `invitations` table in this slice

| Approach | Pros | Cons | Effort |
|----------|------|------|--------|
| A. Core join uses `rooms.invite_code` only; `invitations` table unused | Simple; spec compliant | Table sits idle | Low |
| B. Also implement email-invite via `invitations` | Per-person tracking; future-proof | Scope creep | Medium |

**Recommendation: A.** `invitations` table already exists in schema; populating it is a stretch goal.

---

## Risks

| Risk | Severity |
|------|----------|
| `prize_description` absent from schema — needs migration + re-gen-types | HIGH |
| Post-auth magic-link redirect: `/join/*` excluded from guard, cookie not saved automatically | HIGH |
| RLS blocks client-side room preview for non-members — must use service role in server endpoint | HIGH |
| `invitations` UPDATE (mark used) is service-role-only — join endpoint must be Nitro | MEDIUM |
| Returning users on join form: `display_name` from OTP metadata ignored (trigger only fires on new INSERT) — must document | MEDIUM |
| Vitest nuxt project pattern for `$fetch` on API routes not yet established in repo | MEDIUM |
| `rooms.status` values: DB has `'active'\|'closed'`; some scope text uses `'open'\|'closed'` — DB wins | LOW |

---

## Open Questions (to lock in proposal)

1. **`prize_description`**: NOT NULL DEFAULT '' or nullable TEXT?
2. **Post-auth redirect**: `?next=` in `emailRedirectTo` (recommended) or cookie/sessionStorage?
3. **Owner membership**: DB trigger `on_room_created` (recommended) or app-layer two INSERTs?
4. **Invite code regeneration**: in scope for slice 2 or no?
5. **`invitations` table email-invite feature**: slice 2 stretch or defer?
6. **`scoring_rules` in room create form**: default-only (recommended) or customizable in slice 2?

---

## TDD Seams

- Unit tests (`pnpm test:unit`): `generateInviteCode` format/distribution + retry, `room.schema` Zod, `join.schema` Zod
- Nuxt tests (`pnpm test:nuxt`): join page flow (preview → display_name capture → magic-link/OAuth → post-auth completion), rooms list composable, create-room form

---

## PR Budget

~300-500 changed lines across 2 chained PRs:

- **PR1** (`feat/rooms-schema-and-server`): migration `00005`, `shared/schemas/`, `server/utils/invite-code.ts`, `server/api/rooms/`, `server/api/join/`, unit tests
- **PR2** (`feat/rooms-and-join-pages`): `app/pages/rooms/`, `app/pages/join/[code].vue` (replace), `confirm.vue` edit, `login.vue` edit, `useRoom.ts`, Nuxt tests
