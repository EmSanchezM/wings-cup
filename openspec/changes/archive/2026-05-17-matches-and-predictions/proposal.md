# Proposal: matches-and-predictions (Slice 3 of 5)

**Status**: proposed
**Date**: 2026-05-17
**Change name**: matches-and-predictions
**Artifact store**: engram (primary) + openspec (file trail)
**Inherits from**: foundation, rooms-and-invitations
**Delivery strategy**: auto-chain (2 chained PRs; may collapse to single-pr if total < 400 lines after sdd-tasks forecast)

---

## 1. Problem Statement

Wings Cup users can create rooms and invite friends, but there is nothing to predict and no way to score them. Slice 3 closes that loop: super-admins seed and curate the FIFA 2026 fixture catalog, room members submit pre-kickoff score predictions, and the existing `calculate_points` trigger awards points the moment a match transitions to `finished`. We deliberately reject any external API or scraping integration (explicit user constraint) and we reject auto-cron locking in this slice. Slice 3 is a **manual-admin, self-contained** vertical that proves the prediction lifecycle end-to-end on top of the foundation already in place.

---

## 2. Capabilities (high-level user stories)

| # | Actor | Capability |
|---|-------|------------|
| C1 | Authenticated user | View the full match catalog (group + knockout) with kickoff times, status, and scores when finished |
| C2 | Room member | Create or update a per-match prediction for any room they belong to, before kickoff |
| C3 | Room member | View a room leaderboard ordered by points (desc) with deterministic tie-break |
| C4 | Super-admin | Update a match (status, scores, substitute placeholder team names) via `/admin/matches` |
| C5 | Super-admin | Manually lock predictions that have already kicked off via a "Lock Predictions Now" button |
| C6 | System | Every super-admin match mutation writes an `audit_log` row for traceability |

---

## 3. Approach

Slice 3 stays on the Clean Architecture rails established in slice 2: pure handlers in `server/handlers/<name>.ts`, thin H3 wrappers in `server/api/...`, Zod schemas in `shared/schemas/`, types in `shared/types/`, composables in `app/composables/`. Strict TDD remains active — every handler ships with a failing unit test first.

**Three structural anchors**:

1. **PR-1 Task 1 is the RLS fix migration (`00014_fix_pred_rls.sql`)**. The `pred_insert_own_before_kickoff` and `pred_update_own_unlocked` policies still use bare `auth.uid()` (they were not patched in `00013`). This is the exact failure mode that produced 42501 errors in slice 2. No prediction-touching code is written until this migration lands.
2. **Predictions do NOT need the two-step INSERT pattern** — there is no AFTER trigger on `predictions` INSERT that creates related rows, so `.upsert(..., { onConflict: 'room_id,user_id,match_id' }).select().single()` is safe.
3. **Match writes use the existing `requireSuperAdmin(event)` utility + `serverSupabaseServiceRole`** — matches table is intentionally service-role-only at the RLS layer (no `matches_update_super_admin` policy). The handler defense (`is_super_admin` check before any mutation) is the security boundary.

**Schema correction (locked)**: the tournament-round column is `stage` (not `phase`). All schemas, types, seed columns, and admin UI MUST use `stage`. Allowed values per CHECK constraint: `group`, `round_of_16`, `quarter`, `semi`, `final`, `third_place`. `group_name` holds the group letter (`A`–`H`) and is NULL for knockout matches.

**Seed strategy**: a static `supabase/seeds/matches.sql` file containing 64 INSERTs guarded by `INSERT ... ON CONFLICT (external_id) DO NOTHING`. A `pnpm seed:matches` script invokes `supabase db query --linked -f` against the **linked remote Supabase**. (Note: The original proposal specified local-only via `db execute --file`, but the Supabase CLI deprecated that command; the current invocation is `db query --linked -f`.)

**Leaderboard**: direct `SELECT` on `room_members` joined to `profiles.display_name`, ordered by `total_points DESC, joined_at ASC`. Uses the existing `idx_room_members_room_points` index. No view, no RPC.

---

## 4. In Scope

