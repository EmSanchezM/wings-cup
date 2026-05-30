# Design-System Spec — Delta for design-system-and-ui (Slice 8)

## Overview
NEW capability domain: `design-system`. Defines the semantic token contract and the "Estadio nocturno" palette that the entire UI reads from. No prior requirements in this numbering space.

## Requirements Summary
| Req | Title | Action | Scenarios |
|-----|-------|--------|-----------|
| R-DS-01 | Complete shadcn Semantic Token Set | NEW | 3 |
| R-DS-02 | Estadio Nocturno Dark Theme Applied App-Wide | NEW | 3 |
| R-DS-03 | shadcn Components Resolve Token Colors | NEW | 2 |
| R-DS-04 | Status Color Mapping via Badge | NEW | 3 |
| R-DS-05 | Country Flags via TeamFlag | NEW | 4 |

---

## NEW Requirements

### R-DS-01: Complete shadcn Semantic Token Set
**Type**: NEW | **Source**: Validation finding — only `--color-primary` defined
**Files**: `app/assets/css/tailwind.css`

The `@theme` block in `app/assets/css/tailwind.css` MUST define all of the following semantic color tokens as `--color-<name>` custom properties with OKLCH values: `background`, `foreground`, `card`, `card-foreground`, `popover`, `popover-foreground`, `primary`, `primary-foreground`, `secondary`, `secondary-foreground`, `muted`, `muted-foreground`, `accent`, `accent-foreground`, `destructive`, `destructive-foreground`, `border`, `input`, `ring`. Every token MUST use the OKLCH color function (consistent with the pre-existing `--color-primary`).

#### Scenario: All semantic tokens are defined

- GIVEN `app/assets/css/tailwind.css` is inspected
- WHEN checking the `@theme` block
- THEN a `--color-<name>` declaration exists for each of the 19 required semantic tokens
- AND each value is expressed with `oklch(...)`

#### Scenario: Primary remains defined

- GIVEN the token set after this change
- WHEN checking `--color-primary` and `--color-primary-foreground`
- THEN both are still present (not removed by the extension)

#### Scenario: No undefined token utilities remain referenced

- GIVEN the shadcn components `Button` and `Input` and the three restyled pages
- WHEN scanning their token utility usages (`bg-*`, `text-*`, `border-*`, `ring-*` matching semantic names)
- THEN every referenced semantic token has a matching `--color-<name>` in `@theme`

---

### R-DS-02: Estadio Nocturno Dark Theme Applied App-Wide
**Type**: NEW | **Source**: User-confirmed visual direction
**Files**: `app/assets/css/tailwind.css`

The theme MUST be dark by default. `--color-background` MUST be a dark surface and `--color-foreground` a near-white. `--color-primary` MUST be an emerald/green hue and `--color-accent` MUST be an amber/gold hue (Estadio nocturno identity). A base layer MUST set `body` background-color to `var(--color-background)` and color to `var(--color-foreground)`, and MUST set a default `border-color` of `var(--color-border)` so plain `border` utilities render the themed line color.

#### Scenario: Body adopts dark theme

- GIVEN the app is rendered
- WHEN the `body` computed style is inspected
- THEN its background derives from `--color-background` (dark)
- AND its text color derives from `--color-foreground` (near-white)

#### Scenario: Brand hues are emerald and amber

- GIVEN the token values
- WHEN inspecting `--color-primary` and `--color-accent`
- THEN `--color-primary` is a green/emerald hue
- AND `--color-accent` is an amber/gold hue

#### Scenario: Default border color is themed

- GIVEN an element using the bare `border` utility (no explicit color)
- WHEN its border-color is inspected
- THEN it resolves to `var(--color-border)`, not transparent or currentColor

---

### R-DS-03: shadcn Components Resolve Token Colors
**Type**: NEW | **Source**: Validation finding — half-styled components
**Files**: `app/components/ui/button/*`, `app/components/ui/input/*`, `app/assets/css/tailwind.css`

