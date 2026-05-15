# Project Setup Spec — Delta for rooms-and-invitations

## Overview

Delta to the `project-setup` main spec. Registers new shared schemas, server utilities, and pages introduced by this slice. No new runtime dependency is added to `package.json`.

## Requirements

### R-PS-24: No New Runtime Dependency
**Type**: NEW
**Source**: proposal §Dependencies / §Success Criteria
**Statement**: This slice MUST NOT introduce any new entry in `package.json` `dependencies` (runtime). `crypto.getRandomValues` is already available in the Nuxt 4 baseline. All new code MUST use existing installed packages only (`@nuxtjs/supabase`, `zod`, `pinia`, etc.).

**Scenarios**:
- **Given** all files for this slice have been implemented **When** the developer runs `git diff main package.json` **Then** no new key appears under `"dependencies"` (dev-only additions under `"devDependencies"` for test utilities are acceptable if needed).

### R-PS-25: New Shared Schemas Registered
**Type**: NEW
**Source**: proposal §In Scope
**Statement**: `shared/schemas/room.schema.ts` and `shared/schemas/join.schema.ts` MUST exist after this slice. Both MUST be importable with the `~/` alias from both client-side Vue components and server-side Nitro handlers. Nuxt 4's auto-import MUST cover schemas in `shared/` via `imports.dirs` or the files must use explicit imports — explicit imports are acceptable.

**Scenarios**:
- **Given** `shared/schemas/room.schema.ts` exists **When** `import { roomCreateSchema } from '~/shared/schemas/room.schema'` is used in a Nitro handler **Then** TypeScript resolves the import without error.
- **Given** `shared/schemas/join.schema.ts` exists **When** it is imported in a unit test **Then** Zod parse calls succeed without runtime errors.

### R-PS-26: New Server Utility Registered
**Type**: NEW
**Source**: proposal §In Scope
**Statement**: `server/utils/invite-code.ts` MUST exist and export a named function `generateInviteCode`. Nitro's auto-import scans `server/utils/`, so the function MUST be available in Nitro handlers without an explicit import statement.

**Scenarios**:
- **Given** `server/utils/invite-code.ts` exports `generateInviteCode` **When** a Nitro handler uses `generateInviteCode()` without importing it **Then** TypeScript resolves the function via Nitro auto-import and no TS error is raised.

### R-PS-27: New Pages Registered
**Type**: NEW
**Source**: proposal §In Scope
**Statement**: The following pages MUST exist after this slice: `app/pages/rooms/index.vue` (list + create), `app/pages/rooms/[id]/index.vue` (detail stub — slice 3 completes it), `app/pages/join/[code].vue` (full hybrid flow). `app/pages/auth/confirm.vue` is modified (not new). All new pages MUST mount without a runtime error in the Nuxt test environment.

**Scenarios**:
- **Given** `app/pages/rooms/index.vue` exists **When** `mountSuspended(RoomsIndex)` is called in a Nuxt test **Then** the component mounts without throwing.
- **Given** `app/pages/join/[code].vue` exists **When** `mountSuspended(JoinPage)` is called with a mocked route param `code = "AB12CD"` **Then** the component mounts without throwing.

### R-PS-28: New Composable Registered
**Type**: NEW
**Source**: proposal §In Scope
**Statement**: `app/composables/useRoom.ts` MUST exist and export a composable `useRoom`. The composable MUST be auto-imported by Nuxt (files in `app/composables/` are auto-imported by default in Nuxt 4).

**Scenarios**:
- **Given** `app/composables/useRoom.ts` exports `useRoom` **When** a Vue component uses `useRoom()` without an import statement **Then** Nuxt auto-import resolves it and no TS error is raised at build time.

### R-PS-29: Test Files for This Slice
**Type**: NEW
**Source**: proposal §Strict TDD Plan
**Statement**: The following test files MUST exist after this slice: `tests/unit/invite-code.test.ts`, `tests/unit/room.schema.test.ts`, `tests/unit/join.schema.test.ts`, `tests/nuxt/rooms.test.ts`, `tests/nuxt/join-page.test.ts`. All MUST pass under `pnpm test:unit` and `pnpm test:nuxt` respectively with no skipped or pending tests.

**Scenarios**:
- **Given** all test files exist and pass **When** the developer runs `pnpm test:unit` **Then** the three unit test files execute and all assertions pass.
- **Given** all test files exist and pass **When** the developer runs `pnpm test:nuxt` **Then** the two Nuxt test files execute and all assertions pass.

## Out of Scope
- E2E Playwright scenarios (infrastructure in place from foundation; no new e2e scenarios added in this slice).
- New Nuxt modules or plugins.
- shadcn-vue component additions beyond what the rooms/join UI requires (no formal constraint — add components as needed without a new module registration).
