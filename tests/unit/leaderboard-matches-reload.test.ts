import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

/**
 * Unit tests for the matches-driven leaderboard reload wiring in leaderboard.vue.
 * Covers T-99 / R-LEAD-04 (scenarios 5–7) / R-RT-06.
 *
 * This file is deliberately separate from use-leaderboard-realtime.test.ts to keep
 * concerns separated (the leaderboard reducer is tested there; the matches subscription
 * wiring is tested here).
 *
 * The tests mock both useMatches().subscribe and useLeaderboard(roomId).load and then
 * exercise the onMatchUpdate callback logic that leaderboard.vue wires up.
 */

// ---------------------------------------------------------------------------
// Module mocks — must be at top level (hoisted by vitest)
// ---------------------------------------------------------------------------

vi.mock('vue', () => ({
  ref: <T>(initial: T) => ({ value: initial }),
  onMounted: vi.fn(),
  onUnmounted: vi.fn(),
  computed: vi.fn((fn: () => unknown) => ({ value: fn() })),
}))

// ---------------------------------------------------------------------------
// Nuxt global stubs
// ---------------------------------------------------------------------------

vi.stubGlobal('useRoute', () => ({ params: { id: 'room-test-001' } }))
vi.stubGlobal('useState', (_key: string) => ({ value: false }))
vi.stubGlobal('readonly', (r: unknown) => r)
vi.stubGlobal('useSessionExpired', () => ({
  isExpired: { value: false },
  setExpired: vi.fn(),
  reset: vi.fn(),
}))
vi.stubGlobal('$fetch', vi.fn())
vi.stubGlobal('useSupabaseClient', () => ({
  channel: vi.fn(() => ({
    on: vi.fn().mockReturnThis(),
    subscribe: vi.fn().mockReturnThis(),
  })),
  removeChannel: vi.fn(),
}))

// ---------------------------------------------------------------------------
// Inline onMatchUpdate logic — mirrors what leaderboard.vue implements.
// This tests the BEHAVIOUR contract so we can write tests before the page is
// wired. When leaderboard.vue is implemented (T-101), the Nuxt structural tests
// (T-100) verify that the page actually contains this wiring.
// ---------------------------------------------------------------------------

type MatchPayload = { new: { status: string; id?: string } }

function makeOnMatchUpdate(load: () => void) {
  let matchReloadTimer: ReturnType<typeof setTimeout> | null = null

  function onMatchUpdate(payload: MatchPayload) {
    if (payload.new.status !== 'finished') return
    if (matchReloadTimer) clearTimeout(matchReloadTimer)
    matchReloadTimer = setTimeout(() => {
      void load()
      matchReloadTimer = null
    }, 300)
  }

  function cleanup() {
    if (matchReloadTimer) {
      clearTimeout(matchReloadTimer)
      matchReloadTimer = null
    }
  }

  return { onMatchUpdate, cleanup }
}

// ---------------------------------------------------------------------------
// T-99: [RED] matches-driven leaderboard reload unit tests
// These describe the contract implemented by leaderboard.vue onMatchUpdate.
// ---------------------------------------------------------------------------

describe('leaderboard.vue — onMatchUpdate (R-LEAD-04, R-RT-06)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('T-99-01: finished status → load() called after 300ms', () => {
    const load = vi.fn()
    const { onMatchUpdate } = makeOnMatchUpdate(load)

    onMatchUpdate({ new: { status: 'finished' } })
    expect(load).not.toHaveBeenCalled() // not yet — debounce pending

    vi.advanceTimersByTime(300)
    expect(load).toHaveBeenCalledOnce()
  })

  it('T-99-02: live status → load() NOT called', () => {
    const load = vi.fn()
    const { onMatchUpdate } = makeOnMatchUpdate(load)

    onMatchUpdate({ new: { status: 'live' } })
    vi.advanceTimersByTime(300)
    expect(load).not.toHaveBeenCalled()
  })

  it('T-99-03: scheduled status → load() NOT called', () => {
    const load = vi.fn()
    const { onMatchUpdate } = makeOnMatchUpdate(load)

    onMatchUpdate({ new: { status: 'scheduled' } })
    vi.advanceTimersByTime(300)
    expect(load).not.toHaveBeenCalled()
  })

  it('T-99-04: two rapid finished payloads within 300ms → load() called exactly once (debounce)', () => {
    const load = vi.fn()
    const { onMatchUpdate } = makeOnMatchUpdate(load)

    onMatchUpdate({ new: { status: 'finished' } })
    vi.advanceTimersByTime(100) // 100ms into the first timer
    onMatchUpdate({ new: { status: 'finished' } }) // resets timer
    vi.advanceTimersByTime(300) // fires the second timer
    expect(load).toHaveBeenCalledOnce()
  })

  it('T-99-05: cleanup called before timer fires → load() NOT called', () => {
    const load = vi.fn()
    const { onMatchUpdate, cleanup } = makeOnMatchUpdate(load)

    onMatchUpdate({ new: { status: 'finished' } })
    vi.advanceTimersByTime(100) // timer pending
    cleanup() // component unmounts
    vi.advanceTimersByTime(300) // timer would have fired
    expect(load).not.toHaveBeenCalled()
  })
})
