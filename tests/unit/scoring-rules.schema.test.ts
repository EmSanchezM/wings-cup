import { describe, it, expect } from 'vitest'
import { scoringRulesSchema, defaultScoringRules } from '#shared/schemas/scoring-rules.schema'

describe('scoringRulesSchema', () => {
  it('parses valid input with all fields', () => {
    const result = scoringRulesSchema.parse({
      exact_score: 5,
      correct_goal_diff: 3,
      correct_result: 1,
      wrong: 0,
    })
    expect(result).toEqual({
      exact_score: 5,
      correct_goal_diff: 3,
      correct_result: 1,
      wrong: 0,
    })
  })

  it('applies default for the wrong field when omitted', () => {
    const result = scoringRulesSchema.parse({
      exact_score: 5,
      correct_goal_diff: 3,
      correct_result: 1,
    })
    expect(result.wrong).toBe(0)
  })

  it('rejects a negative number', () => {
    expect(() =>
      scoringRulesSchema.parse({
        exact_score: -1,
        correct_goal_diff: 3,
        correct_result: 1,
      }),
    ).toThrow()
  })

  it('rejects a missing required field', () => {
    expect(() =>
      scoringRulesSchema.parse({
        exact_score: 5,
        correct_goal_diff: 3,
        // correct_result intentionally omitted
      }),
    ).toThrow()
  })

  it('rejects a non-integer value', () => {
    expect(() =>
      scoringRulesSchema.parse({
        exact_score: 5.5,
        correct_goal_diff: 3,
        correct_result: 1,
      }),
    ).toThrow()
  })

  it('defaultScoringRules matches the SQL default', () => {
    // Must stay in sync with 00001_schema.sql scoring_rules column default.
    expect(defaultScoringRules).toEqual({
      exact_score: 5,
      correct_goal_diff: 3,
      correct_result: 1,
      wrong: 0,
    })
  })

  it('defaultScoringRules is a valid parse result', () => {
    expect(() => scoringRulesSchema.parse(defaultScoringRules)).not.toThrow()
  })

  // --- coherence invariants (strictly descending: exact > diff > result > wrong) ---

  it('rejects zero on a reward tier — each tier must be at least 1', () => {
    expect(() =>
      scoringRulesSchema.parse({ exact_score: 1, correct_goal_diff: 0, correct_result: 0 }),
    ).toThrow()
  })

  it('rejects a tier above 100', () => {
    expect(() =>
      scoringRulesSchema.parse({ exact_score: 101, correct_goal_diff: 3, correct_result: 1 }),
    ).toThrow()
  })

  it('accepts a tier of exactly 100', () => {
    expect(() =>
      scoringRulesSchema.parse({ exact_score: 100, correct_goal_diff: 50, correct_result: 10 }),
    ).not.toThrow()
  })

  it('rejects exact_score not strictly greater than correct_goal_diff', () => {
    expect(() =>
      scoringRulesSchema.parse({ exact_score: 3, correct_goal_diff: 3, correct_result: 1 }),
    ).toThrow()
  })

  it('rejects correct_goal_diff not strictly greater than correct_result', () => {
    expect(() =>
      scoringRulesSchema.parse({ exact_score: 5, correct_goal_diff: 3, correct_result: 3 }),
    ).toThrow()
  })

  it('rejects correct_result not strictly greater than wrong', () => {
    expect(() =>
      scoringRulesSchema.parse({ exact_score: 5, correct_goal_diff: 3, correct_result: 2, wrong: 2 }),
    ).toThrow()
  })

  it('accepts a strictly descending custom ruleset', () => {
    expect(() =>
      scoringRulesSchema.parse({ exact_score: 10, correct_goal_diff: 4, correct_result: 2, wrong: 1 }),
    ).not.toThrow()
  })
})
