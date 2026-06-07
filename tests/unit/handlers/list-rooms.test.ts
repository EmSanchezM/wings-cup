import { describe, it, expect, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '#shared/types/database.types'
import { listRoomsHandler } from '#server/handlers/list-rooms'

type SelectResult = { data: unknown[] | null; error: { message: string } | null }

function makeMockClient(result: SelectResult) {
  const order = vi.fn(async () => result)
  const select = vi.fn(() => ({ order }))
  const from = vi.fn(() => ({ select }))
  const client = { from } as unknown as SupabaseClient<Database>
  return { client, spies: { from, select, order } }
}

describe('listRoomsHandler (R-ROOMS-02)', () => {
  it('returns rooms wrapped in { rooms }', async () => {
    const rows = [
      { id: 'r1', name: 'Amigos', prize_description: 'Birra', invite_code: 'AB12CD', status: 'active', created_at: '2026-05-17T12:00:00Z' },
      { id: 'r2', name: 'Familia', prize_description: '', invite_code: 'EF34GH', status: 'active', created_at: '2026-05-16T12:00:00Z' },
    ]
    const { client } = makeMockClient({ data: rows, error: null })

    const result = await listRoomsHandler({ supabase: client, userId: 'user-1' })

    expect(result).toEqual({ rooms: rows })
  })

  it('returns an empty array when the user has no rooms', async () => {
    const { client } = makeMockClient({ data: [], error: null })
    const result = await listRoomsHandler({ supabase: client, userId: 'user-1' })
    expect(result).toEqual({ rooms: [] })
  })

  it('returns an empty array when data is null (no rows)', async () => {
    const { client } = makeMockClient({ data: null, error: null })
    const result = await listRoomsHandler({ supabase: client, userId: 'user-1' })
    expect(result).toEqual({ rooms: [] })
  })

  it('orders by created_at DESC', async () => {
    const { client, spies } = makeMockClient({ data: [], error: null })
    await listRoomsHandler({ supabase: client, userId: 'user-1' })
    expect(spies.order).toHaveBeenCalledWith('created_at', { ascending: false })
  })

  it('selects only the RoomListItem columns', async () => {
    const { client, spies } = makeMockClient({ data: [], error: null })
    await listRoomsHandler({ supabase: client, userId: 'user-1' })
    const selectArg = spies.select.mock.calls[0][0] as string
    expect(selectArg).toContain('id')
    expect(selectArg).toContain('name')
    expect(selectArg).toContain('prize_description')
    expect(selectArg).toContain('invite_code')
    expect(selectArg).toContain('status')
    expect(selectArg).toContain('created_at')
  })

  it('throws when the query returns an error', async () => {
    const { client } = makeMockClient({ data: null, error: { message: 'rls violation' } })
    await expect(listRoomsHandler({ supabase: client, userId: 'user-1' })).rejects.toThrow(/rls violation/)
  })
})
