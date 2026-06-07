import { describe, it, expect, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '#shared/types/database.types'
import { updateMatchHandler } from '#server/handlers/update-match'

type SingleResult<T> = { data: T | null; error: { message: string } | null }
type InsertResult = { error: { message: string } | null }

interface BuilderConfig {
  readSingle?: SingleResult<unknown>
  updateSingle?: SingleResult<unknown>
  auditInsert?: InsertResult
}

function makeServiceClient(cfg: BuilderConfig) {
  const auditInsert = vi.fn(async () => cfg.auditInsert ?? { error: null })

  const readSingleFn = vi.fn(async () => cfg.readSingle ?? { data: null, error: null })
  const readEq = vi.fn(() => ({ single: readSingleFn }))
  const readSelect = vi.fn(() => ({ eq: readEq }))

  const updateSingleFn = vi.fn(async () => cfg.updateSingle ?? { data: null, error: null })
  const updateSelect = vi.fn(() => ({ single: updateSingleFn }))
  const updateEq = vi.fn(() => ({ select: updateSelect }))
  const updateFn = vi.fn(() => ({ eq: updateEq }))

  const from = vi.fn((table: string) => {
    if (table === 'matches') {
      return {
        select: readSelect,
        update: updateFn,
      }
    }
    if (table === 'audit_log') {
      return { insert: auditInsert }
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
      auditInsert,
    },
  }
}

const MATCH_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const ADMIN_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'

const beforeRow = {
  id: MATCH_ID,
  status: 'scheduled',
  home_score: null,
  away_score: null,
  home_team: 'Mexico',
  away_team: 'Ecuador',
}

const afterRow = {
  ...beforeRow,
  status: 'finished',
  home_score: 2,
  away_score: 1,
}

describe('updateMatchHandler (R-ADMIN-01, R-ADMIN-02, R-SEC-45)', () => {
  it('returns updated match and writes audit_log on success', async () => {
    const { client, spies } = makeServiceClient({
      readSingle: { data: beforeRow, error: null },
      updateSingle: { data: afterRow, error: null },
    })

    const result = await updateMatchHandler({
      supabaseService: client,
      adminId: ADMIN_ID,
      matchId: MATCH_ID,
      patch: { status: 'finished', home_score: 2, away_score: 1 },
    })

    expect(result).toEqual({ match: afterRow })
    expect(spies.auditInsert).toHaveBeenCalledTimes(1)
    const auditRow = spies.auditInsert.mock.calls[0][0] as Record<string, unknown>
    expect(auditRow.admin_id).toBe(ADMIN_ID)
    expect(auditRow.action).toBe('matches.update')
    expect(auditRow.target_type).toBe('match')
    expect(auditRow.target_id).toBe(MATCH_ID)
    expect(auditRow.before_value).toEqual(beforeRow)
    expect(auditRow.after_value).toEqual(afterRow)
  })

  it('throws match_not_found when read returns null', async () => {
    const { client, spies } = makeServiceClient({
      readSingle: { data: null, error: null },
    })

    await expect(
      updateMatchHandler({
        supabaseService: client,
        adminId: ADMIN_ID,
        matchId: MATCH_ID,
        patch: { status: 'finished', home_score: 0, away_score: 0 },
      }),
    ).rejects.toThrow(/match_not_found/)
    expect(spies.auditInsert).not.toHaveBeenCalled()
  })

  it('throws when update returns an error and does NOT write audit', async () => {
    const { client, spies } = makeServiceClient({
      readSingle: { data: beforeRow, error: null },
      updateSingle: { data: null, error: { message: 'update failed' } },
    })

    await expect(
      updateMatchHandler({
        supabaseService: client,
        adminId: ADMIN_ID,
        matchId: MATCH_ID,
        patch: { status: 'finished', home_score: 0, away_score: 0 },
      }),
    ).rejects.toThrow(/update failed/)
    expect(spies.auditInsert).not.toHaveBeenCalled()
  })

  it('propagates audit_log insert errors', async () => {
    const { client } = makeServiceClient({
      readSingle: { data: beforeRow, error: null },
      updateSingle: { data: afterRow, error: null },
      auditInsert: { error: { message: 'audit failed' } },
    })

    await expect(
      updateMatchHandler({
        supabaseService: client,
        adminId: ADMIN_ID,
        matchId: MATCH_ID,
        patch: { status: 'finished', home_score: 2, away_score: 1 },
      }),
    ).rejects.toThrow(/audit failed/)
  })
})
