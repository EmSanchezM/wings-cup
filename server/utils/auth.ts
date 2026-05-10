/**
 * Server-side auth utilities for Wings Cup.
 *
 * @nuxtjs/supabase v2 server helpers used here:
 *   - serverSupabaseUser(event)            — decodes the JWT from the SSR cookie; returns JwtPayload | null
 *   - serverSupabaseServiceRole(event)     — returns a SupabaseClient initialised with the service_role key
 *                                            (bypasses RLS — safe only in server routes)
 *
 * NOTE: The design.md §5.1 example mentions "serverSupabaseServiceClient" but the actual export
 * in @nuxtjs/supabase v2 is "serverSupabaseServiceRole". This comment documents the deviation.
 */
import { serverSupabaseServiceRole, serverSupabaseUser } from '#supabase/server'
import { createError, getHeader } from 'h3'
import type { H3Event } from 'h3'

/**
 * Validates the Vercel cron Authorization header.
 *
 * Vercel cron jobs send:  Authorization: Bearer <CRON_SECRET>
 * The secret is stored in runtimeConfig.cronSecret (env: NUXT_CRON_SECRET — server-only).
 *
 * Usage (slice 3):
 *   export default defineEventHandler(async (event) => {
 *     await requireCronSecret(event)
 *     // ... cron logic
 *   })
 */
export async function requireCronSecret(event: H3Event): Promise<void> {
  const config = useRuntimeConfig(event)
  const authHeader = getHeader(event, 'authorization') ?? ''
  const expected = `Bearer ${config.cronSecret}`

  if (!config.cronSecret || authHeader !== expected) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }
}

/**
 * Re-validates that the current user is a super-admin using the service-role client.
 *
 * Why service role: RLS on the profiles table strips is_super_admin from cross-user SELECTs.
 * Reading via service_role bypasses RLS and returns the real column value.
 *
 * Throws 401 if no authenticated user is found in the session.
 * Throws 403 if the user exists but is_super_admin is not TRUE in the database.
 *
 * Usage (slice 5):
 *   export default defineEventHandler(async (event) => {
 *     await requireSuperAdmin(event)
 *     // ... admin logic
 *   })
 */
export async function requireSuperAdmin(event: H3Event): Promise<void> {
  const user = await serverSupabaseUser(event)
  if (!user?.sub) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const supabase = serverSupabaseServiceRole(event)
  const { data, error } = await supabase
    .from('profiles')
    .select('is_super_admin')
    .eq('id', user.sub)
    .single()

  if (error || !data?.is_super_admin) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }
}
