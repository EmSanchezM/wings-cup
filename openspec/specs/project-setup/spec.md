# Spec: project-setup

**Domain:** Scaffolding, tooling, module wiring, directory layout, and test infrastructure.
**Slice:** foundation (PR 1 + PR 3 of 3)

---

## Purpose

Establish a runnable Nuxt 4.4 application with all required modules wired, ESLint active, and Vitest infrastructure proven by two smoke tests. This is the prerequisite every later slice builds on.

---

## Requirements

### Directory layout

- R-PS-01: The repository MUST use Nuxt 4.4 with `future: { compatibilityVersion: 4 }` and `app/` as `srcDir`.
- R-PS-02: The top-level structure MUST contain: `app/`, `server/`, `shared/`, `supabase/`, `tests/`, `public/`.
- R-PS-03: `shared/` MUST contain `types/`, `schemas/`, and `utils/` subdirectories.
- R-PS-04: `app/` MUST contain `assets/css/`, `components/ui/`, `composables/`, `layouts/`, `middleware/`, `pages/`, `plugins/`.
- R-PS-05: The `~` alias MUST resolve to `app/` (Nuxt 4 default — no override needed).

### Package and TypeScript config

- R-PS-06: `package.json` MUST declare `"type": "module"` and all production and dev dependencies including `nuxt`, `@nuxtjs/supabase`, `@pinia/nuxt`, `shadcn-nuxt`, `@tailwindcss/vite`, `zod`, `vitest`, `@nuxt/test-utils`, `@playwright/test`, `eslint`.
- R-PS-07: `tsconfig.json` MUST extend `.nuxt/tsconfig.json` and enable `"strict": true`.
- R-PS-08: `pnpm install` MUST complete with no unresolved peer-dependency errors on a clean checkout.

### Nuxt config

- R-PS-09: `nuxt.config.ts` MUST register modules in this order: `shadcn-nuxt`, `@nuxtjs/supabase`, `@pinia/nuxt`.
- R-PS-10: Tailwind v4 MUST be wired via `@tailwindcss/vite` as a Vite plugin — NOT via `@nuxtjs/tailwindcss`.
- R-PS-11: `css` array MUST reference `~/assets/css/tailwind.css` which starts with `@import "tailwindcss"`.
- R-PS-12: `runtimeConfig` MUST expose `supabaseServiceKey` as a server-only key (NOT under `runtimeConfig.public`).
- R-PS-13: `shadcn` config MUST set `componentDir: './app/components/ui'`.

### ESLint

- R-PS-14: ESLint MUST use flat config (`eslint.config.mjs`).
- R-PS-15: `pnpm lint` MUST exit 0 on a clean tree.

### Testing infrastructure

- R-PS-16: `vitest.config.ts` MUST define two Vitest projects: `unit` (no Nuxt runtime) and `nuxt` (environment: `'nuxt'`).
- R-PS-17: Composables used inside Vitest `nuxt` project tests MUST be called inside `beforeAll` hooks, not at the top level of `describe` blocks (Vitest v4 breaking change).
- R-PS-18: `pnpm test:unit` MUST run and pass the unit smoke test (`tests/unit/scoring-rules.schema.test.ts`).
- R-PS-19: `pnpm test:nuxt` MUST run and pass the Nuxt component smoke test (`tests/nuxt/app.smoke.test.ts`).
- R-PS-20: Playwright MUST be installed and available via `pnpm test:e2e` (no e2e scenarios required in this slice — infrastructure only).

### Baseline app

- R-PS-21: `app/app.vue` MUST mount without a runtime error.
- R-PS-22: `pnpm dev` MUST start the Nuxt dev server on localhost without errors.
- R-PS-23: A `README.md` MUST include a "Boot from scratch" section covering: `pnpm install`, `supabase link`, `supabase db push`, `pnpm dev`, `pnpm gen-types`.

### Seed Scripts and No New Runtime Dependencies (slice 3 — matches-and-predictions)

- R-PS-30: `pnpm seed:matches` Script. `package.json` MUST include a script `"seed:matches": "supabase db query --linked -f supabase/seeds/matches.sql"`. Running it on a local Supabase instance MUST be idempotent — repeated executions MUST NOT fail or duplicate data (enforced by `INSERT ... ON CONFLICT (external_id) DO NOTHING` in the seed file). Note: The `--linked` flag targets the remote linked project; `db query` is the current Supabase CLI command for executing seed files.

