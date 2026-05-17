import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../shared/types/database.types'
import type { RoomPreview } from '../../shared/types/rooms'

export class RoomNotFoundError extends Error {
  readonly code = 'ROOM_NOT_FOUND' as const
  constructor() {
    super('Room not found')
  }
}

export interface GetRoomPreviewDeps {
  admin: SupabaseClient<Database>
  code: string
}

interface RoomPreviewRow {
  name: string
  status: string
  profiles: { display_name: string } | null
}

export async function getRoomPreviewHandler(
  deps: GetRoomPreviewDeps,
): Promise<RoomPreview> {
  const { data, error } = await deps.admin
    .from('rooms')
    .select('name, status, profiles!created_by(display_name)')
    .eq('invite_code', deps.code)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) throw new RoomNotFoundError()

  const { name, status, profiles } = data as unknown as RoomPreviewRow
  return {
    roomName: name,
    creatorName: profiles?.display_name ?? '',
    isActive: status === 'active',
  } satisfies RoomPreview
}
