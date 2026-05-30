# design-system-and-ui — Archive Report

**Change**: design-system-and-ui (Slice 8 of 8+)
**Date Archived**: 2026-05-30
**Status**: COMPLETE & VERIFIED
**Verdict**: PASS — all 5 chained PRs merged, all tests green

---

## Closure Summary

Slice 8 delivered the complete visual identity layer for Wings Cup. The "Estadio nocturno" dark theme (emerald primary, amber accent, OKLCH tokens) is now applied app-wide via a full shadcn semantic token set. The landing page, predictions view (+ points sidebar), leaderboard/ranking, and admin views have been restyled from their functional-but-flat state to intentional, on-brand dark UIs adapted from user mockups. Country flags (circle-flags, vendored as static SVGs) are rendered for all 32 group-stage participants via the new `TeamFlag` component.

All changes are purely visual or read-only derived data. No backend, schema, auth, or RLS changes were made. Script-invariant constraint held for `MatchPredictionCard.vue` and `admin/matches/index.vue`.

**PRs Merged**:
| PR | Title | Scope | Status |
|----|-------|-------|--------|
| #15 | feat(design-system): dark token foundation + Badge | Tokens + Badge primitive (R-DS-01..04) | MERGED |
| #16 | feat(ui): landing page + Cómo Funciona + country flags | Landing + TeamFlag (R-UX-06, R-DS-05) | MERGED |
| #17 | feat(ui): predictions restyle + points sidebar | MatchPredictionCard + predictions.vue (R-UX-07) | MERGED |
| #18 | feat(ui): leaderboard restyle + stats sidebar | leaderboard.vue (R-UX-09) | MERGED |
| #19 | feat(ui): admin restyle + token-styled select | admin/matches/index.vue (R-UX-08) | MERGED |

