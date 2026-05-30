import { describe, it, expect, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../../shared/types/database.types'
import { createRoomHandler } from '../../../server/handlers/create-room'
import { InviteCodeCollisionError } from '../../../server/utils/invite-code'

type LookupResult = { data: { invite_code: string } | null, error: null }
type InsertResult = { error: { message: string } | null }
type RefetchResult = { data: Record<string, unknown> | null, error: { message: string } | null }

interface MockOptions {
  inviteCodeLookups?: LookupResult[]
  insertResult?: InsertResult
  refetchResult?: RefetchResult
}

const DEFAULT_REFETCH: RefetchResult = {
  data: {
    id: 'room-uuid',
    name: 'placeholder',
    prize_description: '',
    invite_code: 'XXXXXX',
    created_by: 'user-uuid',
    scoring_rules: {},
    status: 'active',
    created_at: '2026-05-17T12:00:00Z',
  },
  error: null,
}

function makeMockClient(opts: MockOptions = {}) {
  const lookupQueue: LookupResult[] = [...(opts.inviteCodeLookups ?? [{ data: null, error: null }])]
  const maybeSingle = vi.fn(async () => lookupQueue.shift() ?? { data: null, error: null })
  const refetchSingle = vi.fn(async () => opts.refetchResult ?? DEFAULT_REFETCH)

  const eq = vi.fn(() => ({ maybeSingle, single: refetchSingle }))
  const select = vi.fn(() => ({ eq }))
  const insert = vi.fn(async () => opts.insertResult ?? { error: null })

  const from = vi.fn(() => ({ select, insert }))

  const client = { from } as unknown as SupabaseClient<Database>
  return { client, spies: { from, select, insert, refetchSingle, eq } }
}

describe('createRoomHandler (R-ROOMS-01, R-ROOMS-04, R-ROOMS-05, R-ROOMS-06)', () => {
  it('returns the refetched room wrapped in { room }', async () => {
    const refetchedRow = {
      id: 'room-1',
      name: 'Amigos',
      prize_description: 'Una birra',
      invite_code: 'XY9Z42',
      created_by: 'user-1',
      scoring_rules: { exact_score: 5, correct_goal_diff: 3, correct_result: 1 },
      status: 'active',
      created_at: '2026-05-17T12:00:00Z',
    }
    const { client } = makeMockClient({ refetchResult: { data: refetchedRow, error: null } })

    const result = await createRoomHandler({
      supabase: client,
      userId: 'user-1',
      body: { name: 'Amigos', prize_description: 'Una birra' },
    })

    expect(result).toEqual({ room: refetchedRow })
  })

  it('inserts a row with name, prize_description, invite_code, and created_by', async () => {
    const { client, spies } = makeMockClient()
    await createRoomHandler({
      supabase: client,
      userId: 'user-42',
      body: { name: 'Test Room', prize_description: 'Pizza' },
    })

    expect(spies.insert).toHaveBeenCalledTimes(1)
    const inserted = spies.insert.mock.calls[0][0] as Record<string, unknown>
    expect(inserted).toMatchObject({
      name: 'Test Room',
      prize_description: 'Pizza',
      created_by: 'user-42',
    })
    expect(typeof inserted.invite_code).toBe('string')
    expect(inserted.invite_code).toMatch(/^[A-Z0-9]{6}$/)
  })

  it('inserts the provided scoring_rules from the body', async () => {
    const { client, spies } = makeMockClient()
    const rules = { exact_score: 10, correct_goal_diff: 4, correct_result: 2, wrong: 0 }
    await createRoomHandler({
      supabase: client,
      userId: 'user-1',
      body: { name: 'Reglas', prize_description: '', scoring_rules: rules },
    })
    const inserted = spies.insert.mock.calls[0][0] as Record<string, unknown>
    expect(inserted.scoring_rules).toEqual(rules)
  })

  it('falls back to the default scoring_rules when the body omits them', async () => {
    const { client, spies } = makeMockClient()
    await createRoomHandler({
      supabase: client,
      userId: 'user-1',
      body: { name: 'Sin reglas', prize_description: '' },
    })
    const inserted = spies.insert.mock.calls[0][0] as Record<string, unknown>
    expect(inserted.scoring_rules).toMatchObject({
      exact_score: 5,
      correct_goal_diff: 3,
      correct_result: 1,
    })
  })

  it('passes an empty prize_description through to the insert', async () => {
    const { client, spies } = makeMockClient()
    await createRoomHandler({
      supabase: client,
      userId: 'user-1',
      body: { name: 'No Prize', prize_description: '' },
    })

    const inserted = spies.insert.mock.calls[0][0] as Record<string, unknown>
    expect(inserted.prize_description).toBe('')
  })

  it('refetches by the generated invite_code', async () => {
    const { client, spies } = makeMockClient()
    await createRoomHandler({
      supabase: client,
      userId: 'user-1',
      body: { name: 'X', prize_description: '' },
    })

    // First .eq is the invite-code uniqueness probe; the second is the refetch.
    const lastEqCall = spies.eq.mock.calls.at(-1)!
    expect(lastEqCall[0]).toBe('invite_code')
    const inserted = spies.insert.mock.calls[0][0] as Record<string, unknown>
    expect(lastEqCall[1]).toBe(inserted.invite_code)
  })

  it('propagates InviteCodeCollisionError when retries are exhausted', async () => {
    const { client } = makeMockClient({
      inviteCodeLookups: [
        { data: { invite_code: 'AAAAAA' }, error: null },
        { data: { invite_code: 'BBBBBB' }, error: null },
        { data: { invite_code: 'CCCCCC' }, error: null },
      ],
    })

    await expect(
      createRoomHandler({
        supabase: client,
        userId: 'user-1',
        body: { name: 'Doomed', prize_description: '' },
      }),
    ).rejects.toBeInstanceOf(InviteCodeCollisionError)
  })

  it('throws when the insert returns an error', async () => {
    const { client } = makeMockClient({
      insertResult: { error: { message: 'permission denied' } },
    })

    await expect(
      createRoomHandler({
        supabase: client,
        userId: 'user-1',
        body: { name: 'NoAuth', prize_description: '' },
      }),
    ).rejects.toThrow(/permission denied/)
  })

  it('throws when the refetch returns an error', async () => {
    const { client } = makeMockClient({
      refetchResult: { data: null, error: { message: 'refetch failed' } },
    })

    await expect(
      createRoomHandler({
        supabase: client,
        userId: 'user-1',
        body: { name: 'X', prize_description: '' },
      }),
    ).rejects.toThrow(/refetch failed/)
  })

  it('does not call insert when invite code generation throws', async () => {
    const { client, spies } = makeMockClient({
      inviteCodeLookups: [
        { data: { invite_code: 'AAAAAA' }, error: null },
        { data: { invite_code: 'BBBBBB' }, error: null },
        { data: { invite_code: 'CCCCCC' }, error: null },
      ],
    })

    await expect(
      createRoomHandler({
        supabase: client,
        userId: 'user-1',
        body: { name: 'Doomed', prize_description: '' },
      }),
    ).rejects.toBeInstanceOf(InviteCodeCollisionError)

    expect(spies.insert).not.toHaveBeenCalled()
  })
})
