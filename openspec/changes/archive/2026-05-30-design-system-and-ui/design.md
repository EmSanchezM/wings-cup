# Design: design-system-and-ui

**Date**: 2026-05-30
**Status**: design
**Inherits proposal**: `2026-05-30-design-system-and-ui/proposal.md`
**Reference**: user mockups (QuinielaPro, light) — **layouts adopted, palette overridden to dark**.

## 1. Architecture Decision: token system in Tailwind v4 `@theme`

The repo already uses Tailwind v4's `@theme { --color-primary: oklch(...) }` (not legacy shadcn `:root`/`hsl(var())`). `bg-primary` already resolves today — that's the precedent. Extend the same `@theme` block with the full shadcn semantic set as `--color-<name>` OKLCH values; Tailwind v4 auto-generates `bg-/text-/border-/ring-<name>`. No `tailwind.config.*`, no second token convention.

## 2. Estadio nocturno palette (OKLCH) — DARK

Dark base, emerald primary (césped iluminado), amber accent (trofeo). Kept from the original decision; the light mockups inform *layout*, not color. Values are data — tunable in review.

```css
@theme {
  /* ── Surfaces ── */
  --color-background:          oklch(0.17 0.015 250);  /* deep night slate */
  --color-foreground:          oklch(0.97 0.005 250);  /* near-white */
  --color-card:                oklch(0.21 0.018 250);  /* raised surface */
  --color-card-foreground:     oklch(0.97 0.005 250);
  --color-popover:             oklch(0.20 0.018 250);
  --color-popover-foreground:  oklch(0.97 0.005 250);

  /* ── Brand: emerald (césped) ── */
  --color-primary:             oklch(0.72 0.17 158);   /* vivid pitch green */
  --color-primary-foreground:  oklch(0.18 0.03 158);   /* dark ink on green */

  /* ── Accent: amber (trofeo) ── */
  --color-accent:              oklch(0.80 0.14 78);    /* trophy gold */
  --color-accent-foreground:   oklch(0.20 0.04 78);

  /* ── Neutrals ── */
  --color-secondary:           oklch(0.27 0.02 250);
  --color-secondary-foreground:oklch(0.97 0.005 250);
  --color-muted:               oklch(0.27 0.02 250);
  --color-muted-foreground:    oklch(0.70 0.02 250);

  /* ── Feedback ── */
  --color-destructive:         oklch(0.62 0.21 25);    /* live / alert red */
  --color-destructive-foreground: oklch(0.98 0.01 25);

  /* ── Lines & focus ── */
  --color-border:              oklch(0.30 0.02 250);
  --color-input:               oklch(0.32 0.02 250);
  --color-ring:                oklch(0.72 0.17 158);
}
```

### Base layer

```css
@layer base {
  * { border-color: var(--color-border); }
  body {
    background-color: var(--color-background);
    color: var(--color-foreground);
  }
}
```

### Status color mapping (Badge variants)

| Match status | Badge variant | Token | Notes |
|--------------|---------------|-------|-------|
| `scheduled` / Pendiente | `secondary` | muted | neutral upcoming |
| `live` / En Vivo | `destructive` | red + pulsing dot | + left card accent border |
| `finished` / Finalizado | `outline`/`muted` | dimmed | settled |
| `postponed` | `accent` | amber | warning |
| locked | `secondary` + lock icon | muted-foreground | disabled |

> **Replaces** `MatchPredictionCard`'s hardcoded light literals (`bg-yellow-50`, `bg-red-50`, `bg-green-50`, `bg-gray-50`) — those break on dark and MUST be removed in favour of `Badge`/token classes.

## 3. Component architecture

Two new shadcn-vue primitives under `app/components/ui/`, mirroring `button/` (`index.ts` `cva` variants + `.vue` wrapper using `cn`).

### `app/components/ui/badge/`
- `index.ts`: `badgeVariants` (`default | secondary | destructive | outline | accent`) → token colors.
- `Badge.vue`: `<span>` wrapper, `cn(badgeVariants({ variant }), props.class)`.

