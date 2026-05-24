# Tasks: leaderboard-realtime-via-matches (Slice 7 of 7)

**Date**: 2026-05-24
**Status**: COMPLETE
**Branch**: `feat/leaderboard-realtime-via-matches`
**Delivery strategy**: `single-pr` (~90 LOC estimated; well within 400-line budget)
**Strict TDD**: ACTIVE (RED → GREEN → REFACTOR per block)
**Test commands**: `pnpm test:unit` | `pnpm test:nuxt` | `npx vue-tsc --noEmit`
**Numbering**: continues from T-96 (slice 6 ended at T-96), blocks from B37

---

## Block B37 — useMatches.subscribe channelName param (sequential: RED → GREEN)

**Satisfies**: R-RT-02 (MODIFIED)
**Files**: `app/composables/useMatches.ts`, `tests/unit/use-matches-realtime.test.ts`

- [x] T-97: [RED] `tests/unit/use-matches-realtime.test.ts`
  - Add test: `subscribe(onUpdate)` with no second arg → `channel('matches-updates')` called (default)
  - Add test: `subscribe(onUpdate, 'matches-leaderboard-reload')` → `channel('matches-leaderboard-reload')` called
  - Add test: both call signatures satisfy TypeScript (no type error) — verified by vue-tsc pass
  - Confirm existing tests still describe a single hardcoded `'matches-updates'` (they do — no change needed to them)
  - Suite MUST be RED on current codebase (subscribe signature only takes 1 arg)

- [x] T-98: [GREEN] `app/composables/useMatches.ts`
  - Change `subscribe(onUpdate)` signature to `subscribe(onUpdate, channelName = 'matches-updates')`
  - Replace the single hardcoded `'matches-updates'` string in the channel creation call with `channelName`
  - No other logic changes
  - Suite MUST go GREEN: all prior tests pass unchanged + 2 new tests pass

  **Commit**: `db6341b feat(useMatches): add optional channelName param to subscribe (R-RT-02)`

---

## Block B38 — leaderboard.vue matches-driven reload wire (sequential: RED → GREEN)

**Satisfies**: R-LEAD-04 (new scenarios 5–7), R-RT-06
**Files**: `tests/unit/leaderboard-matches-reload.test.ts` (new), `tests/nuxt/leaderboard.nuxt.test.ts`, `app/pages/rooms/[id]/leaderboard.vue`
**Depends on**: B37 must be complete (T-98 GREEN) — leaderboard test asserts custom channel name, which requires the param to exist

- [x] T-99: [RED] `tests/unit/leaderboard-matches-reload.test.ts` (new file)
  - Mock `useMatches().subscribe` and `useLeaderboard(roomId).load`
  - Test: `payload.new.status === 'finished'` → `load()` called after 300ms (use fake timers)
  - Test: `payload.new.status === 'live'` → `load()` NOT called
  - Test: `payload.new.status === 'scheduled'` → `load()` NOT called
  - Test: two rapid `finished` payloads within 300ms → `load()` called exactly ONCE (debounce)
  - Test: cleanup called before timer fires → `load()` NOT called (timer cleared)
  - Suite MUST be RED (none of this wiring exists in leaderboard.vue yet)

- [x] T-100: [RED] `tests/nuxt/leaderboard.nuxt.test.ts`
  - Add structural assertion: leaderboard.vue source contains `subscribeMatches` (or `useMatches`)
  - Add structural assertion: leaderboard.vue source contains `'matches-leaderboard-reload'`
  - Add structural assertion: leaderboard.vue source contains `onMatchUpdate` (the handler name)
  - Confirm existing 4 tests (from slice 6, B35 T-93) still pass — no regressions
  - Suite MUST be RED on new assertions (wiring not yet added)

