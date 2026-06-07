import { describe, it, expect, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '#shared/types/database.types'
import { updateRoomHandler } from '#server/handlers/update-room'

type SingleResult<T> = { data: T | null, error: { message: string } | null }
type CountResult = { count: number | null, error: { message: string } | null }

interface BuilderConfig {
  readSingle?: SingleResult<unknown>
  updateSingle?: SingleResult<unknown>
  predictionsCount?: CountResult
}

function makeServiceClient(cfg: BuilderConfig) {
  const readSingleFn = vi.fn(async () => cfg.readSingle ?? { data: null, error: null })
  const readEq = vi.fn(() => ({ single: readSingleFn }))
  const readSelect = vi.fn(() => ({ eq: readEq }))

  const updateSingleFn = vi.fn(async () => cfg.updateSingle ?? { data: null, error: null })
  const updateSelect = vi.fn(() => ({ single: updateSingleFn }))
  const updateEq = vi.fn(() => ({ select: updateSelect }))
  const updateFn = vi.fn(() => ({ eq: updateEq }))

  // Predictions count chain: .select('*', { count: 'exact', head: true }).eq(...).not(...)
  const countNotFn = vi.fn(async () => cfg.predictionsCount ?? { count: 0, error: null })
  const countEq = vi.fn(() => ({ not: countNotFn }))
  const predictionsSelect = vi.fn(() => ({ eq: countEq }))

  const from = vi.fn((table: string) => {
    if (table === 'rooms') {
      return {
        select: readSelect,
        update: updateFn,
      }
    }
    if (table === 'predictions') {
      return { select: predictionsSelect }
    }
    throw new Error(`unexpected from(${table})`)
  })

  const client = { from } as unknown as SupabaseClient<Database>
  return {
    client,
    spies: {
      from,
      readSelect,
      updateFn,
      predictionsSelect,
    },
  }
}

const ROOM_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
const USER_ID = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
const OTHER_ID = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'

const existingRoom = {
  id: ROOM_ID,
  name: 'Original Name',
  prize_description: 'Una birra',
  created_by: USER_ID,
  status: 'active',
  invite_code: 'AB12CD',
  scoring_rules: { exact_score: 5, correct_goal_diff: 3, correct_result: 1, wrong: 0 },
  created_at: '2026-01-01T00:00:00Z',
}

const updatedRoom = {
  ...existingRoom,
  name: 'New Name',
  prize_description: 'Dos birras',
}

describe('updateRoomHandler', () => {
  it('owner can edit name and prize_description', async () => {
    const { client } = makeServiceClient({
      readSingle: { data: existingRoom, error: null },
      updateSingle: { data: updatedRoom, error: null },
    })

    const result = await updateRoomHandler({
      supabaseService: client,
      userId: USER_ID,
      roomId: ROOM_ID,
      patch: { name: 'New Name', prize_description: 'Dos birras' },
      isSuperAdmin: false,
    })

    expect(result).toEqual({ room: updatedRoom })
  })

  it('owner can edit scoring_rules when room has NOT started (no locked predictions)', async () => {
    const patchedRoom = { ...existingRoom, scoring_rules: { exact_score: 10, correct_goal_diff: 4, correct_result: 2, wrong: 0 } }
    const { client } = makeServiceClient({
      readSingle: { data: existingRoom, error: null },
      predictionsCount: { count: 0, error: null },
      updateSingle: { data: patchedRoom, error: null },
    })

    const result = await updateRoomHandler({
      supabaseService: client,
      userId: USER_ID,
      roomId: ROOM_ID,
      patch: { scoring_rules: { exact_score: 10, correct_goal_diff: 4, correct_result: 2, wrong: 0 } },
      isSuperAdmin: false,
    })

    expect(result).toEqual({ room: patchedRoom })
  })

  it('owner trying to edit scoring_rules when room HAS started → throws room_already_started', async () => {
    const { client } = makeServiceClient({
      readSingle: { data: existingRoom, error: null },
      predictionsCount: { count: 3, error: null },
    })

    await expect(
      updateRoomHandler({
        supabaseService: client,
        userId: USER_ID,
        roomId: ROOM_ID,
        patch: { scoring_rules: { exact_score: 10, correct_goal_diff: 4, correct_result: 2, wrong: 0 } },
        isSuperAdmin: false,
      }),
    ).rejects.toThrow(/room_already_started/)
  })

  it('non-owner non-admin → throws forbidden', async () => {
    const { client } = makeServiceClient({
      readSingle: { data: existingRoom, error: null },
    })

    await expect(
      updateRoomHandler({
        supabaseService: client,
        userId: OTHER_ID,
        roomId: ROOM_ID,
        patch: { name: 'Hacked' },
        isSuperAdmin: false,
      }),
    ).rejects.toThrow(/forbidden/)
  })

  it('super-admin can edit scoring_rules even when room HAS started', async () => {
    const patchedRoom = { ...existingRoom, scoring_rules: { exact_score: 10, correct_goal_diff: 4, correct_result: 2, wrong: 0 } }
    const { client, spies } = makeServiceClient({
      readSingle: { data: existingRoom, error: null },
      updateSingle: { data: patchedRoom, error: null },
    })

    const result = await updateRoomHandler({
      supabaseService: client,
      userId: OTHER_ID,
      roomId: ROOM_ID,
      patch: { scoring_rules: { exact_score: 10, correct_goal_diff: 4, correct_result: 2, wrong: 0 } },
      isSuperAdmin: true,
    })

    // Should NOT query predictions — admins bypass the freeze check
    expect(spies.predictionsSelect).not.toHaveBeenCalled()
    expect(result).toEqual({ room: patchedRoom })
  })

  it('room not found → throws room_not_found', async () => {
    const { client } = makeServiceClient({
      readSingle: { data: null, error: null },
    })

    await expect(
      updateRoomHandler({
        supabaseService: client,
        userId: USER_ID,
        roomId: ROOM_ID,
        patch: { name: 'New Name' },
        isSuperAdmin: false,
      }),
    ).rejects.toThrow(/room_not_found/)
  })

  it('supabase read error propagates', async () => {
    const { client } = makeServiceClient({
      readSingle: { data: null, error: { message: 'DB error' } },
    })

    await expect(
      updateRoomHandler({
        supabaseService: client,
        userId: USER_ID,
        roomId: ROOM_ID,
        patch: { name: 'New Name' },
        isSuperAdmin: false,
      }),
    ).rejects.toThrow(/DB error/)
  })
})
