import { serverSupabaseServiceRole, serverSupabaseUser } from '#supabase/server'
import { updateRoomHandler } from '#server/handlers/update-room'
import { isSuperAdminHandler } from '#server/handlers/is-super-admin'
import { updateRoomSchema } from '#shared/schemas/room.schema'
import type { Database } from '#shared/types/database.types'

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
  const parsed = updateRoomSchema.safeParse(body)
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'invalid_payload',
      data: parsed.error.flatten(),
    })
  }

  const supabaseService = serverSupabaseServiceRole<Database>(event)

  const { isSuperAdmin } = await isSuperAdminHandler({
    userId: user.sub,
    supabase: supabaseService,
  })

  try {
    return await updateRoomHandler({
      supabaseService,
      userId: user.sub,
      roomId,
      patch: parsed.data,
      isSuperAdmin,
    })
  }
  catch (err) {
    if (err instanceof Error) {
      if (err.message === 'room_not_found') {
        throw createError({ statusCode: 404, statusMessage: 'room_not_found' })
      }
      if (err.message === 'forbidden') {
        throw createError({ statusCode: 403, statusMessage: 'forbidden' })
      }
      if (err.message === 'room_already_started') {
        throw createError({ statusCode: 409, statusMessage: 'room_already_started' })
      }
    }
    throw err
  }
})
