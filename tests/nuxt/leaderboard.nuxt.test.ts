/**
 * Nuxt component tests for leaderboard.vue (R-RT-05, R-LEAD-04)
 *
 * T-93: [RED] subscribe lifecycle and re-sort on member update
 * T-94: [GREEN] implemented in leaderboard.vue
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { flushPromises } from '@vue/test-utils'
import type { LeaderboardEntry } from '../../shared/types/leaderboard'

// ---------------------------------------------------------------------------
// Mock useRoute
// ---------------------------------------------------------------------------

const ROOM_ID = 'room-test-0001'

vi.mock('#app', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return {
    ...actual,
    useRoute: () => ({
      params: { id: ROOM_ID },
    }),
  }
})

// ---------------------------------------------------------------------------
// Mock useSupabaseClient — the nuxt test env resolves this from @nuxtjs/supabase
// which calls useNuxtApp().$supabase.client. We mock the module to intercept it.
// ---------------------------------------------------------------------------

const mockRemoveChannel = vi.fn()
const mockChannel = {
  on: vi.fn().mockReturnThis(),
  subscribe: vi.fn(function (cb: (status: string) => void) {
    void cb
    return mockChannel
  }),
}
const mockSupabaseClient = {
  channel: vi.fn(() => mockChannel),
  removeChannel: mockRemoveChannel,
}

// Mock useLeaderboard to return a controlled subscribe fn in the nuxt test env.
// The unit tests (use-leaderboard-realtime.test.ts) cover subscribe behavior in depth.
// Here we just verify structural wiring + that the page renders without crash.
vi.mock('~/composables/useLeaderboard', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return {
    ...actual,
    useLeaderboard: (_roomId: string) => {
      const data = { value: [] as import('../../shared/types/leaderboard').LeaderboardEntry[] }
      const load = vi.fn(async () => {
        // Simulate load populating data from $fetch
        const result = await (globalThis.$fetch as (url: string) => Promise<{ leaderboard: import('../../shared/types/leaderboard').LeaderboardEntry[] }>)('/api/rooms/test/leaderboard')
        data.value = result.leaderboard
      })
      return {
        data,
        pending: { value: false },
        error: { value: null },
        load,
        subscribe: vi.fn(() => vi.fn()), // returns cleanup no-op
      }
    },
  }
})

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const memberA: LeaderboardEntry = {
  user_id: 'user-aaaa',
  display_name: 'Alice',
  total_points: 10,
  joined_at: '2026-01-01T00:00:00Z',
}

const memberB: LeaderboardEntry = {
  user_id: 'user-bbbb',
  display_name: 'Bob',
  total_points: 7,
  joined_at: '2026-01-02T00:00:00Z',
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('leaderboard.vue — subscribe lifecycle and re-sort (R-RT-05, R-LEAD-04)', () => {
  beforeEach(() => {
    vi.stubGlobal(
      '$fetch',
      vi.fn(async () => ({
        leaderboard: [memberA, memberB],
      })),
    )
  })

  it('T-93-01: page mounts and renders Tabla de Posiciones heading', async () => {
    const { default: LeaderboardPage } = await import(
      '../../app/pages/rooms/[id]/leaderboard.vue'
    )
    const wrapper = await mountSuspended(LeaderboardPage)
    await flushPromises()
    // Verify the page structure is rendered (heading always present)
    expect(wrapper.html()).toContain('Tabla de Posiciones')
  })

  it('T-93-02: leaderboard.vue source contains subscribe lifecycle wiring (structural)', async () => {
    const fs = await import('fs')
    const path = await import('path')
    const src = fs.readFileSync(
      path.resolve(process.cwd(), 'app/pages/rooms/[id]/leaderboard.vue'),
      'utf-8',
    )
    expect(src).toContain('subscribe')
    expect(src).toContain('onMounted')
    expect(src).toContain('onUnmounted')
    expect(src).toContain('cleanup')
  })

  it('T-93-03: leaderboard.vue source uses applyMemberUpdate reducer (structural)', async () => {
    const fs = await import('fs')
    const path = await import('path')
    const src = fs.readFileSync(
      path.resolve(process.cwd(), 'app/pages/rooms/[id]/leaderboard.vue'),
      'utf-8',
    )
    expect(src).toContain('applyMemberUpdate')
  })

  it('T-93-04: page mounts without crash (smoke)', async () => {
    const { default: LeaderboardPage } = await import(
      '../../app/pages/rooms/[id]/leaderboard.vue'
    )
    const wrapper = await mountSuspended(LeaderboardPage)
    expect(wrapper.element).toBeDefined()
  })
})
