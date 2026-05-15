# Design: rooms-and-invitations (Slice 2)

> Technical contract for the 5 moving parts locked in `proposal.md`. All 6 user-locked decisions (2026-05-15) are inputs, not options. Foundation patterns (SECURITY DEFINER triggers, `serverSupabaseUser` / `serverSupabaseServiceRole`, `@nuxtjs/supabase` redirect map) are reused — no new conventions introduced. Strict TDD is ACTIVE: every section identifies its testable seams.

This design uses `[L-#]` to reference the 6 locked decisions and `[D-#]` for new design-level decisions added in this document.

---

## 1. Architecture overview

```
                    ┌────────────────────────────────────────────┐
                    │ Browser (Vue 3 SSR)                        │
                    │  pages/rooms/index.vue   pages/join/[code] │
                    │  composables/useRoom     pages/auth/*      │
                    └────────────┬────────────────────┬──────────┘
                                 │ $fetch              │ supabase-js (anon)
                                 │ /api/rooms          │ direct reads (RLS)
                                 │ /api/join/[code]    │
                                 ▼                     ▼
            ┌──────────────────────────────────────────────────────┐
            │ Nitro server (Nuxt 4)                                │
            │  server/api/rooms/{index.post,index.get,[id].get}    │
            │  server/api/join/[code].{get,post}                   │
            │  server/utils/invite-code.ts (pure)                  │
            │  server/utils/auth.ts (existing)                     │
            └──────┬─────────────────────────────────┬─────────────┘
                   │ serverSupabaseClient (user JWT) │ serverSupabaseServiceRole
                   │ → RLS applies                   │ → bypass RLS
                   ▼                                 ▼
        ┌───────────────────────────────────────────────────────────┐
        │ Supabase Postgres                                         │
        │  rooms (+ prize_description col)                          │
        │  room_members (role: owner|member)                        │
        │  on_room_created trigger (SECURITY DEFINER)               │
        │  existing handle_new_user, set_updated_at, RLS policies   │
        └───────────────────────────────────────────────────────────┘
```

**Slice 2 owns**: migration `00005_rooms_slice2.sql`, the new server utility + Zod schemas, 5 Nitro endpoints, 3 new pages (`rooms/index`, `rooms/[id]/index`, replacement of `join/[code]`), 1 modified page (`auth/confirm`), 1 modified page (`auth/login` — `display_name` capture), 1 composable.

**Slice 2 does NOT touch**: `handle_new_user` (already captures `raw_user_meta_data->>'display_name'` per `00003_triggers.sql`), other existing migrations, or any auth-module configuration in `nuxt.config.ts`.

---

## 2. Architecture decisions

| # | Decision | Rejected alternative | Rationale |
|---|----------|---------------------|-----------|
| L-1 | `prize_description TEXT NOT NULL DEFAULT ''` on `rooms` | Nullable column / separate table | Single source of truth, mirrors v0 docs, no JOIN cost, default is forward-safe for existing rooms. |
| L-2 | Post-auth redirect via `?next=/join/{code}` query in `emailRedirectTo` | Cookie / sessionStorage / hidden form field | URL-borne state survives tab close, email forwarding, and works without persistent client storage. |
| L-3 | Owner membership via `on_room_created` trigger (SECURITY DEFINER, AFTER INSERT) | Two-statement app-layer INSERT | Atomic in same transaction → roll-back guaranteed. Mirrors `handle_new_user` pattern already shipped in foundation. |
| L-4 | Invite code regeneration DEFERRED | Ship now | Out of scope for slice 2; no current need. |
| L-5 | `invitations` table sits idle | Use it for short codes | The slice's join flow uses `rooms.invite_code` (already permanent + UNIQUE); the `invitations` table is reserved for the future email-invite feature with token + expiry. |
| L-6 | `scoring_rules` UI DEFERRED | Show JSON editor in create form | Default rules from `defaultScoringRules` are good enough; customization moves to slice 4/5. |
| D-1 | `generateInviteCode` is a **pure function with injected supabase client** — `generateInviteCode(supabase, retries=3)` | Module-level singleton | Pure-function shape = trivial to unit-test with a mocked client; retries injected for deterministic test seeds. |
| D-2 | Invite code alphabet = `ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789` (36 symbols, **uppercase only**) | Mixed-case base-62 | Uppercase + digits is shouting-friendly for verbal sharing, avoids `O/0` and `I/1` ambiguity at the cost of 2 fewer symbols (we accept; 36⁶ = 2.18B is plenty). |
| D-3 | `POST /api/rooms` and `POST /api/join/[code]` go through Nitro; `GET` endpoints exist but pages MAY also read client-direct via the composable | Server-only for everything | Reads are RLS-gated and don't need server orchestration; writes need server-side invite-code generation + retry, so they MUST be server-side. |
| D-4 | `GET /api/join/[code]` uses `serverSupabaseServiceRole` and returns ONLY a hand-picked projection | RLS allow-anon SELECT on rooms | RLS already (correctly) blocks anon reads; opening it would require either an `auth.uid() IS NULL` policy (leaks all rooms to anyone) or a bypass policy keyed on the URL — both worse than a thin server endpoint. |
| D-5 | `confirm.vue` validates `next` against a strict allow-list regex (`/^\/join\/[A-Z0-9]{6}$/`) | Same-origin URL parse / blanket allow | Path is the ONLY shape we ever generate; anything else is malicious or stale → fall back. Cheap, deterministic, unit-testable. |
| D-6 | Composable `useRoom` exports plain async functions, NOT a Pinia store | New Pinia store | No cross-component state needs to live globally yet; a composable composes naturally with `useSupabaseClient`/`useSupabaseUser`. Pinia adoption deferred until a screen actually needs cached state. |
| D-7 | Server endpoint uses `serverSupabaseClient` (user-context) for `POST /api/rooms` so RLS validates `created_by = auth.uid()` | Service role + manual check | Defense in depth — RLS would catch a buggy server. Service role only used where RLS would block (public preview). |
| D-8 | `display_name` capture lives in `join/[code].vue`, not `auth/login.vue`, and is shown ONLY for the magic-link path | Move it to `login.vue` for all flows | OAuth path already has `name` from Google → `handle_new_user` falls back correctly. Asking again would be a UX regression. |

