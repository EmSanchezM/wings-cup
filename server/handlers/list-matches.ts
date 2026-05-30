import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../shared/types/database.types'
import type { MatchListItem } from '../../shared/types/matches'

const MATCH_LIST_COLUMNS = 'id, external_id, home_team, away_team, stage, group_name, kickoff_at, status, home_score, away_score'

export interface ListMatchesFilters {
  stage?: string
  group_name?: string
}

export interface ListMatchesDeps {
  supabase: SupabaseClient<Database>
  filters?: ListMatchesFilters
}

export async function listMatchesHandler(
  deps: ListMatchesDeps,
): Promise<{ matches: MatchListItem[] }> {
  let query = deps.supabase.from('matches').select(MATCH_LIST_COLUMNS)

  if (deps.filters?.stage) {
    query = query.eq('stage', deps.filters.stage)
  }
  if (deps.filters?.group_name) {
    query = query.eq('group_name', deps.filters.group_name)
  }

  const { data, error } = await query.order('kickoff_at', { ascending: true })

  if (error) throw new Error(error.message)
  return { matches: (data ?? []) as MatchListItem[] }
}