**main HEAD after merge**: 2c94a59 (PR #14 was the prior auth change; #15–#19 applied on top)

---

## Capabilities Affected

### NEW Capability: `design-system` (R-DS-01..R-DS-05)

| Req | Title | Status |
|-----|-------|--------|
| R-DS-01 | Complete shadcn Semantic Token Set | IMPLEMENTED |
| R-DS-02 | Estadio Nocturno Dark Theme Applied App-Wide | IMPLEMENTED |
| R-DS-03 | shadcn Components Resolve Token Colors | IMPLEMENTED |
| R-DS-04 | Status Color Mapping via Badge | IMPLEMENTED |
| R-DS-05 | Country Flags via TeamFlag | IMPLEMENTED |

Main spec created: `openspec/specs/design-system/spec.md`

### MODIFIED Capability: `ux` (R-UX-06..R-UX-09 appended to R-UX-01..05)

| Req | Title | Status |
|-----|-------|--------|
| R-UX-06 | Landing Page + Cómo Funciona | IMPLEMENTED |
| R-UX-07 | Predictions Visual + Points Sidebar | IMPLEMENTED |
| R-UX-08 | Admin Visual + Select (script-invariant) | IMPLEMENTED |
| R-UX-09 | Leaderboard / Ranking Visual + Stats | IMPLEMENTED |

Main spec updated: `openspec/specs/ux/spec.md` (now holds R-UX-01..R-UX-09)

---

## Final Test Status

| Suite | Count | Result |
|-------|-------|--------|
| `pnpm test:unit` | 215 | GREEN |
| `pnpm test:nuxt` | 69 | GREEN |
| `npx vue-tsc --noEmit` | — | CLEAN |

All pre-existing behavioural tests stayed green and unmodified. New tests are structural/additive only.

---

## Apply Lineage

### PR 1 — #15: feat(design-system): dark token foundation + Badge
**Blocks**: B40, B41 | **Tasks**: T-110..T-116
- T-110: `tests/unit/design-tokens.test.ts` — RED: 19 tokens + oklch + body base
- T-111: Extended `@theme` with full OKLCH dark set + `@layer base` body + border-color
- T-112: Confirmed Button/Input utilities resolve; no orphan semantic utilities
- T-113: `tests/nuxt/badge.nuxt.test.ts` — RED: slot + destructive/accent variants
- T-114: `badge/index.ts` (cva: default/secondary/destructive/outline/accent) + `Badge.vue`
- T-115/T-116: Tests green (unit 210 / nuxt 49); vue-tsc clean; committed

### PR 2 — #16: feat(ui): landing page + Cómo Funciona + country flags
**Blocks**: B42, B48 | **Tasks**: T-117..T-120, T-138..T-143
- T-117: `tests/nuxt/landing.nuxt.test.ts` — RED: Wings Cup + tagline + CTA + 3 steps
- T-118: Rewrote `index.vue` — dark hero, Cómo Funciona (3 token cards), footer, SSR-safe year
- T-119: Responsive layout; emerald CTA contrast
- T-138: Vendored 32 circle-flags SVGs → `public/flags/{iso2}.svg`
- T-139..T-142: `team-flags.ts` map + `TeamFlag.vue` — flag img + initials fallback
- T-143: Wired `<TeamFlag>` into landing preview card (ARG/CHI + BRA/COL)
- T-120: Tests green (unit 210 / nuxt 53); vue-tsc clean; committed

### PR 3 — #17: feat(ui): predictions restyle + points sidebar
**Blocks**: B43, B44 | **Tasks**: T-121..T-127
- T-121: Read MatchPredictionCard script; recorded all refs for verbatim reuse
- T-122: `prediction-card-redesign.nuxt.test.ts` — RED: flags + Pendiente badge + live border + no bg-*-50
- T-123: Restyled `MatchPredictionCard.vue` template only; script byte-identical to origin/main
- T-124: `predictions-sidebar.nuxt.test.ts` — RED: sidebar + completados + puntos/pos + graceful degradation
- T-125: Restyled `predictions.vue` (two-col grid) + read-only leaderboard fetch + sidebar
- T-126: MatchPredictionCard script diff clean; 22 pre-existing predictions tests green unmodified
- T-127: Tests green (unit 215 / nuxt 63); vue-tsc clean; committed

### PR 4 — #18: feat(ui): leaderboard restyle + stats sidebar
**Blocks**: B45 | **Tasks**: T-128..T-131
- T-128: `leaderboard-redesign.nuxt.test.ts` — RED: initials avatars + Tú highlight + stats + no deferred
- T-129: Restyled `leaderboard.vue` — token rows, initials, Tú (useSupabaseUser), avg + non-finished count
- T-130: 7 existing realtime tests green unmodified; "Tabla de Posiciones" heading preserved
- T-131: Tests green (unit 215 / nuxt 67); vue-tsc clean; committed

### PR 5 — #19: feat(ui): admin restyle + token-styled select
**Blocks**: B46 (dropped), B47 | **Tasks**: T-132..T-137
- T-132/T-133: DROPPED — pre-approved native `<select>` fallback used (reka-ui port disproportionate for script-invariant constraint)
- T-134: Read admin script; confirmed all refs to preserve verbatim
- T-135: `admin-matches.nuxt.test.ts` — RED: bg-card surface + admin-status-badge + four status values
- T-136: Restyled `admin/matches/index.vue` template only — card surfaces + Badge + TeamFlag + token native select; script byte-identical
- T-137: Admin script diff clean; package.json deps unchanged; tests green (unit 215 / nuxt 69); vue-tsc clean

---

## Specs Synced

| Domain | Action | Main Spec | Details |
|--------|--------|-----------|---------|
| `design-system` | CREATED | `openspec/specs/design-system/spec.md` | NEW capability — R-DS-01..05 (5 requirements, 15 scenarios) |
| `ux` | UPDATED | `openspec/specs/ux/spec.md` | APPENDED R-UX-06..09 after R-UX-05 (9 total requirements) |

---

## Architectural Decisions Locked

| # | Decision | Choice |
|---|----------|--------|
| 1 | Token system | Tailwind v4 `@theme` OKLCH custom properties (`--color-<name>`) — extends existing `--color-primary` precedent, no second convention |
| 2 | Visual identity | "Estadio nocturno" dark — emerald primary (`oklch(0.72 0.17 158)`), amber accent (`oklch(0.80 0.14 78)`); dark-only (no toggle) |
| 3 | Mockup source | Layouts adopted from user mockups (QuinielaPro-style, light), palette completely overridden to dark |
| 4 | Country flags | Vendored circle-flags SVGs (MIT) in `public/flags/`, resolved by name→ISO map; NO runtime npm dep; England = `gb-eng` subdivision |
| 5 | Admin select | Pre-approved native `<select>` fallback used (token-styled); script-invariant constraint blocked reka-ui `Select` port |
| 6 | Per-card save | Preserved (no global "Guardar Cambios") |
| 7 | Script-invariant | `MatchPredictionCard.vue` and `admin/matches/index.vue` template-only; diff verified byte-identical on script blocks |
| 8 | Derived-data additions | `predictions.vue` + `leaderboard.vue` add read-only fetches/composables only; no writes, no new endpoints |

---

## Deferred to Future Proposals

The following features were explicitly scoped OUT — they require new backend capabilities and their own proposal:

| Feature | Reason deferred |
|---------|-----------------|
| Prizes / Pozo del Grupo (Farolito) | No money/prize concept in current schema |
| Trend arrows (↑↓ position changes) | Needs position-history tracking (new backend) |
| Hit counts ("Aciertos: N") | Needs per-user match-accuracy aggregation (new backend) |
| Club crests / real avatars | N/A for national-team World Cup; player avatars → initials only |
| Odds / cuotas (L/E/V) | Exact-score prediction app — no betting data |
| Auth/join/rooms page restyling | Deferred follow-up (login.vue, confirm.vue, rooms/index.vue, join/[code].vue) |
| Global "Último guardado" timestamp | No per-save client timestamp tracked |

---

## Archive Contents

```
openspec/changes/archive/2026-05-30-design-system-and-ui/
├── proposal.md
├── design.md
├── tasks.md
├── specs/
│   ├── index.md
│   ├── design-system/
│   │   └── spec.md
│   └── ux/
│       └── spec.md
└── archive-report.md (this file)
```

**Main specs updated**:
- `openspec/specs/design-system/spec.md` (NEW)
- `openspec/specs/ux/spec.md` (APPENDED R-UX-06..09)

---

## SDD Cycle Complete

design-system-and-ui has been fully planned, implemented (5 chained PRs), verified (unit 215 / nuxt 69 / vue-tsc clean), and archived. Wings Cup is now visually complete for its MVP feature set.

The next change would be a follow-up proposal for any deferred items (prizes/pozo, trend arrows, or auth-page restyling) or a new slice for the next feature.

---

*Archive report generated: 2026-05-30 (sdd-archive phase)*
*Archived by: sdd-archive (sonnet)*
