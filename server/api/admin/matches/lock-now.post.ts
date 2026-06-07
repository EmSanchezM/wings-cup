import {
  serverSupabaseServiceRole,
  serverSupabaseUser,
} from '#supabase/server'
import { requireSuperAdmin } from '#server/utils/auth'
import { lockStartedPredictionsHandler } from '#server/handlers/lock-started-predictions'
import type { Database } from '#shared/types/database.types'

export default defineEventHandler(async (event) => {
  await requireSuperAdmin(event)

  const user = await serverSupabaseUser(event)
  if (!user?.sub) {
    throw createError({ statusCode: 401, statusMessage: 'unauthenticated' })
  }

  const supabaseService = serverSupabaseServiceRole<Database>(event)
  return await lockStartedPredictionsHandler({
    supabaseService,
    adminId: user.sub,
  })
})
