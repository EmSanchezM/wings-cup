# Spec: auth

**Domain:** Authentication flows — OAuth (Google), Magic Link, hybrid guest flow, PKCE callback, and redirect middleware.
**Slice:** foundation (PR 3 of 3)

---

## Purpose

Wire the three authentication entry points (OAuth, Magic Link, Guest-via-magic-link) using `@nuxtjs/supabase` v2 with SSR-safe cookies, PKCE exchange at `/auth/confirm`, and `redirectOptions` guarding only protected routes. After this slice, real users can sign in and their `profiles` row is created automatically by the trigger.

---

## Requirements

### Module configuration

- R-AUTH-01: `@nuxtjs/supabase` v2 MUST be configured with `useSsrCookies: true`.
- R-AUTH-02: `redirectOptions` MUST be configured exactly as:
  ```
  login: '/auth/login'
  callback: '/auth/confirm'
  include: ['/rooms(/*)?', '/admin(/*)?']
  exclude: ['/', '/join/*', '/auth/*']
  saveRedirectToCookie: true
  ```
- R-AUTH-03: The Supabase public URL and anon key MUST be provided via `NUXT_PUBLIC_SUPABASE_URL` and `NUXT_PUBLIC_SUPABASE_KEY` environment variables only.
- R-AUTH-04: `supabase.types` MUST reference `./shared/types/database.types.ts`.

### Pages

- R-AUTH-05: `app/pages/auth/login.vue` MUST exist and render links/buttons for Google sign-in and magic-link sign-in.
- R-AUTH-06: `app/pages/auth/confirm.vue` MUST exist and handle the PKCE token exchange on mount using `useSupabaseClient().auth.exchangeCodeForSession(code)` where `code` comes from the URL query param.
- R-AUTH-07: After successful token exchange in `/auth/confirm`, the user MUST be redirected to the URL stored in the redirect cookie, or to `/rooms` as a default fallback.
- R-AUTH-08: `/auth/login` and `/auth/confirm` MUST be excluded from the redirect guard (authenticated users visiting them MUST NOT be force-redirected).

### OAuth flows

- R-AUTH-09: Clicking "Sign in with Google" MUST call `signInWithOAuth({ provider: 'google', options: { redirectTo: '<origin>/auth/confirm' } })`.
- R-AUTH-11: After OAuth callback, Supabase stores a session cookie and `/auth/confirm` completes the PKCE exchange.
- R-AUTH-12: On first OAuth sign-in, the `handle_new_user` trigger MUST have created a `profiles` row with `auth_provider = 'google'` and `is_guest = FALSE`.

### Magic Link flow

- R-AUTH-13: The magic link flow MUST use `signInWithOtp({ email, options: { emailRedirectTo: '<origin>/auth/confirm', data: { display_name } } })`.
- R-AUTH-14: A magic-link user who clicks the email link and lands on `/auth/confirm` MUST have their session established via the PKCE exchange.
- R-AUTH-15: On first magic-link sign-in, the `handle_new_user` trigger MUST have created a `profiles` row with `auth_provider = 'magic_link'` and `is_guest = TRUE`.

### Guest → registered upgrade

- R-AUTH-16: A logged-in guest (is_guest = TRUE) MUST be able to link a Google identity via `supabaseClient.auth.linkIdentity({ provider: 'google' })`.
- R-AUTH-17: After identity linking, a server-side endpoint MUST flip `profiles.is_guest = FALSE` and set `auth_provider` to the linked provider using the service role client.
- R-AUTH-18: The linked identity MUST share the same `user_id` — no new profile row is created.

### Redirect middleware

- R-AUTH-19: Any unauthenticated request to `/rooms/*` or `/admin/*` MUST be redirected to `/auth/login` with the original path saved to cookie.
- R-AUTH-20: Authenticated users visiting `/`, `/join/*`, or `/auth/*` MUST NOT be redirected away.
- R-AUTH-21: The redirect middleware MUST be provided by the `@nuxtjs/supabase` module (`redirectOptions`), not by a custom hand-written middleware.

### Environment variables

