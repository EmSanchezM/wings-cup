/**
 * Nuxt component tests for TeamFlag.vue (flags feature).
 *
 * Renders a circular flag <img> for known countries, and an initials fallback
 * <span> for knockout placeholders / unknown names.
 *
 * Scenarios:
 *   01: known country renders an <img> pointing at /flags/{code}.svg with alt
 *   02: knockout placeholder renders the initials fallback (no <img>)
 */
import { describe, it, expect } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'

describe('TeamFlag', () => {
  it('01: known country renders a flag image', async () => {
    const { default: TeamFlag } = await import('../../app/components/TeamFlag.vue')
    const wrapper = await mountSuspended(TeamFlag, { props: { team: 'Argentina' } })
    const img = wrapper.find('img')
    expect(img.exists()).toBe(true)
    expect(img.attributes('src')).toBe('/flags/ar.svg')
    expect(img.attributes('alt')).toBe('Argentina')
  })

  it('02: knockout placeholder renders initials fallback (no img)', async () => {
    const { default: TeamFlag } = await import('../../app/components/TeamFlag.vue')
    const wrapper = await mountSuspended(TeamFlag, { props: { team: 'Group A Winner' } })
    expect(wrapper.find('img').exists()).toBe(false)
    expect(wrapper.text()).toBe('GA')
  })
})
