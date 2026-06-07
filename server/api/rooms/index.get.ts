import { serverSupabaseClient, serverSupabaseUser } from '#supabase/server'
import type { Database } from '#shared/types/database.types'
import { listRoomsHandler } from '#server/handlers/list-rooms'

export default defineEventHandler(async (event) => {
  const user = await serverSupabaseUser(event)
  if (!user?.sub) {
    throw createError({ statusCode: 401, statusMessage: 'unauthenticated' })
  }

  const supabase = await serverSupabaseClient<Database>(event)
  return await listRoomsHandler({ supabase, userId: user.sub })
})
