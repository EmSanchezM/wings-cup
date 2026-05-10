# Exploration: foundation — Nuxt 4.4 + Supabase Project Setup

**Recommendation up front:** Use the Nuxt 4 `app/` directory structure, Supabase CLI migrations under `supabase/migrations/`, `@nuxtjs/supabase` module v2 with `useSsrCookies: true`, Tailwind v4 + shadcn-vue via the `shadcn-nuxt` module (`@tailwindcss/vite` — NOT `@nuxtjs/tailwindcss`), `@nuxt/test-utils` v4 + Vitest v4 for testing, and automated type generation via `pnpm gen-types`. Seven architectural decisions analyzed below.

---

## Executive Summary

The source spec (`docs/especificaciones-mundial-bet.md`) references Nuxt 3 but the committed stack is Nuxt 4.4. This creates non-trivial gaps: Nuxt 4 defaults to `app/` as `srcDir`, introduces a `shared/` directory for code shared between app and server, `@nuxt/test-utils` v4 requires Vitest v4 (released Feb 2026 with a breaking change for composables in `describe` blocks), and shadcn-vue has fully migrated to Tailwind v4 (OKLCH colors, `@theme inline`, Vite plugin instead of PostCSS). The spec's RLS policies are incomplete — `matches`, `invitations`, and `audit_log` have no RLS defined. The hybrid guest+OAuth flow requires careful `redirectOptions` configuration to exclude public routes. Foundation is large and will require 2-3 chained PRs.

---

## Source Spec Deviations

| # | Spec Says | Recommended Change | Rationale |
|---|-----------|-------------------|-----------|
| 1 | **Nuxt 3** | **Nuxt 4.4** | Committed stack decision |
| 2 | Implied v3 flat layout | Use **Nuxt 4 `app/` srcDir layout** | Nuxt 4 default; startup perf on Windows; `~` alias maps to `app/` |
| 3 | No `updated_at` on `profiles` | Add `updated_at TIMESTAMPTZ DEFAULT NOW()` + moddatetime trigger | Standard practice; needed for cache invalidation |
| 4 | `kickoff_at > NOW()` in RLS (implicit tz) | Keep as-is (TIMESTAMPTZ makes NOW() safe in pg) but **add comment** documenting symmetry with `lock_started_predictions()` | The cron uses `kickoff_at <= NOW()` — same UTC reference; document intentionally |
| 5 | No RLS on `audit_log` | Add RLS: super admins SELECT only; no direct INSERT/UPDATE/DELETE | Audit log must not be readable by regular users |
| 6 | No RLS on `matches` | Add RLS: all authenticated users can SELECT; only service role INSERT/UPDATE | Matches not sensitive but should be read-only for regular users |
| 7 | No RLS on `invitations` | Add RLS: room owners INSERT; anyone with token SELECT own record; service role marks used_by | Without RLS any auth'd user can enumerate invitations |
| 8 | No `shared/` directory | Add `shared/types/` and `shared/schemas/` | Nuxt 4 `shared/` is for code used by both `app/` and `server/` — perfect for Zod schemas and generated DB types |
| 9 | `lock_started_predictions()` called from cron | Keep cron approach; **note Supabase free tier has no pg_cron** | Vercel/Nitro cron is correct for this constraint |
| 10 | `scoring_rules` default in SQL only | Also validate via **Zod schema** on insertion | DB default + Zod = triple-validation pattern the spec itself calls for |
| 11 | `calculate_points` CASE ordering | Semantically correct but add inline comment explaining priority order | Avoid future confusion: exact_score wins over correct_goal_diff which wins over correct_result |

---

## Approach Comparisons

### Decision 1: Migrations Strategy

