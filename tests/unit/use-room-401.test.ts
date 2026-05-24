import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Unit tests — 401 detection in useRoom composable (R-UX-03, scenario 1 + 4)
 *
 * T-63-01: 401 error → setExpired() called, error NOT bubbled
 * T-63-02: non-401 error (500) → error IS bubbled, setExpired NOT called
 */

// Stub Nuxt globals
const mockSetExpired = vi.fn()
const mockReset = vi.fn()
const _stateRef = { value: false }

vi.stubGlobal('useState', (_key: string, init?: () => boolean) => {
  return _stateRef
})
vi.stubGlobal('readonly', (r: unknown) => r)

describe('useRoom — 401 detection (R-UX-03)', () => {
  beforeEach(() => {
    mockSetExpired.mockClear()
    mockReset.mockClear()
    _stateRef.value = false
  })

  it('T-63-01: 401 from any room method → setExpired() called, error NOT thrown', async () => {
    // Stub useSessionExpired to capture calls
    vi.stubGlobal('useSessionExpired', () => ({
      isExpired: _stateRef,
      setExpired: mockSetExpired,
      reset: mockReset,
    }))

    const error401 = Object.assign(new Error('Unauthorized'), { statusCode: 401 })
    const mockFetch = vi.fn().mockRejectedValue(error401)

    // Dynamically import to pick up stubs
    const { useRoom } = await import('../../app/composables/useRoom')
    const roomClient = useRoom(mockFetch as unknown as typeof $fetch)

    // listRooms should NOT throw on 401
    const result = await roomClient.listRooms()

    expect(mockSetExpired).toHaveBeenCalledOnce()
    // Must return a safe fallback (undefined or empty array), NOT throw
    expect(result).toBeUndefined()
  })

  it('T-63-02: non-401 (500) → error IS thrown, setExpired NOT called', async () => {
    vi.stubGlobal('useSessionExpired', () => ({
      isExpired: _stateRef,
      setExpired: mockSetExpired,
      reset: mockReset,
    }))

    const error500 = Object.assign(new Error('Server Error'), { statusCode: 500 })
    const mockFetch = vi.fn().mockRejectedValue(error500)

    const { useRoom } = await import('../../app/composables/useRoom')
    const roomClient = useRoom(mockFetch as unknown as typeof $fetch)

    // Non-401 errors should still propagate
    await expect(roomClient.listRooms()).rejects.toThrow('Server Error')
    expect(mockSetExpired).not.toHaveBeenCalled()
  })
})
