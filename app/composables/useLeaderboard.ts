import { ref } from 'vue'
import { makeLeaderboardClient } from '../utils/leaderboard-client'
import type { LeaderboardEntry } from '../../shared/types/leaderboard'

export function useLeaderboard(roomId: string) {
  const data = ref<LeaderboardEntry[]>([])
  const pending = ref(false)
  const error = ref<string | null>(null)
  const client = makeLeaderboardClient($fetch)

  async function load() {
    pending.value = true
    error.value = null
    try {
      const result = await client.getLeaderboard(roomId)
      data.value = result.leaderboard
    } catch (err) {
      const status = (err as { statusCode?: number })?.statusCode
      if (status === 401) { useSessionExpired().setExpired(); return }
      error.value = err instanceof Error ? err.message : 'unknown_error'
      data.value = []
    } finally {
      pending.value = false
    }
  }

  return {
    data,
    pending,
    error,
    load,
  }
}
