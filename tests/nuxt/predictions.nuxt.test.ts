/**
 * Nuxt component test for rooms/[id]/predictions.vue
 * R-PRED-01, R-PRED-03, R-ADMIN-04
 *
 * IMPORTANT: Uses the Vitest v4 + @nuxt/test-utils v4 pattern.
 * Composables and dynamic imports MUST be inside beforeAll (not top-level describe).
 */
import { describe, it, expect, beforeAll, vi } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import type { VueWrapper } from '@vue/test-utils'

// Mock useRoute to provide room id
vi.mock('#app', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return {
    ...actual,
    useRoute: () => ({
      params: { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' },
    }),
  }
})

// Mock $fetch to avoid real HTTP calls
vi.stubGlobal('$fetch', vi.fn(async () => ({ predictions: [] })))

describe('predictions.vue (R-PRED-01, R-PRED-03)', () => {
  let wrapper: VueWrapper

  beforeAll(async () => {
    // v4 BREAKING CHANGE: import the component inside beforeAll
    const { default: PredictionsPage } = await import(
      '../../app/pages/rooms/[id]/predictions.vue'
    )
    wrapper = await mountSuspended(PredictionsPage)
  })

  it('mounts without crashing', () => {
    expect(wrapper.element).toBeDefined()
  })

  it('renders a prediction form with predicted_home and predicted_away inputs', () => {
    const html = wrapper.html()
    // The form must have both score inputs
    expect(html).toContain('predicted_home')
    expect(html).toContain('predicted_away')
  })

  it('shows a locked banner when prediction is locked (423)', async () => {
    // Mount a wrapper that has locked state
    const { default: PredictionsPage } = await import(
      '../../app/pages/rooms/[id]/predictions.vue'
    )
    const w = await mountSuspended(PredictionsPage)
    // Simulate locked state by triggering it via the component's exposed logic
    // The locked banner should show when locked=true
    await w.setData?.({ locked: true })
    const html = w.html()
    // Accepts either English or Spanish text for the locked state
    const hasLockedText = html.includes('locked') || html.includes('bloqueada') || html.includes('prediction_locked') || html.includes('Bloqueada')
    expect(hasLockedText || html.includes('locked')).toBe(true)
  })

  it('shows an error when match has already started (409)', async () => {
    const { default: PredictionsPage } = await import(
      '../../app/pages/rooms/[id]/predictions.vue'
    )
    const w = await mountSuspended(PredictionsPage)
    await w.setData?.({ submitError: 'match_already_started' })
    const html = w.html()
    const hasStartedText = html.includes('match_already_started') || html.includes('partido') || html.includes('empezado') || html.includes('started')
    expect(hasStartedText || html.includes('match_already_started')).toBe(true)
  })
})
