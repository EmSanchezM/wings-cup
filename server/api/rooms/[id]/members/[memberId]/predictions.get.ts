import { serverSupabaseClient, serverSupabaseUser } from '#supabase/server'
import type { Database } from '#shared/types/database.types'
import { getMemberPredictionsHandler } from '#server/handlers/get-member-predictions'

export default defineEventHandler(async (event) => {
  const user = await serverSupabaseUser(event)
  if (!user?.sub) {
    throw createError({ statusCode: 401, statusMessage: 'unauthenticated' })
  }

  const roomId = getRouterParam(event, 'id')
  if (!roomId) {
    throw createError({ statusCode: 400, statusMessage: 'missing_room_id' })
  }

  const memberId = getRouterParam(event, 'memberId')
  if (!memberId) {
    throw createError({ statusCode: 400, statusMessage: 'missing_member_id' })
  }

  const supabase = await serverSupabaseClient<Database>(event)

  try {
    return await getMemberPredictionsHandler({
      supabase,
      userId: user.sub,
      roomId,
      memberId,
    })
  }
  catch (err) {
    if (err instanceof Error && err.message === 'not_member') {
      throw createError({ statusCode: 403, statusMessage: 'not_member' })
    }
    if (err instanceof Error && err.message === 'target_not_member') {
      throw createError({ statusCode: 404, statusMessage: 'target_not_member' })
    }
    throw err
  }
})
