import { describe, it, expect, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '#shared/types/database.types'
import { getProfileHandler } from '#server/handlers/get-profile'
import { updateProfileHandler } from '#server/handlers/update-profile'

type SingleResult<T> = { data: T | null, error: { message: string } | null }

interface BuilderConfig {
  readSingle?: SingleResult<unknown>
  updateSingle?: SingleResult<unknown>
}

function makeServiceClient(cfg: BuilderConfig) {
  const readSingleFn = vi.fn(async () => cfg.readSingle ?? { data: null, error: null })
  const readEq = vi.fn(() => ({ single: readSingleFn }))
  const readSelect = vi.fn(() => ({ eq: readEq }))

  const updateSingleFn = vi.fn(async () => cfg.updateSingle ?? { data: null, error: null })
  const updateSelect = vi.fn(() => ({ single: updateSingleFn }))
  const updateEq = vi.fn(() => ({ select: updateSelect }))
  const updateFn = vi.fn(() => ({ eq: updateEq }))

  const from = vi.fn((table: string) => {
    if (table === 'profiles') {
      return { select: readSelect, update: updateFn }
    }
    throw new Error(`unexpected from(${table})`)
  })

  const client = { from } as unknown as SupabaseClient<Database>
  return { client, spies: { from, readSelect, updateFn, updateEq } }
}

const USER_ID = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'

const existingProfile = {
  id: USER_ID,
  display_name: 'Old Name',
  avatar_url: null,
}

describe('getProfileHandler', () => {
  it('returns the caller profile view', async () => {
    const { client } = makeServiceClient({
      readSingle: { data: existingProfile, error: null },
    })

    const result = await getProfileHandler({
      supabaseService: client,
      userId: USER_ID,
    })

    expect(result).toEqual({ profile: existingProfile })
  })

  it('profile not found → throws profile_not_found', async () => {
    const { client } = makeServiceClient({
      readSingle: { data: null, error: null },
    })

    await expect(
      getProfileHandler({ supabaseService: client, userId: USER_ID }),
    ).rejects.toThrow(/profile_not_found/)
  })

  it('supabase read error propagates', async () => {
    const { client } = makeServiceClient({
      readSingle: { data: null, error: { message: 'DB error' } },
    })

    await expect(
      getProfileHandler({ supabaseService: client, userId: USER_ID }),
    ).rejects.toThrow(/DB error/)
  })
})

describe('updateProfileHandler', () => {
  it('updates display_name and returns the updated profile view', async () => {
    const updated = { ...existingProfile, display_name: 'New Name' }
    const { client, spies } = makeServiceClient({
      updateSingle: { data: updated, error: null },
    })

    const result = await updateProfileHandler({
      supabaseService: client,
      userId: USER_ID,
      patch: { display_name: 'New Name' },
    })

    expect(result).toEqual({ profile: updated })
    // Always scopes the update to the caller's own row.
    expect(spies.updateEq).toHaveBeenCalledWith('id', USER_ID)
  })

  it('update returns no row → throws profile_not_found', async () => {
    const { client } = makeServiceClient({
      updateSingle: { data: null, error: null },
    })

    await expect(
      updateProfileHandler({
        supabaseService: client,
        userId: USER_ID,
        patch: { display_name: 'New Name' },
      }),
    ).rejects.toThrow(/profile_not_found/)
  })

  it('supabase update error propagates', async () => {
    const { client } = makeServiceClient({
      updateSingle: { data: null, error: { message: 'DB error' } },
    })

    await expect(
      updateProfileHandler({
        supabaseService: client,
        userId: USER_ID,
        patch: { display_name: 'New Name' },
      }),
    ).rejects.toThrow(/DB error/)
  })
})
