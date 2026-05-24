/**
 * Nuxt component tests for SessionExpiredToast.vue (R-UX-01, R-UX-02, R-UX-05)
 *
 * Uses Vitest v4 + @nuxt/test-utils v4 pattern.
 *
 * Strategy: use the REAL useSessionExpired composable (Nuxt auto-import singleton).
 * Control state by calling setExpired() / reset() directly from tests.
 * For navigateTo: test the observable side-effect (isExpired=false) rather than
 * spying on the Nuxt internal auto-import, which cannot be stubbed via vi.stubGlobal.
 *
 * Scenarios tested:
 *   T-60-01: renders nothing when isExpired=false
 *   T-60-02: renders card with exact message text when isExpired=true
 *   T-60-03: dismiss × button calls reset() → isExpired becomes false
 *   T-60-04: CTA resets state and triggers navigation (isExpired false after click)
 *   T-60-05: isExpired is false at the time navigation fires — same as T-60-04
 *            (reset() must be called before navigateTo per R-UX-05)
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'

describe('SessionExpiredToast (R-UX-01, R-UX-02, R-UX-05)', () => {
  // Reset shared state before each test
  beforeEach(async () => {
    const { useSessionExpired } = await import('../../app/composables/useSessionExpired')
    useSessionExpired().reset()
  })

  it('T-60-01: renders nothing when isExpired=false', async () => {
    const { default: SessionExpiredToast } = await import(
      '../../app/components/SessionExpiredToast.vue'
    )
    // Flag is already false (reset in beforeEach)
    const wrapper = await mountSuspended(SessionExpiredToast)
    // v-if="isExpired" → renders nothing (comment node only)
    expect(wrapper.html()).not.toContain('Tu sesión expiró')
    expect(wrapper.find('[data-testid="session-expired-toast"]').exists()).toBe(false)
  })

  it('T-60-02: renders card with exact message text when isExpired=true', async () => {
    const { useSessionExpired } = await import('../../app/composables/useSessionExpired')
    const { default: SessionExpiredToast } = await import(
      '../../app/components/SessionExpiredToast.vue'
    )
    useSessionExpired().setExpired()
    const wrapper = await mountSuspended(SessionExpiredToast)
    // Must contain exact Spanish message (R-UX-02 normative string)
    expect(wrapper.html()).toContain('Tu sesión expiró. Volvé a iniciar sesión para continuar.')
    // CTA label must appear
    expect(wrapper.html()).toContain('Volver a iniciar sesión')
  })

  it('T-60-03: dismiss × button calls reset() — isExpired becomes false', async () => {
    const { useSessionExpired } = await import('../../app/composables/useSessionExpired')
    const { default: SessionExpiredToast } = await import(
      '../../app/components/SessionExpiredToast.vue'
    )
    useSessionExpired().setExpired()
    const wrapper = await mountSuspended(SessionExpiredToast)

    const dismissBtn = wrapper.find('[data-testid="dismiss-btn"]')
    expect(dismissBtn.exists()).toBe(true)
    await dismissBtn.trigger('click')

    // After dismiss, isExpired must be false (reset called)
    expect(useSessionExpired().isExpired.value).toBe(false)
  })

  it('T-60-04: CTA resets state before navigation (isExpired=false after click, R-UX-05)', async () => {
    const { useSessionExpired } = await import('../../app/composables/useSessionExpired')
    const { default: SessionExpiredToast } = await import(
      '../../app/components/SessionExpiredToast.vue'
    )
    useSessionExpired().setExpired()
    expect(useSessionExpired().isExpired.value).toBe(true)

    const wrapper = await mountSuspended(SessionExpiredToast)
    const ctaBtn = wrapper.find('[data-testid="cta-btn"]')
    expect(ctaBtn.exists()).toBe(true)

    // Trigger CTA click — navigateTo may throw (no router in test) but reset() runs first
    try {
      await ctaBtn.trigger('click')
    } catch {
      // navigateTo may fail in test environment — that's OK, we test reset() ran
    }

    // The critical invariant: isExpired is false after click (reset called before navigate)
    expect(useSessionExpired().isExpired.value).toBe(false)
  })

  it('T-60-05: source code: reset() appears before navigateTo in CTA handler (R-UX-05)', async () => {
    // Structural verification: inspect the component source for call order
    const fs = await import('fs')
    const path = await import('path')
    const filePath = path.resolve(
      process.cwd(),
      'app/components/SessionExpiredToast.vue',
    )
    const src = fs.readFileSync(filePath, 'utf-8')

    const resetIdx = src.indexOf('reset()')
    const navigateIdx = src.indexOf("navigateTo('/auth/login')")
    // Both must exist
    expect(resetIdx).toBeGreaterThan(-1)
    expect(navigateIdx).toBeGreaterThan(-1)
    // reset() must appear BEFORE navigateTo in the CTA handler
    expect(resetIdx).toBeLessThan(navigateIdx)
  })
})
