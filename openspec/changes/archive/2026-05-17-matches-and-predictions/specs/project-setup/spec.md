# Project Setup Spec — Delta for matches-and-predictions (Slice 3)

## Overview

Delta to the `project-setup` main spec. Registers the seed script, new files manifest, and the no-runtime-deps requirement for this slice.

## Requirements

### R-PS-30: `pnpm seed:matches` Script
**Type**: NEW
**Source**: D1 / proposal §In Scope
**Statement**: `package.json` MUST include a script `"seed:matches": "supabase db execute --file supabase/seeds/matches.sql"`. The script MUST be local-only (no `--remote` flag). Running it on a local Supabase instance MUST be idempotent — repeated executions MUST NOT fail or duplicate data (enforced by `INSERT ... ON CONFLICT (external_id) DO NOTHING` in the seed file).

**Scenarios**:
- **Given** the local Supabase instance is running with an empty `matches` table **When** `pnpm seed:matches` is executed **Then** 64 match rows are inserted and the command exits 0.
- **Given** `pnpm seed:matches` has already been run **When** it is run a second time **Then** the command exits 0 and the `matches` table still contains exactly 64 rows (no duplicates, no errors).
- **Given** `pnpm seed:matches` is run with `--remote` appended manually **When** the script definition in `package.json` is inspected **Then** no `--remote` flag is present in the script command.

### R-PS-31: New Files Manifest
**Type**: NEW
**Source**: proposal §In Scope
**Statement**: The following files MUST be created as part of this slice (files already existing from foundation/slice-2 MUST NOT be overwritten unless explicitly modified):

| File | Purpose |
|------|---------|
| `supabase/migrations/00014_fix_pred_rls.sql` | RLS patch for prediction policies |
| `supabase/seeds/matches.sql` | 64-match seed, idempotent on `external_id` |
| `shared/schemas/match.schema.ts` | Zod schemas for match read + admin update |
| `shared/schemas/prediction.schema.ts` | Zod schema for prediction upsert |
| `shared/schemas/leaderboard.schema.ts` | Zod schema for leaderboard entry |
| `shared/schemas/audit-entry.schema.ts` | Zod schema for audit log entry |
| `shared/types/matches.ts` | TypeScript types inferred from match schemas |
| `shared/types/predictions.ts` | TypeScript types for prediction domain |
| `server/handlers/list-matches.ts` | Pure handler: list all matches |
| `server/handlers/update-match.ts` | Pure handler: admin update match |
| `server/handlers/upsert-prediction.ts` | Pure handler: room-scoped prediction upsert |
| `server/handlers/get-leaderboard.ts` | Pure handler: room leaderboard |
| `server/api/matches.get.ts` | Thin H3 wrapper → list-matches handler |
| `server/api/admin/matches/[id].patch.ts` | Thin H3 wrapper → update-match handler |
| `server/api/admin/matches/lock-now.post.ts` | Thin H3 wrapper → lock-now RPC |
| `server/api/rooms/[id]/predictions.post.ts` | Thin H3 wrapper → upsert-prediction handler |
| `server/api/rooms/[id]/leaderboard.get.ts` | Thin H3 wrapper → get-leaderboard handler |
| `app/composables/useMatches.ts` | Reactive match list composable |
| `app/composables/useLeaderboard.ts` | Reactive leaderboard composable |
| `app/pages/admin/matches/index.vue` | Admin match management page |
| `app/pages/rooms/[id]/predictions.vue` | Per-room predictions page |
| `app/pages/rooms/[id]/leaderboard.vue` | Per-room leaderboard page |

**Scenarios**:
- **Given** the PR-1 branch is checked out **When** `git diff --name-only main` is inspected **Then** all files listed under PR-1 scope are present and no files outside scope are modified.
- **Given** the PR-2 branch is merged **When** the full file manifest is checked **Then** all 22 files listed above exist in the repository.

### R-PS-32: No New Runtime Dependencies
**Type**: NEW
**Source**: proposal §Out of Scope / Locked Decisions
**Statement**: This slice MUST NOT introduce new runtime npm dependencies. Type-only packages (`@types/*`) are permitted if needed. `package.json`'s `dependencies` field MUST be identical before and after the slice is applied (excluding lock file updates).

**Scenarios**:
- **Given** the PR-1 and PR-2 branches are applied **When** `package.json` `dependencies` is diffed against `main` **Then** no new entries appear in `dependencies`.
- **Given** a developer needs a utility only used in type declarations **When** they install a package **Then** it MUST be installed under `devDependencies`, not `dependencies`.

## Out of Scope
- New environment variables (zero added in this slice).
- `.env*` file modifications.
- Changes to `nuxt.config.ts` module list.
