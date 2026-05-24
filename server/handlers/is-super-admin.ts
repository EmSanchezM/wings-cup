import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../shared/types/database.types'

/**
 * isSuperAdminHandler — pure handler for GET /api/me/is-super-admin (R-ADMIN-05)
 *
 * Returns a discriminated response with always-present `reason` field:
 *   - userId null (unauthenticated) → { isSuperAdmin: false, reason: 'unauthenticated' }
 *   - userId present but is_super_admin !== true → { isSuperAdmin: false, reason: 'forbidden' }
 *   - userId present and is_super_admin === true → { isSuperAdmin: true, reason: 'authorized' }
 *
 * Never throws — callers receive HTTP 200 in all paths.
 */
export async function isSuperAdminHandler(opts: {
  userId: string | null
  supabase: SupabaseClient<Database>
}): Promise<{ isSuperAdmin: boolean; reason: 'authorized' | 'unauthenticated' | 'forbidden' }> {
  const { userId, supabase } = opts

  if (!userId) {
    return { isSuperAdmin: false, reason: 'unauthenticated' }
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('is_super_admin')
    .eq('id', userId)
    .single()

  if (error || !data?.is_super_admin) {
    return { isSuperAdmin: false, reason: 'forbidden' }
  }

  return { isSuperAdmin: true, reason: 'authorized' }
}
