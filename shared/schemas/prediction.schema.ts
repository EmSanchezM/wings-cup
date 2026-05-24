import { z } from 'zod'

export const UpsertPredictionSchema = z
  .object({
    match_id: z.string().uuid(),
    predicted_home: z.number().int().min(0).max(15),
    predicted_away: z.number().int().min(0).max(15),
  })
  .strip()

export type UpsertPredictionInput = z.infer<typeof UpsertPredictionSchema>