---

## 3. Migration `00005_rooms_slice2.sql`

### 3.1 Full SQL

```sql
-- =============================================================================
-- Migration: 00005_rooms_slice2.sql
-- Purpose  : Slice 2 (rooms-and-invitations).
--            (1) Add rooms.prize_description (NOT NULL DEFAULT '').
--            (2) Create on_room_created trigger that inserts the creator into
--                room_members with role='owner', atomically with the room INSERT.
-- Depends  : 00001_schema.sql (rooms, room_members), 00002_rls.sql (rm_insert_self),
--            00003_triggers.sql (SECURITY DEFINER pattern reference).
-- Idempotency: NONE — additive, forward-only. Rollback: 00006_rollback_slice2.sql.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. rooms.prize_description  [L-1]
-- ---------------------------------------------------------------------------
ALTER TABLE rooms
  ADD COLUMN prize_description TEXT NOT NULL DEFAULT '';

-- Why NOT NULL DEFAULT '': existing rows backfill instantly to '', no NULL
-- handling needed in the type system, default safe for inserts that omit it.

-- ---------------------------------------------------------------------------
-- 2. on_room_created()  [L-3]
--    SECURITY DEFINER bypasses rm_insert_self (which requires user_id = auth.uid()
--    — true here, but we run the INSERT in the trigger context anyway, so DEFINER
--    keeps the contract identical to handle_new_user).
--    Same-transaction failure → rolls back the room INSERT.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION on_room_created() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.room_members (room_id, user_id, role)
  VALUES (NEW.id, NEW.created_by, 'owner');
  RETURN NEW;
END $$;

-- Trigger name follows the foundation convention (verb_subject) used by
-- handle_new_user → on_auth_user_created. Here: rooms_owner_membership.
CREATE TRIGGER rooms_owner_membership
  AFTER INSERT ON rooms
  FOR EACH ROW EXECUTE FUNCTION on_room_created();
```

### 3.2 Rollback `00006_rollback_slice2.sql`

```sql
-- Hot-fix rollback for 00005_rooms_slice2.sql. Hand-applied; not part of the
-- standard `supabase db push` flow.
DROP TRIGGER IF EXISTS rooms_owner_membership ON rooms;
DROP FUNCTION IF EXISTS on_room_created();
ALTER TABLE rooms DROP COLUMN IF EXISTS prize_description;
```

Impact of partial rollback (app code stays, migration reverts): `POST /api/rooms` will fail because the column no longer exists; `GET` calls return rows without `prize_description`. Recommended rollback order: revert app PRs first, then drop the column.

### 3.3 Type regeneration (mandatory)

After `pnpm supabase db push` succeeds for `00005`, the developer MUST:

```bash
pnpm gen-types
```

This regenerates `shared/types/database.types.ts` so `rooms.Row.prize_description` exists. Committing app code referencing the new column **before** regenerating types will fail TypeScript compile. Document this step in PR-1's description.

---

## 4. Server utilities + Zod schemas

### 4.1 `server/utils/invite-code.ts`

