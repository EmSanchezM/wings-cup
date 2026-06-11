import { describe, it, expect, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '#shared/types/database.types'
import { getMemberPredictionsHandler } from '#server/handlers/get-member-predictions'

const ROOM_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const USER_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const MEMBER_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
const MATCH_ID_1 = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
const MATCH_ID_2 = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'

type ManyResult<T> = { data: T[] | null, error: { message: string } | null }
type SingleResult<T> = { data: T | null, error: { message: string } | null }

interface ClientConfig {
  // room_members SELECT(user_id).eq.eq.limit(1) — requester membership
  requesterResult?: ManyResult<unknown>
  // room_members SELECT(user_id, profiles(display_name)).eq.eq.maybeSingle() — target
  targetResult?: SingleResult<unknown>
  // predictions SELECT(*).eq.eq.not.order
  predictionsResult?: ManyResult<unknown>
}

function makeMockClient(cfg: ClientConfig) {
  // room_members supports BOTH query shapes off the same select().eq().eq():
  //   requester -> .limit(1)        resolves requesterResult
  //   target    -> .maybeSingle()   resolves targetResult
  const memberLimitFn = vi.fn(async () => cfg.requesterResult ?? { data: [], error: null })
  const memberMaybeSingleFn = vi.fn(async () => cfg.targetResult ?? { data: null, error: null })
  const memberEq2 = vi.fn(() => ({ limit: memberLimitFn, maybeSingle: memberMaybeSingleFn }))
  const memberEq1 = vi.fn(() => ({ eq: memberEq2 }))
  const memberSelect = vi.fn(() => ({ eq: memberEq1 }))

  // predictions query: select().eq(room_id).eq(user_id=memberId).not('locked_at','is',null).order()
  const predOrderFn = vi.fn(async () => cfg.predictionsResult ?? { data: [], error: null })
  const predNotFn = vi.fn(() => ({ order: predOrderFn }))
  const predEq2Fn = vi.fn(() => ({ not: predNotFn }))
  const predEq1Fn = vi.fn(() => ({ eq: predEq2Fn }))
  const predSelectFn = vi.fn(() => ({ eq: predEq1Fn }))

  const from = vi.fn((table: string) => {
    if (table === 'room_members') return { select: memberSelect }
    if (table === 'predictions') return { select: predSelectFn }
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
      memberMaybeSingleFn,
      predSelectFn,
      predEq1Fn,
      predEq2Fn,
      predNotFn,
      predOrderFn,
    },
  }
}

const requesterRow = { user_id: USER_ID }

// Target row as returned by room_members.select('user_id, profiles!inner(display_name)')
const targetRow = { user_id: MEMBER_ID, profiles: { display_name: 'Alice' } }

const lockedPrediction = {
  id: 'pred-1111-1111-1111-111111111111',
  room_id: ROOM_ID,
  user_id: MEMBER_ID,
  match_id: MATCH_ID_1,
  predicted_home: 2,
  predicted_away: 1,
  locked_at: '2026-06-10T18:00:00Z',
  points_awarded: 5,
  created_at: '2026-06-09T00:00:00Z',
  updated_at: '2026-06-10T18:00:00Z',
}

// Documents the unlocked row shape. Never passed to the predictions mock because
// the DB-level filter (.not('locked_at','is',null) + RLS 00018) keeps it out.
const _unlockedPrediction = {
  id: 'pred-2222-2222-2222-222222222222',
  room_id: ROOM_ID,
  user_id: MEMBER_ID,
  match_id: MATCH_ID_2,
  predicted_home: 1,
  predicted_away: 0,
  locked_at: null,
  points_awarded: 0,
  created_at: '2026-06-09T00:00:00Z',
  updated_at: '2026-06-09T00:00:00Z',
}

function okConfig(overrides: Partial<ClientConfig> = {}): ClientConfig {
  return {
    requesterResult: { data: [requesterRow], error: null },
    targetResult: { data: targetRow, error: null },
    predictionsResult: { data: [lockedPrediction], error: null },
    ...overrides,
  }
}

describe('getMemberPredictionsHandler', () => {
  it('throws not_member when the REQUESTER is not in the room', async () => {
    const { client } = makeMockClient({ requesterResult: { data: [], error: null } })

    await expect(
      getMemberPredictionsHandler({ supabase: client, userId: USER_ID, roomId: ROOM_ID, memberId: MEMBER_ID }),
    ).rejects.toThrow('not_member')
  })

  it('throws target_not_member when the TARGET is not in the room', async () => {
    const { client, spies } = makeMockClient(okConfig({ targetResult: { data: null, error: null } }))

    await expect(
      getMemberPredictionsHandler({ supabase: client, userId: USER_ID, roomId: ROOM_ID, memberId: MEMBER_ID }),
    ).rejects.toThrow('target_not_member')

    // Must short-circuit before touching predictions — no data leak for non-members.
    expect(spies.predSelectFn).not.toHaveBeenCalled()
  })

  it('returns only locked predictions and applies the locked_at IS NOT NULL guard', async () => {
    const { client, spies } = makeMockClient(okConfig())

    const result = await getMemberPredictionsHandler({
      supabase: client, userId: USER_ID, roomId: ROOM_ID, memberId: MEMBER_ID,
    })

    expect(result.predictions).toHaveLength(1)
    expect(result.predictions[0]!.locked_at).not.toBeNull()
    expect(result.predictions[0]!.match_id).toBe(MATCH_ID_1)
    // SECURITY: the reveal gate must be present on the query.
    expect(spies.predNotFn).toHaveBeenCalledWith('locked_at', 'is', null)
  })

  it('queries predictions for memberId (not the requester userId)', async () => {
    const { client, spies } = makeMockClient(okConfig())

    await getMemberPredictionsHandler({ supabase: client, userId: USER_ID, roomId: ROOM_ID, memberId: MEMBER_ID })

    expect(spies.predEq2Fn).toHaveBeenCalledWith('user_id', MEMBER_ID)
  })

  it('returns the target member display_name from the joined profile', async () => {
    const { client } = makeMockClient(okConfig({
      targetResult: { data: { user_id: MEMBER_ID, profiles: { display_name: 'Bob the Builder' } }, error: null },
      predictionsResult: { data: [], error: null },
    }))

    const result = await getMemberPredictionsHandler({
      supabase: client, userId: USER_ID, roomId: ROOM_ID, memberId: MEMBER_ID,
    })

    expect(result.display_name).toBe('Bob the Builder')
  })

  it('flattens an array-shaped joined profile', async () => {
    const { client } = makeMockClient(okConfig({
      targetResult: { data: { user_id: MEMBER_ID, profiles: [{ display_name: 'Carol' }] }, error: null },
      predictionsResult: { data: [], error: null },
    }))

    const result = await getMemberPredictionsHandler({
      supabase: client, userId: USER_ID, roomId: ROOM_ID, memberId: MEMBER_ID,
    })

    expect(result.display_name).toBe('Carol')
  })

  it('returns display_name as empty string when the join has no profile', async () => {
    const { client } = makeMockClient(okConfig({
      targetResult: { data: { user_id: MEMBER_ID, profiles: null }, error: null },
      predictionsResult: { data: [], error: null },
    }))

    const result = await getMemberPredictionsHandler({
      supabase: client, userId: USER_ID, roomId: ROOM_ID, memberId: MEMBER_ID,
    })

    expect(result.display_name).toBe('')
  })

  it('returns an empty predictions array when the member has no locked predictions', async () => {
    const { client } = makeMockClient(okConfig({ predictionsResult: { data: [], error: null } }))

    const result = await getMemberPredictionsHandler({
      supabase: client, userId: USER_ID, roomId: ROOM_ID, memberId: MEMBER_ID,
    })

    expect(result.predictions).toEqual([])
  })

  it('throws when the predictions DB query errors', async () => {
    const { client } = makeMockClient(okConfig({ predictionsResult: { data: null, error: { message: 'db error' } } }))

    await expect(
      getMemberPredictionsHandler({ supabase: client, userId: USER_ID, roomId: ROOM_ID, memberId: MEMBER_ID }),
    ).rejects.toThrow('db error')
  })
})
