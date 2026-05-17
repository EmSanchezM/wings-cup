import { serverSupabaseClient, serverSupabaseUser } from '#supabase/server'
import type { Database } from '~~/shared/types/database.types'
import { getRoomHandler, RoomNotFoundError } from '../../../handlers/get-room'

export default defineEventHandler(async (event) => {
  const user = await serverSupabaseUser(event)
  if (!user?.sub) {
    throw createError({ statusCode: 401, statusMessage: 'unauthenticated' })
  }

  const roomId = getRouterParam(event, 'id')
  if (!roomId) {
    throw createError({ statusCode: 400, statusMessage: 'missing room id' })
  }

  const supabase = await serverSupabaseClient<Database>(event)

  try {
    return await getRoomHandler({ supabase, roomId })
  }
  catch (err) {
    if (err instanceof RoomNotFoundError) {
      throw createError({ statusCode: 404, statusMessage: 'room not found' })
    }
    throw err
  }
})