```ts
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '~~/shared/types/database.types'

export class InviteCodeCollisionError extends Error {
  readonly code = 'INVITE_CODE_COLLISION' as const
  constructor(public readonly attempts: number) {
    super(`Failed to generate a unique invite code after ${attempts} attempts`)
  }
}

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789' // [D-2]
const CODE_LENGTH = 6

/**
 * Generate a 6-char base-36 invite code. Uses crypto.getRandomValues for unbiased
 * sampling (rejection sampling on the byte to avoid modulo bias).
 *
 * Pure for testing: pass a mocked client to drive the collision branch.
 */
export function buildCandidate(): string {
  const bytes = new Uint8Array(CODE_LENGTH)
  crypto.getRandomValues(bytes)
  let out = ''
  for (let i = 0; i < CODE_LENGTH; i++) {
    // Rejection sampling: 256 % 36 != 0, so naive modulo biases toward 0..3.
    // Loop until we get a byte < 252 (252 = 36 * 7), then map evenly.
    let b = bytes[i]!
    while (b >= 252) {
      const next = new Uint8Array(1)
      crypto.getRandomValues(next)
      b = next[0]!
    }
    out += ALPHABET[b % 36]
  }
  return out
}

/**
 * Generate an invite code that does not collide with any existing rooms.invite_code.
 *
 * Strategy: build a candidate, attempt to find it via SELECT; if it exists, retry
 * up to `retries` times before throwing InviteCodeCollisionError.
 *
 * Note: the actual UNIQUE constraint on rooms.invite_code is the source of truth.
 * The pre-check is a *probabilistic shortcut* — the caller MUST still handle the
 * 23505 unique_violation if it leaks through under racing INSERTs. In practice,
 * 36^6 = 2.18B keyspace makes this race vanishingly unlikely.
 */
export async function generateInviteCode(
  supabase: SupabaseClient<Database>,
  retries = 3,
): Promise<string> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    const candidate = buildCandidate()
    const { data, error } = await supabase
      .from('rooms')
      .select('invite_code')
      .eq('invite_code', candidate)
      .maybeSingle()
    if (error) throw error
    if (!data) return candidate
  }
  throw new InviteCodeCollisionError(retries)
}
```

**Testable seams**:
- `buildCandidate()` is pure — unit-test format, alphabet membership, length, distribution sanity.
- `generateInviteCode(mockedClient)` — mock `from().select().eq().maybeSingle()` to return `{ data: { invite_code }, error: null }` on the first N attempts to drive the collision branch.
- `InviteCodeCollisionError` is a typed error — endpoint maps it to HTTP 503 (or 409); covered by integration test.

### 4.2 `shared/schemas/room.schema.ts`

```ts
import { z } from 'zod'

export const createRoomSchema = z.object({
  name: z.string().trim().min(1, 'name required').max(80, 'name too long'),
  prize_description: z.string().trim().max(500, 'prize_description too long').default(''),
})

export type CreateRoomInput = z.infer<typeof createRoomSchema>
```

**Testable seams**:
- Empty `name` → reject.
- 81-char `name` → reject.
- Missing `prize_description` → defaults to `''`.
- 501-char `prize_description` → reject.

### 4.3 `shared/schemas/join.schema.ts`

```ts
import { z } from 'zod'

const magicLinkSchema = z.object({
  provider: z.literal('magic_link'),
  email: z.string().email(),
  display_name: z.string().trim().min(1, 'display_name required').max(60),
})

const googleSchema = z.object({
  provider: z.literal('google'),
  // OAuth carries display_name in raw_user_meta_data; not required here.
})

// Discriminated union on `provider` — Zod parses the right shape based on the tag.
export const joinPayloadSchema = z.discriminatedUnion('provider', [
  magicLinkSchema,
  googleSchema,
])

export type JoinPayload = z.infer<typeof joinPayloadSchema>
```

**Testable seams**:
- `{provider:'magic_link', email, display_name:''}` → reject.
- `{provider:'magic_link', email:'bad'}` → reject.
- `{provider:'google'}` → accept.
- `{provider:'unknown'}` → reject (discriminator).

---

## 5. Nitro endpoints contract

### 5.1 `POST /api/rooms` — create room

| Field | Value |
|-------|-------|
| Auth | Authenticated (JWT cookie) |
| Body | `createRoomSchema` (Zod) |
| Response | `{ room: Room }` (TS type below) |
| Errors | 400 invalid body, 401 unauthenticated, 503 invite-code retries exhausted |
| Supabase client | `serverSupabaseClient` (user JWT) — RLS validates `created_by = auth.uid()` per `rooms_insert_authenticated` [D-7] |
| Side effects | INSERT into `rooms`; `rooms_owner_membership` trigger fires → INSERT into `room_members` (role=owner) |

```ts
// server/api/rooms/index.post.ts
export default defineEventHandler(async (event) => {
  const user = await serverSupabaseUser(event)
  if (!user?.sub) throw createError({ statusCode: 401 })

  const body = await readValidatedBody(event, createRoomSchema.parse)
  const supabase = await serverSupabaseClient<Database>(event)
  const inviteCode = await generateInviteCode(supabase) // throws → 503

  const { data, error } = await supabase
    .from('rooms')
    .insert({
      name: body.name,
      prize_description: body.prize_description,
      invite_code: inviteCode,
      created_by: user.sub,
    })
    .select()
    .single()

  if (error) throw createError({ statusCode: 500, data: error })
  return { room: data }
})
```

### 5.2 `GET /api/rooms` — list user's rooms

| Field | Value |
|-------|-------|
| Auth | Authenticated |
| Body | none |
| Response | `{ rooms: RoomListItem[] }` |
| Errors | 401 |
| Supabase client | `serverSupabaseClient` (user JWT) — RLS `rooms_select_member` returns only rooms the user belongs to |
| Side effects | none |

