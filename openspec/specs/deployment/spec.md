# Spec: deployment

**Domain:** Vercel configuration, environment variable contract, type generation script, and baseline cron skeleton.
**Slice:** foundation (PR 3 of 3)

---

## Purpose

Establish the deployment contract so the app ships to Vercel from day one and every collaborator knows exactly which environment variables are required. Foundation commits an empty cron skeleton; slice 3 populates actual cron jobs.

---

## Requirements

### Vercel config

- R-DEP-01: A `vercel.json` file MUST exist at the repo root.
- R-DEP-02: `vercel.json` MUST be valid JSON and parseable by the Vercel CLI.
- R-DEP-03: `vercel.json` MUST include a `"crons"` array. In foundation it MUST be an empty array `[]`. Slice 3 will add cron entries.
- R-DEP-04: `vercel.json` MUST NOT configure framework or build settings that conflict with Nuxt's default Vercel output (Vercel auto-detects Nuxt).

### Environment variable contract

- R-DEP-05: `.env.example` MUST exist at the repo root with placeholder values (no real secrets).
- R-DEP-06: `.env.example` MUST document every required variable with an inline comment explaining its purpose and whether it is public or server-only:
  | Variable | Visibility |
  |----------|-----------|
  | `NUXT_PUBLIC_SUPABASE_URL` | Public (safe to expose) |
  | `NUXT_PUBLIC_SUPABASE_KEY` | Public (anon key — safe) |
  | `NUXT_SUPABASE_SERVICE_KEY` | Server-only — NEVER expose |
  | `CRON_SECRET` | Server-only — Vercel cron auth token (slice 3 uses it) |
- R-DEP-07: `.env` MUST be listed in `.gitignore`. `.env.example` MUST NOT be in `.gitignore`.
- R-DEP-08: No real secret value MUST appear in any committed file.

### Type generation script

- R-DEP-09: `package.json` MUST include a `"gen-types"` script: `supabase gen types typescript --linked > shared/types/database.types.ts`.
- R-DEP-10: `pnpm gen-types` MUST succeed when `supabase link` is configured and the dev project has the schema applied.
- R-DEP-11: The generated file `shared/types/database.types.ts` MUST be committed to the repository (it is not a build artifact — it is a dev contract).
- R-DEP-12: README MUST document that `pnpm gen-types` MUST be re-run after every migration.

### README boot block

- R-DEP-13: `README.md` MUST contain a "Boot from scratch" section with these ordered steps:
  1. Clone the repo
  2. `pnpm install`
  3. Copy `.env.example` to `.env` and fill in values
  4. `supabase link --project-ref <dev-ref>`
  5. `supabase db push`
  6. `pnpm gen-types`
  7. `pnpm dev`
- R-DEP-14: README MUST note that `supabase start` (Docker) is an optional alternative for step 4, and link to the Supabase local dev docs.
- R-DEP-15: README MUST document the Vitest v4 `beforeAll` composable requirement as a known gotcha.

### Local dev strategy

- R-DEP-16: The project MUST support `supabase link --project-ref <ref>` (cloud-only, no Docker required). This is the required baseline workflow per user decision A.
- R-DEP-17: Docker-based `supabase start` MAY be documented as an alternative but MUST NOT be required.

### Build verification

- R-DEP-18: `pnpm build` (or `nuxt build`) MUST produce a valid Vercel output without errors.
- R-DEP-19: After build, the service role key MUST NOT appear in `dist/_nuxt/*` (covered also in security spec; enforced here as a deployment gate).

---

## Scenarios

### S-DEP-01: vercel.json exists and validates

```
Given the deployment files are committed
When the developer runs `pnpm dlx vercel@latest --help` or the Vercel CLI inspects vercel.json
Then vercel.json is valid JSON
And the "crons" key is present with an empty array value
```

### S-DEP-02: .env.example documents all variables

```
Given a developer clones the repo for the first time
When they open .env.example
Then they see exactly: NUXT_PUBLIC_SUPABASE_URL, NUXT_PUBLIC_SUPABASE_KEY, NUXT_SUPABASE_SERVICE_KEY, CRON_SECRET
And each variable has an inline comment indicating its purpose and public/server-only status
```

### S-DEP-03: .env is gitignored

```
Given the developer copies .env.example to .env and adds real values
When they run `git status`
Then .env does not appear in tracked or untracked files (it is gitignored)
```

### S-DEP-04: gen-types script produces types

```
Given supabase link is configured and the schema migration has been applied
When the developer runs `pnpm gen-types`
Then the command exits 0
And shared/types/database.types.ts is non-empty
And it contains the identifier `Database` (the generated root type)
```

### S-DEP-05: nuxt build succeeds

```
Given .env contains valid Supabase URL and anon key (service key not required for build)
When the developer runs `pnpm build`
Then the build exits 0 with no errors
And the output directory contains a valid Vercel-compatible build
```

### S-DEP-06: Service key absent from build output

```
Given the app has been built with `nuxt build`
When the developer searches the dist/_nuxt/ directory for the string "NUXT_SUPABASE_SERVICE_KEY"
Then no file contains that string
```

### S-DEP-07: Cloud-only workflow is sufficient

```
Given a developer with no Docker installed
When they follow the README "Boot from scratch" steps using supabase link (cloud)
Then they can run the dev server and apply migrations without Docker
```

---

## Acceptance criteria

- [ ] `vercel.json` exists at repo root with valid JSON and `"crons": []`
- [ ] `.env.example` documents all 4 required variables with comments
- [ ] `.env` is in `.gitignore`; `.env.example` is NOT
- [ ] No real secret value is committed anywhere
- [ ] `package.json` has `"gen-types"` script pointing to `shared/types/database.types.ts`
- [ ] `pnpm gen-types` succeeds against a linked dev project
- [ ] `shared/types/database.types.ts` is committed (as initial artifact after gen-types)
- [ ] `pnpm build` exits 0
- [ ] `dist/_nuxt/*` does not contain `NUXT_SUPABASE_SERVICE_KEY`
- [ ] README "Boot from scratch" section present with 7 ordered steps
- [ ] README documents `pnpm gen-types` as a post-migration requirement
- [ ] README documents Vitest v4 `beforeAll` gotcha

---

## Out of scope (this slice)

- Actual Vercel cron job entries in `vercel.json` (slice 3 adds `/api/cron/lock-predictions` and `/api/cron/sync-matches`)
- `/api/cron/*` Nitro server routes (slice 3)
- `CRON_SECRET` validation middleware (slice 3 — variable is only reserved here)
- GitHub Actions CI workflow (not planned for foundation)
- Production deploy runbook (documentation concern, not a spec requirement)
- Vercel preview environment configuration
