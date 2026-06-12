import { serverSupabaseServiceRole, serverSupabaseUser } from '#supabase/server'
import { updateProfileHandler } from '#server/handlers/update-profile'
import { updateProfileSchema } from '#shared/schemas/profile.schema'
import type { Database } from '#shared/types/database.types'

export default defineEventHandler(async (event) => {
  const user = await serverSupabaseUser(event)
  if (!user?.sub) {
    throw createError({ statusCode: 401, statusMessage: 'unauthenticated' })
  }

  const body = await readBody(event)
  const parsed = updateProfileSchema.safeParse(body)
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'invalid_payload',
      data: parsed.error.flatten(),
    })
  }

  const supabaseService = serverSupabaseServiceRole<Database>(event)

  try {
    return await updateProfileHandler({
      supabaseService,
      userId: user.sub,
      patch: parsed.data,
    })
  }
  catch (err) {
    if (err instanceof Error && err.message === 'profile_not_found') {
      throw createError({ statusCode: 404, statusMessage: 'profile_not_found' })
    }
    throw err
  }
})
