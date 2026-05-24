# Proposal: guards-coverage-and-stale-toast

**Slice**: 5 of 5+ (post-MVP)
**Date**: 2026-05-24
**Status**: proposed
**Branch**: `feat/guards-coverage-and-stale-toast`
**Inherits**: foundation, rooms-and-invitations, matches-and-predictions, predictions-ux-and-guards

## Intent

Close two gaps carried forward from slice 4:

- **S-02 coverage (partial → full)**: rooms pages have no auth logic at all and rely silently on `@nuxtjs/supabase` `redirectOptions`. The intent is obscured without an explanatory comment, so future contributors may re-introduce broken `onMounted` guards.
- **Stale-session UX (silent error → visible toast)**: all composables (`useRoom`, `useMatches`, `useLeaderboard`) and `MatchPredictionCard` collapse 401 responses into a generic `error.value` string. Users with an expired JWT see "No se pudieron cargar las salas" with no remediation.
- **Admin silent redirect (CRITICAL gap from explore)**: `/api/me/is-super-admin` swallows 401 and returns `{ isSuperAdmin: false }`, so the admin page redirects to `/` instead of telling the user their session expired.

Success = a single, consistent stale-session recovery flow across every authenticated surface, plus zero ambiguity about which pages delegate auth to the module.

## Scope

### In Scope

- Comment-only updates to `app/pages/rooms/index.vue` and `app/pages/rooms/[id]/index.vue` explaining module-level auth delegation.
- New composable `app/composables/useSessionExpired.ts` — `useState('session-expired', () => false)` singleton exposing `{ isExpired, setExpired, reset }`.
- New component `app/components/SessionExpiredToast.vue` — shadcn-style card built from reka-ui primitives (already in the project); warning icon, message, dismiss button (`×`), CTA "Volver a iniciar sesión".
- Mount `<SessionExpiredToast />` in `app/app.vue` inside `<ClientOnly>`.
- 401 detection added inline in catch blocks of `useRoom`, `useMatches`, `useLeaderboard`, and `MatchPredictionCard` — checks `statusCode === 401`, calls `setExpired()`, returns early.
- Patch `server/api/me/is-super-admin.get.ts` to return discriminated response `{ isSuperAdmin: boolean, reason: 'authorized' | 'unauthenticated' | 'forbidden' }`.
- Update `app/pages/admin/matches/index.vue` to map `reason` to `setExpired()` (unauthenticated), redirect-to-`/` (forbidden), or render normally (authorized).

### Out of Scope

- `app/pages/join/[code].vue` refactor (intentional reactive guest→member UX, keep as-is).
- Realtime updates for match scores (deferred to slice 6+).
- Any new server endpoints beyond the discriminated patch on `/api/me/is-super-admin`.
- New schemas, migrations, or database changes.
- Global `$fetch` plugin interception (rejected — factories capture `$fetch` at init, plugins cannot retrofit).
- New runtime npm dependencies (no `vue-sonner`, no Nuxt UI).

## Capabilities

### New Capabilities

- None at spec level. The toast and composable are UI infrastructure, not new domain capabilities.

### Modified Capabilities

- `project-setup`: add requirement covering the explanatory comment convention for module-protected pages (extends R-PS-31).
- `predictions` or new `session-recovery` (TBD by spec phase): add requirements covering 401-to-toast detection in composables/cards.
- `admin` (or wherever R-ADMIN role check lives): modify requirement for `/api/me/is-super-admin` to return discriminated response; admin page maps reasons.

## Approach

### S-02 comments
Add `// Auth enforced by @nuxtjs/supabase redirectOptions (covers /rooms/**)` style note at the top of each remaining rooms page. Mirrors the comment already in `leaderboard.vue` from slice 4. No logic changes.

### `useSessionExpired` composable
Module-level singleton backed by `useState('session-expired', () => false)`. Exports:
- `isExpired: Readonly<Ref<boolean>>` — reactive flag the toast watches
- `setExpired(): void` — sets flag to `true`
- `reset(): void` — sets flag to `false`; MUST be called before `navigateTo('/auth/login')` to avoid the toast re-appearing after re-auth.

### `SessionExpiredToast.vue`
Built from reka-ui primitives already used by shadcn-nuxt components (Button is reka-ui based). Card positioned top-right or top-center via fixed positioning + Tailwind. Watches `isExpired`; renders nothing when `false`. Includes warning icon (lucide-vue-next, already a dep), message text, dismiss button (`×` → `reset()`), CTA button → `reset()` then `navigateTo('/auth/login')`. Mounted in `app.vue` wrapped in `<ClientOnly>` to avoid SSR hydration mismatches.

### 401 detection pattern (mirrored across 4 surfaces)

```ts
catch (err) {
  const status = (err as { statusCode?: number })?.statusCode
  if (status === 401) { useSessionExpired().setExpired(); return }
  error.value = err instanceof Error ? err.message : 'unknown_error'
}
```

