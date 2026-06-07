import { describe, it, expect } from 'vitest'
import { UpsertPredictionSchema } from '#shared/schemas/prediction.schema'

describe('UpsertPredictionSchema (R-PRED-04)', () => {
  const VALID_UUID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'

  it('accepts valid scores (0 and 0)', () => {
    const result = UpsertPredictionSchema.safeParse({
      match_id: VALID_UUID,
      predicted_home: 0,
      predicted_away: 0,
    })
    expect(result.success).toBe(true)
  })

  it('accepts max valid scores (15 and 15)', () => {
    const result = UpsertPredictionSchema.safeParse({
      match_id: VALID_UUID,
      predicted_home: 15,
      predicted_away: 15,
    })
    expect(result.success).toBe(true)
  })

  it('rejects predicted_home of -1', () => {
    const result = UpsertPredictionSchema.safeParse({
      match_id: VALID_UUID,
      predicted_home: -1,
      predicted_away: 0,
    })
    expect(result.success).toBe(false)
  })

  it('rejects predicted_away of -1', () => {
    const result = UpsertPredictionSchema.safeParse({
      match_id: VALID_UUID,
      predicted_home: 0,
      predicted_away: -1,
    })
    expect(result.success).toBe(false)
  })

  it('rejects predicted_home of 16 (exceeds upper bound)', () => {
    const result = UpsertPredictionSchema.safeParse({
      match_id: VALID_UUID,
      predicted_home: 16,
      predicted_away: 2,
    })
    expect(result.success).toBe(false)
  })

  it('rejects predicted_away of 16 (exceeds upper bound)', () => {
    const result = UpsertPredictionSchema.safeParse({
      match_id: VALID_UUID,
      predicted_home: 2,
      predicted_away: 16,
    })
    expect(result.success).toBe(false)
  })

  it('strips locked_at from output', () => {
    const result = UpsertPredictionSchema.safeParse({
      match_id: VALID_UUID,
      predicted_home: 1,
      predicted_away: 2,
      locked_at: '2026-06-01T00:00:00Z',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect('locked_at' in result.data).toBe(false)
    }
  })

  it('strips user_id from output', () => {
    const result = UpsertPredictionSchema.safeParse({
      match_id: VALID_UUID,
      predicted_home: 1,
      predicted_away: 2,
      user_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect('user_id' in result.data).toBe(false)
    }
  })

  it('strips room_id from output', () => {
    const result = UpsertPredictionSchema.safeParse({
      match_id: VALID_UUID,
      predicted_home: 1,
      predicted_away: 2,
      room_id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect('room_id' in result.data).toBe(false)
    }
  })

  it('rejects invalid (non-uuid) match_id', () => {
    const result = UpsertPredictionSchema.safeParse({
      match_id: 'not-a-uuid',
      predicted_home: 1,
      predicted_away: 2,
    })
    expect(result.success).toBe(false)
  })

  it('rejects missing match_id', () => {
    const result = UpsertPredictionSchema.safeParse({
      predicted_home: 1,
      predicted_away: 2,
    })
    expect(result.success).toBe(false)
  })

  it('rejects float scores', () => {
    const result = UpsertPredictionSchema.safeParse({
      match_id: VALID_UUID,
      predicted_home: 1.5,
      predicted_away: 2,
    })
    expect(result.success).toBe(false)
  })
})
