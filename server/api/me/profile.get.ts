import { serverSupabaseServiceRole, serverSupabaseUser } from '#supabase/server'
import { getProfileHandler } from '#server/handlers/get-profile'
import type { Database } from '#shared/types/database.types'

export default defineEventHandler(async (event) => {
  const user = await serverSupabaseUser(event)
  if (!user?.sub) {
    throw createError({ statusCode: 401, statusMessage: 'unauthenticated' })
  }

  const supabaseService = serverSupabaseServiceRole<Database>(event)

  try {
    return await getProfileHandler({ supabaseService, userId: user.sub })
  }
  catch (err) {
    if (err instanceof Error && err.message === 'profile_not_found') {
      throw createError({ statusCode: 404, statusMessage: 'profile_not_found' })
    }
    throw err
  }
})
