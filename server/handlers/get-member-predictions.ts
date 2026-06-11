import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '#shared/types/database.types'
import type { Prediction } from '#shared/types/predictions'

export interface GetMemberPredictionsDeps {
  supabase: SupabaseClient<Database>
  userId: string
  roomId: string
  memberId: string
}

export interface MemberPredictionsResult {
  predictions: Prediction[]
  display_name: string
}

/** Defensive flatten: Supabase JS may return the joined profile as object or array. */
function flattenProfile(
  profiles: { display_name: string } | { display_name: string }[] | null | undefined,
): { display_name: string } | null {
  if (!profiles) return null
  if (Array.isArray(profiles)) return profiles[0] ?? null
  return profiles
}

export async function getMemberPredictionsHandler(
  deps: GetMemberPredictionsDeps,
): Promise<MemberPredictionsResult> {
  const { supabase, userId, roomId, memberId } = deps

  // 1. Verify the REQUESTER is a member of the room.
  const { data: requester, error: requesterErr } = await supabase
    .from('room_members')
    .select('user_id')
    .eq('room_id', roomId)
    .eq('user_id', userId)
    .limit(1)

  if (requesterErr) throw new Error(requesterErr.message)
  if (!requester || requester.length === 0) throw new Error('not_member')

  // 2. Verify the TARGET belongs to the same room, and grab their display name
  //    in the same query. This prevents display-name enumeration via arbitrary
  //    UUIDs and stops exposing predictions of users who are not (or no longer)
  //    members of this room.
  const { data: target, error: targetErr } = await supabase
    .from('room_members')
    .select('user_id, profiles!inner(display_name)')
    .eq('room_id', roomId)
    .eq('user_id', memberId)
    .maybeSingle()

  if (targetErr) throw new Error(targetErr.message)
  if (!target) throw new Error('target_not_member')

  const targetRow = target as { user_id: string, profiles: { display_name: string } | { display_name: string }[] | null }
  const display_name = flattenProfile(targetRow.profiles)?.display_name ?? ''

  // 3. Fetch the target member's LOCKED predictions only.
  //    SECURITY: locked_at IS NOT NULL is the gate — never reveal picks before
  //    the kickoff lock. This is also enforced at the RLS layer (00018); the
  //    filter here is defence-in-depth and keeps the payload minimal.
  const { data: predictions, error: predErr } = await supabase
    .from('predictions')
    .select('*')
    .eq('room_id', roomId)
    .eq('user_id', memberId)
    .not('locked_at', 'is', null)
    .order('created_at', { ascending: true })

  if (predErr) throw new Error(predErr.message)

  return {
    predictions: (predictions ?? []) as Prediction[],
    display_name,
  }
}
