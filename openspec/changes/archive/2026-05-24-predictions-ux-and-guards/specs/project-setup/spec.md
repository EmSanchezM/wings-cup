# Project Setup Spec — Delta for predictions-ux-and-guards (Slice 4)

## Overview
Delta. R-PS-31 is MODIFIED: removes `shared/schemas/audit-entry.schema.ts` from the new-files manifest and documents the deliberate decision to use a plain TypeScript interface instead of a Zod schema for `AuditLogRow`. R-PS-30 is confirmed current (no text change needed — already corrected in commit f717cb6). R-PS-32 inherits unchanged.

## Requirements Summary
| Req | Title | Change | Scenarios |
|-----|-------|--------|-----------| 
| R-PS-31 | New Files Manifest | MODIFIED | 3 |

---

## MODIFIED Requirements

### R-PS-31: New Files Manifest
**Type**: MODIFIED | **Source**: W-02
(Previously: listed 22 new files including `shared/schemas/audit-entry.schema.ts`.)

The new-files manifest introduced by matches-and-predictions (Slice 3) MUST NOT include `shared/schemas/audit-entry.schema.ts`. The file count MUST be corrected to 21 new files (not 22). The `AuditLogRow` shape is defined as a plain TypeScript interface in `server/handlers/audit-log.ts`. A Zod schema for `AuditLogRow` MUST NOT be created in this slice or treated as a missing deliverable. The rationale MUST be documented: `audit_log` is server-internal only; all write calls originate from server handlers with statically known shapes; no untrusted client input is parsed against this type; runtime validation adds no value. This decision was confirmed by the Slice 4 verify pass (2026-05-24).

The remainder of the manifest — all other 21 files — is unchanged from Slice 3 and MUST be present after Slice 3 is merged.

R-PS-30 (`pnpm seed:matches` script) is confirmed current: the script string `"seed:matches": "supabase db query --linked -f supabase/seeds/matches.sql"` in `package.json` matches the implementation as of commit f717cb6. No text change to R-PS-30 is required.

#### Scenario: audit-entry.schema.ts absent from manifest and repository

- GIVEN the Slice 3 + Slice 4 branches are merged
- WHEN `git ls-files shared/schemas/` is inspected
- THEN `audit-entry.schema.ts` is NOT present
- AND no CI or test step fails because of its absence

#### Scenario: AuditLogRow interface present in server handler

- GIVEN the implementation file `server/handlers/audit-log.ts` is read
- WHEN searching for `AuditLogRow`
- THEN it is defined as a TypeScript interface (not a Zod schema)
- AND it is used only within server-side handler code

#### Scenario: Manifest file count is 21

- GIVEN R-PS-31 is inspected in the spec
- WHEN the listed new files are counted
- THEN the total is 21 (not 22)
- AND `shared/schemas/audit-entry.schema.ts` is not in the list
