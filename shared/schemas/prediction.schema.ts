import { z } from 'zod'

/**
 * Which side a user expects to advance when a knockout tie is decided on
 * penalties. Stored as the SIDE, not the team name, so it survives the
 * placeholder ("Ganador P{n}") -> real-name rewrite done by advance_bracket.
 * Only meaningful for knockout matches; optional/null everywhere else.
 */
export const advancePickEnum = z.enum(['home', 'away'])

export const UpsertPredictionSchema = z
  .object({
    match_id: z.string().uuid(),
    predicted_home: z.number().int().min(0).max(15),
    predicted_away: z.number().int().min(0).max(15),
    predicted_advances: advancePickEnum.nullable().optional(),
  })
  .strip()

export type UpsertPredictionInput = z.infer<typeof UpsertPredictionSchema>