- [x] T-101: [GREEN] `app/pages/rooms/[id]/leaderboard.vue`
  - Import `useMatches` and `MatchListItem` type
  - Destructure `subscribe: subscribeMatches` from a new `useMatches()` call
  - Declare `let matchesCleanup: (() => void) | null = null` and `let matchReloadTimer: ReturnType<typeof setTimeout> | null = null`
  - Implement `onMatchUpdate(payload)`:
    - Early return if `payload.new.status !== 'finished'`
    - `if (matchReloadTimer) clearTimeout(matchReloadTimer)`
    - `matchReloadTimer = setTimeout(() => void load(), 300)`
  - In `onMounted`: add `matchesCleanup = subscribeMatches(onMatchUpdate, 'matches-leaderboard-reload')`
  - In `onUnmounted`: add `if (matchReloadTimer) clearTimeout(matchReloadTimer)` + `matchesCleanup?.()`
  - Keep existing `useLeaderboard(roomId).subscribe(onUpdate)` wiring untouched
  - All 5 unit tests (T-99) and all Nuxt structural tests (T-100) MUST go GREEN
  - `pnpm test:unit` + `pnpm test:nuxt` + `npx vue-tsc --noEmit` all GREEN

  **Commit**: `588a2cf feat(leaderboard): matches-driven reload on finished match (R-LEAD-04, R-RT-06)`

---

## Block B39 — useLeaderboard.subscribe "superseded" annotation (CHORE, independent)

**Satisfies**: R-RT-06 (comment obligation), Proposal §3 / acceptance gate 5
**Files**: `app/composables/useLeaderboard.ts`
**Depends on**: none — can run in parallel with B37 or B38, but MUST commit after B38 is GREEN to keep logical coherence
**Note**: no test change needed — comment-only, no behaviour change

- [x] T-102: [CHORE] `app/composables/useLeaderboard.ts`
  - Added block comment immediately above subscribe:
    ```
    // NOTE: superseded by matches-driven reload in leaderboard.vue due to Supabase Realtime
    // + SECURITY DEFINER RLS interaction on room_members (bug #400 / R-RT-06).
    // Kept as-is — correct code, tested, ready to re-enable as primary source if/when
    // Supabase resolves the SECURITY DEFINER + Realtime RLS issue or we migrate to
    // Broadcast Changes. See proposal sdd/leaderboard-realtime-via-matches for context.
    ```
  - No logic changes; no test changes
  - `npx vue-tsc --noEmit` passed

  **Commit**: `276e40a chore(useLeaderboard): annotate subscribe as superseded by matches-driven reload (R-RT-06)`

---

## Block B40 — Wrap-up (sequential: after B37, B38, B39 all GREEN)

**Satisfies**: Acceptance gates 6–7 (full suite green, no new runtime deps)
**Depends on**: all prior blocks complete

- [x] T-103: [VERIFY]
  - `pnpm test:unit`: 27 test files, 206 tests — all passed
  - `pnpm test:nuxt`: 4 test files, 36 tests — all passed
  - `npx vue-tsc --noEmit`: 0 errors
  - `package.json`: deps=15, devDeps=11 — unchanged
  - No wrap-up fix commit needed

---

## Dependency Graph

```
T-97 (RED useMatches param)
  └─▶ T-98 (GREEN useMatches param) ──▶ T-99 (RED unit leaderboard)
                                    └─▶ T-100 (RED nuxt leaderboard)
                                              ↓
                                         T-101 (GREEN leaderboard.vue) ──▶ T-103 (verify) ✓
                                                                              ↑
T-102 (CHORE comment) ──────────────────────────────────────────────────────┘
```

## Coverage Matrix

| Requirement | Satisfied by | Tasks | Status |
|-------------|-------------|-------|--------|
| R-RT-02 (MODIFIED) — optional channelName param | B37 | T-97, T-98 | DONE |
| R-LEAD-04 (MODIFIED) — scenarios 5, 6, 7 | B38 | T-99, T-100, T-101 | DONE |
| R-RT-06 (ADDED) — matches-driven reload contract | B38 + B39 | T-99, T-100, T-101, T-102 | DONE |
