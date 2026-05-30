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
| R-UX-06 (landing + Cómo Funciona) | B42 |
| R-UX-07 (predictions visual + points sidebar) | B43, B44 |
| R-UX-08 (admin visual + Select) | B46, B47 |
| R-UX-09 (leaderboard visual + stats) | B45 |

---

# ── PR 1: Dark token foundation ──

## B40 — Semantic token set + dark base (RED → GREEN)
**Satisfies**: R-DS-01, R-DS-02, R-DS-03 · **Files**: `tests/unit/design-tokens.test.ts`, `app/assets/css/tailwind.css`

- [ ] T-110: [RED] `tests/unit/design-tokens.test.ts` — assert 19 `--color-*` tokens present + `oklch(`; `body` base rule sets bg/fg; `--color-primary` preserved.
- [ ] T-111: [GREEN] Extend `@theme` with full OKLCH dark set per `design.md` §2 + `@layer base` body + default border-color.
- [ ] T-112: [REFACTOR] Confirm `Button`/`Input` utilities resolve; grep semantic utilities vs defined tokens — no orphans.

## B41 — Badge primitive (RED → GREEN)
**Satisfies**: R-DS-04 · **Files**: `tests/nuxt/badge.nuxt.test.ts`, `app/components/ui/badge/{index.ts,Badge.vue}`

- [ ] T-113: [RED] `tests/nuxt/badge.nuxt.test.ts` — renders slot; `destructive`/`accent` variants apply token classes.
- [ ] T-114: [GREEN] `badge/index.ts` (`cva`: default/secondary/destructive/outline/accent) + `Badge.vue` (`cn` wrapper).

## B-PR1 — Wrap-up
- [ ] T-115: [CHORE] `pnpm test:unit` + `pnpm test:nuxt` green; `vue-tsc` clean.
- [ ] T-116: [CHORE] Work-unit commits (B40, B41); open PR 1 → `main`.

---

# ── PR 2: Landing + Cómo Funciona (off PR 1) ──

## B42 — Landing page (RED → GREEN)
**Satisfies**: R-UX-06 · **Files**: `tests/nuxt/landing.nuxt.test.ts`, `app/pages/index.vue`

- [ ] T-117: [RED] `tests/nuxt/landing.nuxt.test.ts` — "Wings Cup" + tagline present; CTA link `to="/auth/login"`; Cómo Funciona has 3 steps; not the bare placeholder.
- [ ] T-118: [GREEN] Rewrite `index.vue` per `design.md` §4 — dark hero (badge pill, headline w/ emerald span, value prop, dual CTA, social proof, static preview card), Cómo Funciona (3 token cards + CTA), footer; SSR-safe year.
- [ ] T-119: [REFACTOR] Responsive (mobile stacks, desktop two-col hero); emerald CTA contrast sanity.
- [ ] T-120: [CHORE] Tests green; `vue-tsc` clean; commit + open PR 2 → PR1.

---

# ── PR 3: Predictions restyle + points sidebar (off PR 1) ──

## B43 — MatchPredictionCard restyle (RED → GREEN, script-invariant)
**Satisfies**: R-UX-07 (card) · **Files**: `tests/nuxt/predictions.nuxt.test.ts` (extend), `app/components/MatchPredictionCard.vue`

- [ ] T-121: [PREP] Read current `MatchPredictionCard.vue` script; record `predictedHome/Away`, `isLocked`, `isReadonly`, `handleSubmit`, error/success/final-score bindings — reuse verbatim, do NOT touch script.
- [ ] T-122: [RED] Extend nuxt test — card shows teams + status `Badge` + score inputs; locked → readonly + indicator; assert **no `bg-yellow-50`/`bg-red-50`/`bg-green-50`/`bg-gray-50` literals remain**.
- [ ] T-123: [GREEN] Restyle `MatchPredictionCard.vue` **template/classes only** — status divs → `Badge` (status map), native `<input>` → `Input`, live `border-l-4 border-destructive`, lock/finished readonly treatment via existing flags, keep per-card save button. Script untouched.

## B44 — predictions.vue restyle + points sidebar (RED → GREEN)
**Satisfies**: R-UX-07 (page + sidebar) · **Files**: `tests/nuxt/predictions-page.nuxt.test.ts`, `app/pages/rooms/[id]/predictions.vue`

- [ ] T-124: [RED] `tests/nuxt/predictions-page.nuxt.test.ts` — branded header; sidebar "completados N/M" from page data; given a leaderboard + current user, shows puntos + posición; leaderboard-fetch failure → cards still render, figures hidden.
- [ ] T-125: [GREEN] Restyle `predictions.vue` (two-col grid, header, list) + add **read-only** leaderboard fetch to `Promise.all` + `useSupabaseUser` to derive sidebar (completados on-page; puntos/posición from leaderboard). Non-fatal on failure; no writes.
- [ ] T-126: [VERIFY] Diff `MatchPredictionCard` script vs pre-restyle — identical; `predictions.vue` additions are read-only only; all pre-existing predictions tests green unmodified.
- [ ] T-127: [CHORE] Tests green; `vue-tsc` clean; commit + open PR 3 → PR1.

---

# ── PR 4: Leaderboard/Ranking restyle + stats (off PR 1) ──

## B45 — leaderboard.vue restyle (RED → GREEN)
**Satisfies**: R-UX-09 · **Files**: `tests/nuxt/leaderboard.nuxt.test.ts` (extend), `app/pages/rooms/[id]/leaderboard.vue`

- [ ] T-128: [RED] Extend leaderboard nuxt test — rows show initials avatar + name + points; current-user row highlighted + "Tú"; promedio grupo derived; partidos restantes derived; **no trend/aciertos/premios** rendered.
- [ ] T-129: [GREEN] Restyle `leaderboard.vue` — token rows, initials avatar from `display_name`, "Tú" highlight via `useSupabaseUser`, stats panel (avg `total_points`; non-finished match count via read-only `useMatches().load()`). Preserve existing realtime subscribe/cleanup.
- [ ] T-130: [VERIFY] Existing leaderboard + realtime tests green unmodified; additions read-only.
- [ ] T-131: [CHORE] Tests green; `vue-tsc` clean; commit + open PR 4 → PR1.

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
