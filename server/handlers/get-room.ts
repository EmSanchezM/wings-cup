import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../shared/types/database.types'
import type { Room, RoomMemberView } from '../../shared/types/rooms'

export class RoomNotFoundError extends Error {
  readonly code = 'ROOM_NOT_FOUND' as const
  constructor() {
    super('Room not found')
  }
}

/** Defensive flatten: Supabase JS may return the joined profile as object or array. */
function flattenProfile(
  profiles: { display_name: string } | { display_name: string }[] | null | undefined,
): { display_name: string } | null {
  if (!profiles) return null
  if (Array.isArray(profiles)) return profiles[0] ?? null
  return profiles
}

export interface GetRoomDeps {
  supabase: SupabaseClient<Database>
  roomId: string
}

export async function getRoomHandler(
  deps: GetRoomDeps,
): Promise<{ room: Room, members: RoomMemberView[] }> {
  const { data: room, error: roomError } = await deps.supabase
    .from('rooms')
    .select('*')
    .eq('id', deps.roomId)
    .maybeSingle()

  if (roomError) throw new Error(roomError.message)
  if (!room) throw new RoomNotFoundError()

  // JOIN profiles(display_name) so the UI can show names, not raw user ids (R-ROOMS-03).
  const { data: members, error: membersError } = await deps.supabase
    .from('room_members')
    .select('user_id, role, joined_at, profiles!inner(display_name)')
    .eq('room_id', deps.roomId)

  if (membersError) throw new Error(membersError.message)

  const view: RoomMemberView[] = (members ?? []).map((m) => {
    const row = m as { user_id: string, role: string, joined_at: string, profiles: { display_name: string } | { display_name: string }[] | null }
    return {
      user_id: row.user_id,
      role: row.role,
      joined_at: row.joined_at,
      display_name: flattenProfile(row.profiles)?.display_name ?? '',
    }
  })

  return { room: room as Room, members: view }
}
