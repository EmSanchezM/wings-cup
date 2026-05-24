import { z } from 'zod'

export const LeaderboardEntrySchema = z.object({
  user_id: z.string(),
  display_name: z.string().min(1),
  total_points: z.number().int(),
  joined_at: z.string(),
})

export type LeaderboardEntryInput = z.infer<typeof LeaderboardEntrySchema>
