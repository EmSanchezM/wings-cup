# Tasks: design-system-and-ui (Slice 8 of 8+)

**Date**: 2026-05-30
**Status**: pending
**Branch**: `feat/design-system-and-ui` (chain root)
**Delivery strategy**: `ask-on-risk` → resolved to **5 chained PRs**
**Strict TDD**: ACTIVE (RED → GREEN → REFACTOR per block)
**Test commands**: `pnpm test:unit` | `pnpm test:nuxt` | `npx vue-tsc --noEmit`
**Task numbering**: T-110.. (continues from T-109)
**Block numbering**: B40.. (continues from B39)

---

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~700–900 LOC |
| 400-line budget risk | **High** |
| Chained PRs recommended | **Yes** |
| Suggested split | 5 stacked PRs |
| Delivery strategy | chained PRs |
| Chain strategy | PR1 → `main`; PR2–5 branch off PR1, reviewable in parallel |

**Decision needed before apply: resolved** — chained PRs confirmed in proposal.

### Suggested Work Units

| Unit | Goal | Blocks | PR | Est. LOC |
|------|------|--------|----|----------|
| 1 | Dark token foundation + Badge | B40, B41 | PR 1 (→ main) | ~120 |
| 2 | Landing + Cómo Funciona | B42 | PR 2 (→ PR1) | ~170 |
| 3 | Predictions restyle + points sidebar | B43, B44 | PR 3 (→ PR1) | ~200 |
| 4 | Leaderboard/Ranking restyle + stats | B45 | PR 4 (→ PR1) | ~130 |
| 5 | Admin restyle + Select | B46, B47 | PR 5 (→ PR1) | ~150 |

---

## Coverage Matrix

| Requirement | Blocks |
|-------------|--------|
| R-DS-01, R-DS-02, R-DS-03 (token set, dark, shadcn resolves) | B40 |
| R-DS-04 (Badge) | B41 |
| R-DS-05 (flags + TeamFlag) | B48 |
| R-UX-06 (landing + Cómo Funciona) | B42 |
| R-UX-07 (predictions visual + points sidebar) | B43, B44 |
| R-UX-08 (admin visual + Select) | B46, B47 |
| R-UX-09 (leaderboard visual + stats) | B45 |

---

# ── PR 1: Dark token foundation ──

## B40 — Semantic token set + dark base (RED → GREEN)
**Satisfies**: R-DS-01, R-DS-02, R-DS-03 · **Files**: `tests/unit/design-tokens.test.ts`, `app/assets/css/tailwind.css`

- [x] T-110: [RED] `tests/unit/design-tokens.test.ts` — assert 19 `--color-*` tokens present + `oklch(`; `body` base rule sets bg/fg; `--color-primary` preserved.
- [x] T-111: [GREEN] Extend `@theme` with full OKLCH dark set per `design.md` §2 + `@layer base` body + default border-color.
- [x] T-112: [REFACTOR] Confirm `Button`/`Input` utilities resolve; grep semantic utilities vs defined tokens — no orphans.

## B41 — Badge primitive (RED → GREEN)
**Satisfies**: R-DS-04 · **Files**: `tests/nuxt/badge.nuxt.test.ts`, `app/components/ui/badge/{index.ts,Badge.vue}`

- [x] T-113: [RED] `tests/nuxt/badge.nuxt.test.ts` — renders slot; `destructive`/`accent` variants apply token classes.
- [x] T-114: [GREEN] `badge/index.ts` (`cva`: default/secondary/destructive/outline/accent) + `Badge.vue` (`cn` wrapper).

## B-PR1 — Wrap-up
- [x] T-115: [CHORE] `pnpm test:unit` (210/210) + `pnpm test:nuxt` (49/49) green; `vue-tsc` clean.
- [x] T-116: [CHORE] Work-unit commits (B40, B41) done. ⏳ Push + open PR 1 → `main` pending user confirmation.

---

# ── PR 2: Landing + Cómo Funciona (off PR 1) ──

## B42 — Landing page (RED → GREEN)
**Satisfies**: R-UX-06 · **Files**: `tests/nuxt/landing.nuxt.test.ts`, `app/pages/index.vue`

