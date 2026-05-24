# Tasks: predictions-ux-and-guards (Slice 4 of 5)

**Date**: 2026-05-24
**Status**: COMPLETE
**Delivery strategy**: `single-pr` — single PR to `main` on branch `feat/predictions-ux-and-guards`
**Strict TDD**: ACTIVE (RED → GREEN → REFACTOR)
**Test commands**: `pnpm test:unit` | `pnpm test:nuxt`
**Task numbering**: T-47..T-57 (continues from slice 3 T-46)
**Block numbering**: B14..B18 (continues from slice 3 B13)

---

## B14 — MatchPredictionCard component (RED → GREEN → REFACTOR)

- [x] T-47: [RED] Write `tests/nuxt/predictions.nuxt.test.ts` test group for `MatchPredictionCard` (5 scenarios)
- [x] T-48: [GREEN] Create `app/components/MatchPredictionCard.vue`
- [x] T-49: [REFACTOR] Delete `app/components/PredictionForm.vue` (absorbed into MatchPredictionCard — dead code)

## B15 — predictions.vue page redesign (RED → GREEN → REFACTOR)

- [x] T-50: [RED] Add B15 page test group (6 scenarios)
- [x] T-51: [GREEN] Rewrite `app/pages/rooms/[id]/predictions.vue` — parallel fetch, client-side join, empty state
- [x] T-52: [REFACTOR] Extract `joinMatchesWithPredictions` helper function

## B16 — leaderboard.vue guard deletion (CHORE)

- [x] T-53: Delete `useSupabaseUser` import + `onMounted` redirect block from leaderboard.vue; plain `onMounted(() => load())`

## B17 — project-setup spec patch (CHORE)

- [x] T-54: Patch R-PS-31: file count 22→21; remove audit-entry.schema.ts; add rationale note
- [x] T-55: Confirm R-PS-30 text matches implementation (no text change needed)

## B18 — wrap-up (CHORE)

- [x] T-56: `pnpm test:unit` — 164/164 GREEN
- [x] T-57: `pnpm test:nuxt` — 13/13 GREEN; leaderboard.vue has zero useSupabaseUser references

---

## Final test counts
- unit: 164/164 (19 files)
- nuxt: 13/13 (2 files — app.smoke + predictions)