- R-PS-31: New Files Manifest. 21 new files MUST be created by slice 3 (PR-1 and PR-2 combined): migrations, schemas, types, handlers, API wrappers, composables, and pages for matches, predictions, leaderboard, and admin functionality. Existing files (`rooms/[id]/index.vue`, `package.json`) MUST NOT be overwritten except for intentional modifications documented in their respective requirements. **Note (confirmed Slice 4 verify, 2026-05-24):** `shared/schemas/audit-entry.schema.ts` is NOT included in this manifest. `AuditLogRow` is defined as a plain TypeScript interface in `server/handlers/audit-log.ts`. Rationale: `audit_log` is server-internal only; all write calls originate from server handlers with statically known shapes; no untrusted client input is parsed against this type; runtime Zod validation adds no value here.

- R-PS-32: No New Runtime Dependencies. This slice MUST NOT introduce new runtime npm dependencies. Type-only packages (`@types/*`) are permitted if needed. `package.json`'s `dependencies` field MUST be identical before and after the slice is applied (excluding lock file updates).

---

## Scenarios

### S-PS-01: Clean install

```
Given a developer clones the repository on a machine with Node >= 20
When they run `pnpm install`
Then the command exits 0
And no peer-dependency warnings appear in stdout
```

### S-PS-02: Dev server boots

```
Given `pnpm install` has completed
And `.env` contains valid NUXT_PUBLIC_SUPABASE_URL and NUXT_PUBLIC_SUPABASE_KEY
When the developer runs `pnpm dev`
Then the Nuxt dev server starts on localhost:3000 without throwing errors
And `app.vue` renders in the browser
```

### S-PS-03: Tailwind v4 class renders

```
Given the app is running in dev mode
When `app.vue` applies a Tailwind utility class (e.g. `text-primary`)
Then the class resolves to the expected CSS custom property from the OKLCH theme
And no PostCSS/CSS compilation error appears in the terminal
```

### S-PS-04: Unit smoke test passes

```
Given the test infrastructure is wired
When the developer runs `pnpm test:unit`
Then Vitest executes `tests/unit/scoring-rules.schema.test.ts`
And the test asserts that the default `scoring_rules` Zod schema validates the SQL default value `{"exact_score":5,"correct_goal_diff":3,"correct_result":1}`
And the suite exits green
```

### S-PS-05: Nuxt smoke test passes

```
Given the test infrastructure is wired
When the developer runs `pnpm test:nuxt`
Then Vitest executes `tests/nuxt/app.smoke.test.ts`
And `mountSuspended(App)` mounts without throwing
And the suite exits green
```

### S-PS-06: Lint passes

```
Given a clean working tree
When the developer runs `pnpm lint`
Then ESLint exits 0 with no errors
```

### S-PS-07: Service role key is server-only

```
Given the app has been built with `nuxt build`
When the developer inspects the `dist/_nuxt/` directory
Then no file contains the literal string `NUXT_SUPABASE_SERVICE_KEY` or the service key value
```

---

## Acceptance criteria

- [ ] `pnpm install` clean on Node >= 20
- [ ] `pnpm dev` boots without errors
- [ ] `app/` srcDir confirmed (`compatibilityVersion: 4`)
- [ ] `@tailwindcss/vite` wired; `@nuxtjs/tailwindcss` absent from `package.json`
- [ ] `eslint.config.mjs` present; `pnpm lint` exits 0
- [ ] `vitest.workspace.ts` defines `unit` and `nuxt` projects
- [ ] `pnpm test:unit` green
- [ ] `pnpm test:nuxt` green
- [ ] `runtimeConfig.supabaseServiceKey` is server-only (not under `public`)
- [ ] No service role key present in `dist/_nuxt/*` after build
- [ ] README contains boot-from-scratch section

---

## Out of scope (this slice)

- Room, prediction, or admin UI pages
- Auth login/confirm pages (covered in `auth` domain)
- Supabase schema/RLS (covered in `database` and `security` domains)
- E2E Playwright scenarios (infrastructure only)
- shadcn-vue components beyond a `button` smoke (later slices add components as needed)
