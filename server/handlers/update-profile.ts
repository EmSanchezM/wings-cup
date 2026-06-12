import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '#shared/types/database.types'
import type { ProfileView } from '#shared/types/profile'
import type { UpdateProfileInput } from '#shared/schemas/profile.schema'

// Columns exposed to the client — never is_super_admin or is_guest.
const PROFILE_VIEW_COLUMNS = 'id, display_name, avatar_url'

export interface UpdateProfileDeps {
  supabaseService: SupabaseClient<Database>
  userId: string
  patch: UpdateProfileInput
}

export async function updateProfileHandler(
  deps: UpdateProfileDeps,
): Promise<{ profile: ProfileView }> {
  const { supabaseService, userId, patch } = deps

  // Scope the update to the caller's own row — userId comes from the verified
  // JWT (user.sub), never from the request body.
  const { data, error } = await supabaseService
    .from('profiles')
    .update(patch)
    .eq('id', userId)
    .select(PROFILE_VIEW_COLUMNS)
    .single()

  if (error) throw new Error(error.message)
  if (!data) throw new Error('profile_not_found')

  return { profile: data as ProfileView }
}