- R-AUTH-22: `.env.example` MUST document: `NUXT_PUBLIC_SUPABASE_URL`, `NUXT_PUBLIC_SUPABASE_KEY`, `NUXT_SUPABASE_SERVICE_KEY` (server-only), and `CRON_SECRET` (reserved for slice 3).

---

## Scenarios

### S-AUTH-01: Google OAuth signup — happy path

```
Given an unauthenticated user is on /auth/login
When they click "Sign in with Google"
Then the browser is redirected to the Supabase Google OAuth authorization URL
And after Google authorization, the callback reaches /auth/confirm
And the PKCE exchange completes successfully
And a session cookie is stored
And the user is redirected to /rooms (or the saved cookie path)
And a profiles row exists with auth_provider = 'google', is_guest = FALSE
```

### S-AUTH-03: Magic-link signup — happy path

```
Given an unauthenticated user submits an email on the magic-link form
When Supabase sends the magic link to that email
And the user clicks the link
Then the browser reaches /auth/confirm with the PKCE code in the query string
And the session is established
And a profiles row exists with auth_provider = 'magic_link', is_guest = TRUE
```

### S-AUTH-04: Returning user — no new profile row

```
Given a user already has a profiles row (auth_provider = 'google')
When they sign in again with Google OAuth
Then the PKCE exchange succeeds
And no duplicate profiles row is created
And the existing profiles row is unchanged
```

### S-AUTH-05: Protected route redirects unauthenticated user

```
Given an unauthenticated user
When they navigate directly to /rooms/some-id
Then the module middleware redirects them to /auth/login
And the original path /rooms/some-id is saved to cookie
```

### S-AUTH-06: After login, user lands at original path

```
Given an unauthenticated user was redirected from /rooms/some-id to /auth/login
When they complete OAuth sign-in
Then /auth/confirm reads the redirect cookie
And the user is sent to /rooms/some-id
```

### S-AUTH-07: Public routes not gated

```
Given an unauthenticated user
When they navigate to / (landing page)
Then no redirect occurs
And the landing page renders
```

### S-AUTH-08: /join/* is not gated

```
Given an unauthenticated user
When they navigate to /join/INVITE_CODE
Then no redirect occurs
And the join page renders (content may be empty in this slice — the route exists)
```

### S-AUTH-09: Guest upgrades to Google account

```
Given a user is authenticated with is_guest = TRUE
When they trigger "Link Google account" (calls auth.linkIdentity({ provider: 'google' }))
And the server-side endpoint receives the callback
Then the same user_id remains active (no new auth.users row)
And profiles.is_guest is updated to FALSE
And profiles.auth_provider is updated to 'google'
```

### S-AUTH-10: /auth/confirm handles missing code gracefully

```
Given a user navigates to /auth/confirm without a `code` query parameter
When the page mounts
Then no PKCE exchange is attempted
And the page redirects to /auth/login with an appropriate error message or silently
```

---

## Acceptance criteria

- [ ] `@nuxtjs/supabase` v2 configured with `useSsrCookies: true`
- [ ] `redirectOptions` matches the locked configuration exactly
- [ ] `app/pages/auth/login.vue` exists with Google and magic-link entry points
- [ ] `app/pages/auth/confirm.vue` exists and performs PKCE exchange
- [ ] Google OAuth signup creates `profiles` row with `auth_provider = 'google'`, `is_guest = FALSE`
- [ ] Magic-link signup creates `profiles` row with `auth_provider = 'magic_link'`, `is_guest = TRUE`
- [ ] Unauthenticated access to `/rooms/*` redirects to `/auth/login`
- [ ] `/`, `/join/*`, `/auth/*` are NOT gated
- [ ] Returning user does not create duplicate profiles row
- [ ] Guest-to-registered link flow flips `is_guest = FALSE` via server endpoint
- [ ] `.env.example` documents all four required environment variables

---

## Out of scope (this slice)

- Invitation-token-based room joining logic (slice 2)
- Full `/join/[code].vue` page implementation (slice 2)
- Admin authentication guards (slice 5)
- Email customization via Resend (roadmap)
- Session refresh or token rotation strategies (handled by `@nuxtjs/supabase` module)
- `/rooms/*` page implementations (slice 2)
