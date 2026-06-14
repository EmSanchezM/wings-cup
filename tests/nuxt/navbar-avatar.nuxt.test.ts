/**
 * Nuxt tests for the default layout navbar avatar.
 *
 * Behaviour under test:
 *  - Google users (user_metadata.avatar_url present) see their profile photo.
 *  - Everyone else falls back to the initials chip we already had.
 *  - The email is no longer printed in the navbar (the avatar links to /profile).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ref } from 'vue'
import { mountSuspended, mockNuxtImport } from '@nuxt/test-utils/runtime'

const { userMock, superAdminMock } = vi.hoisted(() => ({
  userMock: vi.fn(),
  superAdminMock: vi.fn(),
}))

mockNuxtImport('useSupabaseUser', () => userMock)
mockNuxtImport('useSupabaseClient', () => () => ({ auth: { signOut: vi.fn() } }))
mockNuxtImport('useSuperAdmin', () => superAdminMock)

const layouts = {
  default: () => import('../../app/layouts/default.vue'),
  admin: () => import('../../app/layouts/admin.vue'),
}

async function mountLayout(name: keyof typeof layouts) {
  const { default: Layout } = await layouts[name]()
  return mountSuspended(Layout)
}

// Both layouts share the same navbar avatar contract.
describe.each(Object.keys(layouts) as (keyof typeof layouts)[])(
  '%s layout navbar — avatar photo + no email',
  (layoutName) => {
    beforeEach(() => {
      superAdminMock.mockReturnValue({ isSuperAdmin: ref(false), ensure: vi.fn() })
    })

    it('renders the Google avatar photo when user_metadata.avatar_url exists', async () => {
      userMock.mockReturnValue(ref({
        email: 'jane.doe@gmail.com',
        user_metadata: { avatar_url: 'https://lh3.googleusercontent.com/a/pic.jpg' },
      }))

      const wrapper = await mountLayout(layoutName)

      const img = wrapper.find('[data-testid="nav-avatar-img"]')
      expect(img.exists()).toBe(true)
      expect(img.attributes('src')).toBe('https://lh3.googleusercontent.com/a/pic.jpg')
      expect(wrapper.find('[data-testid="nav-avatar-initials"]').exists()).toBe(false)
    })

    it('falls back to the initials chip when there is no avatar_url', async () => {
      userMock.mockReturnValue(ref({ email: 'jane.doe@gmail.com', user_metadata: {} }))

      const wrapper = await mountLayout(layoutName)

      expect(wrapper.find('[data-testid="nav-avatar-img"]').exists()).toBe(false)
      const initials = wrapper.find('[data-testid="nav-avatar-initials"]')
      expect(initials.exists()).toBe(true)
      expect(initials.text()).toBe('JA')
    })

    it('does not print the email anywhere in the navbar', async () => {
      userMock.mockReturnValue(ref({
        email: 'jane.doe@gmail.com',
        user_metadata: { avatar_url: 'https://lh3.googleusercontent.com/a/pic.jpg' },
      }))

      const wrapper = await mountLayout(layoutName)

      expect(wrapper.text()).not.toContain('jane.doe@gmail.com')
    })
  },
)
