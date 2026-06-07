import { serverSupabaseClient, serverSupabaseUser } from '#supabase/server'
import type { Database } from '#shared/types/database.types'
import { getLeaderboardHandler } from '#server/handlers/get-leaderboard'

export default defineEventHandler(async (event) => {
  const user = await serverSupabaseUser(event)
  if (!user?.sub) {
    throw createError({ statusCode: 401, statusMessage: 'unauthenticated' })
  }

  const roomId = getRouterParam(event, 'id')
  if (!roomId) {
    throw createError({ statusCode: 400, statusMessage: 'missing_room_id' })
  }

  const supabase = await serverSupabaseClient<Database>(event)

  try {
    return await getLeaderboardHandler({ supabase, userId: user.sub, roomId })
  } catch (err) {
    if (err instanceof Error && err.message === 'not_member') {
      throw createError({ statusCode: 403, statusMessage: 'not_member' })
    }
    throw err
  }
})
