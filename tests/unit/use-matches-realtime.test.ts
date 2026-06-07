import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

/**
 * Unit tests for:
 *   - applyMatchUpdate pure reducer (T-81, R-RT-02, R-RT-04)
 *   - useMatches.subscribe wiring (T-83, R-RT-02)
 *
 * Runs in plain Node / vitest unit env — no Nuxt runtime needed.
 */

// ---------------------------------------------------------------------------
// Module mocks — must be at top level (hoisted by vitest)
// ---------------------------------------------------------------------------

vi.mock('vue', () => ({
  ref: <T>(initial: T) => ({ value: initial }),
}))

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

import type { MatchListItem } from '#shared/types/matches'

function makeMatch(overrides: Partial<MatchListItem> = {}): MatchListItem {
  return {
    id: 'match-0001',
    external_id: 'ext-001',
    home_team: 'Brazil',
    away_team: 'Argentina',
    stage: 'group',
    group_name: 'A',
    kickoff_at: '2099-06-11T20:00:00Z',
    status: 'scheduled',
    home_score: null,
    away_score: null,
    ...overrides,
  }
}

const matchA = makeMatch({ id: 'match-aaaa' })
const matchB = makeMatch({ id: 'match-bbbb', home_team: 'Mexico', away_team: 'USA' })
const matchC = makeMatch({ id: 'match-cccc', home_team: 'France', away_team: 'Germany' })

// ---------------------------------------------------------------------------
// Nuxt global stubs (top-level, apply to all tests)
// ---------------------------------------------------------------------------

const mockSetExpired = vi.fn()
vi.stubGlobal('useState', (_key: string) => ({ value: false }))
vi.stubGlobal('readonly', (r: unknown) => r)
vi.stubGlobal('useSessionExpired', () => ({
  isExpired: { value: false },
  setExpired: mockSetExpired,
  reset: vi.fn(),
}))
vi.stubGlobal('$fetch', vi.fn())

// ---------------------------------------------------------------------------
// subscribe mock — shared across subscribe tests
// ---------------------------------------------------------------------------

const mockRemoveChannel = vi.fn()
let statusCallback: ((status: string) => void) | undefined
const mockChannel = {
  on: vi.fn().mockReturnThis(),
  subscribe: vi.fn(function (cb: (status: string) => void) {
    statusCallback = cb
    return mockChannel
  }),
}
const mockClient = {
  channel: vi.fn(() => mockChannel),
  removeChannel: mockRemoveChannel,
}

vi.stubGlobal('useSupabaseClient', () => mockClient)

// ---------------------------------------------------------------------------
// Block B29 — T-81: applyMatchUpdate pure reducer
// ---------------------------------------------------------------------------

describe('applyMatchUpdate (R-RT-02, R-RT-04)', () => {
  it('T-81-01: replaces matching id with payload.new', async () => {
    const { applyMatchUpdate } = await import('../../app/composables/useMatches')
    const updated = makeMatch({ id: 'match-bbbb', status: 'finished', home_score: 2, away_score: 1 })
    const result = applyMatchUpdate([matchA, matchB, matchC], { new: updated })
    expect(result[1]).toEqual(updated)
    expect(result[0]).toEqual(matchA)
    expect(result[2]).toEqual(matchC)
  })

  it('T-81-02: preserves array order (before and after unchanged)', async () => {
    const { applyMatchUpdate } = await import('../../app/composables/useMatches')
    const updated = makeMatch({ id: 'match-aaaa', status: 'live' })
    const result = applyMatchUpdate([matchA, matchB, matchC], { new: updated })
    expect(result[0]).toEqual(updated)
    expect(result[1]).toEqual(matchB)
    expect(result[2]).toEqual(matchC)
  })

  it('T-81-03: returns unchanged array reference when id not found', async () => {
    const { applyMatchUpdate } = await import('../../app/composables/useMatches')
    const unknown = makeMatch({ id: 'match-zzzz' })
    const prev = [matchA, matchB, matchC]
    const result = applyMatchUpdate(prev, { new: unknown })
    expect(result).toBe(prev)
  })

  it('T-81-04: returns a NEW array reference when replacement is made', async () => {
    const { applyMatchUpdate } = await import('../../app/composables/useMatches')
    const updated = makeMatch({ id: 'match-bbbb', status: 'live' })
    const prev = [matchA, matchB, matchC]
    const result = applyMatchUpdate(prev, { new: updated })
    expect(result).not.toBe(prev)
  })
})

