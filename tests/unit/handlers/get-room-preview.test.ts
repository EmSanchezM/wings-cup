import { describe, it, expect, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '#shared/types/database.types'
import {
  getRoomPreviewHandler,
  RoomNotFoundError,
} from '#server/handlers/get-room-preview'

type PreviewRow = {
  name: string
  status: string
  profiles: { display_name: string } | null
} | null

type SingleResult = { data: PreviewRow; error: { message: string } | null }

function makeMockClient(result: SingleResult) {
  const maybeSingle = vi.fn(async () => result)
  const eq = vi.fn(() => ({ maybeSingle }))
  const select = vi.fn(() => ({ eq }))
  const from = vi.fn(() => ({ select }))
  const client = { from } as unknown as SupabaseClient<Database>
  return { client, spies: { from, select, eq, maybeSingle } }
}

describe('getRoomPreviewHandler (R-INV-03, R-SEC-41)', () => {
  it('returns roomName, creatorName, isActive for an active room', async () => {
    const { client } = makeMockClient({
      data: {
        name: 'Amigos',
        status: 'active',
        profiles: { display_name: 'Juan' },
      },
      error: null,
    })

    const result = await getRoomPreviewHandler({ admin: client, code: 'XY9Z42' })

    expect(result).toEqual({
      roomName: 'Amigos',
      creatorName: 'Juan',
      isActive: true,
    })
  })

  it('returns isActive=false when status is archived', async () => {
    const { client } = makeMockClient({
      data: { name: 'Old', status: 'archived', profiles: { display_name: 'Pepe' } },
      error: null,
    })
    const result = await getRoomPreviewHandler({ admin: client, code: 'ABCDEF' })
    expect(result.isActive).toBe(false)
  })

  it('CRITICAL: returns ONLY the three preview keys, no extras', async () => {
    const { client } = makeMockClient({
      data: { name: 'X', status: 'active', profiles: { display_name: 'Y' } },
      error: null,
    })
    const result = await getRoomPreviewHandler({ admin: client, code: 'AB12CD' })
    expect(Object.keys(result).sort()).toEqual([
      'creatorName',
      'isActive',
      'roomName',
    ])
  })

  it('throws RoomNotFoundError when the code does not match any row', async () => {
    const { client } = makeMockClient({ data: null, error: null })
    await expect(
      getRoomPreviewHandler({ admin: client, code: 'NONEXX' }),
    ).rejects.toBeInstanceOf(RoomNotFoundError)
  })

  it('throws when the underlying query errors', async () => {
    const { client } = makeMockClient({ data: null, error: { message: 'db down' } })
    await expect(
      getRoomPreviewHandler({ admin: client, code: 'AB12CD' }),
    ).rejects.toThrow(/db down/)
  })

  it('looks up the room by invite_code', async () => {
    const { client, spies } = makeMockClient({
      data: { name: 'X', status: 'active', profiles: { display_name: 'Y' } },
      error: null,
    })
    await getRoomPreviewHandler({ admin: client, code: 'AB12CD' })
    expect(spies.eq).toHaveBeenCalledWith('invite_code', 'AB12CD')
  })

  it('falls back to empty creatorName when the profile join is null', async () => {
    const { client } = makeMockClient({
      data: { name: 'Orphan', status: 'active', profiles: null },
      error: null,
    })
    const result = await getRoomPreviewHandler({ admin: client, code: 'AB12CD' })
    expect(result.creatorName).toBe('')
  })
})
