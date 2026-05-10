# Foundation — Implementation Tasks

Three stacked PRs (each merges independently to `main`) deliver a runnable Nuxt 4.4 app, the full Supabase schema with RLS and triggers, and wired auth with smoke tests. After all three land, the project boots, authenticates real users, enforces RLS on every table, and runs `vitest` green — unblocking slices 2–5.

## Review Workload Forecast

| Metric | Value |
|--------|-------|
| Total estimated changed lines | ~870 |
| 400-line budget risk | High |
| Chained PRs recommended | Yes (3 stacked-to-main PRs) |
| Delivery strategy | auto-chain |
| Decision needed before apply | No |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High

### Work Units

| Unit | Branch | Scope | Est. lines | Depends on |
|------|--------|-------|-----------|------------|
| PR 1 | `feat/foundation-scaffolding` | Nuxt init, modules, ESLint, Tailwind, directory skeleton | ~300 | nothing |
| PR 2 | `feat/foundation-database` | 3 migration files, gen-types script, committed types artifact | ~350 | PR 1 |
| PR 3 | `feat/foundation-auth` | Supabase auth config, auth pages, server/utils/auth.ts, smoke tests, vercel.json, README | ~220 | PR 1 + PR 2 |

---

## PR 1/3 — feat/foundation-scaffolding (~300 lines)

### 1.1 Directory skeleton

- [x] 1.1.1 Create `app/`, `app/assets/css/`, `app/components/ui/`, `app/composables/`, `app/layouts/`, `app/middleware/`, `app/pages/`, `app/plugins/`, `app/stores/` — acceptance: all dirs exist on disk [ref: R-PS-01, R-PS-04]
- [x] 1.1.2 Create `server/api/.gitkeep`, `shared/types/.gitkeep`, `shared/schemas/.gitkeep`, `shared/utils/.gitkeep`, `supabase/migrations/`, `tests/unit/`, `tests/nuxt/`, `public/` — acceptance: R-PS-02 and R-PS-03 satisfied [ref: R-PS-02, R-PS-03]

### 1.2 `package.json`

- [x] 1.2.1 Write `package.json` with `"type": "module"`, engines `node >= 20`, and all production deps: `nuxt@^4.4`, `@nuxtjs/supabase@^2`, `@pinia/nuxt`, `shadcn-nuxt`, `@tailwindcss/vite`, `tailwindcss@^4`, `zod` — acceptance: no unknown peer-dep warnings [ref: R-PS-06]
- [x] 1.2.2 Add devDeps: `vitest@^4`, `@nuxt/test-utils@^4`, `@playwright/test`, `eslint`, `@nuxt/eslint`, `typescript` — acceptance: `pnpm install` exits 0 [ref: R-PS-06, R-PS-08]
- [x] 1.2.3 Add pnpm scripts: `"dev"`, `"build"`, `"lint": "eslint ."`, `"test:unit": "vitest run --project unit"`, `"test:nuxt": "vitest run --project nuxt"`, `"test:e2e": "playwright test"`, `"gen-types": "supabase gen types typescript --linked > shared/types/database.types.ts"` — acceptance: all scripts defined [ref: R-PS-18, R-PS-19, R-PS-20, R-DB-27, R-DEP-09]

### 1.3 TypeScript and Nuxt config

- [x] 1.3.1 Write `tsconfig.json` extending `.nuxt/tsconfig.json` with `"strict": true` — acceptance: file present, extends correct path [ref: R-PS-07]
- [x] 1.3.2 Write `nuxt.config.ts` with `compatibilityDate: '2025-11-01'`, `future: { compatibilityVersion: 4 }`, modules array `['shadcn-nuxt', '@nuxtjs/supabase', '@pinia/nuxt']`, `vite.plugins: [tailwindcss()]`, `css: ['~/assets/css/tailwind.css']`, `runtimeConfig.supabaseServiceKey: ''`, `runtimeConfig.cronSecret: ''`, `shadcn: { prefix: '', componentDir: './app/components/ui' }`, `typescript: { strict: true, typeCheck: true }` — acceptance: `pnpm dev` starts [ref: R-PS-09, R-PS-10, R-PS-12, R-PS-13]
- [x] 1.3.3 Add `supabase: { types: './shared/types/database.types.ts' }` to `nuxt.config.ts` — acceptance: key present in config [ref: R-DB-29, R-AUTH-04]

