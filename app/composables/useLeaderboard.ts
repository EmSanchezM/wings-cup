import { ref } from 'vue'
import { makeLeaderboardClient } from '../utils/leaderboard-client'
import type { LeaderboardEntry } from '../../shared/types/leaderboard'
import type { RoomMember } from '../../shared/types/rooms'

// ---------------------------------------------------------------------------
// Pure reducer — exported for testing (D6a)
// ---------------------------------------------------------------------------

/** Immutable update + re-sort: find entry by user_id, merge total_points and joined_at
 *  from payload while preserving display_name. Returns same reference if not found. */
export function applyMemberUpdate(
  prev: LeaderboardEntry[],
  payload: { new: RoomMember },
): LeaderboardEntry[] {
  const upd = payload.new
  if (!upd?.user_id) return prev
  const idx = prev.findIndex((e) => e.user_id === upd.user_id)
  if (idx === -1) return prev
  const existing = prev[idx]!
  const merged: LeaderboardEntry = {
    user_id: existing.user_id,
    display_name: existing.display_name,
    total_points: upd.total_points,
    joined_at: upd.joined_at,
  }
  const next = [...prev.slice(0, idx), merged, ...prev.slice(idx + 1)]
  next.sort(
    (a, b) =>
      b.total_points - a.total_points ||
      a.joined_at.localeCompare(b.joined_at),
  )
  return next
}

// ---------------------------------------------------------------------------
// Composable
// ---------------------------------------------------------------------------

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

  // -------------------------------------------------------------------------
  // subscribe — R-RT-03 / design D1, D3, D4
  // -------------------------------------------------------------------------

  type RealtimePayload = { new: RoomMember }

  function subscribe(onUpdate: (payload: RealtimePayload) => void): () => void {
    const supabase = useSupabaseClient()
    let seenSubscribed = false
    let reloadTimer: ReturnType<typeof setTimeout> | null = null

    const channel = supabase
      .channel(`room-members-${roomId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'room_members',
          filter: `room_id=eq.${roomId}`,
        },
        (payload: RealtimePayload) => onUpdate(payload),
      )
      .subscribe((status: string) => {
        if (status !== 'SUBSCRIBED') return
        if (!seenSubscribed) {
          seenSubscribed = true
          return
        }
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
  }
}