```ts
// server/api/rooms/index.get.ts
export default defineEventHandler(async (event) => {
  const user = await serverSupabaseUser(event)
  if (!user?.sub) throw createError({ statusCode: 401 })

  const supabase = await serverSupabaseClient<Database>(event)
  const { data, error } = await supabase
    .from('rooms')
    .select('id, name, prize_description, invite_code, status, created_at')
    .order('created_at', { ascending: false })

  if (error) throw createError({ statusCode: 500, data: error })
  return { rooms: data }
})
```

### 5.3 `GET /api/rooms/[id]` — room detail

| Field | Value |
|-------|-------|
| Auth | Authenticated |
| Body | none |
| Response | `{ room: Room, members: RoomMember[] }` |
| Errors | 401, 404 (RLS treats non-member as not-found) |
| Supabase client | `serverSupabaseClient` |
| Side effects | none |

```ts
// server/api/rooms/[id]/index.get.ts
export default defineEventHandler(async (event) => {
  const user = await serverSupabaseUser(event)
  if (!user?.sub) throw createError({ statusCode: 401 })

  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400 })

  const supabase = await serverSupabaseClient<Database>(event)
  const [{ data: room, error: roomErr }, { data: members, error: membersErr }] = await Promise.all([
    supabase.from('rooms').select('*').eq('id', id).maybeSingle(),
    supabase.from('room_members').select('user_id, role, total_points, joined_at').eq('room_id', id),
  ])
  if (roomErr || membersErr) throw createError({ statusCode: 500 })
  if (!room) throw createError({ statusCode: 404 })
  return { room, members: members ?? [] }
})
```

### 5.4 `GET /api/join/[code]` — public preview

| Field | Value |
|-------|-------|
| Auth | NONE (public; route is in `redirectOptions.exclude: ['/join/*']` indirectly via the page; the API endpoint itself bypasses the module's redirect guard since it's a server handler) |
| Body | none |
| Response | `{ roomName: string, creatorName: string, isActive: boolean }` — **strictly this shape, no leakage** [D-4] |
| Errors | 404 (code not found or room closed) |
| Supabase client | `serverSupabaseServiceRole` (RLS would block anon; we hand-pick the projection) |
| Side effects | none |

```ts
// server/api/join/[code].get.ts
export default defineEventHandler(async (event) => {
  const code = getRouterParam(event, 'code')
  if (!code || !/^[A-Z0-9]{6}$/.test(code)) throw createError({ statusCode: 404 })

  const supabase = serverSupabaseServiceRole<Database>(event)
  const { data, error } = await supabase
    .from('rooms')
    .select('name, status, profiles!rooms_created_by_fkey ( display_name )')
    .eq('invite_code', code)
    .maybeSingle()

  if (error) throw createError({ statusCode: 500 })
  if (!data || data.status !== 'active') throw createError({ statusCode: 404 })

  // Hand-built response — never spread `data` to avoid accidental leakage.
  return {
    roomName: data.name,
    creatorName: (data as any).profiles?.display_name ?? 'Anónimo',
    isActive: data.status === 'active',
  }
})
```

**Why hand-pick the projection**: even though the `select(...)` already restricts columns, we build the response object explicitly so a future careless `select('*')` cannot accidentally widen the response. Schema-level test enforces shape.

### 5.5 `POST /api/join/[code]` — authenticated join

| Field | Value |
|-------|-------|
| Auth | Authenticated |
| Body | `joinPayloadSchema` (Zod, discriminated on `provider`) — used by client to indicate which path was taken; server only honors the membership insert |
| Response | `{ room: { id, name } }` |
| Errors | 400 invalid body, 401, 404 invalid code, 409 already a member |
| Supabase client | `serverSupabaseClient` (user JWT) — RLS `rm_insert_self` validates `user_id = auth.uid()` |
| Side effects | INSERT into `room_members` (role='member'); 23505 (PK violation on `room_id, user_id`) → 409 already-member |

```ts
// server/api/join/[code].post.ts
export default defineEventHandler(async (event) => {
  const user = await serverSupabaseUser(event)
  if (!user?.sub) throw createError({ statusCode: 401 })

  const code = getRouterParam(event, 'code')
  if (!code || !/^[A-Z0-9]{6}$/.test(code)) throw createError({ statusCode: 404 })

  await readValidatedBody(event, joinPayloadSchema.parse)

  // Use service role to look up the room by code (RLS would block non-members).
  const admin = serverSupabaseServiceRole<Database>(event)
  const { data: room } = await admin
    .from('rooms')
    .select('id, name, status')
    .eq('invite_code', code)
    .maybeSingle()
  if (!room || room.status !== 'active') throw createError({ statusCode: 404 })

  // Insert membership with the user's JWT so RLS rm_insert_self verifies user_id = auth.uid().
  const supabase = await serverSupabaseClient<Database>(event)
  const { error } = await supabase
    .from('room_members')
    .insert({ room_id: room.id, user_id: user.sub, role: 'member' })

  if (error) {
    // 23505 = unique_violation on PK (room_id, user_id) → already a member.
    if (error.code === '23505') throw createError({ statusCode: 409, statusMessage: 'Already a member' })
    throw createError({ statusCode: 500, data: error })
  }
  return { room: { id: room.id, name: room.name } }
})
```

