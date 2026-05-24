import { z } from 'zod'

const STAGE_VALUES = ['group', 'round_of_16', 'quarter', 'semi', 'final', 'third_place'] as const
const STATUS_VALUES = ['scheduled', 'live', 'finished', 'postponed'] as const

export const stageEnum = z.enum(STAGE_VALUES)
export const statusEnum = z.enum(STATUS_VALUES)

export const MatchSchema = z.object({
  id: z.string().uuid(),
  external_id: z.string().nullable(),
  home_team: z.string(),
  away_team: z.string(),
  stage: stageEnum,
  group_name: z.string().nullable(),
  kickoff_at: z.string(),
  status: statusEnum,
  home_score: z.number().int().nullable(),
  away_score: z.number().int().nullable(),
  created_at: z.string(),
})

export type MatchInput = z.infer<typeof MatchSchema>

export const UpdateMatchSchema = z
  .object({
    status: statusEnum.optional(),
    home_score: z.number().int().min(0).nullable().optional(),
    away_score: z.number().int().min(0).nullable().optional(),
    home_team: z.string().min(1).optional(),
    away_team: z.string().min(1).optional(),
    stage: stageEnum.optional(),
  })
  .refine(
    (data) => {
      if (data.status === 'finished') {
        return data.home_score != null && data.away_score != null
      }
      return true
    },
    {
      message: "home_score and away_score are required when status is 'finished'",
      path: ['home_score'],
    },
  )

export type UpdateMatchInput = z.infer<typeof UpdateMatchSchema>
