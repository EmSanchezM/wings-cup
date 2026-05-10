import { z } from 'zod'

/**
 * Zod mirror of the rooms.scoring_rules JSONB column default.
 *
 * SQL default (design §4.2):
 *   '{"exact_score":5,"correct_goal_diff":3,"correct_result":1}'::jsonb
 *
 * All values must be non-negative integers.
 * "wrong" defaults to 0 (the ELSE branch of calculate_points()).
 */
export const scoringRulesSchema = z.object({
  exact_score: z.number().int().min(0),
  correct_result: z.number().int().min(0),
  correct_goal_diff: z.number().int().min(0),
  wrong: z.number().int().min(0).default(0),
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
