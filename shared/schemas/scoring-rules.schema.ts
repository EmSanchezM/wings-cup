import { z } from 'zod'

/**
 * Zod mirror of the rooms.scoring_rules JSONB column default.
 *
 * SQL default (design §4.2):
 *   '{"exact_score":5,"correct_goal_diff":3,"correct_result":1}'::jsonb
 *
 * Coherence invariants (enforced below):
 *   - Each reward tier is an integer in [1, 100]; "wrong" is in [0, 100].
 *   - Tiers are strictly descending: exact_score > correct_goal_diff >
 *     correct_result > wrong. A harder-to-hit prediction must always be
 *     worth strictly more than an easier one, so degenerate rulesets like
 *     {exact:1, diff:0, result:0} are rejected at the write boundary.
 * "wrong" is the ELSE branch of calculate_points() and defaults to 0.
 */
const rewardTier = z.number().int().min(1).max(100)

export const scoringRulesSchema = z.object({
  exact_score: rewardTier,
  correct_result: rewardTier,
  correct_goal_diff: rewardTier,
  wrong: z.number().int().min(0).max(100).default(0),
}).superRefine((r, ctx) => {
  if (r.exact_score <= r.correct_goal_diff) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['exact_score'],
      message: 'exact_score must be greater than correct_goal_diff',
    })
  }
  if (r.correct_goal_diff <= r.correct_result) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['correct_goal_diff'],
      message: 'correct_goal_diff must be greater than correct_result',
    })
  }
  if (r.correct_result <= r.wrong) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['correct_result'],
      message: 'correct_result must be greater than wrong',
    })
  }
})

export type ScoringRules = z.infer<typeof scoringRulesSchema>

/**
 * Default scoring rules — mirrors the SQL DEFAULT in rooms.scoring_rules.
 * Must stay in sync with 00001_schema.sql.
 */
export const defaultScoringRules: ScoringRules = {
  exact_score: 5,
  correct_goal_diff: 3,
  correct_result: 1,
  wrong: 0,
}
