# Tasks: realtime-match-and-leaderboard (Slice 6 of 6)

**Date**: 2026-05-24
**Status**: COMPLETE — all tasks done
**Branch**: `feat/realtime-match-and-leaderboard`
**Delivery strategy**: `single-pr` (~310 LOC estimated; within 400-line budget)
**Strict TDD**: ACTIVE (RED → GREEN → REFACTOR per block)
**Test commands**: `pnpm test:unit` | `pnpm test:nuxt` | `npx vue-tsc --noEmit`
**Numbering**: continues from T-79 (slice 5 ended at T-79), blocks from B28

---

## Block B28 — [x] T-80 — Migration 00015

- [x] T-80: Write supabase/migrations/00015_realtime_publication.sql (idempotent DO $$ block)

## Block B29/B30 — applyMatchUpdate + useMatches.subscribe

- [x] T-81: [RED] tests/unit/use-matches-realtime.test.ts — applyMatchUpdate reducer tests
- [x] T-82: [GREEN] app/composables/useMatches.ts — applyMatchUpdate + subscribe
- [x] T-83: [RED] tests/unit/use-matches-realtime.test.ts — subscribe wiring tests
- [x] T-84: [GREEN] app/composables/useMatches.ts — subscribe implemented

## Block B31/B32 — applyMemberUpdate + useLeaderboard.subscribe

- [x] T-85: [RED] tests/unit/use-leaderboard-realtime.test.ts — applyMemberUpdate reducer tests
- [x] T-86: [GREEN] app/composables/useLeaderboard.ts — applyMemberUpdate + subscribe
- [x] T-87: [RED] tests/unit/use-leaderboard-realtime.test.ts — subscribe wiring tests
- [x] T-88: [GREEN] app/composables/useLeaderboard.ts — subscribe implemented

## Block B33 — MatchPredictionCard read-only modes

- [x] T-89: [RED] tests/nuxt/predictions.nuxt.test.ts — card read-only mode tests (6 new)
- [x] T-90: [GREEN] app/components/MatchPredictionCard.vue — isReadonly, badges, final score

## Block B34 — predictions.vue filter + subscribe

- [x] T-91: [RED] tests/nuxt/predictions.nuxt.test.ts — filter widening tests (2 new)
- [x] T-92: [GREEN] app/pages/rooms/[id]/predictions.vue — eligibleEntries + subscribe wire

## Block B35 — leaderboard.vue subscribe

- [x] T-93: [RED] tests/nuxt/leaderboard.nuxt.test.ts — structural subscribe tests (4)
- [x] T-94: [GREEN] app/pages/rooms/[id]/leaderboard.vue — subscribe wire

## Block B36 — Wrap-up

- [x] T-95: Full suite green — unit 199/199, nuxt 33/33, vue-tsc 0 errors, package.json deps unchanged
- [x] T-96: Migration deployment note in PR description
