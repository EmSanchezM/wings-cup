import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '#shared/types/database.types'
import type { Room } from '#shared/types/rooms'
import type { CreateRoomInput } from '#shared/schemas/room.schema'
import { defaultScoringRules } from '#shared/schemas/scoring-rules.schema'
import { generateInviteCode } from '#server/utils/invite-code'

export interface CreateRoomDeps {
  supabase: SupabaseClient<Database>
  userId: string
  body: CreateRoomInput
}

export async function createRoomHandler(deps: CreateRoomDeps): Promise<{ room: Room }> {
  const invite_code = await generateInviteCode(deps.supabase)

  // Two-step pattern: INSERT without RETURNING, then SELECT to refetch.
  // Postgres applies the SELECT USING policy to RETURNING rows, but
  // rooms_select_member requires the user to be in room_members for THIS
  // room — which the on_room_created trigger only guarantees once the
  // INSERT statement has fully completed. Splitting the operation lets
  // the trigger commit the membership row before the SELECT runs.
  const { error: insertError } = await deps.supabase
    .from('rooms')
    .insert({
      name: deps.body.name,
      prize_description: deps.body.prize_description,
      scoring_rules: deps.body.scoring_rules ?? defaultScoringRules,
      invite_code,
      created_by: deps.userId,
    })

  if (insertError) throw new Error(insertError.message)

  const { data, error: selectError } = await deps.supabase
    .from('rooms')
    .select('*')
    .eq('invite_code', invite_code)
    .single()

  if (selectError) throw new Error(selectError.message)
  if (!data) throw new Error('rooms insert succeeded but row was not visible')
  return { room: data }
}