After the token set exists, shadcn components MUST resolve all the semantic utilities they reference. `Button` `outline` variant MUST show a visible border (`border-input`) and accent hover; `Button` `destructive` variant MUST show the destructive background; `Input` MUST show a border and a visible focus ring (`ring-ring`).

#### Scenario: Outline button has a border color

- GIVEN a `<Button variant="outline">`
- WHEN rendered with the token set present
- THEN its border-color resolves to `var(--color-input)` (a real color, not transparent)

#### Scenario: Destructive button has a background

- GIVEN a `<Button variant="destructive">`
- WHEN rendered
- THEN its background resolves to `var(--color-destructive)`

---

### R-DS-04: Status Color Mapping via Badge
**Type**: NEW | **Source**: Design — consistent status semantics
**Files**: `app/components/ui/badge/index.ts`, `app/components/ui/badge/Badge.vue`

A `Badge` component MUST exist under `app/components/ui/badge/`, built in the shadcn-vue style (a `cva` variants object in `index.ts` + a `Badge.vue` wrapper using `cn`). It MUST expose at least the variants `default`, `secondary`, `destructive`, `outline`, and `accent`, each mapping to the corresponding semantic token colors. The component MUST render its default slot content.

#### Scenario: Badge renders slot content

- GIVEN `<Badge>Finalizado</Badge>`
- WHEN rendered
- THEN the text "Finalizado" is present in the DOM

#### Scenario: Variant applies token classes

- GIVEN `<Badge variant="destructive">`
- WHEN rendered
- THEN the element carries the destructive token classes (`bg-destructive` / `text-destructive-foreground`)

#### Scenario: Accent variant exists

- GIVEN the `badgeVariants` definition
- WHEN inspecting its `variant` keys
- THEN an `accent` variant is present mapping to `bg-accent` / `text-accent-foreground`

---

### R-DS-05: Country Flags via TeamFlag
**Type**: NEW | **Source**: User request — real World Cup country flags (upgrades the deferred "initials placeholder" decision)
**Files**: `public/flags/*.svg`, `shared/constants/team-flags.ts`, `app/components/TeamFlag.vue`

Country flags MUST be served as vendored static SVGs under `public/flags/{code}.svg` (circle-flags, MIT — no runtime dependency, no external CDN at runtime). A single source-of-truth map `shared/constants/team-flags.ts` MUST map each participant country NAME (exactly as stored in `matches.home_team`/`away_team`) to its ISO 3166-1 alpha-2 code (England uses the `gb-eng` subdivision). A `TeamFlag` component MUST render the circular flag `<img>` (with `alt`) for a known country and MUST fall back to an initials `<span>` for any name without a flag (knockout placeholders like "Group A Winner", "Winner Match 49", "Loser Match 61", or unknown names). This applies to TEAMS only (landing preview, predictions card, admin list); player avatars in the leaderboard remain initials.

#### Scenario: Map covers all group-stage participants

- GIVEN `shared/constants/team-flags.ts`
- WHEN inspecting `TEAM_FLAG_CODES`
- THEN every one of the 32 group-stage country names from the seed has an ISO code
- AND a corresponding `public/flags/{code}.svg` asset exists

#### Scenario: Known country renders a flag image

- GIVEN `<TeamFlag team="Argentina" />`
- WHEN rendered
- THEN it renders an `<img>` with `src="/flags/ar.svg"` and `alt="Argentina"`

#### Scenario: Knockout placeholder falls back to initials

- GIVEN `<TeamFlag team="Group A Winner" />`
- WHEN rendered
- THEN no `<img>` is rendered
- AND an initials fallback ("GA") is shown

#### Scenario: No runtime flag dependency

- GIVEN `package.json` after this change
- WHEN inspecting dependencies
- THEN no flag npm package was added (flags are vendored static assets)
