/**
 * Nuxt component tests for the landing page index.vue (R-UX-06).
 *
 * Vitest v4 + @nuxt/test-utils v4. Adapts mockups 1 & 2 (dark): hero with brand,
 * tagline, value prop, primary CTA → /auth/login, a "Cómo Funciona" 3-step
 * section, and a footer. Replaces the bare <h1> placeholder.
 *
 * Scenarios:
 *   T-117-01: shows the brand "Wings Cup" and a tagline / value prop
 *   T-117-02: primary CTA is a link to /auth/login
 *   T-117-03: "Cómo Funciona" section has three steps
 *   T-117-04: no longer the bare placeholder (hero + cómo funciona + footer present)
 */
import { describe, it, expect } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'

describe('Landing page (R-UX-06)', () => {
  it('T-117-01: shows the brand and a tagline', async () => {
    const { default: Index } = await import('../../app/pages/index.vue')
    const wrapper = await mountSuspended(Index)
    const text = wrapper.text()
    expect(text).toContain('Wings Cup')
    expect(text.toLowerCase()).toContain('fútbol')
  })

  it('T-117-02: primary CTA links to /auth/login', async () => {
    const { default: Index } = await import('../../app/pages/index.vue')
    const wrapper = await mountSuspended(Index)
    const loginLink = wrapper.find('a[href="/auth/login"]')
    expect(loginLink.exists()).toBe(true)
  })

  it('T-117-03: "Cómo Funciona" section has three steps', async () => {
    const { default: Index } = await import('../../app/pages/index.vue')
    const wrapper = await mountSuspended(Index)
    expect(wrapper.text()).toContain('Cómo Funciona')
    const steps = wrapper.findAll('[data-testid="step-card"]')
    expect(steps.length).toBe(3)
  })

  it('T-117-04: replaces the bare placeholder — hero + cómo funciona + footer', async () => {
    const { default: Index } = await import('../../app/pages/index.vue')
    const wrapper = await mountSuspended(Index)
    expect(wrapper.find('[data-testid="hero"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="how-it-works"]').exists()).toBe(true)
    expect(wrapper.find('footer').exists()).toBe(true)
  })
})
