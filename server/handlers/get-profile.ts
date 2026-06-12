import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '#shared/types/database.types'
import type { ProfileView } from '#shared/types/profile'

// Columns exposed to the client — never is_super_admin or is_guest.
const PROFILE_VIEW_COLUMNS = 'id, display_name, avatar_url'

export interface GetProfileDeps {
  supabaseService: SupabaseClient<Database>
  userId: string
}

export async function getProfileHandler(
  deps: GetProfileDeps,
): Promise<{ profile: ProfileView }> {
  const { supabaseService, userId } = deps

  const { data, error } = await supabaseService
    .from('profiles')
    .select(PROFILE_VIEW_COLUMNS)
    .eq('id', userId)
    .single()

  if (error) throw new Error(error.message)
  if (!data) throw new Error('profile_not_found')

  return { profile: data as ProfileView }
}
