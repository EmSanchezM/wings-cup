import { ref } from 'vue'
import { makeMatchesClient, type MatchFilters } from '../utils/match-client'
import type { MatchListItem } from '../../shared/types/matches'

export function useMatches() {
  const data = ref<MatchListItem[]>([])
  const pending = ref(false)
  const error = ref<string | null>(null)
  const client = makeMatchesClient($fetch)

  async function load(filters?: MatchFilters) {
    pending.value = true
    error.value = null
    try {
      data.value = await client.getMatches(filters)
    } catch (err) {
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
    updateMatch: client.updateMatch,
    lockNow: client.lockNow,
  }
}
