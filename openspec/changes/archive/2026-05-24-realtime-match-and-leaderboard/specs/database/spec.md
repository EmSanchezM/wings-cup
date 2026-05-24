# Database Spec — Delta for realtime-match-and-leaderboard (Slice 6)

## Overview
Delta. One new requirement: migration 00015 adds `matches` and `room_members` to the `supabase_realtime` publication. Requirement is co-specified with R-RT-01 in the realtime spec; this entry anchors it in the database migration lineage. No new tables, no column changes.

## Requirements Summary

| Req | Title | Type | Scenarios |
|-----|-------|------|-----------:|
| R-DB-33 | Migration 00015_realtime_publication.sql | NEW | 3 |

---

## ADDED Requirements

### R-DB-33: Migration `00015_realtime_publication.sql`

**Type**: NEW | **Source**: Proposal §3.1 / R-RT-01
**Files**: `supabase/migrations/00015_realtime_publication.sql`

Migration `00015_realtime_publication.sql` MUST exist in `supabase/migrations/`. It MUST execute `ALTER PUBLICATION supabase_realtime ADD TABLE matches` and `ALTER PUBLICATION supabase_realtime ADD TABLE room_members`. Both statements MUST be idempotent — guarded via `pg_publication_tables` check so that a second application of the migration produces no error. Migration MUST be forward-only; no corresponding `down` migration is required. Migration MUST be applied to the linked Supabase project via `supabase db push` before the application code changes are merged; without it, zero realtime events will fire from either table.

> **Deployment constraint**: This migration is the gating dependency for the entire slice. Acceptance gates 1, 2, and 3 from the proposal all fail silently if this migration has not been applied to the target environment.

#### Scenario: Migration applies cleanly

- GIVEN migrations 00001–00014 applied and neither `matches` nor `room_members` published to `supabase_realtime`
- WHEN `00015_realtime_publication.sql` is applied
- THEN both tables appear in `SELECT tablename FROM pg_publication_tables WHERE pubname = 'supabase_realtime'`
- AND no error is raised

#### Scenario: Migration is idempotent

- GIVEN migration 00015 has already been applied
- WHEN migration 00015 is run a second time
- THEN no error is raised
- AND `pg_publication_tables` still contains exactly one entry per table

#### Scenario: Migration sequencing

- GIVEN the migration file is named `00015_realtime_publication.sql`
- WHEN migration tooling applies pending migrations in filename order
- THEN 00015 applies after 00014 and before any future 00016+ migrations
- AND the migration name reflects its purpose (realtime publication setup)

## Out of Scope
- `REPLICA IDENTITY` changes — `room_members` already has `REPLICA IDENTITY FULL` from `00001_schema.sql`; `matches` keeps default (PK-only) REPLICA IDENTITY, which is sufficient for UPDATE events.
- New tables or column alterations.
- `pnpm gen-types` re-run (developer workflow, not a formal requirement).