// ---------------------------------------------------------------------------
// Block B30 — T-83: useMatches.subscribe wiring
// ---------------------------------------------------------------------------

describe('useMatches.subscribe (R-RT-02)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    mockRemoveChannel.mockClear()
    mockChannel.on.mockClear()
    mockChannel.on.mockReturnThis()
    mockChannel.subscribe.mockClear()
    mockChannel.subscribe.mockImplementation(function (cb: (status: string) => void) {
      statusCallback = cb
      return mockChannel
    })
    mockClient.channel.mockClear()
    statusCallback = undefined
    vi.stubGlobal('useSupabaseClient', () => mockClient)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('T-83-01: calls client.channel with exact string "matches-updates"', async () => {
    const { useMatches } = await import('../../app/composables/useMatches')
    const { subscribe } = useMatches()
    subscribe(vi.fn())
    expect(mockClient.channel).toHaveBeenCalledWith('matches-updates')
  })

  it('T-83-02: registers .on("postgres_changes") with correct args', async () => {
    const { useMatches } = await import('../../app/composables/useMatches')
    const { subscribe } = useMatches()
    subscribe(vi.fn())
    expect(mockChannel.on).toHaveBeenCalledWith(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'matches' },
      expect.any(Function),
    )
  })

  it('T-83-03: cleanup function calls client.removeChannel exactly once', async () => {
    const { useMatches } = await import('../../app/composables/useMatches')
    const { subscribe } = useMatches()
    const cleanup = subscribe(vi.fn())
    cleanup()
    expect(mockRemoveChannel).toHaveBeenCalledOnce()
    expect(mockRemoveChannel).toHaveBeenCalledWith(mockChannel)
  })

  it('T-83-04: first "SUBSCRIBED" status event — load() NOT called (no $fetch)', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ matches: [] })
    vi.stubGlobal('$fetch', mockFetch)
    const { useMatches } = await import('../../app/composables/useMatches')
    const { subscribe } = useMatches()
    subscribe(vi.fn())
    statusCallback?.('SUBSCRIBED')
    await vi.runAllTimersAsync()
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('T-83-05: second "SUBSCRIBED" after 300ms → load() called once', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ matches: [] })
    vi.stubGlobal('$fetch', mockFetch)
    const { useMatches } = await import('../../app/composables/useMatches')
    const { subscribe } = useMatches()
    subscribe(vi.fn())
    statusCallback?.('SUBSCRIBED') // first — no-op
    statusCallback?.('SUBSCRIBED') // second — starts debounce
    vi.advanceTimersByTime(300)
    await Promise.resolve()
    expect(mockFetch).toHaveBeenCalledOnce()
  })

  it('T-83-06: cleanup before timer fires → load() NOT called', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ matches: [] })
    vi.stubGlobal('$fetch', mockFetch)
    const { useMatches } = await import('../../app/composables/useMatches')
    const { subscribe } = useMatches()
    const cleanup = subscribe(vi.fn())
    statusCallback?.('SUBSCRIBED') // first
    statusCallback?.('SUBSCRIBED') // second — starts timer
    cleanup() // cancel before 300ms fires
    vi.advanceTimersByTime(300)
    await Promise.resolve()
    expect(mockFetch).not.toHaveBeenCalled()
  })

  // -------------------------------------------------------------------------
  // T-97: [RED] optional channelName param — B37 / R-RT-02 (MODIFIED)
  // -------------------------------------------------------------------------

  it('T-97-01: subscribe(onUpdate) with no second arg → channel("matches-updates") called', async () => {
    const { useMatches } = await import('../../app/composables/useMatches')
    const { subscribe } = useMatches()
    subscribe(vi.fn())
    expect(mockClient.channel).toHaveBeenCalledWith('matches-updates')
  })

  it('T-97-02: subscribe(onUpdate, "matches-leaderboard-reload") → channel("matches-leaderboard-reload") called', async () => {
    const { useMatches } = await import('../../app/composables/useMatches')
    const { subscribe } = useMatches()
    subscribe(vi.fn(), 'matches-leaderboard-reload')
    expect(mockClient.channel).toHaveBeenCalledWith('matches-leaderboard-reload')
  })
})