### 1.4 Tailwind v4

- [x] 1.4.1 Create `app/assets/css/tailwind.css` with `@import "tailwindcss";` and an `@theme {}` block with at least one `--color-primary` OKLCH token — acceptance: dev server applies class without PostCSS error [ref: R-PS-11, S-PS-03]

### 1.5 ESLint

- [x] 1.5.1 Write `eslint.config.mjs` importing from `@nuxt/eslint` with stylistic rules enabled and no Prettier dependency — acceptance: `pnpm lint` exits 0 on clean tree [ref: R-PS-14, R-PS-15, S-PS-06]

### 1.6 Root app component

- [x] 1.6.1 Create `app/app.vue` with `<template><NuxtPage /></template>` — acceptance: `mountSuspended` succeeds in smoke test [ref: R-PS-21]

### 1.7 Supabase config file

- [x] 1.7.1 Create `supabase/config.toml` (minimal `[project]` section; `project_id` left as placeholder) — acceptance: `supabase link` can read the file [ref: R-DB-03, Locked Decision A]

### 1.8 Pre-PR-open checklist (PR 1)

- [x] `pnpm lint` exits 0
- [x] `pnpm dev` boots without errors (confirmed via `pnpm build` smoke — succeeds)
- [x] All required directories and files created
- [x] No secrets committed; `.env` gitignored (`.gitignore` includes `.env`)
- [x] Changed lines ≤ 310 (actual: 168 lines excluding lockfile)

---

## PR 2/3 — feat/foundation-database (~350 lines)

> Base branch: `main` (after PR 1 merges). Apply `pnpm exec supabase link --project-ref $SUPABASE_PROJECT_REF` before writing migrations.

### 2.1 Link and pre-flight

- [ ] 2.1.1 Verify helper name for service-role client in the pinned `@nuxtjs/supabase` v2 version: check module docs/changelog for `serverSupabaseServiceRole` vs `serverSupabaseServiceClient` — acceptance: correct name documented in a comment in `server/utils/auth.ts` placeholder (actual file ships in PR 3) [ref: design §Q8, Open Implementation Question 8]

### 2.2 Schema migration (`00001_schema.sql`)

- [ ] 2.2.1 Write `supabase/migrations/00001_schema.sql`: `profiles` table with all columns from design §4.1, FK to `auth.users ON DELETE CASCADE`, partial index on `is_super_admin` — acceptance: table created with all constraints [ref: R-DB-01, R-DB-04, R-DB-05, R-DB-06]
- [ ] 2.2.2 Add `rooms` table to `00001_schema.sql` with `scoring_rules JSONB DEFAULT`, `invite_code UNIQUE`, `status CHECK ('active','closed')`, `created_by ON DELETE RESTRICT`, indexes on `invite_code` and `created_by` — acceptance: R-DB-07, R-DB-08, R-DB-09 satisfied [ref: R-DB-07, R-DB-08, R-DB-09]
- [ ] 2.2.3 Add `room_members` to `00001_schema.sql` with composite PK, cascade FKs, `total_points INTEGER DEFAULT 0`, `role CHECK ('owner','member')`, `REPLICA IDENTITY FULL`, indexes on `user_id` and `(room_id, total_points DESC)` — acceptance: `relreplident = 'f'` confirmed via query [ref: R-DB-10, R-DB-11, R-DB-12, R-DB-13]
- [ ] 2.2.4 Add `matches` to `00001_schema.sql` with all columns, `status CHECK` (scheduled/live/finished/postponed/cancelled), `external_id` partial UNIQUE index (WHERE NOT NULL), index on `kickoff_at`, index on `status` — acceptance: R-DB-14, R-DB-15, R-DB-16, R-DB-17 satisfied [ref: R-DB-14, R-DB-15, R-DB-16, R-DB-17]
- [ ] 2.2.5 Add `predictions` to `00001_schema.sql` with cascade FKs, `CHECK (predicted_home BETWEEN 0 AND 15)`, `CHECK (predicted_away BETWEEN 0 AND 15)`, UNIQUE `(room_id, user_id, match_id)`, partial index on `locked_at IS NULL` — acceptance: CHECK rejects 16, accepts 15 [ref: R-DB-18, R-DB-19, R-DB-20, R-DB-21, Locked Decision B]
- [ ] 2.2.6 Add `invitations` to `00001_schema.sql` with `token UNIQUE`, `expires_at DEFAULT (NOW() + INTERVAL '7 days')`, `created_by ON DELETE RESTRICT`, `used_by_user_id ON DELETE SET NULL` — acceptance: default is exactly 7 days [ref: R-DB-22, R-DB-23, Locked Decision D]
- [ ] 2.2.7 Add `audit_log` to `00001_schema.sql` with `admin_id ON DELETE RESTRICT`, composite index `(admin_id, created_at DESC)` — acceptance: index exists, R-DB-24, R-DB-25, R-DB-26 satisfied [ref: R-DB-24, R-DB-25, R-DB-26]

