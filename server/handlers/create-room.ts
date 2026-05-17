import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../shared/types/database.types'
import type { Room } from '../../shared/types/rooms'
import type { CreateRoomInput } from '../../shared/schemas/room.schema'
import { generateInviteCode } from '../utils/invite-code'

export interface CreateRoomDeps {
  supabase: SupabaseClient<Database>
  userId: string
  body: CreateRoomInput
}

export async function createRoomHandler(deps: CreateRoomDeps): Promise<{ room: Room }> {
  const invite_code = await generateInviteCode(deps.supabase)

  const { data, error } = await deps.supabase
    .from('rooms')
    .insert({
      name: deps.body.name,
      prize_description: deps.body.prize_description,
      invite_code,
      created_by: deps.userId,
    })
    .select()
    .single()

  if (error) throw new Error(error.message)
  if (!data) throw new Error('rooms insert returned no data')
  return { room: data }
}
