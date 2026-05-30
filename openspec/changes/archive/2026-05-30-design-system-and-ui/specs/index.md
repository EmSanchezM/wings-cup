# Spec Deltas — design-system-and-ui (Slice 8)

| Capability | File | Requirements | Status |
|------------|------|--------------|--------|
| `design-system` | `specs/design-system/spec.md` | R-DS-01, R-DS-02, R-DS-03, R-DS-04 | NEW capability (dark palette) |
| `ux` | `specs/ux/spec.md` | R-UX-06, R-UX-07, R-UX-08, R-UX-09 | MODIFIED (adds to R-UX-01..05) |

**Theme**: dark "Estadio nocturno". Layouts adapted from user mockups (light) but rendered dark. Scope = **visual + small extras**: read-only derived data + a leaderboard fetch (predictions) + `useSupabaseUser` (leaderboard) are allowed; **no backend/schema/auth changes**.

**Invariants**:
- `MatchPredictionCard` and `admin/matches/index.vue`: **script-invariant** (template/classes + select control only).
- `predictions.vue` and `leaderboard.vue`: restyle + **read-only derived-data additions only** (no writes, no new endpoints).
- Deferred to future proposals (need backend): prizes/pozo, trend arrows, hit counts, real crests/avatars, odds.
