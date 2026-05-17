import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../shared/types/database.types'

export class RoomNotFoundError extends Error {
  readonly code = 'ROOM_NOT_FOUND' as const
  constructor() {
    super('Room not found')
  }
}

export interface JoinRoomDeps {
  admin: SupabaseClient<Database>
  userClient: SupabaseClient<Database>
  userId: string
  code: string
}

export async function joinRoomHandler(
  deps: JoinRoomDeps,
): Promise<{ roomId: string }> {
  const { data: room, error: lookupError } = await deps.admin
    .from('rooms')
    .select('id, status')
    .eq('invite_code', deps.code)
    .maybeSingle()

  if (lookupError) throw new Error(lookupError.message)
  if (!room || room.status !== 'active') throw new RoomNotFoundError()

  const { error: insertError } = await deps.userClient
    .from('room_members')
    .insert({ room_id: room.id, user_id: deps.userId, role: 'member' })

  // Postgres 23505 unique_violation on (room_id, user_id) -> user is already
  // a member; treat as idempotent success per R-INV-04 scenario 2.
  if (insertError && (insertError as { code?: string }).code !== '23505') {
    throw new Error(insertError.message)
  }

  return { roomId: room.id }
}
