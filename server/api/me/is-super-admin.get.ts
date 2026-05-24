import { serverSupabaseServiceRole, serverSupabaseUser } from '#supabase/server'
import { isSuperAdminHandler } from '../../handlers/is-super-admin'

/**
 * GET /api/me/is-super-admin (R-ADMIN-05)
 *
 * Returns a discriminated response with always-present `reason` field.
 * Never throws — all paths return HTTP 200:
 *   { isSuperAdmin: false, reason: 'unauthenticated' } — missing/expired JWT
 *   { isSuperAdmin: false, reason: 'forbidden' }       — authenticated, not admin
 *   { isSuperAdmin: true,  reason: 'authorized' }      — authenticated super-admin
 */
export default defineEventHandler(async (event) => {
  // Resolve userId — catch 401 from serverSupabaseUser for the unauthenticated case
  let userId: string | null = null
  try {
    const user = await serverSupabaseUser(event)
    userId = user?.sub ?? null
  } catch {
    // JWT missing, invalid, or expired → unauthenticated path
    userId = null
  }

  const supabase = serverSupabaseServiceRole(event)
  return isSuperAdminHandler({ userId, supabase })
})
