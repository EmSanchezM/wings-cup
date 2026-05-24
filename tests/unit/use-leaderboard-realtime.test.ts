import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

/**
 * Unit tests for:
 *   - applyMemberUpdate pure reducer (T-85, R-RT-03, R-RT-05, R-LEAD-04)
 *   - useLeaderboard.subscribe wiring (T-87, R-RT-03)
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

import type { LeaderboardEntry } from '../../shared/types/leaderboard'
import type { RoomMember } from '../../shared/types/rooms'

function makeEntry(overrides: Partial<LeaderboardEntry> = {}): LeaderboardEntry {
  return {
    user_id: 'user-0001',
    display_name: 'Alice',
    total_points: 10,
    joined_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

function makeMember(overrides: Partial<RoomMember> = {}): RoomMember {
  return {
    user_id: 'user-0001',
    room_id: 'room-0001',
    total_points: 10,
    joined_at: '2026-01-01T00:00:00Z',
    role: 'member',
    ...overrides,
  }
}

const entryA = makeEntry({ user_id: 'user-aaaa', display_name: 'Alice', total_points: 10, joined_at: '2026-01-01T00:00:00Z' })
const entryB = makeEntry({ user_id: 'user-bbbb', display_name: 'Bob', total_points: 7, joined_at: '2026-01-02T00:00:00Z' })
const entryC = makeEntry({ user_id: 'user-cccc', display_name: 'Carol', total_points: 4, joined_at: '2026-01-03T00:00:00Z' })

// ---------------------------------------------------------------------------
// Nuxt global stubs
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
// Block B31 — T-85: applyMemberUpdate pure reducer
// ---------------------------------------------------------------------------

describe('applyMemberUpdate (R-RT-03, R-RT-05, R-LEAD-04)', () => {
  it('T-85-01: updates total_points on matching user_id and preserves display_name', async () => {
    const { applyMemberUpdate } = await import('../../app/composables/useLeaderboard')
    const payload = makeMember({ user_id: 'user-bbbb', total_points: 12 })
    const result = applyMemberUpdate([entryA, entryB, entryC], { new: payload })
    const updated = result.find((e) => e.user_id === 'user-bbbb')!
    expect(updated.total_points).toBe(12)
    expect(updated.display_name).toBe('Bob') // preserved from original entry
  })

  it('T-85-02: re-sorts result by total_points DESC, joined_at ASC', async () => {
    const { applyMemberUpdate } = await import('../../app/composables/useLeaderboard')
    // B goes from 7 to 12 — should rank first now
    const payload = makeMember({ user_id: 'user-bbbb', total_points: 12 })
    const result = applyMemberUpdate([entryA, entryB, entryC], { new: payload })
    expect(result[0].user_id).toBe('user-bbbb') // 12 pts
    expect(result[1].user_id).toBe('user-aaaa') // 10 pts
    expect(result[2].user_id).toBe('user-cccc') // 4 pts
  })

  it('T-85-03: returns unchanged array when user_id not found', async () => {
    const { applyMemberUpdate } = await import('../../app/composables/useLeaderboard')
    const payload = makeMember({ user_id: 'user-zzzz', total_points: 99 })
    const prev = [entryA, entryB, entryC]
    const result = applyMemberUpdate(prev, { new: payload })
    expect(result).toBe(prev)
  })

  it('T-85-04: returns a NEW sorted array (different reference)', async () => {
    const { applyMemberUpdate } = await import('../../app/composables/useLeaderboard')
    const payload = makeMember({ user_id: 'user-bbbb', total_points: 12 })
    const prev = [entryA, entryB, entryC]
    const result = applyMemberUpdate(prev, { new: payload })
    expect(result).not.toBe(prev)
  })

  it('T-85-05: tie-break — member with earlier joined_at ranks higher', async () => {
    const { applyMemberUpdate } = await import('../../app/composables/useLeaderboard')
    // Both A and C will have 10 pts after update. A joined_at < C joined_at → A ranks first
    const payload = makeMember({ user_id: 'user-cccc', total_points: 10, joined_at: '2026-01-03T00:00:00Z' })
    const result = applyMemberUpdate([entryA, entryB, entryC], { new: payload })
    const top = result.filter((e) => e.total_points === 10)
    expect(top[0].user_id).toBe('user-aaaa') // earlier joined_at
    expect(top[1].user_id).toBe('user-cccc')
  })
})

// ---------------------------------------------------------------------------
// Block B32 — T-87: useLeaderboard.subscribe wiring
// ---------------------------------------------------------------------------

describe('useLeaderboard.subscribe (R-RT-03)', () => {
  const ROOM_ID = 'room-abc'

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

  it('T-87-01: calls client.channel with room-scoped name "room-members-room-abc"', async () => {
    const { useLeaderboard } = await import('../../app/composables/useLeaderboard')
    const { subscribe } = useLeaderboard(ROOM_ID)
    subscribe(vi.fn())
    expect(mockClient.channel).toHaveBeenCalledWith('room-members-room-abc')
  })

  it('T-87-02: listener config includes filter, table, and event', async () => {
    const { useLeaderboard } = await import('../../app/composables/useLeaderboard')
    const { subscribe } = useLeaderboard(ROOM_ID)
    subscribe(vi.fn())
    expect(mockChannel.on).toHaveBeenCalledWith(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'room_members',
        filter: 'room_id=eq.room-abc',
      },
      expect.any(Function),
    )
  })

  it('T-87-03: cleanup calls removeChannel with the correct channel', async () => {
    const { useLeaderboard } = await import('../../app/composables/useLeaderboard')
    const { subscribe } = useLeaderboard(ROOM_ID)
    const cleanup = subscribe(vi.fn())
    cleanup()
    expect(mockRemoveChannel).toHaveBeenCalledOnce()
    expect(mockRemoveChannel).toHaveBeenCalledWith(mockChannel)
  })

  it('T-87-04: first "SUBSCRIBED" → load() NOT called', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ leaderboard: [] })
    vi.stubGlobal('$fetch', mockFetch)
    const { useLeaderboard } = await import('../../app/composables/useLeaderboard')
    const { subscribe } = useLeaderboard(ROOM_ID)
    subscribe(vi.fn())
    statusCallback?.('SUBSCRIBED')
    await vi.runAllTimersAsync()
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('T-87-05: second "SUBSCRIBED" after 300ms → load() called once', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ leaderboard: [] })
    vi.stubGlobal('$fetch', mockFetch)
    const { useLeaderboard } = await import('../../app/composables/useLeaderboard')
    const { subscribe } = useLeaderboard(ROOM_ID)
    subscribe(vi.fn())
    statusCallback?.('SUBSCRIBED') // first — no-op
    statusCallback?.('SUBSCRIBED') // second — starts debounce
    vi.advanceTimersByTime(300)
    await Promise.resolve()
    expect(mockFetch).toHaveBeenCalledOnce()
  })

  it('T-87-06: cleanup before timer fires → load() NOT called', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ leaderboard: [] })
    vi.stubGlobal('$fetch', mockFetch)
    const { useLeaderboard } = await import('../../app/composables/useLeaderboard')
    const { subscribe } = useLeaderboard(ROOM_ID)
    const cleanup = subscribe(vi.fn())
    statusCallback?.('SUBSCRIBED')
    statusCallback?.('SUBSCRIBED')
    cleanup() // cancel before 300ms
    vi.advanceTimersByTime(300)
    await Promise.resolve()
    expect(mockFetch).not.toHaveBeenCalled()
  })
})
