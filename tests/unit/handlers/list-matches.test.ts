import { describe, it, expect, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '#shared/types/database.types'
import { listMatchesHandler } from '#server/handlers/list-matches'

type FinalResult = { data: unknown[] | null; error: { message: string } | null }

interface QueryBuilder {
  eq: ReturnType<typeof vi.fn>
  order: ReturnType<typeof vi.fn>
  then: (resolve: (value: FinalResult) => unknown) => unknown
}

function makeMockClient(result: FinalResult) {
  const order = vi.fn((): QueryBuilder => builder)
  const eq = vi.fn((): QueryBuilder => builder)
  const builder: QueryBuilder = {
    eq,
    order,
    then: (resolve) => resolve(result),
  }
  const select = vi.fn(() => builder)
  const from = vi.fn(() => ({ select }))
  const client = { from } as unknown as SupabaseClient<Database>
  return { client, spies: { from, select, eq, order } }
}

describe('listMatchesHandler (R-MATCHES-01, R-MATCHES-03)', () => {
  const baseRows = [
    {
      id: '11111111-1111-4111-8111-111111111111',
      external_id: 'fifa26-001',
      home_team: 'Mexico',
      away_team: 'Ecuador',
      stage: 'group',
      group_name: 'A',
      kickoff_at: '2026-06-11T20:00:00Z',
      status: 'scheduled',
      home_score: null,
      away_score: null,
      created_at: '2026-05-17T00:00:00Z',
    },
  ]

  it('returns matches wrapped in { matches } ordered by kickoff_at ASC', async () => {
    const { client, spies } = makeMockClient({ data: baseRows, error: null })

    const result = await listMatchesHandler({ supabase: client })

    expect(result).toEqual({ matches: baseRows })
    expect(spies.from).toHaveBeenCalledWith('matches')
    expect(spies.order).toHaveBeenCalledWith('kickoff_at', { ascending: true })
  })

  it('returns empty array when data is null', async () => {
    const { client } = makeMockClient({ data: null, error: null })
    const result = await listMatchesHandler({ supabase: client })
    expect(result).toEqual({ matches: [] })
  })

  it('applies stage filter when provided', async () => {
    const { client, spies } = makeMockClient({ data: [], error: null })
    await listMatchesHandler({ supabase: client, filters: { stage: 'group' } })
    expect(spies.eq).toHaveBeenCalledWith('stage', 'group')
  })

  it('applies group_name filter when provided', async () => {
    const { client, spies } = makeMockClient({ data: [], error: null })
    await listMatchesHandler({ supabase: client, filters: { group_name: 'A' } })
    expect(spies.eq).toHaveBeenCalledWith('group_name', 'A')
  })

  it('applies both stage and group_name filters', async () => {
    const { client, spies } = makeMockClient({ data: [], error: null })
    await listMatchesHandler({
      supabase: client,
      filters: { stage: 'group', group_name: 'B' },
    })
    expect(spies.eq).toHaveBeenCalledWith('stage', 'group')
    expect(spies.eq).toHaveBeenCalledWith('group_name', 'B')
  })

  it('does not apply filters when none provided', async () => {
    const { client, spies } = makeMockClient({ data: [], error: null })
    await listMatchesHandler({ supabase: client })
    expect(spies.eq).not.toHaveBeenCalled()
  })

  it('throws when the query returns an error', async () => {
    const { client } = makeMockClient({ data: null, error: { message: 'select failed' } })
    await expect(listMatchesHandler({ supabase: client })).rejects.toThrow(/select failed/)
  })
})