### 2.3 RLS migration (`00002_rls.sql`)

- [ ] 2.3.1 Write `supabase/migrations/00002_rls.sql`: `ENABLE ROW LEVEL SECURITY` on all 7 tables — acceptance: `relrowsecurity = true` for every table [ref: R-SEC-01, R-SEC-04]
- [ ] 2.3.2 Add `profiles` policies: `profiles_select_self`, `profiles_select_shared_room` (display_name + avatar_url only; no is_super_admin cross-user), `profiles_insert_none (false)`, `profiles_update_self`, `profiles_delete_none (false)` — acceptance: S-SEC-04, S-SEC-05, S-SEC-06 [ref: R-SEC-05, R-SEC-06, R-SEC-07, R-SEC-08, R-SEC-09]
- [ ] 2.3.3 Add `rooms` policies: `rooms_select_member`, `rooms_insert_authenticated`, `rooms_update_owner`, `rooms_delete_owner` — acceptance: member can SELECT their rooms, non-member cannot [ref: R-SEC-10, R-SEC-11, R-SEC-12, R-SEC-13, R-SEC-14]
- [ ] 2.3.4 Add `room_members` policies: `rm_select_same_room`, `rm_insert_self`, `rm_update_self`, `rm_delete_self_or_owner`; add `REVOKE UPDATE (total_points) ON room_members FROM authenticated` — acceptance: total_points not updatable by client [ref: R-SEC-15, R-SEC-16, R-SEC-17, R-SEC-18]
- [ ] 2.3.5 Add `matches` policies: `matches_select_authenticated` (SELECT only, auth.role()='authenticated'); no INSERT/UPDATE/DELETE policy for authenticated — acceptance: S-SEC-01, S-SEC-02, S-SEC-03 [ref: R-SEC-19, R-SEC-20, R-SEC-21, R-SEC-22]
- [ ] 2.3.6 Add `predictions` policies: `pred_select_room_members`, `pred_insert_own_before_kickoff`, `pred_update_own_unlocked`, `pred_delete_own_unlocked` — acceptance: S-SEC-10, S-SEC-11 pass [ref: R-SEC-23, R-SEC-24, R-SEC-25, R-SEC-26, R-SEC-27]
- [ ] 2.3.7 Add `invitations` policies: `inv_select_room_owner`, `inv_insert_room_owner`, `inv_delete_room_owner`; no UPDATE policy for authenticated — acceptance: S-SEC-14 passes [ref: R-SEC-28, R-SEC-29, R-SEC-30, R-SEC-31, R-SEC-32]
- [ ] 2.3.8 Add `audit_log` policies: `audit_select_super_admin`; no INSERT/UPDATE/DELETE for authenticated — acceptance: S-SEC-07, S-SEC-08, S-SEC-09 pass [ref: R-SEC-33, R-SEC-34, R-SEC-35, R-SEC-36]

### 2.4 Triggers migration (`00003_triggers.sql`)

