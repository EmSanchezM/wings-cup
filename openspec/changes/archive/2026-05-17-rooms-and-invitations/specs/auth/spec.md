# Auth Spec — Delta for rooms-and-invitations

## Overview

Delta to the `auth` main spec. Two changes: (1) magic-link `signInWithOtp` now includes `data: { display_name }` (closes W-03); (2) `confirm.vue` reads and validates a `?next=` query parameter after PKCE exchange, using it as a redirect destination before falling back to `/rooms`.

## Requirements

### R-AUTH-23: Magic-Link Includes `display_name` in OTP Data
**Type**: NEW
**Source**: proposal §In Scope (W-03 closure) / R-INV-05
**Statement**: The magic-link signup path on the join page MUST call `signInWithOtp` with `options.data = { display_name: <user-supplied string> }`. This ensures `handle_new_user` reads `NEW.raw_user_meta_data->>'display_name'` and populates `profiles.display_name` correctly. The existing `signInWithOtp` call in `R-AUTH-13` (login page, no join context) is unchanged — it does NOT need `display_name` because the login page has no name collection.

**Scenarios**:
- **Given** an unauthenticated user submits the magic-link form on `/join/AB12CD` with `email = "a@b.com"` and `display_name = "Pepe"` **When** `signInWithOtp` is called **Then** the call includes `{ email: "a@b.com", options: { emailRedirectTo: "<origin>/auth/confirm?next=/join/AB12CD", data: { display_name: "Pepe" } } }`.
- **Given** the magic-link email is sent and the user clicks the link **When** `handle_new_user` fires on first sign-in **Then** `profiles.display_name = "Pepe"` (populated from `raw_user_meta_data`).
- **Given** an existing user (already authenticated) visits `/join/AB12CD` **When** the page renders **Then** no `signInWithOtp` call is made and no `display_name` form is shown.

### R-AUTH-24: `confirm.vue` Honors `?next=` After PKCE Exchange
**Type**: NEW
**Source**: proposal §In Scope / locked decision #2 / R-INV-06, R-INV-07
**Statement**: After a successful PKCE token exchange, `confirm.vue` MUST read the `next` query parameter, validate it against the same-origin pattern `/^\/join\/[A-Z0-9]{6}$/`, and redirect there if valid. If `next` is absent, malformed, or fails validation, the fallback MUST be `/rooms`. This replaces (in the join context) the existing behavior of reading the redirect cookie (R-AUTH-07), but MUST NOT break the existing cookie-based redirect for non-join flows. Both paths MUST coexist: `next` query param takes precedence over the cookie when present and valid.

**Scenarios**:
- **Given** the user lands on `/auth/confirm?next=/join/AB12CD` after magic-link or OAuth **When** PKCE exchange succeeds **Then** `confirm.vue` validates `/join/AB12CD` against the pattern, it passes, and the user is redirected to `/join/AB12CD`.
- **Given** the user lands on `/auth/confirm` (no `next` param) after Google OAuth from the login page **When** PKCE exchange succeeds **Then** `confirm.vue` falls back to reading the redirect cookie, and if the cookie contains `/rooms/some-id`, redirects there (existing behavior unchanged).
- **Given** the user lands on `/auth/confirm?next=https://evil.com` **When** PKCE exchange succeeds **Then** the `next` value fails validation and `confirm.vue` redirects to `/rooms`.
- **Given** PKCE exchange fails (invalid or expired code) **When** `confirm.vue` processes the callback **Then** the user is redirected to `/auth/login` with an error indicator (existing behavior from R-AUTH-10, unchanged).

## MODIFIED Requirements

### R-AUTH-13: Magic-Link OTP — Updated to Include `emailRedirectTo` with `?next=` Support
**Type**: MODIFIED
**Source**: R-AUTH-13 (foundation) — updated to reflect join-page usage with `?next=`

The magic link flow MUST use `signInWithOtp({ email, options: { emailRedirectTo: '<origin>/auth/confirm', data: { display_name } } })` when initiated from the join page. When initiated from the standard login page (no invite context), `data` MAY be omitted. In both cases, when a join code is present, `emailRedirectTo` MUST append `?next=/join/{code}` to the confirm URL.

(Previously: `signInWithOtp` always used `emailRedirectTo: '<origin>/auth/confirm'` with `data: { display_name }` — no `?next=` encoding existed.)

#### Scenario: Magic-link from login page (no join context)

- GIVEN an unauthenticated user submits an email on the magic-link form at `/auth/login`
- WHEN `signInWithOtp` is called
- THEN `emailRedirectTo` is `<origin>/auth/confirm` (no `?next=` suffix)
- AND `data` may be absent or empty (no display_name collection at login)

#### Scenario: Magic-link from join page

- GIVEN an unauthenticated user submits the magic-link form on `/join/AB12CD`
- WHEN `signInWithOtp` is called
- THEN `emailRedirectTo` is `<origin>/auth/confirm?next=/join/AB12CD`
- AND `data: { display_name: "<supplied name>" }` is included

### R-AUTH-07: Post-PKCE Redirect — Updated to Prefer `?next=` Over Cookie
**Type**: MODIFIED
**Source**: R-AUTH-07 (foundation) — updated redirect priority

After successful token exchange in `/auth/confirm`, the user MUST be redirected using this priority order: (1) validate and use `?next=` query parameter if present and passes `/^\/join\/[A-Z0-9]{6}$/` check; (2) fall back to the URL stored in the redirect cookie; (3) fall back to `/rooms` as the final default.

(Previously: redirect logic read only the cookie, falling back to `/rooms`. No `?next=` param existed.)

#### Scenario: `?next=` takes precedence over cookie

- GIVEN the redirect cookie contains `/rooms/some-id`
- AND the URL includes `?next=/join/AB12CD`
- WHEN PKCE exchange succeeds
- THEN the user is redirected to `/join/AB12CD` (not the cookie value)

#### Scenario: Cookie fallback when `?next=` absent

- GIVEN the redirect cookie contains `/rooms/some-id`
- AND no `?next=` param is in the URL
- WHEN PKCE exchange succeeds
- THEN the user is redirected to `/rooms/some-id`

#### Scenario: Final fallback to `/rooms`

- GIVEN no `?next=` param and no redirect cookie
- WHEN PKCE exchange succeeds
- THEN the user is redirected to `/rooms`

## Out of Scope
- Guest→registered `linkIdentity` upgrade flow (slice 5).
- Admin authentication guards (slice 5).
- Email customization via Resend (roadmap).
- Session refresh / token rotation (handled by `@nuxtjs/supabase`).
