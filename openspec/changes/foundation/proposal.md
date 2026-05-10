# Proposal: foundation — Nuxt 4.4 + Supabase Project Bootstrap

> **Slice 1 of 5.** This change initializes the wings-cup project with a runnable Nuxt 4.4 + Supabase + shadcn-vue baseline, creates the full database schema and RLS policies for all 7 tables, wires hybrid OAuth/magic-link auth, and installs the test runner. After this slice, the project boots, authenticates real users, persists data with RLS enforced, and runs `vitest`/`playwright`. No business features (rooms, predictions, ranking, admin) are implemented here — slices 2–5 build on this foundation.

---

## Outcome

A reviewer can clone the repo, run `npm install && npm run dev`, sign in with Google/Facebook/magic-link, and see their `profiles` row created automatically. A migration command (`supabase db push`) creates **all 7 tables**, **RLS on every table** (closing the 3 spec gaps in `matches`, `invitations`, `audit_log`), and **all triggers** (`calculate_points`, `lock_started_predictions`, `handle_new_user`, `handle_updated_at`). The test runner is wired with one unit and one Nuxt smoke test, ESLint flat config is active, and `npm run gen-types` produces typed DB access from `shared/types/database.types.ts`. **REPLICA IDENTITY FULL** is set on `room_members` so slice 4 realtime works without a follow-up migration.

This slice unblocks every other slice: rooms (2) needs the schema and auth; matches/predictions (3) needs the matches table and the locking function; ranking (4) needs realtime config; admin (5) needs `audit_log`.

---

## Quick path

The implementer (sdd-apply) will follow this order. Each step has a corresponding spec scenario the next phase will write.

1. **Scaffolding & deps** — `package.json`, `nuxt.config.ts`, `tsconfig`, ESLint flat config, Tailwind v4 entry CSS, `app.vue`, directory layout (`app/`, `server/`, `shared/`, `supabase/`, `tests/`).
2. **Module wiring** — `@nuxtjs/supabase` v2 with `redirectOptions`, `@pinia/nuxt`, `shadcn-nuxt`, `@tailwindcss/vite`. `runtimeConfig` with server-only secrets.
3. **Schema migration** (`supabase/migrations/00001_schema.sql`) — 7 tables, indexes, FK constraints, `REPLICA IDENTITY FULL` on `room_members`, `updated_at` columns where needed.
4. **RLS migration** (`supabase/migrations/00002_rls.sql`) — `ENABLE ROW LEVEL SECURITY` on all 7 tables, full policy set covering SELECT/INSERT/UPDATE/DELETE per table per role (authenticated, service_role).
5. **Triggers migration** (`supabase/migrations/00003_triggers.sql`) — `handle_new_user` (reads `app_metadata->>'provider'`), `handle_updated_at` (moddatetime on `profiles` and `predictions`), `calculate_points`, `lock_started_predictions`.
6. **Auth wiring** — `app/pages/auth/login.vue`, `app/pages/auth/confirm.vue` (PKCE callback), redirect middleware via module `redirectOptions`.
7. **Test infrastructure** — `vitest.config.ts`, `vitest.workspace.ts` (unit + nuxt projects), one unit test (Zod schema smoke), one Nuxt component test (`app.vue` mounts).
8. **Type generation & deploy contract** — `npm run gen-types` script, `vercel.json` placeholder (no cron jobs yet — slice 3 adds them), `.env.example` documenting every variable.
9. **README boot block** — minimum docs so a teammate can run the project.

---

## Scope

### In scope

| # | Deliverable | Why in this slice |
|---|-------------|-------------------|
| 1 | Nuxt 4.4 init (TS strict, `compatibilityVersion: 4`, `app/` srcDir) | Boots the project |
| 2 | Tailwind v4 + shadcn-vue baseline (no components added beyond `button` smoke) | UI primitives every later slice uses |
| 3 | Pinia + Zod base setup | State management + validation contract |
| 4 | `@nuxtjs/supabase` v2 + `redirectOptions` (hybrid flow) | Auth wiring for slice 2 onwards |
| 5 | Schema for **all 7 tables** including `REPLICA IDENTITY FULL` on `room_members` | Avoids painful re-migrations later |
| 6 | RLS for **all 7 tables** including `matches`, `invitations`, `audit_log`, `profiles` | Spec gap closure; security-first |
| 7 | Triggers: `calculate_points`, `lock_started_predictions`, `handle_new_user`, `handle_updated_at` | DB logic the spec mandates |
| 8 | OAuth Google + Facebook + Magic Link routes | Hybrid signup is the product's USP |
| 9 | Vitest v4 + `@nuxt/test-utils` v4 + ESLint flat + Prettier with smoke tests | Strict TDD turns ON after this slice |
| 10 | Vercel deploy baseline + env contract | CI deploy works on day one |
| 11 | `npm run gen-types` → `shared/types/database.types.ts` | Typed DB access for every slice |

