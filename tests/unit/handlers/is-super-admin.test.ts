import { describe, it, expect, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../../shared/types/database.types'

/**
 * Unit tests for the discriminated /api/me/is-super-admin endpoint logic.
 * (R-ADMIN-05 scenarios 1–4)
 *
 * Tests the handler function directly, not the Nitro event handler wrapper.
 *
 * T-71-01: valid JWT + super admin → { isSuperAdmin: true, reason: 'authorized' }
 * T-71-02: valid JWT + non-admin → { isSuperAdmin: false, reason: 'forbidden' }
 * T-71-03: missing/invalid JWT (serverSupabaseUser throws 401) → { isSuperAdmin: false, reason: 'unauthenticated' }, HTTP 200
 * T-71-04: response always includes reason field in ['authorized', 'unauthenticated', 'forbidden']
 */

// We test the handler logic function, not the Nitro event handler.
// Import the handler from server/handlers/is-super-admin.ts
import { isSuperAdminHandler } from '../../../server/handlers/is-super-admin'

type MockSupabaseClient = Pick<SupabaseClient<Database>, 'from'>

function makeProfileClient(isSuperAdmin: boolean | null, dbError = false) {
  const singleFn = vi.fn(async () => ({
    data: dbError ? null : { is_super_admin: isSuperAdmin },
    error: dbError ? { message: 'db error' } : null,
  }))
  const eqFn = vi.fn(() => ({ single: singleFn }))
  const selectFn = vi.fn(() => ({ eq: eqFn }))
  const from = vi.fn(() => ({ select: selectFn }))
  const client = { from } as unknown as MockSupabaseClient
  return { client, spies: { from, selectFn, eqFn, singleFn } }
}

describe('isSuperAdminHandler (R-ADMIN-05)', () => {
  it('T-71-01: valid JWT + super admin → { isSuperAdmin: true, reason: "authorized" }', async () => {
    const { client } = makeProfileClient(true)
    const result = await isSuperAdminHandler({
      userId: 'user-001',
      supabase: client as unknown as SupabaseClient<Database>,
    })
    expect(result).toEqual({ isSuperAdmin: true, reason: 'authorized' })
  })

  it('T-71-02: valid JWT + non-admin → { isSuperAdmin: false, reason: "forbidden" }', async () => {
    const { client } = makeProfileClient(false)
    const result = await isSuperAdminHandler({
      userId: 'user-002',
      supabase: client as unknown as SupabaseClient<Database>,
    })
    expect(result).toEqual({ isSuperAdmin: false, reason: 'forbidden' })
  })

  it('T-71-03: unauthenticated (no userId) → { isSuperAdmin: false, reason: "unauthenticated" }, no throw', async () => {
    const { client } = makeProfileClient(null)
    // No userId = unauthenticated path
    const result = await isSuperAdminHandler({
      userId: null,
      supabase: client as unknown as SupabaseClient<Database>,
    })
    expect(result).toEqual({ isSuperAdmin: false, reason: 'unauthenticated' })
  })

  it('T-71-04: reason field is always present and in valid set', async () => {
    const validReasons = ['authorized', 'unauthenticated', 'forbidden']

    const adminClient = makeProfileClient(true).client
    const forbiddenClient = makeProfileClient(false).client

    // Test all three paths
    const adminResult = await isSuperAdminHandler({
      userId: 'u1',
      supabase: adminClient as unknown as SupabaseClient<Database>,
    })
    const forbiddenResult = await isSuperAdminHandler({
      userId: 'u2',
      supabase: forbiddenClient as unknown as SupabaseClient<Database>,
    })
    const unauthenticatedResult = await isSuperAdminHandler({
      userId: null,
      supabase: adminClient as unknown as SupabaseClient<Database>,
    })

    expect(validReasons).toContain(adminResult.reason)
    expect(validReasons).toContain(forbiddenResult.reason)
    expect(validReasons).toContain(unauthenticatedResult.reason)
  })
})
