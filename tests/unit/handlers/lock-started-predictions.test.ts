import { describe, it, expect, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '#shared/types/database.types'
import { lockStartedPredictionsHandler } from '#server/handlers/lock-started-predictions'

type RpcResult = { data: number | null; error: { message: string } | null }
type InsertResult = { error: { message: string } | null }

function makeServiceClient(cfg: {
  rpc?: RpcResult
  auditInsert?: InsertResult
}) {
  const rpc = vi.fn(async () => cfg.rpc ?? { data: 0, error: null })
  const auditInsert = vi.fn(async () => cfg.auditInsert ?? { error: null })
  const from = vi.fn((table: string) => {
    if (table === 'audit_log') return { insert: auditInsert }
    throw new Error(`unexpected from(${table})`)
  })
  const client = { rpc, from } as unknown as SupabaseClient<Database>
  return { client, spies: { rpc, from, auditInsert } }
}

const ADMIN_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'

describe('lockStartedPredictionsHandler (R-ADMIN-03, R-SEC-45)', () => {
  it('returns { locked: N } on RPC success and writes audit', async () => {
    const { client, spies } = makeServiceClient({
      rpc: { data: 5, error: null },
    })

    const result = await lockStartedPredictionsHandler({
      supabaseService: client,
      adminId: ADMIN_ID,
    })

    expect(result).toEqual({ locked: 5 })
    expect(spies.rpc).toHaveBeenCalledWith('lock_started_predictions')
    expect(spies.auditInsert).toHaveBeenCalledTimes(1)
    const auditRow = spies.auditInsert.mock.calls[0][0] as Record<string, unknown>
    expect(auditRow.admin_id).toBe(ADMIN_ID)
    expect(auditRow.action).toBe('predictions.lock_started')
    expect(auditRow.target_type).toBe('prediction')
    expect(auditRow.after_value).toEqual({ locked_count: 5 })
  })

  it('returns { locked: 0 } when no predictions are locked', async () => {
    const { client, spies } = makeServiceClient({ rpc: { data: 0, error: null } })

    const result = await lockStartedPredictionsHandler({
      supabaseService: client,
      adminId: ADMIN_ID,
    })

    expect(result).toEqual({ locked: 0 })
    const auditRow = spies.auditInsert.mock.calls[0][0] as Record<string, unknown>
    expect(auditRow.after_value).toEqual({ locked_count: 0 })
  })

  it('throws when RPC errors and does NOT write audit', async () => {
    const { client, spies } = makeServiceClient({
      rpc: { data: null, error: { message: 'rpc failed' } },
    })

    await expect(
      lockStartedPredictionsHandler({ supabaseService: client, adminId: ADMIN_ID }),
    ).rejects.toThrow(/rpc failed/)
    expect(spies.auditInsert).not.toHaveBeenCalled()
  })

  it('propagates audit_log insert errors', async () => {
    const { client } = makeServiceClient({
      rpc: { data: 3, error: null },
      auditInsert: { error: { message: 'audit failed' } },
    })

    await expect(
      lockStartedPredictionsHandler({ supabaseService: client, adminId: ADMIN_ID }),
    ).rejects.toThrow(/audit failed/)
  })
})
