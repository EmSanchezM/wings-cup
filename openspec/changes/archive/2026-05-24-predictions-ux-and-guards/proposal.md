# Proposal — predictions-ux-and-guards (Slice 4 of 5)

**Date**: 2026-05-24
**Status**: proposed
**Branch (planned)**: `feat/predictions-ux-and-guards`
**Inherits**: foundation, rooms-and-invitations, matches-and-predictions

---

## 1. Problem Statement

Slice 3 (matches-and-predictions) shipped a fully correct backend (170/170 tests green) but the verify pass flagged three real product-quality regressions that block end users from actually using the feature:

- **W-03**: `app/pages/rooms/[id]/predictions.vue` declares `matchId = ref('')` but renders no control to set it; `handleSubmit()` silently no-ops on every click. The predictions page is effectively non-functional in production despite passing all backend tests.
- **S-02**: `app/pages/rooms/[id]/leaderboard.vue` uses the same `useSupabaseUser() + onMounted` guard pattern that we already established is unreliable in `@nuxtjs/supabase` v2 (the same hydration gap fixed for the admin page in commit 9f8c0d7). The page is also covered by the module-level redirect, making the manual guard both redundant and broken.
- **W-01 / W-02** (cosmetic / spec accuracy): the project-setup spec still carries a stale R-PS-30 CLI string and an R-PS-31 manifest entry (`audit-entry.schema.ts`) that was deliberately not created. The spec text must catch up with the implementation reality.

Slice 4 closes these gaps so users can actually submit predictions end-to-end, removes the unreliable guard, and brings the spec back in sync with the code.

---

## 2. Scope

### In scope

- W-03: redesign `rooms/[id]/predictions.vue` as a scrollable list of match cards. New `app/components/MatchPredictionCard.vue` component. Reuse `useMatches` + existing `predClient.getPredictions(roomId)`. Client-side join by `match_id`.
- W-03 filter: list only matches where `status === 'scheduled'` (postponed / finished / in_progress excluded).
- W-03 already-predicted: cards remain inline-editable until `kickoff_at`, with scores pre-filled from the existing prediction.
- W-03 locked: matches with `locked_at IS NOT NULL` render as read-only cards with a lock badge so users keep visibility of their pick.
- W-03 empty state: when no scheduled+unlocked matches are available, render "No hay partidos disponibles para pronosticar" with a link to the leaderboard (no redirect).
- S-02 (leaderboard): delete the broken `useSupabaseUser + onMounted` guard from `app/pages/rooms/[id]/leaderboard.vue`; rely on the module-level `include: ['/rooms(/*)?']` redirect already configured in `nuxt.config.ts`. Move `load()` into a plain `onMounted`.
- W-01: emit a spec note confirming R-PS-30 text in `openspec/specs/project-setup/spec.md` is already correct (`supabase db query --linked -f`).
- W-02: update R-PS-31 manifest in `openspec/specs/project-setup/spec.md` — remove `audit-entry.schema.ts` from the file list and add a comment that `AuditLogRow` lives in `server/handlers/audit-log.ts` as a TS interface (server-only, no runtime validation needed).
- Tests: update `tests/nuxt/predictions.nuxt.test.ts` to mock the new card-list flow.

### Out of scope

- `app/pages/join/[code].vue` — its `useSupabaseUser()` usage drives the guest→member conditional UI, not a redirect guard. Leave it.
- New server endpoints (no `/api/me`, no `/api/rooms/[id]/predictions+matches` join endpoint). All joining happens client-side.
- New Zod schemas (`audit-entry.schema.ts` will NOT be created in this slice — documented as a deliberate decision).
- Per-match deep-link routes (`/rooms/[id]/predictions/[matchId]`).
- Standardising auth guards across other pages beyond `leaderboard.vue`.
- Refactoring `PredictionForm.vue` API surface — the new card encapsulates layout; the form stays as-is.

---

## 3. Approach (per work item)

### W-03 — Match card list page

- **Rewrite** `app/pages/rooms/[id]/predictions.vue` so its template is a list of cards, one per scheduled match in the room.
- **New component** `app/components/MatchPredictionCard.vue`:
  - Props: a `MatchListItem` + the user's existing `Prediction | null` for that match + `roomId`.
  - Owns its own local state (`predictedHome`, `predictedAway`, `submitting`, `error`). Per-card state, no global form state — keeps each card self-contained and avoids "which match am I editing" ambiguity.
  - Renders: team names, kickoff time (`toLocaleString()` for tz safety), score inputs pre-filled from existing prediction, submit button.
  - Locked state (`locked_at !== null`): renders inputs disabled + a lock badge; scores still visible.
  - Submit calls existing `predClient.upsertPrediction(...)` — no backend change.
- **Page data flow**:
  1. On mount: `useMatches()` (filtered to `status === 'scheduled'`) + `predClient.getPredictions(roomId)` in parallel.
  2. Client-side join by `match_id` → array of `{ match, prediction | null }`.
  3. Render one `<MatchPredictionCard>` per entry, or the empty-state message + leaderboard link if the array is empty.
- **Why this approach** (vs. a single shared form with a select): a card-per-match layout is the natural mobile pattern, avoids "select then edit then re-select" friction, and lets us render locked items inline alongside editable ones without mode-switching. Per-card local state means no Vuex/Pinia-style coordination is needed for a list of independent forms.

### S-02 — Leaderboard guard