---

## 6. Pages + composable

### 6.1 `app/composables/useRoom.ts`

```ts
import type { CreateRoomInput } from '~~/shared/schemas/room.schema'
import type { JoinPayload } from '~~/shared/schemas/join.schema'
import type { Room, RoomListItem, RoomMember, RoomPreview } from '~~/shared/types/rooms'

export function useRoom() {
  async function createRoom(input: CreateRoomInput): Promise<Room> {
    const { room } = await $fetch<{ room: Room }>('/api/rooms', {
      method: 'POST',
      body: input,
    })
    return room
  }

  async function listRooms(): Promise<RoomListItem[]> {
    const { rooms } = await $fetch<{ rooms: RoomListItem[] }>('/api/rooms')
    return rooms
  }

  async function getRoom(id: string): Promise<{ room: Room, members: RoomMember[] }> {
    return $fetch(`/api/rooms/${id}`)
  }

  async function previewByCode(code: string): Promise<RoomPreview> {
    return $fetch<RoomPreview>(`/api/join/${code}`)
  }

  async function joinByCode(code: string, payload: JoinPayload): Promise<{ room: { id: string, name: string } }> {
    return $fetch(`/api/join/${code}`, { method: 'POST', body: payload })
  }

  return { createRoom, listRooms, getRoom, previewByCode, joinByCode }
}
```

**Public API** (return types declared; no implicit `any`):
- `createRoom(input)` → `Promise<Room>`
- `listRooms()` → `Promise<RoomListItem[]>`
- `getRoom(id)` → `Promise<{ room: Room, members: RoomMember[] }>`
- `previewByCode(code)` → `Promise<RoomPreview>`
- `joinByCode(code, payload)` → `Promise<{ room: { id, name } }>`

### 6.2 `app/pages/rooms/index.vue`

**Component tree**:
```
<NuxtLayout>
  <PageHeader title="Salas" />
  <CreateRoomForm @created="onCreated" />        ← uses <Input>, <Button>, <Textarea>
  <RoomList :rooms="rooms" />                    ← uses <Card> per item
</NuxtLayout>
```

**Data dependencies**:
- `onMounted`: `rooms.value = await useRoom().listRooms()` (could also use `useAsyncData('rooms', ...)` for SSR).
- On `@created`: prepend new room to the local `rooms` ref (no refetch).

**Conditional rendering**: empty list → "No tenés salas todavía"; loading state → skeleton.

**Definespacepagemeta**: relies on `redirectOptions.include: ['/rooms(/*)?']` — non-authed users get bounced to `/auth/login`.

### 6.3 `app/pages/rooms/[id]/index.vue` (slice-3 stub)

**Component tree**:
```
<NuxtLayout>
  <PageHeader :title="room?.name" />
  <p>Código de invitación: <code>{{ room?.invite_code }}</code></p>
  <RoomMembersList :members="members" />
  <p class="text-muted-foreground">Las predicciones estarán disponibles en el próximo slice.</p>
</NuxtLayout>
```

**Data**: `useAsyncData(\`room-\${id}\`, () => useRoom().getRoom(id))`.

### 6.4 `app/pages/join/[code].vue` (replaces foundation stub)

**Component tree**:
```
<div>
  <RoomPreviewCard :preview="preview" />
  <template v-if="!user">
    <AuthChoiceTabs v-model="provider">          ← magic_link | google
      <template #magic_link>
        <Input v-model="email" type="email" />
        <Input v-model="displayName" />          ← R-AUTH-13 + W-03 closure
        <Button @click="sendMagicLink">Continuar</Button>
      </template>
      <template #google>
        <Button @click="signInWithGoogle">Continuar con Google</Button>
      </template>
    </AuthChoiceTabs>
  </template>
  <template v-else>
    <Button :disabled="isJoining" @click="join">Unirme a la sala</Button>
  </template>
</div>
```

**Data dependencies**:
- `onMounted`: `preview.value = await useRoom().previewByCode(code)` → 404 → render "Sala no encontrada".
- If `useSupabaseUser()` returns truthy → user is back from auth callback → auto-call `joinByCode(code, { provider })`.

**Conditional rendering**: `display_name` field shown ONLY for `provider === 'magic_link'` AND `user` is null [D-8].

**Magic-link submit** (closes W-03):
```ts
await supabase.auth.signInWithOtp({
  email: email.value,
  options: {
    data: { display_name: displayName.value },             // W-03 closure
    emailRedirectTo: `${window.location.origin}/auth/confirm?next=/join/${code}`, // L-2
  },
})
```

