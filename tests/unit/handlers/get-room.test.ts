import { describe, it, expect, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../../shared/types/database.types'
import { getRoomHandler, RoomNotFoundError } from '../../../server/handlers/get-room'

type SingleResult = { data: Record<string, unknown> | null; error: { message: string } | null }
type ListResult = { data: unknown[] | null; error: { message: string } | null }

function makeMockClient(opts: { room: SingleResult; members: ListResult }) {
  const maybeSingle = vi.fn(async () => opts.room)
  const roomEq = vi.fn(() => ({ maybeSingle }))
  const roomSelect = vi.fn(() => ({ eq: roomEq }))

  const membersEq = vi.fn(async () => opts.members)
  const membersSelect = vi.fn(() => ({ eq: membersEq }))

  const from = vi.fn((table: string) => {
    if (table === 'rooms') return { select: roomSelect }
    if (table === 'room_members') return { select: membersSelect }
    throw new Error(`unexpected from('${table}')`)
  })

  const client = { from } as unknown as SupabaseClient<Database>
  return { client, spies: { from, roomEq, membersEq } }
}

describe('getRoomHandler (R-ROOMS-03)', () => {
  it('returns the room with its members', async () => {
    const room = {
      id: 'r1', name: 'Amigos', prize_description: 'Birra', invite_code: 'AB12CD',
      status: 'active', created_at: '2026-05-17T12:00:00Z', created_by: 'user-1',
      scoring_rules: { exact_score: 5, correct_goal_diff: 3, correct_result: 1 },
    }
    const members = [
      { room_id: 'r1', user_id: 'user-1', role: 'owner', total_points: 0, joined_at: '2026-05-17T12:00:00Z' },
      { room_id: 'r1', user_id: 'user-2', role: 'member', total_points: 0, joined_at: '2026-05-17T13:00:00Z' },
    ]
    const { client } = makeMockClient({ room: { data: room, error: null }, members: { data: members, error: null } })

    const result = await getRoomHandler({ supabase: client, roomId: 'r1' })

    expect(result).toEqual({ room, members })
  })

  it('throws RoomNotFoundError when no room matches the id', async () => {
    const { client } = makeMockClient({ room: { data: null, error: null }, members: { data: [], error: null } })
    await expect(getRoomHandler({ supabase: client, roomId: 'missing' })).rejects.toBeInstanceOf(RoomNotFoundError)
  })

  it('throws when the room query returns an error', async () => {
    const { client } = makeMockClient({ room: { data: null, error: { message: 'db down' } }, members: { data: [], error: null } })
    await expect(getRoomHandler({ supabase: client, roomId: 'r1' })).rejects.toThrow(/db down/)
  })

  it('throws when the members query returns an error', async () => {
    const room = { id: 'r1', name: 'X', prize_description: '', invite_code: 'AB12CD', status: 'active', created_at: '2026-05-17T12:00:00Z', created_by: 'user-1', scoring_rules: {} }
    const { client } = makeMockClient({ room: { data: room, error: null }, members: { data: null, error: { message: 'members down' } } })
    await expect(getRoomHandler({ supabase: client, roomId: 'r1' })).rejects.toThrow(/members down/)
  })

  it('filters room_members by the requested room_id', async () => {
    const room = { id: 'r1', name: 'X', prize_description: '', invite_code: 'AB12CD', status: 'active', created_at: '2026-05-17T12:00:00Z', created_by: 'user-1', scoring_rules: {} }
    const { client, spies } = makeMockClient({ room: { data: room, error: null }, members: { data: [], error: null } })
    await getRoomHandler({ supabase: client, roomId: 'r1' })
    expect(spies.membersEq).toHaveBeenCalledWith('room_id', 'r1')
  })

  it('does not query members when the room is not found', async () => {
    const { client, spies } = makeMockClient({ room: { data: null, error: null }, members: { data: [], error: null } })
    await expect(getRoomHandler({ supabase: client, roomId: 'missing' })).rejects.toBeInstanceOf(RoomNotFoundError)
    expect(spies.membersEq).not.toHaveBeenCalled()
  })

  it('returns an empty members array when data is null', async () => {
    const room = { id: 'r1', name: 'X', prize_description: '', invite_code: 'AB12CD', status: 'active', created_at: '2026-05-17T12:00:00Z', created_by: 'user-1', scoring_rules: {} }
    const { client } = makeMockClient({ room: { data: room, error: null }, members: { data: null, error: null } })
    const result = await getRoomHandler({ supabase: client, roomId: 'r1' })
    expect(result.members).toEqual([])
  })
})
