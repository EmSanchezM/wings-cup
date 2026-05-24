import type { MatchListItem, MatchUpdate, Match } from '../../shared/types/matches'

export interface MatchFilters {
  stage?: string
  group_name?: string
}

export function makeMatchesClient(fetchImpl: typeof $fetch) {
  return {
    async getMatches(filters?: MatchFilters): Promise<MatchListItem[]> {
      const query: Record<string, string> = {}
      if (filters?.stage) query.stage = filters.stage
      if (filters?.group_name) query.group_name = filters.group_name

      const { matches } = await fetchImpl<{ matches: MatchListItem[] }>(
        '/api/matches',
        { query },
      )
      return matches
    },

    async updateMatch(id: string, payload: MatchUpdate): Promise<Match> {
      const { match } = await fetchImpl<{ match: Match }>(
        `/api/admin/matches/${id}`,
        { method: 'PATCH', body: payload },
      )
      return match
    },

    async lockNow(): Promise<{ locked: number }> {
      return fetchImpl<{ locked: number }>('/api/admin/matches/lock-now', {
        method: 'POST',
      })
    },
  }
}
