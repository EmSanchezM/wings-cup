# Proposal: design-system-and-ui

**Slice**: 8 of 8+ (post-MVP — presentation layer)
**Date**: 2026-05-30
**Status**: proposed
**Branch**: `feat/design-system-and-ui`
**Inherits**: foundation, rooms-and-invitations, matches-and-predictions, predictions-ux-and-guards, guards-coverage-and-stale-toast, realtime-match-and-leaderboard, leaderboard-realtime-via-matches

## Intent

The app is **functionally complete** but visually unfinished. Every prior slice shipped behaviour, not identity. The user-visible outcome of this slice: Wings Cup gets a coherent **"Estadio nocturno"** visual identity — a **dark** sports-app aesthetic with emerald (césped) primary and amber (trofeo) accent — and adopts the **layouts** from user-provided reference mockups (QuinielaPro-style: rich hero, "Cómo Funciona", a predictions view with a points sidebar, and a ranking view) **adapted to our real data model** and rendered dark.

Two things drive this slice:

1. **Foundational token bug (blocking)**: the Tailwind v4 `@theme` block in `app/assets/css/tailwind.css` defines **only** `--color-primary`/`--color-primary-foreground`. shadcn components (`Button`, `Input`) and pages reference `bg-destructive`, `border-input`, `bg-accent`, `text-accent-foreground`, `ring-ring`, `text-muted-foreground`, `bg-background`, `bg-card` — none defined. In Tailwind v4 those utilities resolve to nothing, so shadcn has rendered half-styled since foundation.
2. **No visual identity + mockup adoption**: landing is a bare `<h1>`; predictions/admin/leaderboard are functional but flat, and `MatchPredictionCard` uses **hardcoded light colors** (`bg-yellow-50`, `bg-red-50`, `bg-green-50`) that will look broken on a dark surface.

Success = (1) the full shadcn token set exists, themed dark; (2) landing, predictions (+ points sidebar), leaderboard, and admin look intentional and on-brand, adapted from the mockups; (3) only data our backend actually serves is rendered.

## Mockup adaptation — what maps, what's dropped, what's deferred

Reference mockups are **light theme**; user confirmed **dark wins** — we adopt their *layout/structure*, not their palette. Scope confirmed: **"visual + small extras"** (no new backend). Verified against `shared/types/{matches,leaderboard,predictions}.ts`:

| Mockup element | Decision |
|----------------|----------|
| Odds / cuotas (L/E/V) | **Dropped** — we are exact-score prediction, not betting; no such data |
| Team crests | **Initials placeholder** — `home_team`/`away_team` are strings, no logo URLs |
| Ranking avatars | **Initials in circle** — only `display_name` exists |
| Trend arrows (↑↓), "Aciertos: N" | **Deferred** — needs new backend (position history, hit count) → future proposal |
| Premios del Grupo (pozo, Farolito) | **Deferred** — no money/prize concept exists → future proposal |
| Points sidebar (completados N/M, puntos, posición) | **Included** — completados derived on-page; puntos/posición via a leaderboard fetch added to `predictions.vue` |
| League stats (promedio grupo, partidos restantes) | **Included** — derived (avg of `total_points`; count of non-finished matches) |
| Global "Guardar Cambios" | **Kept per-card** — our save is per-card; switching to global save is a behaviour change → out of scope |
| "Último guardado: hace 2 min" | **Dropped** — no per-save client timestamp tracked |

## Scope

### In Scope