### 4.1 Migrations & data
- `supabase/migrations/00014_fix_pred_rls.sql` — drop + recreate `pred_insert_own_before_kickoff` and `pred_update_own_unlocked` using `(SELECT auth.uid())`. Forward-only, idempotent.
- `supabase/seeds/matches.sql` — 64-row fixture file. Group stage rows include `group_name` and concrete team names. Knockout rows use placeholder text (`"Group A Winner"`, `"Group A Runner-up"`, etc.) per locked decision D2.
- `pnpm seed:matches` npm script. Uses `supabase db query --linked -f` (current CLI).

### 4.2 Handlers (4)
- `server/handlers/list-matches.ts` — public catalog read
- `server/handlers/update-match.ts` — super-admin only; writes `audit_log` in same transaction context
- `server/handlers/upsert-prediction.ts` — composite-key upsert; RLS gates kickoff
- `server/handlers/get-leaderboard.ts` — room-scoped, ordered by `total_points DESC, joined_at ASC`

### 4.3 API endpoints (5)
- `GET  /api/matches`
- `PATCH /api/admin/matches/[id]`
- `POST /api/admin/matches/lock-now` (calls `lock_started_predictions()` RPC) — locked decision D4
- `POST /api/rooms/[id]/predictions`
- `GET  /api/rooms/[id]/leaderboard`

### 4.4 Pages (3 new + 1 edited)
- `app/pages/admin/matches/index.vue` — list + status/score edit form + "Lock Predictions Now" button
- `app/pages/rooms/[id]/predictions.vue` — match list with inline upsert forms, grouped by date/stage; UI must surface the gotcha: "Predictions are locked when the match starts. Unlocked predictions are not scored."
- `app/pages/rooms/[id]/leaderboard.vue`
- `app/pages/rooms/[id]/index.vue` — edited to add navigation links to the two new pages

### 4.5 Schemas & types (4)
- `shared/schemas/match.schema.ts` — admin update payload (status, home_score, away_score, optional team-name overrides)
- `shared/schemas/prediction.schema.ts` — upsert payload (`match_id`, `predicted_home`, `predicted_away`)
- `shared/schemas/leaderboard.schema.ts` — query shape (room_id from URL)
- `shared/types/matches.ts`, `shared/types/predictions.ts` — `Tables<'matches'>`-derived view types

### 4.6 Composables & client utils (2)
- `app/composables/useMatches.ts`
- `app/composables/useLeaderboard.ts`
- (`app/utils/prediction-client.ts` + `app/utils/match-client.ts` follow the established `makeXxxClient($fetch)` pattern)

### 4.7 Tests (5 new files)
- `tests/unit/handlers/list-matches.test.ts`
- `tests/unit/handlers/update-match.test.ts`
- `tests/unit/handlers/upsert-prediction.test.ts`
- `tests/unit/handlers/get-leaderboard.test.ts`
- `tests/nuxt/predictions.test.ts`

### 4.8 Locked constraints (decided, not optional)
- **D1** Seed targets linked remote Supabase via `pnpm seed:matches`; idempotent on `external_id`.
- **D2** Knockout placeholder strings: `"Group A Winner"`, `"Group A Runner-up"`, etc. Admin substitutes real names post-group-stage.
- **D3** Leaderboard tie-break: `total_points DESC, joined_at ASC`.
- **D4** "Lock Predictions Now" admin button is IN scope; invokes `lock_started_predictions()` RPC under service role.
- **D5** Every admin match mutation writes one `audit_log` row.

---

## 5. Out of Scope

| Excluded | Reason |
|----------|--------|
| External fixture API or scraping integration | Explicit user constraint |
| Automatic cron lock of started predictions | Manual button suffices; cron deferred to a later slice |
| Realtime push of match/leaderboard updates | Slice 4+ |
| Bracket visualization UI | Not required for the prediction lifecycle |
| Multi-tournament support | Single-tournament assumed; schema doesn't model others |
| Performance optimization beyond existing indexes | Personal project scope; `idx_room_members_room_points` is sufficient |
| Per-match detail page (`/rooms/[id]/match/[matchId]`) | All matches inline in `/rooms/[id]/predictions` instead |
| New runtime dependencies | Existing stack is sufficient; types-only packages OK if strictly needed |
| `.env*` edits | Permission-gated; surface as manual follow-up if needed (not anticipated) |

---

## 6. Locked Decisions Table

