import type { Tables } from './database.types'

export type Match = Tables<'matches'>

export type MatchListItem = Pick<
  Match,
  | 'id'
  | 'stage'
  | 'group_name'
  | 'home_team'
  | 'away_team'
  | 'kickoff_at'
  | 'status'
  | 'home_score'
  | 'away_score'
  | 'home_penalties'
  | 'away_penalties'
  | 'external_id'
>

export type MatchUpdate = Partial<
  Pick<
    Match,
    | 'status'
    | 'home_score'
    | 'away_score'
    | 'home_penalties'
    | 'away_penalties'
    | 'home_team'
    | 'away_team'
  >
>
