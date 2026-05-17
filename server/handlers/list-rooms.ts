import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../shared/types/database.types'
import type { RoomListItem } from '../../shared/types/rooms'

const ROOM_LIST_COLUMNS = 'id, name, prize_description, invite_code, status, created_at'

export interface ListRoomsDeps {
  supabase: SupabaseClient<Database>
  userId: string
}

export async function listRoomsHandler(
  deps: ListRoomsDeps,
): Promise<{ rooms: RoomListItem[] }> {
  const { data, error } = await deps.supabase
    .from('rooms')
    .select(ROOM_LIST_COLUMNS)
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  return { rooms: (data ?? []) as RoomListItem[] }
}
