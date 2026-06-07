import { serverSupabaseClient, serverSupabaseUser } from '#supabase/server'
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

  const supabase = await serverSupabaseClient<Database>(event)

  const { data, error } = await supabase
    .from('predictions')
    .select('*')
    .eq('room_id', roomId)
    .eq('user_id', user.sub)
    .order('created_at', { ascending: true })

  if (error) throw createError({ statusCode: 500, statusMessage: error.message })

  return { predictions: data ?? [] }
})
