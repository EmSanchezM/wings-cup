import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../shared/types/database.types'
import type { UpsertPredictionInput, Prediction } from '../../shared/types/predictions'

export class PredictionLockedError extends Error {
  constructor() {
    super('prediction_locked')
    this.name = 'PredictionLockedError'
  }
}

export interface UpsertPredictionDeps {
  supabase: SupabaseClient<Database>
  userId: string
  roomId: string
  input: UpsertPredictionInput
  /** Pass true when the caller knows it's an update (e.g. existing prediction found). */
  isUpdate?: boolean
}

export async function upsertPredictionHandler(
  deps: UpsertPredictionDeps,
): Promise<{ status: 200 | 201; prediction: Prediction }> {
  const { supabase, userId, roomId, input } = deps

  // 1. Verify room membership
  const { data: members, error: memberErr } = await supabase
    .from('room_members')
    .select('user_id')
    .eq('room_id', roomId)
    .eq('user_id', userId)
    .limit(1)

  if (memberErr) throw new Error(memberErr.message)
  if (!members || members.length === 0) throw new Error('not_member')

  // 2. Kickoff gate: match must not have started yet
  const { data: match, error: matchErr } = await supabase
    .from('matches')
    .select('kickoff_at')
    .eq('id', input.match_id)
    .single()

  if (matchErr) throw new Error(matchErr.message)
  if (!match) throw new Error('match_not_found')

  const kickoffAt = new Date(match.kickoff_at)
  if (kickoffAt <= new Date()) throw new Error('match_already_started')

  // 3. Upsert — room_id always from URL params, never from payload
  const { data: prediction, error: upsertErr } = await supabase
    .from('predictions')
    .upsert(
      {
        match_id: input.match_id,
        predicted_home: input.predicted_home,
        predicted_away: input.predicted_away,
        room_id: roomId,
        user_id: userId,
      },
      { onConflict: 'room_id,user_id,match_id' },
    )
    .select()
    .single()

  if (upsertErr) {
    if (upsertErr.code === '42501') throw new PredictionLockedError()
    throw new Error(upsertErr.message)
  }

  const status = deps.isUpdate ? 200 : 201
  return { status, prediction: prediction as Prediction }
}