| Approach | Pros | Cons | Effort |
|----------|------|------|--------|
| **A. Supabase CLI** (`supabase/migrations/`) | Official; `db push/reset/diff`; GitHub integration; CI-friendly | Docker for full local stack (optional — can use `--linked`) | Medium |
| **B. Raw SQL at `migrations/` root** | Simple, no tooling | Manual apply; drift-prone; no `db reset` | Low setup / High maintenance |
| **C. Drizzle Kit / ORM migration** | TypeScript-first | Doesn't handle RLS/Auth; adds dependency | High |

**Recommendation: A — `supabase/migrations/` at repo root.**
Use `supabase link --project-ref <ref>` + `supabase db push` against a dedicated dev project on Supabase free tier (2 projects allowed). Migrations are version-controlled SQL; Vercel doesn't touch this directory.

---

### Decision 2: Auth Integration

| Approach | Pros | Cons | Effort |
|----------|------|------|--------|
| **A. `@nuxtjs/supabase` v2** | SSR-safe cookies; PKCE; auto composables; `redirectOptions`; server utilities | Opinionated redirects need careful exclude config | Low |
| **B. Supabase JS directly** | Full control | Manual SSR hydration; manual redirect middleware | High |

**Recommendation: A.** Configure `redirectOptions` to guard only `/rooms/*` and `/admin/*`. Exclude `/`, `/join/*`, `/auth/*` from redirect.

```typescript
supabase: {
  redirectOptions: {
    login: '/auth/login',
    callback: '/auth/confirm',
    include: ['/rooms(/*)?', '/admin(/*)?'],
    exclude: ['/', '/join/*', '/auth/*'],
    saveRedirectToCookie: true,
  }
}
```

Magic link users are standard Supabase auth users (`is_guest: true` in profiles). No special treatment needed at the module level — the profile trigger handles the flag.

---

### Decision 3: Schema Location

| Approach | Pros | Cons | Effort |
|----------|------|------|--------|
| **A. `supabase/migrations/` (default)** | CLI expects it; zero config | One more dir at root | Low |
| **B. `migrations/` at root** | Generic | CLI needs `--migration-dir` flag | Low |
| **C. `server/db/migrations/`** | Co-located with server | CLI won't find it | Medium |

**Recommendation: A.** Zero friction with tooling.

---

### Decision 4: TypeScript Type Generation

| Approach | Pros | Cons | Effort |
|----------|------|------|--------|
| **A. pnpm script** (`gen-types`) | Simple; always reflects actual DB | Manual trigger | Low |
| **B. GitHub Actions auto-gen** | No drift | Overkill for solo; CI minutes | Medium |
| **C. Manual maintenance** | None | Always drifts | High maintenance |
| **D. Zod-only runtime types** | Unified | Must sync Zod to DB manually | High |

**Recommendation: A.** Place output at `shared/types/database.types.ts`.

```json
"gen-types": "supabase gen types typescript --linked > shared/types/database.types.ts"
```

Configure in `nuxt.config.ts`:
```typescript
supabase: { types: './shared/types/database.types.ts' }
```

Document `pnpm gen-types` in README as a required step after every migration.

---

### Decision 5: Testing Setup for Nuxt 4.4

| Approach | Pros | Cons | Effort |
|----------|------|------|--------|
| **A. `@nuxt/test-utils` v4 + Vitest v4** | Official; handles Nuxt runtime; `mountSuspended`; Playwright included | Vitest v4 required; `beforeAll` breaking change from v3 | Medium |
| **B. Plain Vitest + `@vue/test-utils`** | Simpler | Nuxt composables unusable without mocking | Low setup / High friction |

**Recommendation: A.** Critical v4 breaking change: composables must move from top-level `describe` to `beforeAll` hooks. Nuxt Test Utils v4.0.0 was released Feb 2026.

Split test projects: `--project unit` for pure logic (Zod, utils), `--project nuxt` for components and composables.

---

### Decision 6: Folder Structure Under Nuxt 4.4

Verified from Nuxt 4 docs: `app/` is the new default `srcDir`. `server/` stays at root. New `shared/` directory for code used by both app and Nitro server. `~` alias now resolves to `app/`.

