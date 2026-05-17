import { serverSupabaseClient, serverSupabaseUser } from '#supabase/server'
import type { Database } from '~~/shared/types/database.types'
import { createRoomSchema } from '~~/shared/schemas/room.schema'
import { createRoomHandler } from '../../handlers/create-room'
import { InviteCodeCollisionError } from '../../utils/invite-code'

export default defineEventHandler(async (event) => {
  const user = await serverSupabaseUser(event)
  if (!user?.sub) {
    throw createError({ statusCode: 401, statusMessage: 'unauthenticated' })
  }

  const body = await readValidatedBody(event, createRoomSchema.parse)
  const supabase = await serverSupabaseClient<Database>(event)

  try {
    const result = await createRoomHandler({ supabase, userId: user.sub, body })
    setResponseStatus(event, 201)
    return result
  }
  catch (err) {
    if (err instanceof InviteCodeCollisionError) {
      throw createError({ statusCode: 503, statusMessage: 'invite_code_conflict' })
    }
    throw err
  }
})
