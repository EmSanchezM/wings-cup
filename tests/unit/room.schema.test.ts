import { describe, it, expect } from 'vitest'
import { createRoomSchema, updateRoomSchema } from '#shared/schemas/room.schema'
import { defaultScoringRules } from '#shared/schemas/scoring-rules.schema'

describe('createRoomSchema (R-ROOMS-07)', () => {
  it('accepts a minimal valid payload', () => {
    const result = createRoomSchema.parse({ name: 'Test Room' })
    expect(result.name).toBe('Test Room')
  })

  it('defaults prize_description to "" when omitted', () => {
    const result = createRoomSchema.parse({ name: 'Test' })
    expect(result.prize_description).toBe('')
  })

  it('accepts a populated prize_description', () => {
    const result = createRoomSchema.parse({
      name: 'Test',
      prize_description: 'Una birra',
    })
    expect(result.prize_description).toBe('Una birra')
  })

  it('trims whitespace from name', () => {
    const result = createRoomSchema.parse({ name: '  Padding  ' })
    expect(result.name).toBe('Padding')
  })

  it('rejects empty name', () => {
    expect(() => createRoomSchema.parse({ name: '' })).toThrow()
  })

  it('rejects whitespace-only name (empty after trim)', () => {
    expect(() => createRoomSchema.parse({ name: '   ' })).toThrow()
  })

  it('rejects missing name', () => {
    expect(() => createRoomSchema.parse({})).toThrow()
  })

  it('accepts name of exactly 100 characters', () => {
    const result = createRoomSchema.parse({ name: 'x'.repeat(100) })
    expect(result.name).toHaveLength(100)
  })

  it('rejects name longer than 100 characters (R-ROOMS-01 scenario 2)', () => {
    expect(() => createRoomSchema.parse({ name: 'x'.repeat(101) })).toThrow()
  })

  it('accepts prize_description of exactly 500 characters', () => {
    const result = createRoomSchema.parse({
      name: 'OK',
      prize_description: 'x'.repeat(500),
    })
    expect(result.prize_description).toHaveLength(500)
  })

  it('rejects prize_description longer than 500 characters', () => {
    expect(() =>
      createRoomSchema.parse({
        name: 'OK',
        prize_description: 'x'.repeat(501),
      }),
    ).toThrow()
  })

  // --- scoring_rules (wizard step 3) ---

  it('accepts custom scoring_rules', () => {
    const result = createRoomSchema.parse({
      name: 'OK',
      scoring_rules: { exact_score: 10, correct_goal_diff: 4, correct_result: 2 },
    })
    expect(result.scoring_rules).toMatchObject({
      exact_score: 10,
      correct_goal_diff: 4,
      correct_result: 2,
      wrong: 0,
    })
  })

  it('leaves scoring_rules undefined when omitted (handler applies the default)', () => {
    const result = createRoomSchema.parse({ name: 'OK' })
    expect(result.scoring_rules).toBeUndefined()
  })

  it('rejects negative scoring values', () => {
    expect(() =>
      createRoomSchema.parse({
        name: 'OK',
        scoring_rules: { exact_score: -1, correct_goal_diff: 3, correct_result: 1 },
      }),
    ).toThrow()
  })

  it('keeps the suggested defaults in sync (exact 5 / diff 3 / result 1)', () => {
    expect(defaultScoringRules).toMatchObject({
      exact_score: 5,
      correct_goal_diff: 3,
      correct_result: 1,
    })
  })
})

describe('updateRoomSchema', () => {
  it('rejects empty object — at least one field required', () => {
    expect(() => updateRoomSchema.parse({})).toThrow()
  })

  it('accepts name-only patch', () => {
    const result = updateRoomSchema.parse({ name: 'New Name' })
    expect(result.name).toBe('New Name')
    expect(result.scoring_rules).toBeUndefined()
  })

  it('accepts prize_description-only patch', () => {
    const result = updateRoomSchema.parse({ prize_description: 'Una birra' })
    expect(result.prize_description).toBe('Una birra')
  })

  it('accepts scoring_rules-only patch with valid shape', () => {
    const result = updateRoomSchema.parse({
      scoring_rules: { exact_score: 10, correct_goal_diff: 4, correct_result: 2, wrong: 0 },
    })
    expect(result.scoring_rules).toMatchObject({
      exact_score: 10,
      correct_goal_diff: 4,
      correct_result: 2,
      wrong: 0,
    })
  })

  it('trims whitespace from name', () => {
    const result = updateRoomSchema.parse({ name: '  Trimmed  ' })
    expect(result.name).toBe('Trimmed')
  })

  it('rejects name that exceeds 100 characters', () => {
    expect(() => updateRoomSchema.parse({ name: 'x'.repeat(101) })).toThrow()
  })

  it('rejects prize_description that exceeds 500 characters', () => {
    expect(() => updateRoomSchema.parse({ prize_description: 'x'.repeat(501) })).toThrow()
  })

  it('rejects scoring_rules with negative values', () => {
    expect(() =>
      updateRoomSchema.parse({
        scoring_rules: { exact_score: -1, correct_goal_diff: 3, correct_result: 1, wrong: 0 },
      }),
    ).toThrow()
  })

  it('accepts all three fields together', () => {
    const result = updateRoomSchema.parse({
      name: 'Full Update',
      prize_description: 'A prize',
      scoring_rules: { exact_score: 5, correct_goal_diff: 3, correct_result: 1, wrong: 0 },
    })
    expect(result.name).toBe('Full Update')
    expect(result.prize_description).toBe('A prize')
    expect(result.scoring_rules?.exact_score).toBe(5)
  })
})
