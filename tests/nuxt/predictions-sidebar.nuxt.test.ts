/**
 * Nuxt tests for the predictions.vue "Resumen de Puntos" sidebar (R-UX-07).
 *
 * The sidebar adds READ-ONLY derived data: completados (on-page, no fetch) plus
 * puntos/posición from a read-only leaderboard fetch matched to the current user
 * via useSupabaseUser. Must degrade gracefully when the leaderboard is
 * unavailable or the user is unknown — the cards keep working either way.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ref } from 'vue'
import { mountSuspended, mockNuxtImport } from '@nuxt/test-utils/runtime'
import { flushPromises } from '@vue/test-utils'
import type { MatchListItem } from '#shared/types/matches'
import type { Prediction } from '#shared/types/predictions'

const ROOM_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'

const scheduledMatch: MatchListItem = {
  id: '11111111-1111-4111-8111-111111111111',
  external_id: 'fifa26-001',
  home_team: 'Mexico',
  away_team: 'Ecuador',
  stage: 'group',
  group_name: 'A',
  kickoff_at: '2099-06-11T20:00:00Z',
  status: 'scheduled',
  home_score: null,
  away_score: null,
  home_penalties: null,
  away_penalties: null,
}
const finishedMatch: MatchListItem = { ...scheduledMatch, id: '22222222-2222-4222-8222-222222222222', status: 'finished', home_score: 2, away_score: 1 }

const myPrediction: Prediction = {
  id: 'pred-1', room_id: ROOM_ID, user_id: 'user-me', match_id: scheduledMatch.id,
  predicted_home: 2, predicted_away: 1, predicted_advances: null, locked_at: null, points_awarded: 0,
  created_at: '2026-05-24T00:00:00Z', updated_at: '2026-05-24T00:00:00Z',
}

const leaderboard = [
  { user_id: 'leader', display_name: 'Carlos', total_points: 150, joined_at: '2026-05-01T00:00:00Z' },
  { user_id: 'user-me', display_name: 'Yo', total_points: 120, joined_at: '2026-05-02T00:00:00Z' },
  { user_id: 'other', display_name: 'Ana', total_points: 100, joined_at: '2026-05-03T00:00:00Z' },
]

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
      const data = vref<MatchListItem[]>([])
      return {
        data, pending: vref(false), error: vref<string | null>(null),
        load: vi.fn(async () => {
          const r = await (globalThis.$fetch as (u: string) => Promise<{ matches: MatchListItem[] }>)('/api/matches')
          data.value = r.matches
        }),
        subscribe: vi.fn(() => vi.fn()),
        updateMatch: vi.fn(), lockNow: vi.fn(),
      }
    },
  }
})

const { userMock } = vi.hoisted(() => ({ userMock: vi.fn() }))
mockNuxtImport('useSupabaseUser', () => userMock)

describe('predictions.vue — points sidebar (R-UX-07)', () => {
  beforeEach(() => {
    userMock.mockReturnValue(ref({ id: 'user-me' }))
    vi.stubGlobal('$fetch', vi.fn(async (url: string) => {
      if (typeof url === 'string' && url.includes('leaderboard')) return { leaderboard }
      if (typeof url === 'string' && url.includes('/predictions')) return { predictions: [myPrediction] }
      return { matches: [scheduledMatch, finishedMatch] }
    }))
  })

  it('01: renders the "Resumen de Puntos" sidebar', async () => {
    const { default: Page } = await import('../../app/pages/rooms/[id]/predictions.vue')
    const wrapper = await mountSuspended(Page)
    await flushPromises()
    expect(wrapper.find('[data-testid="points-summary"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('Resumen de Puntos')
  })

  it('02: completados is derived on-page (1 of 2 eligible)', async () => {
    const { default: Page } = await import('../../app/pages/rooms/[id]/predictions.vue')
    const wrapper = await mountSuspended(Page)
    await flushPromises()
    expect(wrapper.find('[data-testid="completados"]').text()).toContain('1/2')
  })

  it('03: puntos and posición come from the leaderboard fetch matched to the user', async () => {
    const { default: Page } = await import('../../app/pages/rooms/[id]/predictions.vue')
    const wrapper = await mountSuspended(Page)
    await flushPromises()
    expect(wrapper.find('[data-testid="puntos"]').text()).toContain('120')
    expect(wrapper.find('[data-testid="posicion"]').text()).toContain('2')
  })

  it('04: degrades gracefully when the leaderboard fetch fails', async () => {
    vi.stubGlobal('$fetch', vi.fn(async (url: string) => {
      if (typeof url === 'string' && url.includes('leaderboard')) throw Object.assign(new Error('boom'), { statusCode: 500 })
      if (typeof url === 'string' && url.includes('/predictions')) return { predictions: [myPrediction] }
      return { matches: [scheduledMatch, finishedMatch] }
    }))
    const { default: Page } = await import('../../app/pages/rooms/[id]/predictions.vue')
    const wrapper = await mountSuspended(Page)
    await flushPromises()
    // cards still render
    expect(wrapper.findAll('[data-testid="prediction-card"]').length).toBe(2)
    // points unavailable placeholder
    expect(wrapper.find('[data-testid="puntos"]').text()).toContain('—')
  })
})
