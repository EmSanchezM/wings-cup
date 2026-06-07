import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '#shared/types/database.types'
import type { Match, MatchUpdate } from '#shared/types/matches'
import { writeAuditLog } from './audit-log'

export interface UpdateMatchDeps {
  supabaseService: SupabaseClient<Database>
  adminId: string
  matchId: string
  patch: MatchUpdate
}

export async function updateMatchHandler(
  deps: UpdateMatchDeps,
): Promise<{ match: Match }> {
  const { data: before, error: readErr } = await deps.supabaseService
    .from('matches')
    .select('*')
    .eq('id', deps.matchId)
    .single()
  if (readErr) throw new Error(readErr.message)
  if (!before) throw new Error('match_not_found')

  const { data: after, error: updErr } = await deps.supabaseService
    .from('matches')
    .update(deps.patch)
    .eq('id', deps.matchId)
    .select('*')
    .single()
  if (updErr) throw new Error(updErr.message)
  if (!after) throw new Error('match_update_failed')

  await writeAuditLog(deps.supabaseService, {
    admin_id: deps.adminId,
    action: 'matches.update',
    target_type: 'match',
    target_id: deps.matchId,
    before_value: before,
    after_value: after,
  })

  return { match: after }
}
