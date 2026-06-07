import { describe, it, expect, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '#shared/types/database.types'
import {
  generateInviteCode,
  InviteCodeCollisionError,
} from '#server/utils/invite-code'

type MaybeSingleResult = { data: { invite_code: string } | null; error: null }

function makeMockClient(results: MaybeSingleResult[]): SupabaseClient<Database> {
  const queue = [...results]
  const maybeSingle = vi.fn(async () => queue.shift() ?? { data: null, error: null })
  const eq = vi.fn(() => ({ maybeSingle }))
  const select = vi.fn(() => ({ eq }))
  const from = vi.fn(() => ({ select }))
  return { from } as unknown as SupabaseClient<Database>
}

describe('generateInviteCode', () => {
  describe('format (R-INV-01)', () => {
    it('returns a code with exactly 6 characters', async () => {
      const client = makeMockClient([{ data: null, error: null }])
      const code = await generateInviteCode(client)
      expect(code).toHaveLength(6)
    })

    it('returns a code matching /^[A-Z0-9]{6}$/', async () => {
      const client = makeMockClient([{ data: null, error: null }])
      const code = await generateInviteCode(client)
      expect(code).toMatch(/^[A-Z0-9]{6}$/)
    })

    it('never produces lowercase letters or special characters', async () => {
      for (let i = 0; i < 20; i++) {
        const client = makeMockClient([{ data: null, error: null }])
        const code = await generateInviteCode(client)
        expect(code).toBe(code.toUpperCase())
        expect(code).not.toMatch(/[^A-Z0-9]/)
      }
    })

    it('produces different codes across multiple calls (distribution sanity)', async () => {
      const codes = new Set<string>()
      for (let i = 0; i < 20; i++) {
        const client = makeMockClient([{ data: null, error: null }])
        codes.add(await generateInviteCode(client))
      }
      expect(codes.size).toBeGreaterThan(15)
    })
  })

  describe('collision retry (R-INV-02)', () => {
    it('returns the code on the first attempt when no collision', async () => {
      const client = makeMockClient([{ data: null, error: null }])
      const code = await generateInviteCode(client)
      expect(code).toMatch(/^[A-Z0-9]{6}$/)
    })

    it('retries once and returns a unique code on the second attempt', async () => {
      const client = makeMockClient([
        { data: { invite_code: 'AAAAAA' }, error: null },
        { data: null, error: null },
      ])
      const code = await generateInviteCode(client)
      expect(code).toMatch(/^[A-Z0-9]{6}$/)
    })

    it('throws InviteCodeCollisionError after 3 consecutive collisions', async () => {
      const client = makeMockClient([
        { data: { invite_code: 'AAAAAA' }, error: null },
        { data: { invite_code: 'BBBBBB' }, error: null },
        { data: { invite_code: 'CCCCCC' }, error: null },
      ])
      await expect(generateInviteCode(client)).rejects.toBeInstanceOf(
        InviteCodeCollisionError,
      )
    })

    it('InviteCodeCollisionError exposes attempts and a discriminating code', async () => {
      const client = makeMockClient([
        { data: { invite_code: 'AAAAAA' }, error: null },
        { data: { invite_code: 'BBBBBB' }, error: null },
        { data: { invite_code: 'CCCCCC' }, error: null },
      ])
      await expect(generateInviteCode(client)).rejects.toMatchObject({
        attempts: 3,
        code: 'INVITE_CODE_COLLISION',
      })
    })

    it('respects a custom retries argument', async () => {
      const client = makeMockClient([
        { data: { invite_code: 'AAAAAA' }, error: null },
        { data: { invite_code: 'BBBBBB' }, error: null },
      ])
      await expect(generateInviteCode(client, 2)).rejects.toMatchObject({
        attempts: 2,
      })
    })
  })
})