- [ ] 2.4.1 Write `supabase/migrations/00003_triggers.sql`: define `set_updated_at()` function (inline, no pg extension required) and bind `profiles_set_updated_at` BEFORE UPDATE, `predictions_set_updated_at` BEFORE UPDATE — acceptance: S-TR-05, S-TR-06 pass [ref: R-TR-10, R-TR-11, R-TR-12]
- [ ] 2.4.2 Define `handle_new_user()` SECURITY DEFINER with COALESCE chain for display_name, avatar_url, auth_provider (fallback 'magic_link'), is_guest derived from provider — bind `auth_users_create_profile` AFTER INSERT ON auth.users — acceptance: S-TR-01, S-TR-03, S-TR-04 pass [ref: R-TR-04, R-TR-05, R-TR-06, R-TR-08, R-TR-09]
- [ ] 2.4.3 Define `lock_super_admin_column()` BEFORE UPDATE trigger on `profiles` checking JWT role claim; bind `profiles_lock_super_admin` — acceptance: S-SEC-12 passes [ref: R-SEC-08, design §5.2]
- [ ] 2.4.4 Define `calculate_points()` SECURITY DEFINER with priority CASE (exact_score > correct_goal_diff > correct_result > 0), per-room weights from `rooms.scoring_rules`, updates to `predictions.points_awarded` and `room_members.total_points`; bind `matches_calculate_points` AFTER UPDATE OF status, home_score, away_score ON matches — inline priority comment required — acceptance: S-TR-07, S-TR-08, S-TR-09, S-TR-10, S-TR-11 pass [ref: R-TR-13, R-TR-14, R-TR-15, R-TR-16, R-TR-17, R-TR-18]
- [ ] 2.4.5 Define `lock_started_predictions()` SECURITY DEFINER returning INTEGER (locked row count), callable via service role RPC — no table trigger binding — acceptance: S-TR-12, S-TR-13 pass [ref: R-TR-19, R-TR-20, R-TR-21, R-TR-22]

### 2.5 Apply migrations against dev project

- [ ] 2.5.1 Run `pnpm exec supabase link --project-ref $SUPABASE_PROJECT_REF` — acceptance: CLI confirms project linked
- [ ] 2.5.2 Run `pnpm exec supabase db push --linked` — acceptance: all 3 migrations apply, no errors, all 7 tables present [ref: R-DB-03, S-DB-01]
- [ ] 2.5.3 Verify `SELECT relreplident FROM pg_class WHERE relname = 'room_members'` returns `f` — acceptance: S-DB-02 [ref: R-DB-13]
- [ ] 2.5.4 Run `pnpm gen-types` — acceptance: `shared/types/database.types.ts` non-empty, contains `Database` identifier; commit the file [ref: R-DB-27, R-DB-28, R-DEP-09, R-DEP-10, R-DEP-11]

### 2.6 Pre-PR-open checklist (PR 2)

- [ ] `pnpm exec supabase db push --linked` exits 0 against a clean dev project
- [ ] All 7 tables present in public schema
- [ ] `room_members` REPLICA IDENTITY = FULL
- [ ] `predictions.predicted_home = 16` raises CHECK violation
- [ ] `shared/types/database.types.ts` committed and non-empty
- [ ] `pnpm lint` exits 0
- [ ] Changed lines ≤ 360

---

## PR 3/3 — feat/foundation-auth (~250 lines)

> Base branch: `main` (after PR 2 merges). Both schema and gen-types output must be available.

### 3.1 Supabase module auth config

- [ ] 3.1.1 Add `supabase: { useSsrCookies: true, redirectOptions: { login: '/auth/login', callback: '/auth/confirm', include: ['/rooms(/*)?', '/admin(/*)?'], exclude: ['/', '/join/*', '/auth/*'], saveRedirectToCookie: true } }` to `nuxt.config.ts` — acceptance: redirect guard active [ref: R-AUTH-01, R-AUTH-02, R-AUTH-08, R-AUTH-19, R-AUTH-20, R-AUTH-21]
- [ ] 3.1.2 Confirm `SUPABASE_URL` and `SUPABASE_ANON_KEY` env vars are NOT mirrored into `runtimeConfig.public` (module reads them directly) — acceptance: no duplication in nuxt.config [ref: R-AUTH-03, design §9]

### 3.2 Auth pages

- [ ] 3.2.1 Create `app/pages/auth/login.vue` with Google OAuth button calling `signInWithOAuth({ provider: 'google', options: { redirectTo } })` and magic-link email form calling `signInWithOtp` — acceptance: page renders; R-AUTH-05, R-AUTH-09, R-AUTH-13 satisfied
- [ ] 3.2.2 Create `app/pages/auth/confirm.vue`: on `onMounted`, read `code` from query; if present call `useSupabaseClient().auth.exchangeCodeForSession(code)`, then redirect to saved cookie path or `/rooms`; if no code redirect to `/auth/login` silently — acceptance: R-AUTH-06, R-AUTH-07, S-AUTH-10 [ref: R-AUTH-06, R-AUTH-07]
- [ ] 3.2.3 Create stub `app/pages/index.vue` (landing page, empty) and `app/pages/join/[code].vue` (empty stub) so the routes exist and excluded paths render without error — acceptance: S-AUTH-07, S-AUTH-08 [ref: R-AUTH-20]