### `app/components/ui/select/`
- reka-ui `SelectRoot/Trigger/Value/Portal/Content/Viewport/Item/ItemText/ItemIndicator` port (reka-ui already transitive via shadcn-nuxt). Trigger `border-input bg-transparent`; content `bg-popover text-popover-foreground border`; item hover `bg-accent text-accent-foreground`. `v-model` → `editDrafts[id].status`.
- **Pre-approved fallback**: token-styled native `<select>` (`border-input bg-card` + focus ring) if the reka-ui port is disproportionately heavy. Four values + `v-model` mandatory either way.

## 4. Page layouts (adapted from mockups, rendered dark)

### Landing (`index.vue`) — mockups 1 + 2

```
┌ nav: WingsCup ·· [Crear Quiniela]■ 🔔 ◔ ──────────────┐
│  ● La nueva temporada está en vivo   │   ┌─ preview ─┐ │
│                                       │   │ ● EN VIVO │ │
│  La emoción del fútbol                │   │ RMA 2-1 FCB│ │  ← static
│  se vive  entre amigos  ← emerald     │   │  MAÑANA   │ │     preview
│  Creá tu liga, invitá amigos…         │   │  ▢ VS ▢   │ │     card
│  [ Crear mi Liga Gratis ]■  [Ver demo]│   └───────────┘ │
│  ◍◍◍ 10k+ ligas activas hoy           │                 │
├───────────────────────────────────────────────────────┤
│                  Cómo Funciona                          │
│  ┌ 1. Creá tu Liga ┐ ┌ 2. Invitá ┐ ┌ 3. Pronosticá ┐  │  ← 3 cards
│  └─────────────────┘ └───────────┘ └───────────────┘  │
│              [ Comenzar Ahora → ]■                       │
├───────────────────────────────────────────────────────┤
│  WingsCup · © {year} · Reglas · Soporte · Privacidad    │
└───────────────────────────────────────────────────────┘
```
- Full dark, `min-h-screen`. Wordmark "Wings"(fg)+"Cup"(primary), trophy icon (`lucide` `Trophy`, accent).
- Hero headline with emerald `<span>` highlight; pill badge with pulsing dot.
- Dual CTA: primary `Button` "Crear mi Liga Gratis" → `/auth/login`; outline "Ver demo" (anchor to demo section or login).
- Side **preview card** is **static decorative markup** (no live data) — illustrative only.
- Cómo Funciona: 3 token cards w/ `lucide` icons (`PlusCircle`, `UserPlus`, `Flag`) + "Comenzar Ahora" CTA → `/auth/login`.
- Footer. Year via SSR-safe computed (consistent server/client within request) — no markup-diverging `Date`.

### Predictions (`predictions.vue` + `MatchPredictionCard.vue`) — mockup 3

Two-column on `lg+` (`grid lg:grid-cols-[1fr_320px]`), stacked on mobile.

**Left — `predictions.vue` (restyle, template + small data addition):**
- Header: title "Mis Pronósticos" + subtitle from data (`stage` / count) — no invented "Jornada 15" string; derive from matches.
- Match card list (one `MatchPredictionCard` per entry — unchanged props).

**`MatchPredictionCard.vue` (script-invariant, template only):**
```
┌ card (bg-card border) ───── [status Badge] ┐   live → left border-l-4 border-destructive
│ STAGE · Grupo X                             │
│  Real Madrid  [ _ ] vs [ _ ]  Barcelona     │  ← token Input scores
│  sáb 24 nov 16:00         [ Guardar ]■      │  ← per-card save (kept)
└──────────────────────────────────────────────┘
```
- Keep all script (`predictedHome/Away`, `isLocked`, `isReadonly`, `handleSubmit`, error states, final-score block, per-card submit). Change ONLY markup/classes: status divs → `Badge` (status map §2), native `<input>` → `Input` (or token-styled), live left accent border, lock/finished readonly treatment via existing reactive flags.