### Out of scope (defer to later slices)

| Item | Slice | Why deferred |
|------|-------|--------------|
| Room CRUD UI/endpoints | 2 | Schema is enough here; rooms is a complete deliverable on its own |
| Invitation flow logic & token generation | 2 | Schema/RLS only here — the logic is its own work unit |
| Match sync from API-Football | 3 | External API integration belongs with prediction features |
| Prediction UI + locking cron | 3 | Trigger and schema present; UI/cron is a later deliverable |
| Realtime ranking subscription code | 4 | Only `REPLICA IDENTITY FULL` needs to be set now |
| Admin panel UI | 5 | `audit_log` schema/RLS only here |
| `tournament_predictions` table (champion bet) | Roadmap | Not in v1 |
| Resend custom emails | Roadmap | Supabase magic links are enough for v1 |

---

## Spec deviations

The source spec (`docs/especificaciones-mundial-bet.md`) is a **flexible v0 design memo, not a contract**. Every deviation below is intentional.

| # | Spec says | We do | Rationale |
|---|-----------|-------|-----------|
| 1 | Nuxt 3 | Nuxt 4.4 | Committed stack; Nuxt 4 is GA |
| 2 | Implied flat layout | `app/` srcDir + `shared/` directory | Nuxt 4 default; Windows perf; `~` → `app/` |
| 3 | No `updated_at` on `profiles` | Add `updated_at TIMESTAMPTZ` + moddatetime trigger | Cache invalidation, audit trail |
| 4 | `kickoff_at > NOW()` in RLS (implicit tz) | Keep + inline comment documenting symmetry with `lock_started_predictions()` | TIMESTAMPTZ + Postgres NOW() are UTC-safe, but make symmetry explicit for future readers |
| 5 | No RLS on `audit_log` | Add RLS: super admins SELECT; service role only writes | Audit log must not leak |
| 6 | No RLS on `matches` | Add RLS: any authenticated user SELECT; service role INSERT/UPDATE | Public-readable but write-locked |
| 7 | No RLS on `invitations` | Add RLS: room owners INSERT; token-bearer SELECT own row; service role marks `used_by_user_id` | Without it, any auth'd user can enumerate tokens |
| 8 | No `shared/` directory | Add `shared/types/`, `shared/schemas/`, `shared/utils/` | Nuxt 4 convention; perfect for Zod schemas + generated types |
| 9 | `lock_started_predictions()` from cron (unspecified runner) | Vercel cron via `vercel.json` (decision below) | Free tier has no `pg_cron`; Vercel cron is reliable on Vercel runtime |
| 10 | `scoring_rules` default in SQL only | Add Zod schema mirroring SQL default | Triple-validation pattern the spec itself calls for |
| 11 | `calculate_points` CASE ordering | Keep + inline comment explaining priority (`exact_score` > `correct_goal_diff` > `correct_result`) | Avoid future confusion |

**Spec gap closure:** the source spec only enables RLS on 4 tables (`rooms`, `room_members`, `predictions`, `profiles`). We close the gap on `matches`, `invitations`, `audit_log` in this slice. **No table ships without RLS.**

---

## Architecture decisions (autonomous, locked in this proposal)

These were analyzed in exploration. The recommended option is now the project decision unless the user objects in the next phase gate.

