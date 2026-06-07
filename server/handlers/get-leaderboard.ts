import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '#shared/types/database.types'
import type { LeaderboardEntry } from '#shared/types/leaderboard'

export interface GetLeaderboardDeps {
  supabase: SupabaseClient<Database>
  userId: string
  roomId: string
}

/** Defensive flatten: Supabase JS may return profile as object or as array depending on version. */
function flattenProfile(
  profiles: { display_name: string } | { display_name: string }[] | null | undefined,
): { display_name: string } | null {
  if (!profiles) return null
  if (Array.isArray(profiles)) return profiles[0] ?? null
  return profiles
}

export async function getLeaderboardHandler(
  deps: GetLeaderboardDeps,
): Promise<{ leaderboard: LeaderboardEntry[] }> {
  const { supabase, userId, roomId } = deps

  // 1. Verify room membership
  const { data: members, error: memberErr } = await supabase
    .from('room_members')
    .select('user_id')
    .eq('room_id', roomId)
    .eq('user_id', userId)
    .limit(1)

  if (memberErr) throw new Error(memberErr.message)
  if (!members || members.length === 0) throw new Error('not_member')

  // 2. Fetch leaderboard — JOIN profiles, ORDER BY total_points DESC, joined_at ASC (R-LEAD-02 D3)
  const { data, error } = await supabase
    .from('room_members')
    .select('user_id, total_points, joined_at, profiles!inner(display_name)')
    .eq('room_id', roomId)
    .order('total_points', { ascending: false })
    .order('joined_at', { ascending: true })

  if (error) throw new Error(error.message)

  const leaderboard: LeaderboardEntry[] = (data ?? []).map((row) => {
    const profile = flattenProfile(
      row.profiles as { display_name: string } | { display_name: string }[] | null | undefined,
    )
    return {
      user_id: row.user_id,
      display_name: profile?.display_name ?? '',
      total_points: row.total_points,
      joined_at: row.joined_at,
    }
  })

  return { leaderboard }
}
