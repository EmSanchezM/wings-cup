import {
  serverSupabaseClient,
  serverSupabaseServiceRole,
  serverSupabaseUser,
} from '#supabase/server'
import type { Database } from '#shared/types/database.types'
import { joinPayloadSchema } from '#shared/schemas/join.schema'
import { joinRoomHandler, RoomNotFoundError } from '#server/handlers/join-room'

export default defineEventHandler(async (event) => {
  const user = await serverSupabaseUser(event)
  if (!user?.sub) {
    throw createError({ statusCode: 401, statusMessage: 'unauthenticated' })
  }

  const code = getRouterParam(event, 'code')
  if (!code) {
    throw createError({ statusCode: 404, statusMessage: 'room not found' })
  }

  await readValidatedBody(event, joinPayloadSchema.parse)

  const admin = serverSupabaseServiceRole<Database>(event)
  const userClient = await serverSupabaseClient<Database>(event)

  try {
    return await joinRoomHandler({ admin, userClient, userId: user.sub, code })
  }
  catch (err) {
    if (err instanceof RoomNotFoundError) {
      throw createError({ statusCode: 404, statusMessage: 'room not found' })
    }
    throw err
  }
})
