# Matches Spec — matches-and-predictions (Slice 3)

## Overview

New capability. Full spec for the match catalog: authenticated reads, seed contract, and knockout placeholder rules. All data flows from the `matches` table populated by `pnpm seed:matches` and edited by super-admins.

## Requirements

### R-MATCHES-01: Authenticated Match Catalog Read
**Type**: NEW
**Source**: C1
**Statement**: `GET /api/matches` MUST return all rows from the `matches` table ordered by `kickoff_at ASC`. The endpoint MUST be accessible to any authenticated user. Unauthenticated requests MUST receive `401`. The response MUST include `id`, `stage`, `group_name`, `home_team`, `away_team`, `kickoff_at`, `status`, `home_score`, `away_score`, `external_id`.

**Scenarios**:
- **Given** 64 matches have been seeded and the user is authenticated **When** `GET /api/matches` is called **Then** the response returns `200` with an array of 64 match objects ordered by `kickoff_at ASC`, each containing the fields listed in the statement.
- **Given** an unauthenticated request reaches `GET /api/matches` **When** the Nitro handler checks the session **Then** the endpoint returns `401` and no match data is exposed.
- **Given** a match has `status = 'finished'` **When** `GET /api/matches` is called **Then** `home_score` and `away_score` are non-null integers in the response object for that match.

### R-MATCHES-02: Stage Values Constraint
**Type**: NEW
**Source**: C1 / proposal §Approach
**Statement**: The `matches.stage` column MUST only contain values from `{ 'group', 'round_of_16', 'quarter', 'semi', 'final', 'third_place' }`. The seed file and admin update payloads MUST be validated against this set. Any other value MUST be rejected at the Zod schema layer before reaching the database.

**Scenarios**:
- **Given** an admin sends `PATCH /api/admin/matches/[id]` with `stage: "group_stage"` **When** Zod validates the payload **Then** the endpoint returns `400` with a validation error on `stage`.
- **Given** the seed file contains only valid `stage` values **When** `pnpm seed:matches` is executed **Then** all 64 rows are inserted without constraint violations.

### R-MATCHES-03: Knockout Placeholder Team Names
**Type**: NEW
**Source**: C1 / D2
**Statement**: Knockout matches (stages `round_of_16`, `quarter`, `semi`, `final`, `third_place`) MUST store placeholder text in `home_team` and `away_team` at seed time (e.g., `"Group A Winner"`, `"Group A Runner-up"`). The system MUST allow a super-admin to substitute real team names via `PATCH /api/admin/matches/[id]` once the group stage resolves. The API response MUST return the current value (placeholder or real name) without transformation.

**Scenarios**:
- **Given** a seeded knockout match has `home_team = "Group A Winner"` **When** `GET /api/matches` is called by an authenticated user **Then** the response includes `home_team: "Group A Winner"` verbatim.
- **Given** a super-admin sends `PATCH /api/admin/matches/[id]` with `home_team: "Argentina"` **When** the update succeeds **Then** subsequent reads of that match return `home_team: "Argentina"`.
- **Given** a group match has `stage = 'group'` and `group_name = 'A'` **When** the match is read **Then** `group_name` is `"A"` and `home_team` / `away_team` contain real national team names (not placeholders).

### R-MATCHES-04: Match Zod Schema
**Type**: NEW
**Source**: C1 / proposal §In Scope
**Statement**: `shared/schemas/match.schema.ts` MUST define and export Zod schemas for match reads (`MatchSchema`) and the admin update payload (`UpdateMatchSchema`). `UpdateMatchSchema` MUST accept optional `status`, `home_score`, `away_score`, `home_team`, `away_team`. Both schemas MUST be importable client-side and server-side (no Node-only imports).

**Scenarios**:
- **Given** `{ status: "invalid_status" }` **When** parsed by `UpdateMatchSchema` **Then** validation fails with an error on `status`.
- **Given** `{ home_score: 2, away_score: 1 }` **When** parsed by `UpdateMatchSchema` **Then** validation passes and all other fields remain `undefined` (not stripped to incorrect defaults).

## Out of Scope
- Per-match detail page (deferred).
- Real-time score push (deferred).
- External fixture API integration (explicitly excluded).