- **Design system foundation** — extend `app/assets/css/tailwind.css` `@theme` with the complete shadcn semantic token set (`background`, `foreground`, `card`, `card-foreground`, `popover`, `popover-foreground`, `primary`, `primary-foreground`, `secondary`, `secondary-foreground`, `muted`, `muted-foreground`, `accent`, `accent-foreground`, `destructive`, `destructive-foreground`, `border`, `input`, `ring`), OKLCH, **dark** (Estadio nocturno). Base `<body>` background/foreground + default border color.
- **Landing** (`app/pages/index.vue`) — built from scratch, adapting mockups 1 & 2: dark hero (badge pill + headline with emerald highlight + value prop + dual CTA + social proof + side preview card), a **"Cómo Funciona"** 3-step section, footer. CTA → `/auth/login`.
- **Predictions** (`app/pages/rooms/[id]/predictions.vue` + `app/components/MatchPredictionCard.vue`) — restyle to dark tokens adapting mockup 3: branded header with jornada/stage subtitle, match cards with status `Badge` (Pendiente/En Vivo/Finalizado), live-match left accent border, token score inputs, **"Resumen de Puntos" sidebar** (completados N/M derived on-page; puntos acumulados + posición via an added leaderboard fetch). **`MatchPredictionCard` stays script-invariant** (template/classes only — replaces its hardcoded light badge colors with `Badge`); **`predictions.vue` gets a small derived-data addition** (leaderboard fetch + summary), no backend.
- **Leaderboard / Ranking** (`app/pages/rooms/[id]/leaderboard.vue`) — restyle adapting mockup 4: rank rows with initials avatar, **"Tú" row highlighted** (requires reading current user via `useSupabaseUser`), league-stats sidebar (promedio grupo, partidos restantes — derived). Small derived-data addition, no backend.
- **Shared UI primitives** — `Badge` (status pills) and `Select` (admin status), shadcn-vue style under `app/components/ui/`.
- **Admin** (`app/pages/admin/matches/index.vue`) — restyle to dark tokens, replace native `<select>` with shadcn `Select` (same model, same four values), status `Badge`. **Script-invariant** (template/classes + select control only).

### Out of Scope

- **Any DB / API / auth / RLS / schema change.** No new backend. If a mockup element needs new data, it is deferred to its own proposal (prizes, trends, hit counts, real crests/avatars, odds).
- Light theme / theme toggle (dark-only).
- Global "Guardar Cambios" (per-card save preserved).
- Restyling `auth/login.vue`, `auth/confirm.vue`, `rooms/index.vue`, `rooms/[id]/index.vue`, `join/[code].vue` (deferred follow-up).
- New fonts requiring external network loading.
- New runtime npm dependencies (`reka-ui`, `lucide-vue-next` already present; shadcn primitives are copied source).

## Capabilities

### New Capabilities
- **`design-system`** — semantic token contract + Estadio nocturno (dark) palette.

### Modified Capabilities
- **`ux`** — landing (+ Cómo Funciona), predictions visual + points sidebar, leaderboard/ranking visual + stats, admin visual + Select (R-UX-06..R-UX-09; extends R-UX-01..05 from slice 5).

## Approach

1. **Token foundation** — extend `@theme`; add base body/border layer. Fixes shadcn half-styling as a side effect; dependency root for everything else. Exact OKLCH in `design.md`.
2. **Landing** — replace `<h1>` with hero + preview card + Cómo Funciona + footer; pure presentation, SSR-safe.
3. **Predictions** — `MatchPredictionCard`: template-only restyle, swap hardcoded light badges for `Badge`, token inputs, live left-border; script untouched. `predictions.vue`: restyle + add a leaderboard fetch to compute the points sidebar (completados from on-page data; puntos/posición from leaderboard).
4. **Leaderboard** — `leaderboard.vue`: restyle table to rows with initials + "Tú" highlight (add `useSupabaseUser`) + derived stats sidebar.
5. **Admin** — template-only restyle; native `<select>` → shadcn `Select` bound to the same `editDrafts[id].status` model + same four values.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `app/assets/css/tailwind.css` | Modified | Full dark token set (OKLCH) + base body/border |
| `app/pages/index.vue` | Rewritten | Landing + Cómo Funciona from scratch |
| `app/components/MatchPredictionCard.vue` | Modified | Template/classes only; hardcoded badges → `Badge`, token inputs |
| `app/pages/rooms/[id]/predictions.vue` | Modified | Restyle + small leaderboard fetch for points sidebar |
| `app/pages/rooms/[id]/leaderboard.vue` | Modified | Restyle + `useSupabaseUser` ("Tú") + derived stats |
| `app/pages/admin/matches/index.vue` | Modified | Template/classes + native select → `Select`; script untouched |
| `app/components/ui/badge/*` | New | shadcn-style Badge |
| `app/components/ui/select/*` | New | shadcn-style Select (reka-ui) |

~7–9 files + 2 new primitives. Estimated > 400 LOC → **chained PRs**.

## Delivery Strategy

Per cached `ask-on-risk`, resolved to a **chain of 5 stacked PRs**, each independently reviewable, each leaving the app working:

