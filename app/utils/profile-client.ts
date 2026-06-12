import type { UpdateProfileInput } from '#shared/schemas/profile.schema'
import type { ProfileView } from '#shared/types/profile'

export function makeProfileClient(fetchImpl: typeof $fetch) {
  return {
    async getProfile(): Promise<ProfileView> {
      const { profile } = await fetchImpl<{ profile: ProfileView }>('/api/me/profile')
      return profile
    },

    async updateProfile(input: UpdateProfileInput): Promise<ProfileView> {
      const { profile } = await fetchImpl<{ profile: ProfileView }>('/api/me/profile', {
        method: 'PATCH',
        body: input,
      })
      return profile
    },
  }
}
