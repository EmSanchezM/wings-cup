import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Unit tests — 401 detection in useLeaderboard composable (R-UX-03, scenario 3 + 4)
 *
 * T-65-01: 401 error → setExpired() called, error.value NOT set
 * T-65-02: non-401 error (500) → error.value IS set, setExpired NOT called
 */

// Mock 'vue' to provide ref() in the plain node unit environment
vi.mock('vue', () => ({
  ref: <T>(initial: T) => ({ value: initial }),
}))

// Stub Nuxt globals
const mockSetExpired = vi.fn()
const mockReset = vi.fn()
const _stateRef = { value: false }

vi.stubGlobal('useState', (_key: string) => _stateRef)
vi.stubGlobal('readonly', (r: unknown) => r)

const ROOM_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'

describe('useLeaderboard — 401 detection (R-UX-03)', () => {
  beforeEach(() => {
    mockSetExpired.mockClear()
    mockReset.mockClear()
    _stateRef.value = false
  })

  it('T-65-01: 401 → setExpired() called, error.value NOT set', async () => {
    vi.stubGlobal('useSessionExpired', () => ({
      isExpired: _stateRef,
      setExpired: mockSetExpired,
      reset: mockReset,
    }))

    const error401 = Object.assign(new Error('Unauthorized'), { statusCode: 401 })
    const mockFetch = vi.fn().mockRejectedValue(error401)
    vi.stubGlobal('$fetch', mockFetch)

    const { useLeaderboard } = await import('../../app/composables/useLeaderboard')
    const { error, load } = useLeaderboard(ROOM_ID)

    await load()

    expect(mockSetExpired).toHaveBeenCalledOnce()
    // error.value must NOT be set on 401
    expect(error.value).toBeNull()
  })

  it('T-65-02: non-401 (500) → error.value IS set, setExpired NOT called', async () => {
    vi.stubGlobal('useSessionExpired', () => ({
      isExpired: _stateRef,
      setExpired: mockSetExpired,
      reset: mockReset,
    }))

    const error500 = Object.assign(new Error('Server Error'), { statusCode: 500 })
    const mockFetch = vi.fn().mockRejectedValue(error500)
    vi.stubGlobal('$fetch', mockFetch)

    const { useLeaderboard } = await import('../../app/composables/useLeaderboard')
    const { error, load } = useLeaderboard(ROOM_ID)

    await load()

    expect(error.value).toBe('Server Error')
    expect(mockSetExpired).not.toHaveBeenCalled()
  })
})
