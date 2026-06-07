import { describe, it, expect, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '#shared/types/database.types'
import {
  joinRoomHandler,
  RoomNotFoundError,
} from '#server/handlers/join-room'

type RoomLookup = { data: { id: string; status: string } | null; error: { message: string } | null }
type InsertResult = { error: { code?: string; message: string } | null }

function makeMocks(opts: { lookup: RoomLookup; insert: InsertResult }) {
  const maybeSingle = vi.fn(async () => opts.lookup)
  const lookupEq = vi.fn(() => ({ maybeSingle }))
  const lookupSelect = vi.fn(() => ({ eq: lookupEq }))
  const adminFrom = vi.fn(() => ({ select: lookupSelect }))
  const admin = { from: adminFrom } as unknown as SupabaseClient<Database>

  const insert = vi.fn(async () => opts.insert)
  const userFrom = vi.fn(() => ({ insert }))
  const userClient = { from: userFrom } as unknown as SupabaseClient<Database>

  return { admin, userClient, spies: { adminFrom, lookupEq, insert, userFrom } }
}

describe('joinRoomHandler (R-INV-04)', () => {
  it('returns { roomId } when a new member joins an active room', async () => {
    const { admin, userClient } = makeMocks({
      lookup: { data: { id: 'room-1', status: 'active' }, error: null },
      insert: { error: null },
    })

    const result = await joinRoomHandler({
      admin,
      userClient,
      userId: 'user-1',
      code: 'AB12CD',
    })

    expect(result).toEqual({ roomId: 'room-1' })
  })

  it('inserts a room_members row with role=member, user_id, room_id', async () => {
    const { admin, userClient, spies } = makeMocks({
      lookup: { data: { id: 'room-1', status: 'active' }, error: null },
      insert: { error: null },
    })

    await joinRoomHandler({ admin, userClient, userId: 'user-42', code: 'AB12CD' })

    expect(spies.userFrom).toHaveBeenCalledWith('room_members')
    expect(spies.insert).toHaveBeenCalledWith({
      room_id: 'room-1',
      user_id: 'user-42',
      role: 'member',
    })
  })

  it('looks up the room by invite_code', async () => {
    const { admin, userClient, spies } = makeMocks({
      lookup: { data: { id: 'r1', status: 'active' }, error: null },
      insert: { error: null },
    })

    await joinRoomHandler({ admin, userClient, userId: 'u1', code: 'XY9Z42' })

    expect(spies.lookupEq).toHaveBeenCalledWith('invite_code', 'XY9Z42')
  })

  it('returns { roomId } when the user is already a member (23505 idempotent)', async () => {
    const { admin, userClient } = makeMocks({
      lookup: { data: { id: 'room-1', status: 'active' }, error: null },
      insert: { error: { code: '23505', message: 'duplicate key value' } },
    })

    const result = await joinRoomHandler({
      admin,
      userClient,
      userId: 'user-1',
      code: 'AB12CD',
    })

    expect(result).toEqual({ roomId: 'room-1' })
  })

  it('throws RoomNotFoundError when no room matches the code', async () => {
    const { admin, userClient } = makeMocks({
      lookup: { data: null, error: null },
      insert: { error: null },
    })

    await expect(
      joinRoomHandler({ admin, userClient, userId: 'u1', code: 'BADCOD' }),
    ).rejects.toBeInstanceOf(RoomNotFoundError)
  })

  it('throws RoomNotFoundError when the room exists but status is not active', async () => {
    const { admin, userClient } = makeMocks({
      lookup: { data: { id: 'r1', status: 'archived' }, error: null },
      insert: { error: null },
    })

    await expect(
      joinRoomHandler({ admin, userClient, userId: 'u1', code: 'AB12CD' }),
    ).rejects.toBeInstanceOf(RoomNotFoundError)
  })

  it('does not insert when the room is not active', async () => {
    const { admin, userClient, spies } = makeMocks({
      lookup: { data: { id: 'r1', status: 'archived' }, error: null },
      insert: { error: null },
    })

    await expect(
      joinRoomHandler({ admin, userClient, userId: 'u1', code: 'AB12CD' }),
    ).rejects.toBeInstanceOf(RoomNotFoundError)

    expect(spies.insert).not.toHaveBeenCalled()
  })

  it('rethrows non-23505 insert errors', async () => {
    const { admin, userClient } = makeMocks({
      lookup: { data: { id: 'r1', status: 'active' }, error: null },
      insert: { error: { code: '42501', message: 'permission denied' } },
    })

    await expect(
      joinRoomHandler({ admin, userClient, userId: 'u1', code: 'AB12CD' }),
    ).rejects.toThrow(/permission denied/)
  })

  it('throws when the room lookup query errors', async () => {
    const { admin, userClient } = makeMocks({
      lookup: { data: null, error: { message: 'db down' } },
      insert: { error: null },
    })

    await expect(
      joinRoomHandler({ admin, userClient, userId: 'u1', code: 'AB12CD' }),
    ).rejects.toThrow(/db down/)
  })
})