1. **PR 1 — Design system foundation**: tokens + base + `Badge`. Unblocks all; fixes shadcn half-styling alone.
2. **PR 2 — Landing + Cómo Funciona**: `index.vue`.
3. **PR 3 — Predictions**: `MatchPredictionCard` + `predictions.vue` (+ points sidebar).
4. **PR 4 — Leaderboard/Ranking**: `leaderboard.vue`.
5. **PR 5 — Admin**: `Select` + `admin/matches/index.vue`.

PR 1 → `main` first; PR 2–5 branch off PR 1, reviewable in parallel.

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Tailwind v4 `@theme` naming doesn't generate utilities | Med | Mirror the working `--color-primary` → `bg-primary` precedent; design pins names |
| Restyle changes behaviour | Med | `MatchPredictionCard`/admin: **no `<script setup>` edits**; predictions/leaderboard additions limited to read-only derived data + a leaderboard/user fetch, no writes |
| Predictions leaderboard fetch adds load/latency | Low | Parallel `Promise.all` with existing fetches; failure is non-fatal (sidebar degrades, cards still work) |
| `useSupabaseUser` for "Tú" highlight unavailable SSR | Low | Highlight is presentational; guard for null user (no highlight) |
| New `Select` changes admin status semantics | Med | Bind same `editDrafts[id].status`, same four values; structural test asserts values; native fallback pre-approved |
| Hardcoded light badge colors missed in restyle | Med | Explicit task + scenario: assert no `bg-yellow-50`/`bg-red-50`/`bg-green-50` literals remain in `MatchPredictionCard` |
| Scope creep into deferred features | Med | Deferred list explicit; each needs its own proposal |

## Rollback Plan

Per-PR revert. Token PR is additive (defines previously-undefined utilities). No DB/API/auth/schema/deps. Predictions/leaderboard additions are read-only fetches — reverting restores prior fetch set with zero data risk.

## Dependencies

- None new at npm level. Existing: Tailwind v4, shadcn-nuxt, reka-ui, `lucide-vue-next`, `cva`/`clsx`/`tailwind-merge`, `@nuxtjs/supabase` (`useSupabaseUser`).

## Success Criteria / Acceptance Gates

- [ ] All 19 shadcn semantic tokens defined in `@theme`; `bg-card`, `text-muted-foreground`, `border-input`, `bg-accent`, `ring-ring`, `bg-destructive` resolve to real OKLCH (dark) colors.
- [ ] App renders **dark** by default; `body` bg/fg from tokens.
- [ ] `Button` outline/ghost show border/hover; `Input` shows border + focus ring.
- [ ] Landing: hero, value prop, "Cómo Funciona" 3 steps, footer, CTA → `/auth/login`.
- [ ] Predictions: branded header, dark status badges (no `bg-yellow-50`/`bg-red-50`/`bg-green-50` literals remain), live left-border, points sidebar (completados + puntos + posición); **`MatchPredictionCard` script unchanged**; `predictions.vue` adds only a leaderboard fetch + derived summary.
- [ ] Leaderboard: initials rows, **"Tú" highlighted**, derived stats sidebar.
- [ ] Admin: dark restyle, native `<select>` → `Select` (same model, four values); **script unchanged**.
- [ ] `pnpm test:unit` + `pnpm test:nuxt` green; `vue-tsc` clean.
- [ ] No new `package.json` deps; no backend/schema/auth change.

## Decisions Baked In (do not re-debate)

1. Visual identity = **Estadio nocturno (dark)**. Confirmed twice by user (kept dark even against light mockups).
2. **Dark only** — no light theme, no toggle.
3. Tokens in existing `@theme` as `--color-*` OKLCH (Tailwind v4 convention already in use).
4. Adopt mockup **layouts**, not their light palette; **adapt to real data** — odds dropped, crests/avatars → initials, prizes/trends/hit-counts deferred.
5. Scope = **visual + small extras**: derived data + a leaderboard fetch (predictions) + `useSupabaseUser` (leaderboard) allowed; **no backend/schema**.
6. **Per-card save preserved** (no global "Guardar Cambios").
7. `MatchPredictionCard` + admin = **script-invariant** (template only). `predictions.vue` + `leaderboard.vue` = restyle + read-only derived additions.
8. Native admin `<select>` → shadcn `Select`, same model + four values.
9. No new npm deps; shadcn primitives copied source.
10. Ships as **5 chained PRs**.

## Next Phase

`sdd-spec` (design-system + ux deltas) + `sdd-design` (palette already pinned; layouts adapted from mockups) in parallel, then `sdd-tasks`.
