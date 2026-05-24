import { serverSupabaseClient, serverSupabaseUser } from '#supabase/server'
import type { Database } from '~~/shared/types/database.types'
import { listMatchesHandler } from '../handlers/list-matches'

export default defineEventHandler(async (event) => {
  const user = await serverSupabaseUser(event)
  if (!user?.sub) {
    throw createError({ statusCode: 401, statusMessage: 'unauthenticated' })
  }

  const query = getQuery(event)
  const stage = typeof query.stage === 'string' ? query.stage : undefined
  const group_name = typeof query.group_name === 'string' ? query.group_name : undefined

  const supabase = await serverSupabaseClient<Database>(event)
  return await listMatchesHandler({ supabase, filters: { stage, group_name } })
})