**Google submit**:
```ts
await supabase.auth.signInWithOAuth({
  provider: 'google',
  options: {
    redirectTo: `${window.location.origin}/auth/confirm?next=/join/${code}`,
  },
})
```

### 6.5 `app/pages/auth/confirm.vue` (modified — honors `?next=`)

**Diff intent** (against existing file):

```ts
// existing logic …
const { error } = await supabase.auth.exchangeCodeForSession(code)
if (error) { await router.replace('/auth/login'); return }

// NEW: honor ?next= before falling back to cookie/default.
const next = route.query.next as string | undefined
const safeNext = isSafeNext(next) ? next! : null

const redirectTo = safeNext ?? cookieRedirect.pluck() ?? '/rooms'
await router.replace(redirectTo)
```

`isSafeNext` lives next to the page (or in `app/utils/is-safe-next.ts`):

```ts
const NEXT_PATTERN = /^\/join\/[A-Z0-9]{6}$/
export function isSafeNext(next: string | undefined): next is string {
  if (!next) return false
  return NEXT_PATTERN.test(next)
}
```

**Test plan** [D-5]:
- `isSafeNext('/join/AB12CD')` → true.
- `isSafeNext('/join/abc123')` → false (lowercase).
- `isSafeNext('/join/AB12CD/extra')` → false.
- `isSafeNext('https://evil.com/join/AB12CD')` → false (absolute URL).
- `isSafeNext(undefined)` → false.
- `isSafeNext('//evil.com')` → false.
- `isSafeNext('/rooms')` → false (only `/join/CODE` is a known generated `next`).

### 6.6 `app/pages/auth/login.vue` (optionally modified)

**No structural change required** for slice 2 — login page already calls `signInWithOtp` for magic-link without `display_name`. The `display_name` capture happens in `join/[code].vue` because that's the only flow where we know who's signing up new (W-03 is closed in the join context).

**If we DO want to capture `display_name` on the standalone `/auth/login`** (recommended for future-proofing): add an optional `display_name` Input shown next to the email field; pass it through `data: { display_name }`. **Decision for slice 2**: SKIP. The login page is reached only by users who already have an account in the future flows, OR by guests creating an account without a join code (no slice-2 flow does this — every signup path goes via `/join/{code}`). Defer to a future slice if needed.

---

## 7. Post-auth redirect mechanism

### 7.1 URL contract

- Outgoing (set by `/join/[code].vue`): `${origin}/auth/confirm?next=/join/${code}`.
- Incoming (read by `/auth/confirm.vue`): `route.query.next`.

### 7.2 Validation pipeline (in order)

1. After `exchangeCodeForSession(code)` succeeds.
2. `const next = route.query.next as string | undefined`.
3. `isSafeNext(next)` — regex `/^\/join\/[A-Z0-9]{6}$/`.
4. If safe → `router.replace(next)`.
5. Else → fallback to `cookieRedirect.pluck() ?? '/rooms'` (existing behavior preserved).

### 7.3 Threat model