Applied uniformly in `useRoom`, `useMatches`, `useLeaderboard`, `MatchPredictionCard`.

### `/api/me/is-super-admin` discriminated patch

```ts
{ isSuperAdmin: false, reason: 'unauthenticated' } // 401 from serverSupabaseUser
{ isSuperAdmin: false, reason: 'forbidden' }       // user exists, not super admin
{ isSuperAdmin: true,  reason: 'authorized' }      // user exists, is super admin
```

Admin page (`app/pages/admin/matches/index.vue`) switches on `reason`:
- `'authorized'` → render normally
- `'unauthenticated'` → `useSessionExpired().setExpired()` and stop
- `'forbidden'` → `navigateTo('/')`

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `app/pages/rooms/index.vue` | Modified | Add auth-delegation comment |
| `app/pages/rooms/[id]/index.vue` | Modified | Add auth-delegation comment |
| `app/composables/useSessionExpired.ts` | New | useState singleton + getters/setters |
| `app/components/SessionExpiredToast.vue` | New | reka-ui based toast card |
| `app/app.vue` | Modified | Mount `<SessionExpiredToast />` in `<ClientOnly>` |
| `app/composables/useRoom.ts` | Modified | Inline 401 detection in catch |
| `app/composables/useMatches.ts` | Modified | Inline 401 detection in catch |
| `app/composables/useLeaderboard.ts` | Modified | Inline 401 detection in catch |
| `app/components/MatchPredictionCard.vue` | Modified | 401 case alongside existing 423/409 handling |
| `server/api/me/is-super-admin.get.ts` | Modified | Return discriminated `{ isSuperAdmin, reason }` |
| `app/pages/admin/matches/index.vue` | Modified | Map `reason` to setExpired / redirect / render |

~9–11 files, ~150–200 LOC.

## Delivery Strategy

Single PR targeting `main`, branch `feat/guards-coverage-and-stale-toast`. Under the 400-line budget; no chaining needed.

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| `useState` SSR caveat — flag leaks across requests on server | Low | Wrap `<SessionExpiredToast />` in `<ClientOnly>`; `useState` is request-scoped on server so isolation holds |
| Flag persistence after re-auth — toast reappears on login page | Med | `reset()` MUST be called before `navigateTo('/auth/login')` in CTA; covered by component test |
| `/api/me/is-super-admin` response shape breaks existing admin call site | Low | Single call site; updated in same PR |
| reka-ui primitives insufficient for toast styling | Low | Fallback: pure Tailwind + lucide icon; no functional dependency on reka-ui beyond what's already used |
| Test coverage gaps for 401 paths in 3 composables + card | Med | Mandate unit tests per composable (`useSessionExpired`), component test for toast, 401 path test for each composable's error branch |

## Rollback Plan

Revert the PR. No DB migrations, no schema changes, no new runtime deps. The discriminated `is-super-admin` patch is backward-compatible at the wire level (extra `reason` field is additive); the admin page's old behavior (`if (!isSuperAdmin) navigateTo('/')`) still works if reverted alone.

## Dependencies

- None new. Uses existing: `@nuxtjs/supabase`, reka-ui (transitive via shadcn-nuxt), `lucide-vue-next`, Tailwind.

## Success Criteria / Acceptance Gates

- [ ] All three composables and `MatchPredictionCard` detect `statusCode === 401` and call `setExpired()` instead of silently filling `error.value`.
- [ ] `<SessionExpiredToast />` renders when `isExpired === true` and disappears after `reset()` (dismiss or CTA).
- [ ] CTA navigates to `/auth/login` AND calls `reset()` before navigating, so the toast does not re-appear on the login page.
- [ ] Admin page renders normal content when `reason === 'authorized'`, calls `setExpired()` when `reason === 'unauthenticated'`, redirects to `/` when `reason === 'forbidden'`.
- [ ] `/rooms/index.vue` and `/rooms/[id]/index.vue` carry the explanatory comment about module-level auth delegation.
- [ ] `pnpm test:unit` and `pnpm test:nuxt` both green.
- [ ] No new runtime dependencies in `package.json`.

## Decisions Baked In (do not re-debate)

1. Slice scope is strictly S-02 coverage + stale-session toast. Realtime deferred to slice 6+.
2. `/api/me/is-super-admin` returns discriminated `{ isSuperAdmin, reason: 'authorized' | 'unauthenticated' | 'forbidden' }`.
3. Toast = shadcn-style card built from reka-ui primitives. No new runtime deps.
4. `useState` key is `'session-expired'`.
5. Plugin interception of `$fetch` is REJECTED. 401 detection lives inline in composable catch blocks.
6. Rooms pages get comment-only updates explaining module-level auth.
7. `join/[code].vue` is OUT of scope (intentional reactive UX).

## Next Phase

`sdd-spec` + `sdd-tasks` in parallel. Skip `sdd-design` — no new architecture, scope is concrete file additions + small patches following established patterns from slice 4.
