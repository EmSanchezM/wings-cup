import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '#shared/types/database.types'
import type { Room } from '#shared/types/rooms'
import type { UpdateRoomInput } from '#shared/schemas/room.schema'

export interface UpdateRoomDeps {
  supabaseService: SupabaseClient<Database>
  userId: string
  roomId: string
  patch: UpdateRoomInput
  isSuperAdmin: boolean
}

export async function updateRoomHandler(
  deps: UpdateRoomDeps,
): Promise<{ room: Room }> {
  const { supabaseService, userId, roomId, patch, isSuperAdmin } = deps

  // 1. Load the room
  const { data: room, error: readErr } = await supabaseService
    .from('rooms')
    .select('*')
    .eq('id', roomId)
    .single()

  if (readErr) throw new Error(readErr.message)
  if (!room) throw new Error('room_not_found')

  // 2. Authorization: owner or super-admin only
  const isOwner = room.created_by === userId
  if (!isOwner && !isSuperAdmin) {
    throw new Error('forbidden')
  }

  // 3. Scoring rules freeze check — owner only; admins bypass
  if (patch.scoring_rules !== undefined && !isSuperAdmin) {
    const { count, error: countErr } = await supabaseService
      .from('predictions')
      .select('*', { count: 'exact', head: true })
      .eq('room_id', roomId)
      .not('locked_at', 'is', null)

    if (countErr) throw new Error(countErr.message)
    if ((count ?? 0) > 0) throw new Error('room_already_started')
  }

  // 4. Apply the patch
  const { data: updated, error: updErr } = await supabaseService
    .from('rooms')
    .update(patch)
    .eq('id', roomId)
    .select('*')
    .single()

  if (updErr) throw new Error(updErr.message)
  if (!updated) throw new Error('room_update_failed')

  return { room: updated as Room }
}