| # | Decision | Choice | Rationale |
|---|----------|--------|-----------|
| 1 | Migrations strategy | `supabase/migrations/` + Supabase CLI | Official; `db push/reset/diff`; CI-friendly; no drift |
| 2 | Auth integration | `@nuxtjs/supabase` v2 (SSR cookies on, PKCE, `redirectOptions`) | Opinionated but covers the hybrid flow with minimal code |
| 3 | Schema location | `supabase/migrations/` at repo root | CLI default; zero friction |
| 4 | Type generation | `npm run gen-types` → `shared/types/database.types.ts` | Manual but reliable; documented in README |
| 5 | Testing | `@nuxt/test-utils` v4 + Vitest v4, split projects (`unit`, `nuxt`) | Official; `mountSuspended`; v4 `beforeAll` pattern documented in README |
| 6 | Folder layout | Nuxt 4 `app/` + `server/` + `shared/` + `supabase/` + `tests/` | Future-proof; greenfield, zero migration cost |
| 7 | shadcn-vue | `shadcn-nuxt` module + `@tailwindcss/vite` (NOT `@nuxtjs/tailwindcss`) | Tailwind v4 requires Vite plugin; community module covers Nuxt 4 |
| 8 | Profile trigger provider detection | `NEW.raw_app_meta_data->>'provider'` | OAuth providers populate `app_metadata.provider`; magic link populates differently — fall back to `'magic_link'` when null |
| 9 | Magic link callback route | `/auth/confirm` | `@nuxtjs/supabase` v2 default for token exchange |
| 10 | Service role key safety | `runtimeConfig.supabaseServiceKey` (server-only); **never** `runtimeConfig.public.*` | Module config validates this; integration test asserts it isn't in client bundle |
| 11 | Realtime REPLICA IDENTITY | `ALTER TABLE room_members REPLICA IDENTITY FULL` in foundation migration | Slice 4 cannot do `WHERE` filtering on realtime payloads without it |
| 12 | ESLint flat config | `eslint.config.mjs` | Nuxt 4 default; future-compatible |
| 13 | `profiles` RLS SELECT policy | Allow user to SELECT own row + display_name/avatar of users in shared rooms; **never** expose `is_super_admin` cross-user | Server-side always re-validates super-admin via `serverSupabaseUser()` |

---

## Decisions required from the user

The following four open questions need explicit user input before sdd-tasks runs. Surface them in interactive mode.

### Decision A — Local development environment

> Do you want a fully local Supabase stack (Docker) or cloud-only via `supabase link`?

| Option | Pros | Cons | Rec |
|--------|------|------|-----|
| **A1. Cloud-only** (`supabase link --project-ref <dev>`) | Zero local setup; uses free tier (2 projects allowed); always realistic | Requires internet; manual reset of remote DB | Recommended for solo work — simpler |
| **A2. Docker local** (`supabase start`) | Offline; instant `db reset`; full Auth/Realtime locally | Docker required (heavy on Windows); more onboarding friction | Recommended if more contributors join |

**Proposal recommends: A1 (cloud-only).** Document in README how to upgrade to A2 later.

### Decision B — Prediction score cap

> The spec caps `predicted_home`/`predicted_away` at 20 (`CHECK (>= 0 AND <= 20)`). Reduce to 15?

| Option | Pros | Cons |
|--------|------|------|
| **B1. Cap at 15** | 7-0 (Hungary–El Salvador 1982) is the widest WC margin; 15 still leaves a comfortable buffer; tighter validation surface | Slightly arbitrary; users typing fat-fingered "20" get a friction bump |
| **B2. Keep 20** (spec default) | No deviation from spec; very forgiving | Allows nonsense values |

**Proposal recommends: B1 (cap at 15).** Easy to relax later via migration; tightening later is a breaking change.

### Decision C — Cron strategy

> `lock_started_predictions()` runs every minute. Match-sync runs every 5 min. Use Vercel cron or Nitro `scheduledTasks`?

| Option | Pros | Cons |
|--------|------|------|
| **C1. Vercel cron** (`vercel.json`) | First-class on Vercel; reliable; viewable in dashboard | Vercel-only (locks deploy target) |
| **C2. Nitro scheduledTasks** | Runtime-agnostic; works on Vercel, Netlify, Node | Less mature; harder to debug; not all runtimes start the scheduler |

**Proposal recommends: C1 (Vercel cron).** The product's deploy target is Vercel and `$0 during the World Cup` is the cost goal — Vercel cron is included free at Hobby tier (limited but enough for 6 cron jobs).

> **Note:** foundation does NOT add cron jobs yet (no `/api/cron/*` endpoints exist). It only commits the strategy and reserves an empty `vercel.json` skeleton. Slice 3 wires the actual jobs.

### Decision D — Invitation expiry default

> Spec doesn't define `invitations.expires_at` duration. Propose **7 days** as default.

| Option | Pros | Cons |
|--------|------|------|
| **D1. 7 days** | Long enough for WhatsApp messages to be seen, short enough to feel intentional | Some friends miss the window |
| **D2. 30 days** | Maximum safety margin | Stale invitations linger forever |
| **D3. Until tournament end** | Simplest UX | Token reuse risk after the cup |