| Approach | Pros | Cons | Effort |
|----------|------|------|--------|
| **A. Nuxt 4 `app/` layout** | Future-proof; startup perf; clean separation | Team must know `~` → `app/` | Low (greenfield) |
| **B. v3 flat layout** | Familiar | Legacy; perf issue on Windows; won't be default in Nuxt 5 | None |

**Recommendation: A.** Greenfield project — zero migration cost.

**Proposed full structure:**

```
wings-cup/
├── app/
│   ├── assets/css/tailwind.css     ← Tailwind v4 entry (@import "tailwindcss")
│   ├── components/ui/              ← shadcn-vue components
│   ├── composables/
│   ├── layouts/
│   ├── middleware/
│   ├── pages/
│   │   ├── index.vue               ← Landing (public)
│   │   ├── auth/login.vue
│   │   ├── auth/confirm.vue        ← Magic link / OAuth callback
│   │   ├── join/[code].vue         ← Public join page
│   │   └── rooms/[id]/index.vue
│   ├── plugins/
│   └── app.vue
├── server/
│   ├── api/
│   │   ├── rooms/
│   │   ├── predictions/
│   │   ├── invitations/
│   │   ├── admin/
│   │   └── cron/
│   │       ├── sync-matches.post.ts
│   │       └── lock-predictions.post.ts
│   ├── middleware/
│   └── utils/
│       ├── auth.ts                 ← CRON_SECRET validation, super admin check
│       └── supabase.ts            ← serverSupabaseClient helpers
├── shared/
│   ├── types/
│   │   └── database.types.ts      ← Generated; import from both app/ and server/
│   ├── schemas/                    ← Zod schemas
│   │   ├── room.schema.ts
│   │   ├── prediction.schema.ts
│   │   └── invitation.schema.ts
│   └── utils/
│       └── scoring.ts             ← Pure scoring logic (testable without Nuxt)
├── supabase/
│   ├── migrations/
│   │   ├── 00001_schema.sql
│   │   ├── 00002_rls.sql
│   │   └── 00003_triggers.sql
│   └── seed.sql
├── tests/
│   ├── unit/                       ← Pure logic tests (no Nuxt runtime)
│   └── e2e/                        ← Playwright tests
├── public/
├── nuxt.config.ts
├── vitest.config.ts
├── vitest.workspace.ts            ← defines unit + nuxt projects
├── eslint.config.mjs              ← Nuxt 4 flat ESLint config
└── vercel.json                    ← Cron job definitions
```

---

### Decision 7: shadcn-vue Installation

| Approach | Pros | Cons | Effort |
|----------|------|------|--------|
| **A. `shadcn-nuxt` module + CLI** | Auto-imports; `pnpm dlx shadcn-vue@radix add`; Tailwind v4 supported; Nuxt 4 compatible | Community-maintained module; monitor stability | Low |
| **B. Manual copy** | Full control | Tedious; no auto-import | Medium |

**Recommendation: A.** Use `@tailwindcss/vite` (NOT `@nuxtjs/tailwindcss`) for Tailwind v4.

```typescript
// nuxt.config.ts
import tailwindcss from '@tailwindcss/vite'

export default defineNuxtConfig({
  compatibilityDate: '2024-11-01',
  future: { compatibilityVersion: 4 },
  css: ['~/assets/css/tailwind.css'],
  vite: { plugins: [tailwindcss()] },
  modules: ['shadcn-nuxt', '@nuxtjs/supabase', '@pinia/nuxt'],
  shadcn: {
    prefix: '',
    componentDir: './app/components/ui'
  }
})
```

shadcn-vue v4 changes: OKLCH colors (not HSL), `data-slot` attributes on components, Toast deprecated in favor of Sonner, `new-york` as default style.

---

## Open Questions for Proposal Phase

