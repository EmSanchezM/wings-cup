/**
 * Nuxt component smoke test — R-PS-19, S-PS-05
 *
 * IMPORTANT: Uses the Vitest v4 + @nuxt/test-utils v4 pattern.
 * Composables and dynamic imports MUST be inside beforeAll (not top-level describe).
 * This is a breaking change from Vitest v3 — the Nuxt environment is only
 * initialized after the suite begins. Documented in README.
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import type { VueWrapper } from '@vue/test-utils'

describe('App (smoke)', () => {
  let wrapper: VueWrapper

  beforeAll(async () => {
    // v4 BREAKING CHANGE: import the component inside beforeAll, not at the module top level.
    const { default: App } = await import('~/app.vue')
    wrapper = await mountSuspended(App)
  })

  it('mounts without crashing', () => {
    expect(wrapper.element).toBeDefined()
  })

  it('renders a root element', () => {
    expect(wrapper.html()).toBeTruthy()
  })
})