**Proposal recommends: D1 (7 days).** Encoded as DB default; UI in slice 2 can override per-invitation.

---

## Database schema summary

All 7 tables ship in `00001_schema.sql`. FK relationships and constraints below.

| Table | PK | Key FKs | Special |
|-------|----|---------| --------|
| `profiles` | `id` (= `auth.users.id`) | `id → auth.users.id ON DELETE CASCADE` | `updated_at` + moddatetime trigger; `is_guest` default TRUE; `is_super_admin` default FALSE |
| `rooms` | `id` (uuid) | `created_by → profiles.id` | `invite_code` UNIQUE; `scoring_rules` JSONB default; `status` default `'active'` |
| `room_members` | composite (`room_id`, `user_id`) | `room_id → rooms.id ON DELETE CASCADE`, `user_id → profiles.id ON DELETE CASCADE` | **`REPLICA IDENTITY FULL`** (slice 4 realtime); `total_points` default 0 |
| `matches` | `id` (uuid) | none | `external_id` UNIQUE NULLABLE; `kickoff_at` indexed; `status` default `'scheduled'` |
| `predictions` | `id` (uuid) | `room_id`, `user_id`, `match_id` (all CASCADE) | UNIQUE (`room_id`, `user_id`, `match_id`); CHECK 0–15; `updated_at` trigger; `locked_at` NULL until cron locks |
| `invitations` | `id` (uuid) | `room_id → rooms.id ON DELETE CASCADE`, `used_by_user_id → profiles.id` | `token` UNIQUE; `expires_at` NOT NULL (default `NOW() + 7 days`) |
| `audit_log` | `id` (uuid) | `admin_id → profiles.id` | Indexed on (`admin_id`, `created_at DESC`); `before_value`/`after_value` JSONB |

---

## RLS coverage matrix

Every table has RLS enabled. Every CRUD operation on every table has an explicit policy (or is denied by absence of policy + `service_role` bypass).

| Table | SELECT | INSERT | UPDATE | DELETE |
|-------|--------|--------|--------|--------|
| `profiles` | own row + (display_name, avatar_url) of users in shared rooms; super-admin sees all | service role only (trigger inserts) | own row, but **cannot toggle `is_super_admin`** (column-level lock via trigger) | service role only |
| `rooms` | own membership rows + super-admin all (per spec) | authenticated (must set `created_by = auth.uid()`) | room owner only | room owner only |
| `room_members` | members of same room | authenticated joining via valid invitation token (slice 2 enforces) | own row only (e.g. role; though `total_points` is service-only) | own row (leave room) or room owner removing |
| `matches` | any authenticated user | service role only | service role only | service role only |
| `predictions` | members of same room + super-admin | own (`user_id = auth.uid()`) AND match `kickoff_at > NOW()` | own AND `locked_at IS NULL` AND `kickoff_at > NOW()` | own AND `locked_at IS NULL` |
| `invitations` | room owner of `room_id` OR user holding token (server-side filtering by token) | room owner of `room_id` | service role only (sets `used_by_user_id`) | room owner of `room_id` |
| `audit_log` | super-admin only | service role only (server inserts after admin actions) | denied | denied |

Notes:
- `service_role` bypasses RLS entirely (Supabase default). Cron and admin endpoints use the service role key (server-only).
- `room_members.total_points` is mutated only by the `calculate_points()` trigger (running as `SECURITY DEFINER`). Regular UPDATE policy on `room_members` does NOT permit changing `total_points` — enforced by column grants.
- `profiles.is_super_admin` is service-only. The trigger initializing a new profile inserts `false`; only manual SQL or a service-role admin endpoint can flip it.

---

## Auth flow summary

| Flow | Sequence |
|------|----------|
| **OAuth signup (Google/Facebook)** | `signInWithOAuth({ provider, options: { redirectTo: '/auth/confirm' } })` → Supabase callback hits `/auth/confirm` → cookie session stored → `handle_new_user` trigger inserts `profiles` row with `auth_provider = 'google'\|'facebook'`, `is_guest = false` → redirect to saved cookie path |
| **Magic-link signup (guest)** | User submits name + email on `/join/[code]` → server calls `auth.signInWithOtp({ email, options: { emailRedirectTo: '/auth/confirm', data: { display_name } } })` → user clicks email → `/auth/confirm` exchanges token → trigger inserts profile with `auth_provider = 'magic_link'`, `is_guest = true` |
| **Guest → registered link** | Logged-in guest clicks "Vincular Google" → `linkIdentity({ provider: 'google' })` → Supabase merges identities (same `user_id`) → server-side endpoint flips `profiles.is_guest = false`, sets `auth_provider = 'google'` |
| **Login (returning)** | Same as signup but Supabase recognizes existing user; trigger fires only on first signup |

