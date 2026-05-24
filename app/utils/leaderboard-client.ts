import type { LeaderboardEntry } from '../../shared/types/leaderboard'

export function makeLeaderboardClient(fetchImpl: typeof $fetch) {
  return {
    async getLeaderboard(roomId: string): Promise<{ leaderboard: LeaderboardEntry[] }> {
      return fetchImpl<{ leaderboard: LeaderboardEntry[] }>(
        `/api/rooms/${roomId}/leaderboard`,
      )
    },
  }
}
