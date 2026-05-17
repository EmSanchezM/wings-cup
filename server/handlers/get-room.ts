import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../shared/types/database.types'
import type { Room, RoomMember } from '../../shared/types/rooms'

export class RoomNotFoundError extends Error {
  readonly code = 'ROOM_NOT_FOUND' as const
  constructor() {
    super('Room not found')
  }
}

export interface GetRoomDeps {
  supabase: SupabaseClient<Database>
  roomId: string
}

export async function getRoomHandler(
  deps: GetRoomDeps,
): Promise<{ room: Room; members: RoomMember[] }> {
  const { data: room, error: roomError } = await deps.supabase
    .from('rooms')
    .select('*')
    .eq('id', deps.roomId)
    .maybeSingle()

  if (roomError) throw new Error(roomError.message)
  if (!room) throw new RoomNotFoundError()

  const { data: members, error: membersError } = await deps.supabase
    .from('room_members')
    .select('*')
    .eq('room_id', deps.roomId)

  if (membersError) throw new Error(membersError.message)

  return { room: room as Room, members: (members ?? []) as RoomMember[] }
}
