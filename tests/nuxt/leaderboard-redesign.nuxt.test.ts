/**
 * Nuxt tests for the leaderboard.vue restyle + stats (R-UX-09).
 *
 * Additive to leaderboard.nuxt.test.ts (which still guards realtime wiring).
 * Asserts: initials avatars, current-user row highlighted as "Tú", derived
 * stats (promedio grupo, partidos restantes), and that deferred features
 * (trend arrows / aciertos / premios) are NOT rendered.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ref } from 'vue'
import { mountSuspended, mockNuxtImport } from '@nuxt/test-utils/runtime'
import { flushPromises } from '@vue/test-utils'
import type { LeaderboardEntry } from '../../shared/types/leaderboard'
import type { MatchListItem } from '../../shared/types/matches'

const ROOM_ID = 'room-test-0001'

const memberA: LeaderboardEntry = { user_id: 'user-aaaa', display_name: 'Alice', total_points: 10, joined_at: '2026-01-01T00:00:00Z' }
const memberB: LeaderboardEntry = { user_id: 'user-bbbb', display_name: 'Bob', total_points: 7, joined_at: '2026-01-02T00:00:00Z' }

const matches = [
  { id: 'm1', status: 'finished' },
  { id: 'm2', status: 'scheduled' },
  { id: 'm3', status: 'live' },
] as unknown as MatchListItem[]

vi.mock('#app', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return { ...actual, useRoute: () => ({ params: { id: ROOM_ID } }) }
})

vi.mock('~/composables/useMatches', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return {
    ...actual,
    useMatches: () => {
      const { ref: vref } = require('vue') as typeof import('vue')
      return {
        data: vref(matches),
        pending: vref(false),
        error: vref(null),
        load: vi.fn(),
        subscribe: vi.fn(() => vi.fn()),
        updateMatch: vi.fn(),
        lockNow: vi.fn(),
      }
    },
  }
})

vi.mock('~/composables/useLeaderboard', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return {
    ...actual,
    useLeaderboard: () => {
      const { ref: vref } = require('vue') as typeof import('vue')
      const data = vref<LeaderboardEntry[]>([])
      return {
        data,
        pending: vref(false),
        error: vref(null),
        load: vi.fn(async () => {
          const r = await (globalThis.$fetch as (u: string) => Promise<{ leaderboard: LeaderboardEntry[] }>)('/api/rooms/x/leaderboard')
          data.value = r.leaderboard
        }),
        subscribe: vi.fn(() => vi.fn()),
      }
    },
  }
})

const { userMock } = vi.hoisted(() => ({ userMock: vi.fn() }))
mockNuxtImport('useSupabaseUser', () => userMock)

describe('leaderboard.vue — redesign + stats (R-UX-09)', () => {
  beforeEach(() => {
    userMock.mockReturnValue(ref({ id: 'user-bbbb' })) // current user = Bob
    vi.stubGlobal('$fetch', vi.fn(async () => ({ leaderboard: [memberA, memberB] })))
  })

  it('01: renders an initials avatar per row', async () => {
    const { default: Page } = await import('../../app/pages/rooms/[id]/leaderboard.vue')
    const wrapper = await mountSuspended(Page)
    await flushPromises()
    expect(wrapper.findAll('[data-testid="lb-avatar"]')).toHaveLength(2)
  })

  it('02: current-user row is highlighted and labelled "Tú"', async () => {
    const { default: Page } = await import('../../app/pages/rooms/[id]/leaderboard.vue')
    const wrapper = await mountSuspended(Page)
    await flushPromises()
    expect(wrapper.text()).toContain('Tú')
    const me = wrapper.find('[data-testid="lb-row-me"]')
    expect(me.exists()).toBe(true)
  })

  it('03: derives promedio grupo and partidos restantes', async () => {
    const { default: Page } = await import('../../app/pages/rooms/[id]/leaderboard.vue')
    const wrapper = await mountSuspended(Page)
    await flushPromises()
    // (10 + 7) / 2 = 8.5
    expect(wrapper.find('[data-testid="promedio"]').text()).toContain('8.5')
    // 3 matches, 1 finished → 2 remaining
    expect(wrapper.find('[data-testid="partidos-restantes"]').text()).toContain('2')
  })

  it('04: does not render deferred features (trend / aciertos / premios)', async () => {
    const { default: Page } = await import('../../app/pages/rooms/[id]/leaderboard.vue')
    const wrapper = await mountSuspended(Page)
    await flushPromises()
    const html = wrapper.html()
    expect(html).not.toContain('Aciertos')
    expect(html).not.toContain('Premios')
    expect(wrapper.find('[data-testid="trend"]').exists()).toBe(false)
  })
})
