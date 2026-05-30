import { z } from 'zod'
import { trimmedOptional, trimmedRequired } from './field-helpers'
import { scoringRulesSchema } from './scoring-rules.schema'

export const createRoomSchema = z.object({
  name: trimmedRequired('name', 100),
  prize_description: trimmedOptional('prize_description', 500).default(''),
  // Optional at the boundary; the create-room handler applies defaultScoringRules
  // when omitted, so the suggested points live in a single source of truth.
  scoring_rules: scoringRulesSchema.optional(),
})

export type CreateRoomInput = z.infer<typeof createRoomSchema>