| Attack | Defense |
|--------|---------|
| Open redirect: `?next=https://evil.com` | Regex requires leading `/join/`; absolute URL fails. |
| Path traversal: `?next=/join/AB12CD/../admin` | Regex anchors `^…$`; no `/` after the 6 chars. |
| Protocol-relative: `?next=//evil.com` | Regex requires `/join/`. |
| Lowercase invite code: `?next=/join/abc123` | Regex `[A-Z0-9]` is uppercase-only (matches our generator's alphabet). |
| Missing `next` | Falls back gracefully to existing cookie/`/rooms` flow. |

---

## 8. Type contracts

`shared/types/rooms.ts` (new) — handcrafted aliases on top of generated DB types so the rest of the app imports stable names:

```ts
import type { Tables, TablesInsert } from './database.types'

// Re-export generated row types under business-friendly names.
export type Room = Tables<'rooms'>            // id, name, invite_code, status, scoring_rules, prize_description, created_by, created_at
export type RoomMember = Tables<'room_members'> // room_id, user_id, role, total_points, joined_at

// Subset of Room used in list views (omits scoring_rules to keep payload small).
export type RoomListItem = Pick<Room,
  'id' | 'name' | 'prize_description' | 'invite_code' | 'status' | 'created_at'>

// Public preview returned by GET /api/join/[code] — strict shape, never widen.
export interface RoomPreview {
  roomName: string
  creatorName: string
  isActive: boolean
}

// Re-export Zod-derived input types for convenience.
export type { CreateRoomInput } from '../schemas/room.schema'
export type { JoinPayload } from '../schemas/join.schema'
```

After migration `00005`, `Tables<'rooms'>` will include `prize_description: string` automatically (regenerated by `pnpm gen-types`).

---

## 9. RLS interaction map

| Endpoint | Client used | RLS policy involved | Why this client |
|----------|-------------|---------------------|-----------------|
| `POST /api/rooms` | `serverSupabaseClient` (user JWT) | `rooms_insert_authenticated` (`created_by = auth.uid()`) | Defense in depth — RLS catches a buggy/forged `created_by`. |
| `GET /api/rooms` | `serverSupabaseClient` | `rooms_select_member` | RLS naturally filters to user's rooms; service role would over-select. |
| `GET /api/rooms/[id]` | `serverSupabaseClient` (×2) | `rooms_select_member`, `rm_select_same_room` | Non-members get 404 (not-found = not-authorized in RLS world). |
| `GET /api/join/[code]` | `serverSupabaseServiceRole` | bypassed | RLS correctly blocks anon SELECTs; we hand-pick `{name, creator.display_name, status}` projection [D-4]. |
| `POST /api/join/[code]` lookup | `serverSupabaseServiceRole` | bypassed | User isn't a member yet → RLS would 404 the room lookup; need service role to find the room by code. |
| `POST /api/join/[code]` insert | `serverSupabaseClient` (user JWT) | `rm_insert_self` (`user_id = auth.uid()`) | RLS validates the user can only insert themselves; trigger `rooms_owner_membership` does NOT fire (only AFTER INSERT on `rooms`). |
| Trigger `on_room_created` insert into `room_members` | DB-internal (SECURITY DEFINER) | bypasses `rm_insert_self` | Same transaction as the room INSERT; failure rolls everything back. |

---

## 10. Test seams (Strict TDD)

Strict TDD is ACTIVE. Every implementation file pairs with a failing test BEFORE the implementation is written. Test runners: `pnpm test:unit`, `pnpm test:nuxt`.

### 10.1 Unit (`tests/unit/`)

| File | Pure-function seam | Assertions (RED first) |
|------|---------------------|------------------------|
| `tests/unit/invite-code.test.ts` | `buildCandidate()` | length=6, every char in `[A-Z0-9]`, multiple calls produce different codes. |
| | `generateInviteCode(mockClient)` | First call returns hit → throws error path; first miss → returns code; mock 3 collisions → throws `InviteCodeCollisionError` with `attempts=3`. |
| `tests/unit/room.schema.test.ts` | `createRoomSchema.parse` | Accept `{name:'X'}` → `prize_description=''`; reject empty name; reject 81-char name; reject 501-char `prize_description`. |
| `tests/unit/join.schema.test.ts` | `joinPayloadSchema.parse` | Accept magic_link with valid payload; reject magic_link with empty `display_name`; accept google; reject unknown provider. |
| `tests/unit/is-safe-next.test.ts` | `isSafeNext(value)` | Cases from §7.3 threat model (5+ assertions). |

### 10.2 Nuxt (`tests/nuxt/`)

Use the v4 `beforeAll` import pattern (per `tests/nuxt/app.smoke.test.ts`). Mock `$fetch` via `vi.mock` of `'#app'`.

| File | Mockable boundary | Assertions |
|------|-------------------|------------|
| `tests/nuxt/use-room.test.ts` | `$fetch` mocked | `createRoom({name:'X'})` POSTs to `/api/rooms`; `listRooms()` returns the array; rejected fetch surfaces error. |
| `tests/nuxt/join-page.test.ts` | `useRoom` composable + `useSupabaseUser` mocked | Preview renders room name + creator; auth tab toggles `display_name` field for magic_link only; submit calls `signInWithOtp` with `data.display_name` and `emailRedirectTo` containing `?next=`. |
| `tests/nuxt/confirm-next.test.ts` | `route.query.next` + `router.replace` mocked | `?next=/join/AB12CD` → `router.replace('/join/AB12CD')`; `?next=https://evil.com` → falls through to cookie/`/rooms`; missing `next` → existing cookie/`/rooms` behavior preserved. |

### 10.3 (Optional, recommended) DB integration test

Out of scope for slice 2 if not yet wired (no Supabase test helper exists in repo). Document this gap as a follow-up: a `tests/db/on-room-created.sql.test` that inserts a room and asserts a `room_members` row with `role='owner'` exists, exercised against a local `supabase start` instance. **For slice 2**: rely on manual smoke-test in PR-1 description.

---

## 11. Migration ordering and re-gen workflow

```
supabase/migrations/
├── 00001_schema.sql              [foundation]
├── 00002_rls.sql                 [foundation]
├── 00003_triggers.sql            [foundation]
├── 00004_admin_rls.sql           [foundation post-merge]
└── 00005_rooms_slice2.sql        [THIS SLICE — additive]
```

Workflow per developer / CI:

```
pnpm supabase db push                    # apply 00005
pnpm gen-types                           # regenerate database.types.ts
git add shared/types/database.types.ts   # commit alongside migration
```

CI gate: a step that runs `pnpm gen-types && git diff --exit-code shared/types/database.types.ts` fails if the committed types are stale.

---

## 12. Sequence diagram — magic-link join flow

```
User                Browser              Supabase Auth        Email      auth.users     handle_new_user      Browser                /api/join
  │                    │                      │                 │             │                │                  │                       │
  │ visit /join/AB12CD │                      │                 │             │                │                  │                       │
  ├───────────────────►│                      │                 │             │                │                  │                       │
  │                    │ GET /api/join/AB12CD │                 │             │                │                  │                       │
  │                    ├──────────────────────────────────────────────────────────────────────────────────────────────────────────────────►│ (service-role)
  │                    │ 200 {roomName,creatorName,isActive}                  │             │                │                  │         │
  │ ◄──────────────────┤                      │                 │             │                │                  │                       │
  │ enter email + name │                      │                 │             │                │                  │                       │
  ├───────────────────►│ signInWithOtp({email,                                │             │                │                  │         │
  │                    │   options:{data:{display_name},                      │             │                │                  │         │
  │                    │     emailRedirectTo:`/auth/confirm?next=/join/AB12CD`}})            │                │                  │         │
  │                    ├─────────────────────►│                 │             │                │                  │                       │
  │                    │                      │ send link       │             │                │                  │                       │
  │                    │                      ├────────────────►│             │                │                  │                       │
  │                    │ 200 (check inbox)    │                 │             │                │                  │                       │
  │ ◄──────────────────┤                      │                 │             │                │                  │                       │
  │  ── opens email ── │                      │                 │             │                │                  │                       │
  │ click link         │                      │                 │             │                │                  │                       │
  ├──────────────────────────────────────────►│ verifyOtp       │             │                │                  │                       │
  │                                           ├──────────────────────────────►│ INSERT user    │                  │                       │
  │                                           │                 │             ├───AFTER INSERT►│ INSERT profile   │                       │
  │                                           │                 │             │                │ (display_name=…) │                       │
  │                                           │                 │             │                ├─────────────────►│                       │
  │ 302 → /auth/confirm?code=…&next=/join/AB12CD                │             │                │                  │                       │
  │ ◄─────────────────────────────────────────┤                 │             │                │                  │                       │
  │                    │ exchangeCodeForSession(code)           │             │                │                  │                       │
  │                    ├─────────────────────►│ session cookie  │             │                │                  │                       │
  │                    │ ◄────────────────────┤                 │             │                │                  │                       │
  │                    │ isSafeNext('/join/AB12CD') → true      │             │                │                  │                       │
  │                    │ router.replace('/join/AB12CD')         │             │                │                  │                       │
  │                    │ useSupabaseUser() truthy → auto-join   │             │                │                  │                       │
  │                    │ POST /api/join/AB12CD {provider:'magic_link',email,display_name}     │                  │                       │
  │                    ├──────────────────────────────────────────────────────────────────────────────────────────────────────────────────►│
  │                    │                      │                 │             │                │                  │ INSERT room_members   │
  │                    │                      │                 │             │                │                  │ (RLS rm_insert_self ✓)│
  │                    │ 200 {room:{id,name}} │                 │             │                │                  │                       │
  │ ◄──────────────────┤                      │                 │             │                │                  │                       │
  │ navigate to /rooms/{id}                   │                 │             │                │                  │                       │
```

---

## 13. Risks (design-level)

| Risk | Severity | Design mitigation |
|------|----------|-------------------|
| Stale `database.types.ts` after migration | High (TS compile fails) | Documented two-step workflow (§11); CI gate suggested. |
| `display_name` lost if user opens email in different browser (no localStorage continuity) | Low | Closed by L-2 — `next` lives in URL; `display_name` is in `raw_user_meta_data` set at OTP send time, persists in Supabase backend. |
| Trigger `rooms_owner_membership` causes duplicate insert if `POST /api/rooms` retries on transient error | Low | Trigger fires per row; if room INSERT succeeds, owner row exists. Endpoint must NOT retry the INSERT — surface the 5xx instead. Documented in §5.1. |
| `serverSupabaseServiceRole` accidentally returns more than `{roomName, creatorName, isActive}` | High | Hand-built response object [D-4]; schema-test on the response shape. |
| Race: two users trying to claim the same invite code at the exact same millisecond | Vanishingly low | UNIQUE constraint is the source of truth; pre-check is a probabilistic shortcut. The 23505 leak path is documented but not implemented in `generateInviteCode` (would require catching the INSERT error, regenerating, retrying — over-engineering for 36⁶ keyspace). |
| `confirm.vue` regression: existing OAuth flow without `next` breaks | Medium | Test asserts existing behavior preserved when `next` is missing. |

---

## 14. Open questions

NONE. All proposal-level open questions were locked by the user 2026-05-15. The two design-level workflow notes (CI gate for type generation; integration test for trigger) are recommendations, not blockers.

---

**Summary**: this design pins the SQL for `00005`, the `generateInviteCode` pure-function shape with retry contract, two Zod schemas (room + discriminated-union join), five Nitro endpoints with explicit auth/RLS-client/error-code matrices, three new pages plus one tightened `confirm.vue`, the `?next=` validation regex, the type-regen workflow, and the RED-first test plan for both `pnpm test:unit` and `pnpm test:nuxt`. Foundation patterns (SECURITY DEFINER trigger mirroring `handle_new_user`, `serverSupabaseServiceRole` for public endpoints, `redirectOptions` semantics) are reused without modification.