1. **Local dev without Docker**: Use `supabase link` + remote dev project, or Docker? Free tier allows 2 projects.
2. **Prediction score max**: Spec caps at 20. Reduce to 15? Keep 20?
3. **Profile trigger provider detection**: Must read `NEW.app_metadata->>'provider'` to set `auth_provider` and `is_guest` correctly. Needs verification against Supabase auth.users schema.
4. **Magic link callback route**: Confirm `/auth/confirm` handles the token exchange and redirects to the saved cookie path.
5. **Vercel cron vs. Nitro scheduled tasks**: Vercel `vercel.json` cron is more reliable for Vercel-deployed apps. Nitro tasks would work on any runtime. Pick one strategy.
6. **Service role key safety**: Confirm `NUXT_SUPABASE_SECRET_KEY` never leaks into `runtimeConfig.public`. Verify nuxt.config setup.
7. **Realtime REPLICA IDENTITY**: For slice 4 ranking realtime, `room_members` needs `REPLICA IDENTITY FULL`. Schema decision should be made now (add to foundation migration) even though realtime is implemented in slice 4.
8. **Invitation expiry**: Spec doesn't define duration. Propose 7 days as default.
9. **ESLint flat config**: Confirm `eslint.config.mjs` format (Nuxt 4 default) is acceptable.
10. **`profiles` RLS SELECT policy**: Currently not shown in spec. Need a policy allowing users to read their own profile (and optionally other members' display_name/avatar within shared rooms).

---

## Risks

| Risk | Severity | Mitigation |
|------|----------|-----------|
| RLS missing on `matches`, `invitations`, `audit_log` | High | Define in proposal; include in 00002_rls.sql migration |
| `is_super_admin` readable by self (profiles RLS) | Medium | Scope profiles SELECT carefully; server-side always validates via `serverSupabaseUser` |
| `@nuxt/test-utils` v4 `beforeAll` breaking change | Medium | Document pattern in foundation; catch early with smoke tests |
| `shadcn-nuxt` module stability | Low | Pin version; manual fallback is feasible |
| Foundation slice exceeds 400-line PR budget | High | Split into 2-3 chained PRs: (1) scaffolding + deps, (2) schema + RLS migrations, (3) auth wiring + smoke tests |
| Supabase free tier: no pg_cron | Low | Already handled: use Vercel/Nitro cron |
| `NUXT_SUPABASE_SECRET_KEY` leak | High | Never put in `runtimeConfig.public`; use `runtimeConfig.supabaseServiceKey` (server-only) |
| Realtime REPLICA IDENTITY not set in foundation | Medium | Add `ALTER TABLE room_members REPLICA IDENTITY FULL` to foundation migration now |

---

## Recommended Next Phase

**sdd-propose** for the `foundation` change.

The proposal must:
1. Confirm 2-3 chained PR delivery strategy
2. Resolve open questions 1, 5, 6, 7, 9, 10 above
3. Define the profile-on-signup trigger implementation (reading `app_metadata`)
4. Define RLS for `matches`, `invitations`, `audit_log`, and `profiles`
5. Specify the exact `nuxt.config.ts` with all modules
6. Document `REPLICA IDENTITY FULL` on `room_members` in foundation migrations

---

## Sources

- [Nuxt 4 upgrade guide](https://nuxt.com/docs/getting-started/upgrade)
- [@nuxtjs/supabase introduction](https://supabase.nuxtjs.org/getting-started/introduction)
- [shadcn-vue Tailwind v4 migration](https://v3.shadcn-vue.com/docs/tailwind-v4)
- [shadcn-vue Nuxt installation](https://radix.shadcn-vue.com/docs/installation/nuxt)
- [Nuxt Test Utils v4 release (InfoQ)](https://www.infoq.com/news/2026/03/nuxt-test-utils-4/)
- [Supabase type generation docs](https://supabase.com/docs/guides/api/rest/generating-types)
- [Supabase CLI local dev](https://supabase.com/docs/guides/local-development/overview)
