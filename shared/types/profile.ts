import type { Tables } from './database.types'

export type Profile = Tables<'profiles'>

/**
 * The subset of a profile the client is allowed to read/write for self-service
 * editing. Never exposes is_super_admin or is_guest.
 */
export type ProfileView = Pick<Profile, 'id' | 'display_name' | 'avatar_url'>

export type { UpdateProfileInput } from '../schemas/profile.schema'