`redirectOptions` config (locked):
```ts
supabase: {
  redirectOptions: {
    login: '/auth/login',
    callback: '/auth/confirm',
    include: ['/rooms(/*)?', '/admin(/*)?'],
    exclude: ['/', '/join/*', '/auth/*'],
    saveRedirectToCookie: true,
  },
  useSsrCookies: true,
}
```

---

## Testing strategy for foundation

Foundation **installs and proves** the test infrastructure. Behavior tests come in later slices.

| Test | Type | Asserts |
|------|------|---------|
| `tests/unit/scoring-rules.schema.test.ts` | unit (Vitest, no Nuxt runtime) | Default `scoring_rules` Zod schema validates the SQL default |
| `tests/nuxt/app.smoke.test.ts` | nuxt (`@nuxt/test-utils` v4 `mountSuspended`) | `app.vue` mounts without error; tailwind classes render |
| `tests/integration/rls.test.sql` (optional, deferred) | psql | Document pattern in README; defer execution to slice 2 |

After foundation merges, **Strict TDD Mode activates** for slices 2–5. The `sdd-init` artifact (`testing_capabilities`) will be re-cached to flip `strict_tdd: true`.

`vitest.workspace.ts` defines two projects: `unit` (no Nuxt env) and `nuxt` (`environment: 'nuxt'`). Composables go in `beforeAll` hooks (Vitest v4 breaking change — documented in README).

---

## Delivery strategy

> **The orchestrator MUST resolve `delivery_strategy` with the user after this proposal.** This slice exceeds the 400-line PR budget and the chained-PR skill requires a decision.

### Estimated change size

| Group | Files | Est. lines |
|-------|-------|-----------|
| Scaffolding (config, env, README, deps) | 12 | ~250 |
| Migrations (schema + RLS + triggers) | 3 SQL files | ~350 |
| Auth pages + module config | 4 | ~150 |
| Tests + ESLint + workspace config | 6 | ~150 |
| **Total** | **~25 files** | **~900 lines** |

**900 lines > 400 budget.** Single PR violates the chained-pr skill unless `size:exception` is granted.

### Recommended split — 3 chained PRs (stacked-to-main)

Each PR lands independently to `main` (no tracker PR — this is bootstrap, not a feature). The reviewer reviews them in order but each can merge as soon as approved.

```
PR 1 (foundation/scaffolding) ──┐
                                │
PR 2 (foundation/db-schema-rls) ─── independent stacks to main
                                │
PR 3 (foundation/auth-tests)  ──┘
```

| PR | Scope | Est. lines | Depends on |
|----|-------|-----------|-----------|
| **PR 1** | Project init: Nuxt 4.4 config, modules wiring (Pinia, Tailwind v4, shadcn-nuxt skeleton), ESLint flat, Prettier, `package.json`, `tsconfig`, base `app.vue`, directory skeleton, `.env.example`, `README` boot block | ~300 | nothing |
| **PR 2** | The 3 migration files: `00001_schema.sql`, `00002_rls.sql`, `00003_triggers.sql` + `npm run gen-types` script + `shared/types/database.types.ts` (initial generated artifact, committed) | ~350 | PR 1 (`package.json` script) |
| **PR 3** | `@nuxtjs/supabase` config + `app/pages/auth/login.vue` + `app/pages/auth/confirm.vue` + Vitest workspace + smoke tests + `vercel.json` skeleton | ~250 | PR 1, PR 2 |

**Why stacked-to-main not feature-branch chain:** foundation is bootstrap. Each PR is independently shippable to a fresh repo (PR 1 alone is a runnable Nuxt 4 app; PR 2 alone is just SQL files; PR 3 needs both, but a reviewer can approve it after PR 1+2 merge). Feature-branch tracker pattern adds review overhead with no benefit here.

### Recommendation

**`auto-chain`** — the split is mechanical and the dependencies are clean. Apply phase implements PR 1 first, then PR 2 atop it, then PR 3.

If the user prefers `single-pr`, a `size:exception` label MUST be applied before review (foundation is genuinely indivisible without losing review quality, but 900 lines is the high end).

