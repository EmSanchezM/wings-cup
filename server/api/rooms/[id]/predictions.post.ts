import { serverSupabaseClient, serverSupabaseUser } from '#supabase/server'
import type { Database } from '#shared/types/database.types'
import { UpsertPredictionSchema } from '#shared/schemas/prediction.schema'
import {
  upsertPredictionHandler,
  PredictionLockedError,
} from '#server/handlers/upsert-prediction'

export default defineEventHandler(async (event) => {
  const user = await serverSupabaseUser(event)
  if (!user?.sub) {
    throw createError({ statusCode: 401, statusMessage: 'unauthenticated' })
  }

  const roomId = getRouterParam(event, 'id')
  if (!roomId) {
    throw createError({ statusCode: 400, statusMessage: 'missing_room_id' })
  }

  const body = await readBody(event)
  const parsed = UpsertPredictionSchema.safeParse(body)
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'invalid_payload',
      data: parsed.error.flatten(),
    })
  }

  const supabase = await serverSupabaseClient<Database>(event)

  try {
    const result = await upsertPredictionHandler({
      supabase,
      userId: user.sub,
      roomId,
      input: parsed.data,
    })
    setResponseStatus(event, result.status)
    return { prediction: result.prediction }
  } catch (err) {
    if (err instanceof PredictionLockedError) {
      throw createError({ statusCode: 423, statusMessage: 'prediction_locked' })
    }
    if (err instanceof Error) {
      if (err.message === 'not_member') {
        throw createError({ statusCode: 403, statusMessage: 'not_member' })
      }
      if (err.message === 'match_already_started') {
        throw createError({ statusCode: 409, statusMessage: 'match_already_started' })
      }
    }
    throw err
  }
})
