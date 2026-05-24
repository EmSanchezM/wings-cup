# Leaderboard Spec — Delta for predictions-ux-and-guards (Slice 4)

## Overview
Delta. R-LEAD-04 is MODIFIED: the auth-guard mechanism is corrected from an unreliable `useSupabaseUser + onMounted` redirect to exclusive reliance on the `@nuxtjs/supabase` module-level `redirectOptions`. R-LEAD-01..03 are unchanged (inherited from slice 3).

## Requirements Summary
| Req | Title | Change | Scenarios |
|-----|-------|--------|-----------| 
| R-LEAD-04 | Leaderboard Page Auth Guard | MODIFIED | 4 |

---

## MODIFIED Requirements

### R-LEAD-04: Leaderboard Page Auth Guard
**Type**: MODIFIED | **Source**: S-02
(Previously: "Page MUST redirect unauthenticated users to `/login`" via `useSupabaseUser() + onMounted` guard.)

`app/pages/rooms/[id]/leaderboard.vue` MUST NOT contain a `useSupabaseUser()` import or any `onMounted` redirect block that checks `user.value`. Authentication enforcement MUST be delegated exclusively to the `@nuxtjs/supabase` module's `redirectOptions.include` list which already covers `/rooms(/*)` routes in `nuxt.config.ts`. The `load()` call from `useLeaderboard()` MUST be invoked inside a plain `onMounted(() => load())`. Stale-session failures (401 from the leaderboard API) MUST surface via the `useLeaderboard().error` ref — they MUST NOT be swallowed silently and MUST NOT trigger a manual `navigateTo` redirect from the page component.

#### Scenario: Unauthenticated access redirects via module

- GIVEN a user is not authenticated (no valid session cookie)
- WHEN they navigate to `rooms/[id]/leaderboard`
- THEN the `@nuxtjs/supabase` middleware intercepts the navigation
- AND the user is redirected to the configured login route
- AND the leaderboard page component is never mounted

#### Scenario: Leaderboard page has no manual auth guard

- GIVEN the `leaderboard.vue` source file is inspected
- WHEN checking for `useSupabaseUser` imports or `navigateTo('/login')` calls inside `onMounted`
- THEN neither is present

#### Scenario: Load fires on mount without manual guard

- GIVEN the user is authenticated and navigates to `rooms/[id]/leaderboard`
- WHEN the page component mounts
- THEN `onMounted(() => load())` fires immediately
- AND leaderboard data is fetched from the API

#### Scenario: Stale session error surfaces via composable

- GIVEN the user's JWT has expired mid-session
- WHEN the page is already mounted and `load()` calls the leaderboard API
- THEN the API returns 401
- AND `useLeaderboard().error` is set to the error value
- AND no automatic `navigateTo` redirect is triggered from the page component