---

## Risks and mitigations

| Risk | Sev | Mitigation |
|------|-----|-----------|
| Missing RLS on `matches`, `invitations`, `audit_log` (spec gap) | High | Closed in this slice; `00002_rls.sql` covers all 7 tables |
| `is_super_admin` leaks via `profiles` SELECT | High | RLS policy excludes the column when SELECTing other users; server always re-validates via `serverSupabaseUser()` |
| `NUXT_SUPABASE_SERVICE_KEY` ends up in client bundle | Critical | Use `runtimeConfig.supabaseServiceKey` (server-only); CI smoke test greps `nuxt build` output |
| `@nuxt/test-utils` v4 `beforeAll` breaking change | Medium | Smoke test uses the v4 pattern from day one; README documents it |
| `shadcn-nuxt` community module instability | Low | Pin exact version; manual copy-fallback documented |
| Realtime `REPLICA IDENTITY` forgotten until slice 4 | Medium | Set in `00001_schema.sql` now |
| `pg_cron` not on Supabase free tier | Low | Already chosen Vercel cron strategy |
| Migration errors block deploy | Medium | Migrations idempotent where possible; `supabase db reset` documented; staging project on free tier validates before prod |
| Profile trigger fires on phantom users (e.g. SAML) | Low | Trigger reads `app_metadata->>'provider'`, defaults to `'magic_link'` if null; defensive |
| Tailwind v4 CSS regressions vs v3 muscle memory | Low | OKLCH color tokens documented in README; design tokens in `app/assets/css/tailwind.css` |

---

## Rollback plan

Foundation is bootstrap, but each piece has a rollback path.

| Risky change | Rollback |
|--------------|----------|
| `00001_schema.sql` breaks production DB | Migrations are forward-only; rollback via `supabase db reset` to a known migration. Pre-prod runs against the dev project — never apply directly to a hot DB |
| RLS policy too restrictive (legitimate query blocked) | Hotfix migration `00004_rls_relax.sql`; can ship within minutes via `supabase db push` |
| RLS policy too permissive (data leak) | Same — hotfix migration; meanwhile super-admin can revoke `authenticated` role grants on the affected table |
| Auth callback `/auth/confirm` broken | Page-level rollback via revert PR; users fall back to `/auth/login` (no callback redirect) |
| `@nuxtjs/supabase` v2 incompatibility | Pin previous v2.x; module config is small enough to swap inline |
| Service role key leak | Rotate immediately in Supabase dashboard; redeploy with new key in env |

For DB migrations specifically: **never edit a committed migration file.** Always add a new one. The `supabase/migrations/` directory is append-only history.

---

## Success criteria

Foundation is "done" when **all** of these are true:

- [ ] `npm install` completes with no peer-dep warnings on a clean checkout
- [ ] `npm run dev` boots Nuxt 4.4 on localhost without errors
- [ ] `npm run lint` passes (ESLint flat config active)
- [ ] `npm run test:unit` runs the unit smoke test green
- [ ] `npm run test:nuxt` runs the Nuxt component smoke test green
- [ ] `supabase db push` (against dev project) applies all 3 migrations without errors
- [ ] `npm run gen-types` produces a non-empty `shared/types/database.types.ts`
- [ ] Logging in with Google creates a `profiles` row with `auth_provider = 'google'`, `is_guest = false`
- [ ] Logging in with magic link creates a `profiles` row with `auth_provider = 'magic_link'`, `is_guest = true`
- [ ] `SELECT * FROM matches` as an unauthenticated user returns 0 rows (RLS enforced)
- [ ] `SELECT is_super_admin FROM profiles WHERE id != auth.uid()` returns nothing or NULL for that column (no leak)
- [ ] `pg_class.relreplident = 'f'` (REPLICA IDENTITY FULL) on `room_members`
- [ ] `vercel.json` exists and validates (even if empty `crons`)
- [ ] `.env.example` documents every required variable, no secrets
- [ ] No `NUXT_SUPABASE_SERVICE_KEY` reference appears in `dist/_nuxt/*` after `nuxt build`
- [ ] README has the "boot the project from scratch" block

---

## Next phase

`sdd-spec` for the `foundation` change — write Given/When/Then scenarios from this proposal.

Parallel option: `sdd-design` to deepen the architectural decisions if the orchestrator wants design + spec in parallel.

After spec + design: `sdd-tasks` will break the work into the 3-PR split above, with work-unit commits inside each PR.