**Right — `predictions.vue` "Resumen de Puntos" sidebar (small addition):**
```
┌ Resumen de Puntos ─────────┐
│ Pronósticos completados 4/10│  ← derived: predictionsMap.size / eligibleEntries.length (on-page, no fetch)
│ Puntos acumulados      120  │  ← from added leaderboard fetch (my entry.total_points)
│ Posición actual        4to  │  ← my index in leaderboard + 1
│ [ link → Ver tabla completa]│
└─────────────────────────────┘
```
- **Data addition**: in `onMounted`, add `useLeaderboard(roomId).load()` (or `predClient`/leaderboard composable) to the existing `Promise.all`; compute my entry via `useSupabaseUser().value?.id`. Read-only; failure non-fatal (sidebar hides/degrades). No writes, no new endpoint.

### Leaderboard / Ranking (`leaderboard.vue`) — mockup 4

```
┌ Liga (room name if available) ── Participantes: N ┐
│ POS  JUGADOR                          PTS         │
│  1   ◍ Carlos M.                      145         │
│  2   ◍ Ana S.                         132         │
│  3   ◍ Tú                  (emerald)  128   ← highlighted
│  4   ◍ Diego R.                       115         │
└────────────────────────────────────────────────────┘
┌ Estadísticas de la liga ┐
│ Promedio grupo   123.6  │  ← avg(total_points)
│ Partidos rest.     24   │  ← count(matches.status != finished)
└─────────────────────────┘
```
- Restyle table → token rows; initials avatar from `display_name` (first letters in a circle, `bg-secondary`).
- **"Tú" highlight**: add `useSupabaseUser`; row where `entry.user_id === user.id` gets `bg-primary/10 border-l-2 border-primary` + label "Tú".
- Stats sidebar: promedio derived from `leaderboard`; partidos restantes via `useMatches().load()` count (small read addition). Both read-only, non-fatal.
- Deferred (NOT rendered): trend arrows, "Aciertos: N", Premios del Grupo.

### Admin (`admin/matches/index.vue`) — no mockup; dark restyle + Select

Template only (script preserved): header, lock-now panel on `card`, match list rows on `card` with status `Badge`, edit form grid with `Select` (status) + two `Input`s + Guardar/Cancelar. Save/cancel/disabled states unchanged.

## 5. Data-flow note

No new flows, no new endpoints, no schema. The only data additions are **read-only client fetches of already-existing endpoints**: leaderboard on `predictions.vue` (points sidebar) and matches count on `leaderboard.vue` (stats). Auth, prediction lock, points calc, and realtime are untouched. Invariant: `MatchPredictionCard` + admin scripts unchanged; `predictions.vue` + `leaderboard.vue` add only read-only derived data.

## 6. Testing strategy (strict TDD active)

Structure/invariant assertions, RED before GREEN:

- **Token presence** (unit): read `tailwind.css`; assert 19 `--color-*` tokens in `oklch(`; body base rule; primary preserved.
- **Badge** (nuxt): renders slot; `destructive`/`accent` variants apply token classes.
- **Landing** (nuxt): "Wings Cup", tagline, CTA link `to="/auth/login"`, "Cómo Funciona" 3 steps, footer; not the bare placeholder.
- **MatchPredictionCard** (nuxt): renders teams + status `Badge` + score inputs; locked → readonly + indicator; **no `bg-yellow-50`/`bg-red-50`/`bg-green-50` literals remain**; **existing behavioural tests stay green unmodified**.
- **predictions sidebar** (nuxt): completados renders `n/m`; given a leaderboard, shows my points + position; degrades gracefully when leaderboard fetch fails.
- **Leaderboard** (nuxt): initials avatar; current-user row highlighted ("Tú"); stats derived; existing tests green.
- **Admin Select** (nuxt): four values `scheduled|live|finished|postponed`, bound to draft model; existing admin tests green.

Strongest "no logic change" guarantee: **all pre-existing unit + nuxt tests stay green untouched**; restyle tasks add structural tests only.

## 7. Open decisions deferred to apply

- Font: **system stack** (`font-sans`) unless a self-hosted font is trivially droppable — no external network font.
- Icon set: `lucide-vue-next` (`Trophy`, `PlusCircle`, `UserPlus`, `Flag`, lock, arrows) — already a dependency.
- Initials avatar: derive 1–2 letters from `display_name`; deterministic bg from a small token palette.
