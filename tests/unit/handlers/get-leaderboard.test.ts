import { describe, it, expect, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../../shared/types/database.types'
import { getLeaderboardHandler } from '../../../server/handlers/get-leaderboard'

const ROOM_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const USER_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'

type ManyResult<T> = { data: T[] | null; error: { message: string } | null }

function makeMockClient(cfg: {
  membershipResult?: ManyResult<unknown>
  leaderboardResult?: ManyResult<unknown>
}) {
  // membership check: room_members select + eq + eq + limit
  const memberLimitFn = vi.fn(async () => cfg.membershipResult ?? { data: [], error: null })
  const memberEq2 = vi.fn(() => ({ limit: memberLimitFn }))
  const memberEq1 = vi.fn(() => ({ eq: memberEq2 }))
  const memberSelect = vi.fn(() => ({ eq: memberEq1 }))

  // leaderboard query: room_members select + eq + order(total_points DESC).order(joined_at ASC)
  const leaderboardResult = cfg.leaderboardResult ?? { data: [], error: null }
  const secondOrderFn = vi.fn(async () => leaderboardResult)
  const firstOrderFn = vi.fn(() => ({ order: secondOrderFn }))
  const leaderboardEq = vi.fn(() => ({ order: firstOrderFn }))
  const leaderboardSelect = vi.fn(() => ({ eq: leaderboardEq }))

  let callCount = 0
  const from = vi.fn((table: string) => {
    if (table === 'room_members') {
      callCount++
      // First call = membership check, second call = leaderboard query
      if (callCount === 1) return { select: memberSelect }
      return { select: leaderboardSelect }
    }
    throw new Error(`Unexpected table: ${table}`)
  })

  const client = { from } as unknown as SupabaseClient<Database>
  return {
    client,
    spies: {
      from,
      memberSelect,
      memberEq1,
      memberEq2,
      memberLimitFn,
      leaderboardSelect,
      leaderboardEq,
      firstOrderFn,
      secondOrderFn,
    },
  }
}

const memberRow = { user_id: USER_ID, room_id: ROOM_ID, role: 'member', joined_at: '2026-06-01T00:00:00Z', total_points: 0 }

// Leaderboard rows with profiles as nested object (Supabase JS typical join shape)
const leaderboardRowsObject = [
  {
    user_id: 'u1111111-1111-4111-8111-111111111111',
    total_points: 10,
    joined_at: '2026-06-01T00:00:00Z',
    profiles: { display_name: 'Alice' },
  },
  {
    user_id: 'u2222222-2222-4222-8222-222222222222',
    total_points: 10,
    joined_at: '2026-06-02T00:00:00Z',
    profiles: { display_name: 'Bob' },
  },
  {
    user_id: 'u3333333-3333-4333-8333-333333333333',
    total_points: 7,
    joined_at: '2026-06-01T10:00:00Z',
    profiles: { display_name: 'Charlie' },
  },
]

// Leaderboard rows with profiles as array (defensive case)
const leaderboardRowsArray = leaderboardRowsObject.map((r) => ({
  ...r,
  profiles: [r.profiles],
}))

describe('getLeaderboardHandler (R-LEAD-01, R-LEAD-02)', () => {
  it('throws not_member when user is not in room', async () => {
    const { client } = makeMockClient({
      membershipResult: { data: [], error: null },
    })

    await expect(
      getLeaderboardHandler({ supabase: client, userId: USER_ID, roomId: ROOM_ID }),
    ).rejects.toThrow('not_member')
  })

  it('returns leaderboard entries ordered by total_points DESC joined_at ASC (profile as object)', async () => {
    const { client } = makeMockClient({
      membershipResult: { data: [memberRow], error: null },
      leaderboardResult: { data: leaderboardRowsObject, error: null },
    })

    const result = await getLeaderboardHandler({ supabase: client, userId: USER_ID, roomId: ROOM_ID })

    expect(result.leaderboard).toHaveLength(3)
    expect(result.leaderboard[0].display_name).toBe('Alice')
    expect(result.leaderboard[0].total_points).toBe(10)
    expect(result.leaderboard[1].display_name).toBe('Bob')
    expect(result.leaderboard[2].display_name).toBe('Charlie')
    expect(result.leaderboard[2].total_points).toBe(7)
  })

  it('chains .order(total_points DESC).order(joined_at ASC) for D3 tie-break (R-LEAD-02)', async () => {
    const { client, spies } = makeMockClient({
      membershipResult: { data: [memberRow], error: null },
      leaderboardResult: { data: leaderboardRowsObject, error: null },
    })

    await getLeaderboardHandler({ supabase: client, userId: USER_ID, roomId: ROOM_ID })

    expect(spies.firstOrderFn).toHaveBeenCalledWith('total_points', { ascending: false })
    expect(spies.secondOrderFn).toHaveBeenCalledWith('joined_at', { ascending: true })
  })

  it('defensively flattens profile when returned as array', async () => {
    const { client } = makeMockClient({
      membershipResult: { data: [memberRow], error: null },
      leaderboardResult: { data: leaderboardRowsArray, error: null },
    })

    const result = await getLeaderboardHandler({ supabase: client, userId: USER_ID, roomId: ROOM_ID })
    expect(result.leaderboard[0].display_name).toBe('Alice')
  })

  it('returns empty array for room with no members', async () => {
    const { client } = makeMockClient({
      membershipResult: { data: [memberRow], error: null },
      leaderboardResult: { data: [], error: null },
    })

    const result = await getLeaderboardHandler({ supabase: client, userId: USER_ID, roomId: ROOM_ID })
    expect(result.leaderboard).toEqual([])
  })

  it('throws when DB query returns an error', async () => {
    const { client } = makeMockClient({
      membershipResult: { data: [memberRow], error: null },
      leaderboardResult: { data: null, error: { message: 'db error' } },
    })

    await expect(
      getLeaderboardHandler({ supabase: client, userId: USER_ID, roomId: ROOM_ID }),
    ).rejects.toThrow('db error')
  })
})
