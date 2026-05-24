import { describe, it, expect } from 'vitest'
import { LeaderboardEntrySchema } from '../../shared/schemas/leaderboard.schema'

describe('LeaderboardEntrySchema (R-LEAD-03)', () => {
  const VALID_ENTRY = {
    user_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    display_name: 'Alice',
    total_points: 10,
    joined_at: '2026-06-01T00:00:00Z',
  }

  it('accepts a valid leaderboard entry', () => {
    const result = LeaderboardEntrySchema.safeParse(VALID_ENTRY)
    expect(result.success).toBe(true)
  })

  it('accepts total_points of 0', () => {
    const result = LeaderboardEntrySchema.safeParse({
      ...VALID_ENTRY,
      total_points: 0,
    })
    expect(result.success).toBe(true)
  })

  it('fails when display_name is missing', () => {
    const { display_name: _, ...rest } = VALID_ENTRY
    const result = LeaderboardEntrySchema.safeParse(rest)
    expect(result.success).toBe(false)
  })

  it('fails when user_id is missing', () => {
    const { user_id: _, ...rest } = VALID_ENTRY
    const result = LeaderboardEntrySchema.safeParse(rest)
    expect(result.success).toBe(false)
  })

  it('fails when total_points is missing', () => {
    const { total_points: _, ...rest } = VALID_ENTRY
    const result = LeaderboardEntrySchema.safeParse(rest)
    expect(result.success).toBe(false)
  })

  it('fails when joined_at is missing', () => {
    const { joined_at: _, ...rest } = VALID_ENTRY
    const result = LeaderboardEntrySchema.safeParse(rest)
    expect(result.success).toBe(false)
  })

  it('fails when display_name is empty string', () => {
    const result = LeaderboardEntrySchema.safeParse({
      ...VALID_ENTRY,
      display_name: '',
    })
    expect(result.success).toBe(false)
  })
})
