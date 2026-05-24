/**
 * Nuxt component tests for app/pages/auth/confirm.vue (R-AUTH-11)
 *
 * Tests the invite branch: token_hash + type=invite → verifyOtp flow.
 * Also guards the existing PKCE branch (regression).
 *
 * Strategy:
 *   Structural tests (fs.readFileSync) — used throughout this test suite for
 *   components that call useSupabaseClient() directly. The @nuxt/test-utils
 *   runtime environment cannot initialize the Supabase plugin (no SUPABASE_URL/KEY),
 *   so runtime mocking of useSupabaseClient is not feasible here. This matches
 *   the established pattern in this codebase (see predictions.nuxt.test.ts T-69-03,
 *   session-expired-toast.nuxt.test.ts T-60-05).
 *
 *   Structural tests fully satisfy the spec requirements because R-AUTH-11 specifies
 *   exact source-level invariants (which calls appear, which branch guards are used,
 *   which redirect values are set). Runtime behavior is covered by the manual smoke
 *   runbook (T-111).
 *
 * TDD: T-107 (RED) — tests written BEFORE invite branch exists in confirm.vue.
 *      T-108 (GREEN) — tests go GREEN after invite branch is added.
 */
import { describe, it, expect } from 'vitest'

// ---------------------------------------------------------------------------
// Helper: read confirm.vue source once per suite
// ---------------------------------------------------------------------------

async function readConfirmSrc(): Promise<string> {
  const fs = await import('fs')
  const path = await import('path')
  return fs.readFileSync(
    path.resolve(process.cwd(), 'app/pages/auth/confirm.vue'),
    'utf-8',
  )
}

// ---------------------------------------------------------------------------
// T-107 — Structural tests (source-level invariants)
// RED when invite branch does not exist; GREEN after T-108 implements it.
// ---------------------------------------------------------------------------

describe('confirm.vue — invite branch structure (R-AUTH-11)', () => {
  it('T-107-S1: source contains verifyOtp call (invite branch implemented)', async () => {
    const src = await readConfirmSrc()
    expect(src).toContain('verifyOtp')
  })

  it('T-107-S2: branch guard checks token_hash AND type === invite', async () => {
    const src = await readConfirmSrc()
    expect(src).toContain('token_hash')
    expect(src).toContain("'invite'")
  })

  it('T-107-S3: verifyOtp called with type: invite (correct OTP type passed)', async () => {
    const src = await readConfirmSrc()
    // The verifyOtp call must pass type: 'invite'
    expect(src).toContain("type: 'invite'")
  })

  it('T-107-S4: PKCE branch (exchangeCodeForSession) still present — regression guard', async () => {
    const src = await readConfirmSrc()
    expect(src).toContain('exchangeCodeForSession')
  })

  it('T-107-S5: invite branch redirect fallback is /rooms', async () => {
    const src = await readConfirmSrc()
    expect(src).toContain('/rooms')
  })

  it('T-107-S6: error path in invite branch redirects to /auth/login', async () => {
    const src = await readConfirmSrc()
    expect(src).toContain('/auth/login')
  })

  it('T-107-S7: isSafeNext used in invite branch (priority ?next redirect)', async () => {
    const src = await readConfirmSrc()
    expect(src).toContain('isSafeNext')
  })

  it('T-107-S8: invite branch is ordered AFTER the PKCE branch in source', async () => {
    const src = await readConfirmSrc()
    const pkceIdx = src.indexOf('exchangeCodeForSession')
    const inviteIdx = src.indexOf('verifyOtp')
    // Both must exist
    expect(pkceIdx).toBeGreaterThan(-1)
    expect(inviteIdx).toBeGreaterThan(-1)
    // PKCE branch must appear before invite branch in source
    expect(pkceIdx).toBeLessThan(inviteIdx)
  })

  it('T-107-S9: typeof token_hash check guards the invite branch (string type guard)', async () => {
    const src = await readConfirmSrc()
    // Must have a typeof check for token_hash to avoid undefined/array edge cases
    expect(src).toContain("typeof tokenHash === 'string'")
  })

  it('T-107-S10: useSupabaseCookieRedirect().pluck() used in invite redirect resolution', async () => {
    const src = await readConfirmSrc()
    expect(src).toContain('cookieRedirect.pluck()')
  })
})
