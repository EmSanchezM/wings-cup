import { serverSupabaseServiceRole } from '#supabase/server'
import type { Database } from '~~/shared/types/database.types'
import {
  getRoomPreviewHandler,
  RoomNotFoundError,
} from '../../handlers/get-room-preview'

export default defineEventHandler(async (event) => {
  const code = getRouterParam(event, 'code')
  if (!code) {
    throw createError({ statusCode: 404, statusMessage: 'room not found' })
  }

  const admin = serverSupabaseServiceRole<Database>(event)

  try {
    return await getRoomPreviewHandler({ admin, code })
  }
  catch (err) {
    if (err instanceof RoomNotFoundError) {
      throw createError({ statusCode: 404, statusMessage: 'room not found' })
    }
    throw err
  }
})
