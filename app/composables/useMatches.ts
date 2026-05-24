import { ref } from 'vue'
import { makeMatchesClient, type MatchFilters } from '../utils/match-client'
import type { MatchListItem } from '../../shared/types/matches'

// ---------------------------------------------------------------------------
// Pure reducer — exported for testing (D6a)
// ---------------------------------------------------------------------------

/** Immutable replace: find entry by id and return a new array with it replaced.
 *  Returns the same reference if id is not found (no-op). */
export function applyMatchUpdate(
  prev: MatchListItem[],
  payload: { new: MatchListItem },
): MatchListItem[] {
  const updated = payload.new
  const idx = prev.findIndex((m) => m.id === updated.id)
  if (idx === -1) return prev
  return [...prev.slice(0, idx), updated, ...prev.slice(idx + 1)]
}

// ---------------------------------------------------------------------------
// Composable
// ---------------------------------------------------------------------------

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
      const status = (err as { statusCode?: number })?.statusCode
      if (status === 401) { useSessionExpired().setExpired(); return }
      error.value = err instanceof Error ? err.message : 'unknown_error'
      data.value = []
    } finally {
      pending.value = false
    }
  }

  // -------------------------------------------------------------------------
  // subscribe — R-RT-02 / design D1, D3, D4
  // -------------------------------------------------------------------------

  type RealtimePayload = { new: MatchListItem }

  function subscribe(onUpdate: (payload: RealtimePayload) => void): () => void {
    const supabase = useSupabaseClient()
    let seenSubscribed = false
    let reloadTimer: ReturnType<typeof setTimeout> | null = null

    const channel = supabase
      .channel('matches-updates')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'matches' },
        (payload: RealtimePayload) => onUpdate(payload),
      )
      .subscribe((status: string) => {
        if (status !== 'SUBSCRIBED') return
        if (!seenSubscribed) {
          seenSubscribed = true
          return
        }
        // Reconnect — debounced reload
        if (reloadTimer) clearTimeout(reloadTimer)
        reloadTimer = setTimeout(() => {
          void load()
          reloadTimer = null
        }, 300)
      })

    return () => {
      if (reloadTimer) {
        clearTimeout(reloadTimer)
        reloadTimer = null
      }
      supabase.removeChannel(channel)
    }
  }

  return {
    data,
    pending,
    error,
    load,
    subscribe,
    updateMatch: client.updateMatch,
    lockNow: client.lockNow,
  }
}
