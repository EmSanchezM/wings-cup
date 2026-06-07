import {
  serverSupabaseServiceRole,
  serverSupabaseUser,
} from '#supabase/server'
import { requireSuperAdmin } from '#server/utils/auth'
import { updateMatchHandler } from '#server/handlers/update-match'
import { UpdateMatchSchema } from '#shared/schemas/match.schema'
import type { Database } from '#shared/types/database.types'

export default defineEventHandler(async (event) => {
  await requireSuperAdmin(event)

  const user = await serverSupabaseUser(event)
  if (!user?.sub) {
    throw createError({ statusCode: 401, statusMessage: 'unauthenticated' })
  }

  const matchId = getRouterParam(event, 'id')
  if (!matchId) {
    throw createError({ statusCode: 400, statusMessage: 'missing_match_id' })
  }

  const body = await readBody(event)
  const parsed = UpdateMatchSchema.safeParse(body)
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'invalid_payload',
      data: parsed.error.flatten(),
    })
  }

  const supabaseService = serverSupabaseServiceRole<Database>(event)

  try {
    return await updateMatchHandler({
      supabaseService,
      adminId: user.sub,
      matchId,
      patch: parsed.data,
    })
  } catch (err) {
    if (err instanceof Error && err.message === 'match_not_found') {
      throw createError({ statusCode: 404, statusMessage: 'match_not_found' })
    }
    throw err
  }
})