| ID | Decision | Locked value |
|----|----------|--------------|
| D1 | Seed strategy | `pnpm seed:matches` → linked remote Supabase, file `supabase/seeds/matches.sql`, idempotent on `external_id` |
| D2 | Knockout placeholders | Text strings like `"Group A Winner"`, `"Group A Runner-up"` in `home_team`/`away_team`; admin edits post-group |
| D3 | Leaderboard tie-break | `ORDER BY total_points DESC, joined_at ASC` |
| D4 | Lock Predictions Now button | IN scope; admin matches page; calls `lock_started_predictions()` RPC under service role |
| D5 | Audit log on match updates | IN scope; every super-admin `matches` mutation writes an `audit_log` row |
| Inherited | Architecture | Clean Architecture — handlers + thin H3 wrappers + Zod + composables |
| Inherited | TDD | Strict TDD: failing test before code; `pnpm test:unit`, `pnpm test:nuxt` |
| Inherited | Two-step INSERT | NOT required for predictions (no AFTER trigger). Standard `.upsert().select().single()` is safe |
| Inherited | Migrations | Forward-only, idempotent. `00014_fix_pred_rls.sql` is PR-1 task 1 |
| Inherited | Dependencies | No new runtime deps preferred (types-only OK) |
| Inherited | External APIs | NONE. Slice 3 is self-contained |
| Inherited | Schema | Column is `stage`, NOT `phase`. Confirmed in `database.types.ts` |

---

## 7. Risks

| # | Risk | Severity | Mitigation |
|---|------|----------|------------|
| R1 | Bare `auth.uid()` in `pred_insert_own_before_kickoff` + `pred_update_own_unlocked` reproduces the slice-2 42501 failure | HIGH | Migration `00014_fix_pred_rls.sql` is PR-1 task 1 — no prediction code touches the DB until it lands |
| R2 | Seed file drifts if FIFA changes the 2026 fixture list between seed authoring and the tournament | MEDIUM | `ON CONFLICT (external_id) DO NOTHING` keeps re-seeding safe; admin can edit individual rows; the file is in git, drift is reviewable |
| R3 | `calculate_points` silently awards 0 to predictions with `locked_at IS NULL` | MEDIUM | UI on `/rooms/[id]/predictions` MUST display: "Predictions are locked when the match starts. Unlocked predictions are not scored." D4 button mitigates the gap for predictions made after kickoff |
| R4 | PR-1 size budget (~320–400 lines; seed file is dense SQL) approaches the 400-line guard | MEDIUM | Auto-chain delivery strategy; sdd-tasks Review Workload Forecast will confirm whether to split or keep single-PR with `size:exception` |
| R5 | Audit-log writes from admin endpoints run under service role (no RLS gate) — a bug bypassing `requireSuperAdmin` would let any caller forge audit entries | MEDIUM | `requireSuperAdmin(event)` is invoked at the top of every admin handler before any DB call; unit tests assert the 403 path; service role is never injected into non-admin handlers |

---

## 8. Open Questions

None. The five open questions from the exploration (D1–D5) were resolved by the user on 2026-05-17 and are locked above.

---

## 9. Delivery Strategy

**`auto-chain`** with a 2-PR forecast:

- **PR-1** `feat/matches-seed-and-admin` (~320–400 lines): migration `00014`, seed file, `seed:matches` script, match schemas/types, `list-matches` + `update-match` handlers, public list + admin PATCH + `lock-now` endpoints, admin matches page, audit-log wiring.
- **PR-2** `feat/predictions-and-leaderboard` (~280–360 lines): prediction + leaderboard schemas/types, `upsert-prediction` + `get-leaderboard` handlers, `POST /api/rooms/[id]/predictions`, `GET /api/rooms/[id]/leaderboard`, composables, predictions page, leaderboard page, `rooms/[id]/index.vue` nav edit, nuxt test.

If `sdd-tasks` Review Workload Forecast shows total < 400 lines (unlikely but possible if seed is compressed), the orchestrator may collapse to `single-pr`. Otherwise the auto-chain proceeds without asking.

---

## 10. Acceptance gates downstream

- `sdd-spec` + `sdd-design` can run in parallel after this proposal.
- Gate P1 (spec/design cross-check) MUST pass before `sdd-tasks`.
- Gate P2 (Known Gotchas Addressed) MUST appear in `design.md`.
- Strict TDD enforcement is forwarded to `sdd-apply` and `sdd-verify`.