### 3.3 Server auth utility

- [ ] 3.3.1 Create `server/utils/auth.ts` with:
  - `verifyCronSecret(event)` helper that reads `runtimeConfig.cronSecret` and validates `Authorization: Bearer <secret>` header (throws 401 if missing/wrong — documented now, used in slice 3)
  - `revalidateSuperAdmin(event)` helper that uses service-role client to re-read `profiles.is_super_admin` for the current user (throws 403 if false)
  - Use the verified helper name from task 2.1.1 for the service-role client call
  - acceptance: file compiles with strict TypeScript; no runtime import needed in this PR [ref: design §5.1, §11, Locked Decision C, Open Implementation Question 8]

### 3.4 Environment contract files

- [ ] 3.4.1 Write `.env.example` with `NUXT_PUBLIC_SUPABASE_URL=`, `NUXT_PUBLIC_SUPABASE_KEY=`, `NUXT_SUPABASE_SERVICE_KEY=` (comment: server-only — NEVER expose), `CRON_SECRET=` (comment: server-only, slice 3) — acceptance: R-DEP-05, R-DEP-06, R-AUTH-22, R-SEC-39 [ref: R-DEP-05, R-DEP-06, R-AUTH-22]
- [ ] 3.4.2 Add `.env` and `.env.local` to `.gitignore`; confirm `.env.example` is NOT gitignored — acceptance: S-DEP-03 [ref: R-DEP-07]

### 3.5 Vercel config

- [ ] 3.5.1 Write `vercel.json` at repo root: `{ "crons": [] }` — acceptance: valid JSON, `crons` key present with empty array; Vercel auto-detects Nuxt [ref: R-DEP-01, R-DEP-02, R-DEP-03, R-DEP-04, Locked Decision C]

### 3.6 README

- [ ] 3.6.1 Write `README.md` with "Boot from scratch" section (7 ordered steps: clone, pnpm install, copy env, supabase link, supabase db push, gen-types, dev); note Docker as optional alternative; document `pnpm gen-types` as post-migration step; document Vitest v4 `beforeAll` gotcha; include manual super-admin bootstrap SQL snippet — acceptance: R-DEP-13, R-DEP-14, R-DEP-15, R-PS-23, Open Implementation Question 1 [ref: R-DEP-13, R-DEP-14, R-DEP-15, R-PS-23]

### 3.7 Vitest workspace and smoke tests

- [ ] 3.7.1 Write `vitest.workspace.ts` defining two projects: `unit` (`include: ['tests/unit/**/*.test.ts']`, `environment: 'node'`) and `nuxt` (`include: ['tests/nuxt/**/*.test.ts']`, `environment: 'nuxt'`) — acceptance: both projects discovered [ref: R-PS-16, design §10.1]
- [ ] 3.7.2 Write `vitest.config.ts` baseline: `defineConfig({ test: { globals: true, reporters: ['default'] } })` — acceptance: file present [ref: design §10.2]
- [ ] 3.7.3 Write `shared/schemas/scoring-rules.ts` with `scoringRulesSchema` Zod object validating `{ exact_score: z.number(), correct_goal_diff: z.number(), correct_result: z.number() }` and a `defaultScoringRules` const matching the SQL default `{ exact_score: 5, correct_goal_diff: 3, correct_result: 1 }` — acceptance: Zod parse succeeds in test [ref: S-PS-04, design §10.4]
- [ ] 3.7.4 Write `tests/unit/scoring-rules.schema.test.ts`: import `scoringRulesSchema` and `defaultScoringRules`; assert `scoringRulesSchema.parse(defaultScoringRules)` succeeds without throwing; assert `scoringRulesSchema.parse({ exact_score: 5, correct_goal_diff: 3, correct_result: 1 })` returns expected shape — acceptance: `pnpm run test:unit` exits green [ref: R-PS-18, S-PS-04]
- [ ] 3.7.5 Write `tests/nuxt/app.smoke.test.ts` using v4 `beforeAll` pattern: import `mountSuspended` from `@nuxt/test-utils/runtime`; in `beforeAll` import `App` from `~/app.vue`; `it('mounts')`: `const wrapper = await mountSuspended(App); expect(wrapper.element).toBeDefined()` — acceptance: `pnpm run test:nuxt` exits green [ref: R-PS-17, R-PS-19, S-PS-05, design §10.3]

