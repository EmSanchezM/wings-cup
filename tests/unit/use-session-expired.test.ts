import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Unit tests for useSessionExpired composable (R-UX-01)
 *
 * The composable uses Nuxt globals (useState, readonly) which are not available
 * in the plain node unit environment. We stub them here using plain objects that
 * mimic the required interface, allowing us to test the observable behaviour.
 *
 * Tests:
 *   T-58-01: isExpired starts false
 *   T-58-02: setExpired() flips to true
 *   T-58-03: reset() flips back to false
 *   T-58-04: source uses useState('session-expired', ...) with false initialiser
 */

// Minimal ref-like object for unit environment
function makeRef(initial: boolean) {
  const obj = { value: initial }
  return obj
}

// Shared state ref across composable calls (singleton simulation)
let _state = makeRef(false)

// Stub Nuxt globals before the composable module is loaded
vi.stubGlobal('useState', (_key: string, init?: () => boolean) => {
  if (init !== undefined && _state.value === makeRef(false).value) {
    // only apply init once (singleton behaviour)
  }
  return _state
})

// readonly: in tests, just return the same ref (readonly is a Nuxt/Vue wrapper)
vi.stubGlobal('readonly', (r: { value: boolean }) => r)

describe('useSessionExpired (R-UX-01)', () => {
  beforeEach(() => {
    // Reset singleton state between tests
    _state.value = false
  })

  it('T-58-01: isExpired is false initially', async () => {
    const { useSessionExpired } = await import('../../app/composables/useSessionExpired')
    const { isExpired } = useSessionExpired()
    expect(isExpired.value).toBe(false)
  })

  it('T-58-02: setExpired() flips isExpired to true', async () => {
    const { useSessionExpired } = await import('../../app/composables/useSessionExpired')
    const { isExpired, setExpired } = useSessionExpired()
    setExpired()
    expect(isExpired.value).toBe(true)
  })

  it('T-58-03: reset() flips isExpired back to false', async () => {
    const { useSessionExpired } = await import('../../app/composables/useSessionExpired')
    const { isExpired, setExpired, reset } = useSessionExpired()
    setExpired()
    expect(isExpired.value).toBe(true)
    reset()
    expect(isExpired.value).toBe(false)
  })

  it('T-58-04: useState key is exactly "session-expired" with false initialiser', async () => {
    // Structural: verify the source uses the correct useState key and initialiser
    const fs = await import('fs')
    const path = await import('path')
    const filePath = path.resolve(
      process.cwd(),
      'app/composables/useSessionExpired.ts',
    )
    const src = fs.readFileSync(filePath, 'utf-8')
    expect(src).toContain("useState('session-expired'")
    // Initialiser must return false
    expect(src).toContain('() => false')
  })
})
