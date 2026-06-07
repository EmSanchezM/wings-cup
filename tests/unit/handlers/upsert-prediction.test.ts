import { describe, it, expect, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '#shared/types/database.types'
import { upsertPredictionHandler } from '#server/handlers/upsert-prediction'

const ROOM_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const USER_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const MATCH_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'

const FUTURE_KICKOFF = new Date(Date.now() + 60 * 60 * 1000).toISOString()
const PAST_KICKOFF = new Date(Date.now() - 60 * 60 * 1000).toISOString()

type SingleResult<T> = { data: T | null; error: { message: string; code?: string } | null }
type ManyResult<T> = { data: T[] | null; error: { message: string; code?: string } | null }

interface ClientConfig {
  membershipResult?: ManyResult<unknown>
  matchResult?: SingleResult<{ kickoff_at: string }>
  upsertResult?: SingleResult<unknown>
}

function makeClient(cfg: ClientConfig) {
  const memberSingle = vi.fn(async () => cfg.membershipResult ?? { data: [], error: null })
  const memberEq2 = vi.fn(() => ({ limit: vi.fn(async () => cfg.membershipResult ?? { data: [], error: null }) }))
  const memberEq1 = vi.fn(() => ({ eq: memberEq2 }))
  const memberSelect = vi.fn(() => ({ eq: memberEq1 }))

  const matchSingleFn = vi.fn(async () => cfg.matchResult ?? { data: null, error: null })
  const matchEq = vi.fn(() => ({ single: matchSingleFn }))
  const matchSelect = vi.fn(() => ({ eq: matchEq }))

  const upsertSingleFn = vi.fn(async () => cfg.upsertResult ?? { data: null, error: null })
  const upsertSelect = vi.fn(() => ({ single: upsertSingleFn }))
  const upsertFn = vi.fn(() => ({ select: upsertSelect }))

  const from = vi.fn((table: string) => {
    if (table === 'room_members') {
      return { select: memberSelect }
    }
    if (table === 'matches') {
      return { select: matchSelect }
    }
    if (table === 'predictions') {
      return { upsert: upsertFn }
    }
    throw new Error(`Unexpected table: ${table}`)
  })

  const client = { from } as unknown as SupabaseClient<Database>
  return { client, spies: { from, memberSelect, memberEq1, memberEq2, upsertFn } }
}

const memberRow = { user_id: USER_ID, room_id: ROOM_ID, role: 'member', joined_at: '2026-06-01T00:00:00Z', total_points: 0 }

const predictionRow = {
  id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  match_id: MATCH_ID,
  room_id: ROOM_ID,
  user_id: USER_ID,
  predicted_home: 2,
  predicted_away: 1,
  locked_at: null,
  points_awarded: 0,
  created_at: '2026-06-01T00:00:00Z',
  updated_at: '2026-06-01T00:00:00Z',
}

describe('upsertPredictionHandler (R-PRED-01, R-PRED-02, R-PRED-03, R-PRED-05)', () => {
  it('returns 201 (insert) when member and match is in future', async () => {
    const { client } = makeClient({
      membershipResult: { data: [memberRow], error: null },
      matchResult: { data: { kickoff_at: FUTURE_KICKOFF }, error: null },
      upsertResult: { data: predictionRow, error: null },
    })

    const result = await upsertPredictionHandler({
      supabase: client,
      userId: USER_ID,
      roomId: ROOM_ID,
      input: { match_id: MATCH_ID, predicted_home: 2, predicted_away: 1 },
    })

    expect(result.status).toBe(201)
    expect(result.prediction).toEqual(predictionRow)
  })

  it('returns 200 (update) when prediction already exists (updated_at > created_at)', async () => {
    // Simulates a row that was previously inserted and is being updated now:
    // the predictions_set_updated_at BEFORE UPDATE trigger bumped updated_at
    // past created_at, so the handler can detect "this was an update".
    const existingPrediction = {
      ...predictionRow,
      id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      created_at: '2026-06-01T00:00:00Z',
      updated_at: '2026-06-02T00:00:00Z',
    }
    const { client } = makeClient({
      membershipResult: { data: [memberRow], error: null },
      matchResult: { data: { kickoff_at: FUTURE_KICKOFF }, error: null },
      upsertResult: { data: existingPrediction, error: null },
    })

    const result = await upsertPredictionHandler({
      supabase: client,
      userId: USER_ID,
      roomId: ROOM_ID,
      input: { match_id: MATCH_ID, predicted_home: 3, predicted_away: 0 },
    })

    expect(result.status).toBe(200)
  })

  it('throws 403 when user is not a room member', async () => {
    const { client } = makeClient({
      membershipResult: { data: [], error: null },
    })

    await expect(
      upsertPredictionHandler({
        supabase: client,
        userId: USER_ID,
        roomId: ROOM_ID,
        input: { match_id: MATCH_ID, predicted_home: 1, predicted_away: 0 },
      }),
    ).rejects.toThrow('not_member')
  })

  it('throws 409 when kickoff_at is in the past (match already started)', async () => {
    const { client } = makeClient({
      membershipResult: { data: [memberRow], error: null },
      matchResult: { data: { kickoff_at: PAST_KICKOFF }, error: null },
    })

    await expect(
      upsertPredictionHandler({
        supabase: client,
        userId: USER_ID,
        roomId: ROOM_ID,
        input: { match_id: MATCH_ID, predicted_home: 1, predicted_away: 0 },
      }),
    ).rejects.toThrow('match_already_started')
  })

  it('throws 423 when DB returns 42501 (prediction locked by RLS)', async () => {
    const { client } = makeClient({
      membershipResult: { data: [memberRow], error: null },
      matchResult: { data: { kickoff_at: FUTURE_KICKOFF }, error: null },
      upsertResult: { data: null, error: { message: 'new row violates policy', code: '42501' } },
    })

    await expect(
      upsertPredictionHandler({
        supabase: client,
        userId: USER_ID,
        roomId: ROOM_ID,
        input: { match_id: MATCH_ID, predicted_home: 1, predicted_away: 0 },
      }),
    ).rejects.toThrow('prediction_locked')
  })

  it('uses room_id from URL params (not from input payload)', async () => {
    const { client, spies } = makeClient({
      membershipResult: { data: [memberRow], error: null },
      matchResult: { data: { kickoff_at: FUTURE_KICKOFF }, error: null },
      upsertResult: { data: predictionRow, error: null },
    })

    await upsertPredictionHandler({
      supabase: client,
      userId: USER_ID,
      roomId: ROOM_ID,
      input: { match_id: MATCH_ID, predicted_home: 2, predicted_away: 1 },
    })

    // The upsert must be called with room_id = ROOM_ID from URL params
    expect(spies.upsertFn).toHaveBeenCalledWith(
      expect.objectContaining({ room_id: ROOM_ID }),
      expect.any(Object),
    )
  })

  it('throws when match is not found', async () => {
    const { client } = makeClient({
      membershipResult: { data: [memberRow], error: null },
      matchResult: { data: null, error: { message: 'match not found' } },
    })

    await expect(
      upsertPredictionHandler({
        supabase: client,
        userId: USER_ID,
        roomId: ROOM_ID,
        input: { match_id: MATCH_ID, predicted_home: 1, predicted_away: 0 },
      }),
    ).rejects.toThrow()
  })
})