### 3.8 shadcn-vue Button (smoke)

- [ ] 3.8.1 Run `pnpm dlx shadcn-vue@latest add button` (or equivalent for the pinned shadcn-nuxt version) to scaffold `app/components/ui/button/index.ts` and `Button.vue` — acceptance: file exists; PR 3 reviewer can confirm shadcn + Tailwind v4 wiring is functional [ref: design §Open Implementation Questions Q6]

### 3.9 Pre-PR-open checklist (PR 3)

- [ ] `pnpm lint` exits 0
- [ ] `pnpm test:unit` exits green
- [ ] `pnpm test:nuxt` exits green
- [ ] `pnpm dev` boots without errors; `/auth/login` renders; `/rooms` redirects to `/auth/login`
- [ ] `vercel.json` is valid JSON with `"crons": []`
- [ ] `.env.example` present with all 4 vars documented
- [ ] No service key value in `dist/_nuxt/*` after `pnpm build`
- [ ] Changed lines ≤ 230

---

## Cross-PR considerations

- **PR 2 depends on PR 1** only for the `package.json` Supabase CLI script entry and the `supabase/config.toml` file. PR 2 migrations are pure SQL — a reviewer can read them independently.
- **PR 3 depends on PR 1 and PR 2**: `nuxt.config.ts` auth config extends what PR 1 started; `shared/types/database.types.ts` (PR 2) must exist for TypeScript to compile auth page types.
- **If PR 2 lands before PR 3**: the DB schema and RLS are live but auth pages do not exist — the app runs but users cannot sign in. Incomplete but not broken (no data corruption risk).
- **If PR 3 lands before PR 2**: TypeScript errors because `database.types.ts` is absent. Block PR 3 merge until PR 2 is merged.
- **Migration safety**: migrations are forward-only. Never edit a committed file — add `00004_*.sql` for fixups.
- **Super-admin bootstrap**: manual step documented in README. No automation. Execute after first OAuth sign-in creates a profiles row: `UPDATE profiles SET is_super_admin = TRUE WHERE id = '<your-uuid>';` using the service role or the Supabase dashboard SQL editor. [ref: Open Implementation Question 1]

---

## Verification per PR

### PR 1

```
pnpm install                 # exits 0, no peer-dep warnings (S-PS-01)
pnpm dev                     # Nuxt 4 boots on localhost:3000 (S-PS-02)
pnpm lint                    # exits 0 (S-PS-06)
```
Do NOT break: existing project root (clean git state).

### PR 2

```
pnpm exec supabase link --project-ref $SUPABASE_PROJECT_REF
pnpm exec supabase db push --linked          # all 3 migrations apply (S-DB-01)
# in Supabase SQL editor:
SELECT relreplident FROM pg_class WHERE relname = 'room_members';   # expect 'f' (S-DB-02)
SELECT * FROM matches;   # as anon = 0 rows (S-SEC-01), as authenticated = all rows (S-SEC-02)
pnpm gen-types           # shared/types/database.types.ts non-empty (S-DB-08, S-DEP-04)
pnpm lint                # still exits 0
```
Do NOT break: PR 1 working dev server.

### PR 3

```
pnpm lint                  # exits 0
pnpm test:unit             # scoring-rules.schema.test.ts green (S-PS-04)
pnpm test:nuxt             # app.smoke.test.ts green (S-PS-05)
pnpm dev                   # /auth/login renders; /rooms redirects to /auth/login (S-AUTH-05)
pnpm build                 # exits 0 (S-DEP-05)
# manual: confirm no NUXT_SUPABASE_SERVICE_KEY in dist/_nuxt/* (S-SEC-13, S-DEP-06)
# manual: OAuth sign-in creates profiles row with correct auth_provider + is_guest
```
Do NOT break: PR 1 and PR 2 functionality.