- **Delete** the `const user = useSupabaseUser()` import + the `onMounted(() => { if (!user.value) navigateTo('/login') })` block from `app/pages/rooms/[id]/leaderboard.vue`.
- **Keep** the `load()` invocation, but move it into a plain `onMounted(() => load())` so behaviour is unchanged for the happy path.
- **Rely on** the module-level `supabase.redirectOptions.include: ['/rooms(/*)?']` in `nuxt.config.ts` to handle unauthenticated redirects before the page renders.
- If a session expires mid-session, `useLeaderboard()` already surfaces the resulting 401 as an `error` ref — acceptable graceful degradation (consistent with the rest of the rooms tree).
- **Not introducing** a `GET /api/me` endpoint in this slice. The leaderboard page does not need user identity, only auth presence — the module redirect is sufficient.

### W-01 — R-PS-30 spec text

- Open `openspec/specs/project-setup/spec.md`, locate R-PS-30, verify the script string matches `"seed:matches": "supabase db query --linked -f supabase/seeds/matches.sql"`.
- It already does (commit f717cb6). Add a brief inline note that the verify-report flagged this and the spec is confirmed current.

### W-02 — R-PS-31 manifest accuracy

- In `openspec/specs/project-setup/spec.md`, edit R-PS-31:
  - Remove `shared/schemas/audit-entry.schema.ts` from the new-files manifest.
  - Add a sentence: "The audit log row shape lives in `server/handlers/audit-log.ts` as the `AuditLogRow` TypeScript interface. A Zod schema is intentionally not created because `audit_log` is server-internal only; all writes originate from server handlers with statically known shapes, so runtime validation adds no value."
- This is a documentation-only change — no code touched in this work item.

---

## 4. Delivery Strategy

- **Single PR to `main`** on a new branch `feat/predictions-ux-and-guards`.
- Estimated footprint: ~5 files changed, ~250–350 LOC total (one new component, one rewritten page, one trimmed page, one spec edit, one test update).
- Well under the 400-line review budget. **Auto-chain / chained PRs are NOT needed** for this slice.
- Conventional commit at apply time: `feat(predictions): match card list + leaderboard guard cleanup` (or similar — final phrasing decided at apply).

---

## 5. Acceptance Gates

1. A user on `rooms/[id]/predictions` can pick a future scheduled match from the visible card list and submit a prediction successfully — verified end-to-end, not just code-complete.
2. Already-predicted matches show pre-filled scores and remain editable until `kickoff_at`.
3. Matches with `locked_at IS NOT NULL` render as read-only cards with a lock badge; scores remain visible.
4. When there are zero scheduled+unlocked matches available, the empty-state message with leaderboard link is rendered (no redirect).
5. `app/pages/rooms/[id]/leaderboard.vue` no longer imports `useSupabaseUser`; the module-level redirect in `nuxt.config.ts` is the sole guard for unauthenticated access to the page.
6. `openspec/specs/project-setup/spec.md` reflects: R-PS-30 confirmed current, R-PS-31 manifest no longer lists `audit-entry.schema.ts` and explicitly documents the TS-interface decision.
7. `pnpm test:unit` and `pnpm test:nuxt` both green; predictions.nuxt.test.ts updated for the card-list flow.
8. No new runtime dependencies added to `package.json`.

---

## 6. Risks

- **Timezone display on `kickoff_at`**: server stores UTC; client must use `toLocaleString()` (or equivalent) so users see local kickoff time. Mismatch would cause "this match looks future" / "server rejects with already-started" confusion. Mitigation: explicit `Date(kickoff_at).toLocaleString()` in the card, plus a client-side `kickoff_at > now` filter is NOT required (server already filters by `status === 'scheduled'`, and `upsertPrediction` enforces the kickoff gate authoritatively).
- **Per-card local state explosion**: with N visible cards, we have N independent reactive state islands. Acceptable for the expected match counts (≤64 across the tournament, likely ≤8 active at any time). Mitigated by moving state into the `MatchPredictionCard` component (Vue handles isolation cleanly).
- **Nuxt test mock surface change**: `predictions.nuxt.test.ts` currently mocks the old single-form flow. The new card-list flow changes the DOM shape; tests must be re-derived. Risk of mock drift if `useMatches` mock isn't updated in lockstep.
- **Stale session edge case**: deleting the leaderboard `onMounted` guard means a user whose JWT silently expired mid-session sees the 401 surfaced through `useLeaderboard().error` rather than a redirect. This is the same behaviour as `predictions.vue` already has — accepted as consistent graceful degradation, not a regression.
- **R-PS-31 manifest count drift**: removing `audit-entry.schema.ts` shrinks the file-count in the manifest. Need to update any "N files added" tally if R-PS-31 lists one.

---

## 7. Decisions Baked In (user-approved during exploration)

1. Match filter is `status === 'scheduled'` — postponed / finished / in_progress are excluded from the list.
2. Already-predicted matches stay editable until `kickoff_at`, same card, scores pre-filled.
3. Locked matches render as read-only cards with a lock badge — users keep visibility of their submitted pick.
4. Empty state shows a friendly message + link to leaderboard; no automatic redirect.
5. `app/pages/join/[code].vue` is explicitly out of scope — its `useSupabaseUser()` is reactive UI for the guest→member flow, not a guard.
6. `AuditLogRow` stays as a TS interface in `server/handlers/audit-log.ts`. No `audit-entry.schema.ts` Zod file in this slice; R-PS-31 manifest is updated to document the choice.