- [x] T-117: [RED] `tests/nuxt/landing.nuxt.test.ts` — "Wings Cup" + tagline present; CTA link `to="/auth/login"`; Cómo Funciona has 3 steps; not the bare placeholder.
- [x] T-118: [GREEN] Rewrite `index.vue` per `design.md` §4 — dark hero (badge pill, headline w/ emerald span, value prop, dual CTA, honest social-proof line, static preview card), Cómo Funciona (3 token cards + CTA), footer; SSR-safe year. (Fake "10k+ ligas" metric dropped — honesty.)
- [x] T-119: [REFACTOR] Responsive (mobile stacks, desktop two-col hero); emerald CTA contrast sanity.
- [x] T-120: [CHORE] Tests green (unit 210, nuxt 53); `vue-tsc` clean; commit done. ⏳ Push + open PR 2 pending user confirmation.

---

# ── Flags addition (folded into PR 2 — user request) ──

## B48 — Country flags + TeamFlag (RED → GREEN) ✅
**Satisfies**: R-DS-05 · **Files**: `public/flags/*.svg`, `shared/constants/team-flags.ts`, `app/components/TeamFlag.vue`, `tests/unit/team-flags.test.ts`, `tests/nuxt/team-flag.nuxt.test.ts`

- [x] T-138: [CHORE] Vendor 32 circle-flags SVGs (MIT) → `public/flags/{iso2}.svg` (jsdelivr; England = `gb-eng`).
- [x] T-139: [RED] `tests/unit/team-flags.test.ts` (5) — name→code map, `/flags` path, England subdivision, knockout→null, initials.
- [x] T-140: [GREEN] `shared/constants/team-flags.ts` — `TEAM_FLAG_CODES` + `flagCode`/`flagSrc`/`teamInitials`.
- [x] T-141: [RED] `tests/nuxt/team-flag.nuxt.test.ts` (2) — known country → `<img>`; knockout → initials fallback.
- [x] T-142: [GREEN] `app/components/TeamFlag.vue` — circular flag img + initials `<span>` fallback.
- [x] T-143: [GREEN] Wire `<TeamFlag>` into landing preview card (ARG/CHI + BRA/COL). Reused by predictions (B43) and admin (B47).

---

# ── PR 3: Predictions restyle + points sidebar (off PR 1) ──

## B43 — MatchPredictionCard restyle (RED → GREEN, script-invariant)
**Satisfies**: R-UX-07 (card) · **Files**: `tests/nuxt/predictions.nuxt.test.ts` (extend), `app/components/MatchPredictionCard.vue`

- [x] T-121: [PREP] Read current `MatchPredictionCard.vue` script; recorded `predictedHome/Away`, `isLocked`, `isReadonly`, `handleSubmit`, error/success/final-score bindings — reused verbatim.
- [x] T-122: [RED] `tests/nuxt/prediction-card-redesign.nuxt.test.ts` (4) — flags per team, "Pendiente" badge, live left border, **no `bg-*-50` literals remain**.
- [x] T-123: [GREEN] Restyle `MatchPredictionCard.vue` **template only** — status divs → token badge spans (kept exact texts "En vivo"/"Finalizado" + data-testids), `<TeamFlag>` per team (auto-import → no script import), kept native inputs (token-styled; name/readonly preserved), live `border-l-4 border-destructive`, per-card save kept. **`<script setup>` byte-identical to origin/main (verified via diff).**

## B44 — predictions.vue restyle + points sidebar (RED → GREEN)
**Satisfies**: R-UX-07 (page + sidebar) · **Files**: `tests/nuxt/predictions-page.nuxt.test.ts`, `app/pages/rooms/[id]/predictions.vue`

- [x] T-124: [RED] `tests/nuxt/predictions-sidebar.nuxt.test.ts` (4) — sidebar renders; "completados 1/2" from page data; puntos/posición from leaderboard + `useSupabaseUser` (mockNuxtImport); fetch-failure → cards render + figures show "—".
- [x] T-125: [GREEN] Restyle `predictions.vue` (two-col grid, header, list) + read-only `loadLeaderboard()` in `Promise.all` + `useSupabaseUser` deriving sidebar (completados on-page; puntos/posición from leaderboard). Non-fatal (useLeaderboard self-catches); no writes.
- [x] T-126: [VERIFY] `MatchPredictionCard` `<script setup>` byte-identical to origin/main (diff ✓); `predictions.vue` additions read-only; all 22 pre-existing predictions tests green unmodified (nuxt 63/63). NOTE: T-50-05's title says "no useSupabaseUser import" — now stale (scope approved adding it); its assertion is a mount smoke-check and still passes; left unmodified.
- [x] T-127: [CHORE] unit 215 + nuxt 63 green; `vue-tsc` clean; committed. ⏳ Push + open PR 3 pending user merge.

---

# ── PR 4: Leaderboard/Ranking restyle + stats (off PR 1) ──

## B45 — leaderboard.vue restyle (RED → GREEN)
**Satisfies**: R-UX-09 · **Files**: `tests/nuxt/leaderboard.nuxt.test.ts` (extend), `app/pages/rooms/[id]/leaderboard.vue`

- [x] T-128: [RED] `tests/nuxt/leaderboard-redesign.nuxt.test.ts` (4) — initials avatars, "Tú" highlight (mockNuxtImport user), promedio 8.5 + partidos restantes 2 derived, no trend/aciertos/premios.
- [x] T-129: [GREEN] Restyle `leaderboard.vue` — token ranking rows, initials avatar, "Tú" highlight via `useSupabaseUser`, stats sidebar (avg `total_points`; non-finished count via read-only `loadMatches()`). All existing realtime wiring (subscribe/cleanup/applyMemberUpdate/onMatchUpdate/matches-leaderboard-reload) preserved.
- [x] T-130: [VERIFY] 7 existing leaderboard realtime tests green unmodified (nuxt 67/67); additions read-only (no writes/endpoints/schema); "Tabla de Posiciones" heading kept.
- [x] T-131: [CHORE] unit 215 + nuxt 67 green; `vue-tsc` clean; committed. ⏳ Push + open PR 4 pending user merge.

---

# ── PR 5: Admin restyle + Select (off PR 1) ──

## B46 — Select primitive (RED → GREEN)
**Satisfies**: R-UX-08 (control) · **Files**: `tests/nuxt/select.nuxt.test.ts`, `app/components/ui/select/*`

- [ ] T-132: [RED] `tests/nuxt/select.nuxt.test.ts` — trigger renders; four values `scheduled|live|finished|postponed` exposed; `v-model` updates on selection. (Fallback: test styled native `<select>`.)
- [ ] T-133: [GREEN] Create `app/components/ui/select/*` (reka-ui port per `design.md` §3) OR token-styled native fallback.

## B47 — admin restyle (RED → GREEN, script-invariant)
**Satisfies**: R-UX-08 (page) · **Files**: `tests/nuxt/admin-matches.nuxt.test.ts` (extend if present), `app/pages/admin/matches/index.vue`

- [ ] T-134: [PREP] Read admin script; confirm `ensureSuperAdmin`/`startEdit`/`saveEdit`/`cancelEdit`/`handleLockNow` + refs to preserve verbatim.
- [ ] T-135: [RED] Extend admin test — rows on card surface + status `Badge`; status control bound to `editDrafts[id].status` with four values.
- [ ] T-136: [GREEN] Restyle `admin/matches/index.vue` **template/classes only** — lock-now panel, card list, `Badge`, edit-form grid; native `<select>` → `Select` (same model + four values). Script untouched.
- [ ] T-137: [VERIFY+CHORE] Diff script vs pre-restyle — identical; pre-existing admin tests green unmodified; `package.json` deps unchanged; commit + open PR 5 → PR1.

---

## Dependency Graph

```
B40 (tokens) ──┬──▶ B41 (Badge) ───────────────────────▶ PR1 → main
               │
               ├──▶ B42 (landing) ───────────────────────▶ PR2
               ├──▶ B43 (card) ──▶ B44 (predictions+sidebar) ▶ PR3
               ├──▶ B45 (leaderboard) ───────────────────▶ PR4
               └──▶ B46 (Select) ──▶ B47 (admin) ─────────▶ PR5

PR1 merges first. PR2–PR5 branch off PR1, reviewable in parallel.
```

## Global Invariants (every restyle task)

- **No `<script setup>` logic changes** in `MatchPredictionCard.vue` and `admin/matches/index.vue` (markup/classes + select control only).
- `predictions.vue` and `leaderboard.vue` may add **read-only derived data** (leaderboard fetch / `useSupabaseUser` / matches count) — **no writes, no new endpoints, no schema**.
- **Per-card save preserved** (no global "Guardar Cambios").
- **No new npm dependencies**; no DB/API/auth/RLS/schema changes.
- All **pre-existing behavioural tests stay green, unmodified**; new tests are structural/additive.
- **Deferred (do NOT render)**: trend arrows, hit counts, prizes/pozo, real crests/avatars, odds.
