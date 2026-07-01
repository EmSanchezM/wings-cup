/**
 * Nuxt component tests for rooms/[id]/members/[memberId].vue
 *
 * Focus: the read-only "no prediction" card. When a match has ALREADY started
 * and the member has no locked prediction, the page must state the member never
 * submitted a pick — NOT the misleading "se revela cuando empiece el partido".
 * A submitted pick is locked at kickoff and returned by the API, so its absence
 * on an already-started match unambiguously means "no prediction sent".
 *
 * Vitest v4 + @nuxt/test-utils v4 pattern: dynamic imports live inside `it`.
 */
import { describe, it, expect, vi } from 'vitest'
import { ref } from 'vue'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { flushPromises } from '@vue/test-utils'
import type { MatchListItem } from '#shared/types/matches'
import type { Prediction } from '#shared/types/predictions'

const ROOM_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const MEMBER_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'

const scheduledMatch: MatchListItem = {
  id: '11111111-1111-4111-8111-111111111111',
  external_id: 'fifa26-001',
  home_team: 'Mexico',
  away_team: 'Sudafrica',
  stage: 'group',
  group_name: 'A',
  kickoff_at: '2099-06-11T20:00:00Z', // far future — always scheduled
  status: 'scheduled',
  home_score: null,
  away_score: null,
  home_penalties: null,
  away_penalties: null,
}

const finishedMatch: MatchListItem = {
  ...scheduledMatch,
  id: '22222222-2222-4222-8222-222222222222',
  status: 'finished',
  kickoff_at: '2026-06-11T13:00:00Z', // already played
  home_score: 2,
  away_score: 1,
}

const lockedPrediction: Prediction = {
  id: 'pred-0001-0000-0000-000000000001',
  room_id: ROOM_ID,
  user_id: MEMBER_ID,
  match_id: finishedMatch.id,
  predicted_home: 2,
  predicted_away: 3,
  predicted_advances: null,
  locked_at: '2026-06-11T13:00:00Z',
  points_awarded: 0,
  created_at: '2026-05-24T00:00:00Z',
  updated_at: '2026-05-24T00:00:00Z',
}

const knockoutMatch: MatchListItem = {
  ...finishedMatch,
  id: '33333333-3333-4333-8333-333333333333',
  external_id: 'fifa26-074',
  home_team: 'Inglaterra',
  away_team: 'RD Congo',
  stage: 'round_of_32',
  group_name: null,
}

const knockoutPrediction: Prediction = {
  ...lockedPrediction,
  id: 'pred-0002-0000-0000-000000000002',
  match_id: knockoutMatch.id,
  predicted_advances: 'home',
}

// ---------------------------------------------------------------------------
// Mock useRoute — this page needs BOTH room id and member id.
// ---------------------------------------------------------------------------

vi.mock('#app', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return {
    ...actual,
    useRoute: () => ({ params: { id: ROOM_ID, memberId: MEMBER_ID } }),
  }
})

// ---------------------------------------------------------------------------
// Mock useMatches — useSupabaseClient cannot initialize in the nuxt test env,
// so we expose a load() that just pulls matches from the stubbed $fetch.
// ---------------------------------------------------------------------------

vi.mock('~/composables/useMatches', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return {
    ...actual,
    useMatches: () => {
      const data = ref<MatchListItem[]>([])
      return {
        data,
        pending: ref(false),
        error: ref<string | null>(null),
        load: vi.fn(async () => {
          const result = await (globalThis.$fetch as (url: string) => Promise<{ matches: MatchListItem[] }>)('/api/matches')
          data.value = result.matches
        }),
        subscribe: vi.fn(() => vi.fn()),
        updateMatch: vi.fn(),
        lockNow: vi.fn(),
      }
    },
  }
})

// ---------------------------------------------------------------------------
// Stub $fetch: the member-predictions endpoint also contains "/predictions",
// so match "/members/" FIRST.
// ---------------------------------------------------------------------------

function stubFetch(matches: MatchListItem[], predictions: Prediction[]) {
  vi.stubGlobal(
    '$fetch',
    vi.fn(async (url: string) => {
      if (typeof url === 'string' && url.includes('/members/')) {
        return { predictions, display_name: 'Stiven Ruben Sanchez' }
      }
      return { matches }
    }),
  )
}

async function mountMemberPage() {
  const { default: MemberPage } = await import(
    '../../app/pages/rooms/[id]/members/[memberId].vue'
  )
  const wrapper = await mountSuspended(MemberPage)
  await flushPromises()
  return wrapper
}

describe('members/[memberId].vue — no-prediction card', () => {
  it('T-MP-01: started match without prediction → no-prediction card, not the "reveal" card', async () => {
    stubFetch([finishedMatch], [])
    const wrapper = await mountMemberPage()
    expect(wrapper.find('[data-testid="no-prediction-card"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="hidden-prediction-card"]').exists()).toBe(false)
    expect(wrapper.html()).toContain('no envió pronóstico')
    expect(wrapper.html()).not.toContain('Se revela cuando empiece')
  })

  it('T-MP-02: scheduled match without prediction → "reveal" card (regression guard)', async () => {
    stubFetch([scheduledMatch], [])
    const wrapper = await mountMemberPage()
    expect(wrapper.find('[data-testid="hidden-prediction-card"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="no-prediction-card"]').exists()).toBe(false)
    expect(wrapper.html()).toContain('Se revela cuando empiece')
  })

  it('T-MP-03: started match with locked prediction → revealed card, no no-prediction card', async () => {
    stubFetch([finishedMatch], [lockedPrediction])
    const wrapper = await mountMemberPage()
    expect(wrapper.find('[data-testid="member-prediction-card"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="no-prediction-card"]').exists()).toBe(false)
  })

  it('T-MP-04: knockout prediction with an advance pick → shows the chosen team', async () => {
    stubFetch([knockoutMatch], [knockoutPrediction])
    const wrapper = await mountMemberPage()
    const pick = wrapper.find('[data-testid="advance-pick-display"]')
    expect(pick.exists()).toBe(true)
    // predicted_advances 'home' → the home team name is shown
    expect(pick.text()).toContain('Pasa')
    expect(pick.text()).toContain('Inglaterra')
    expect(pick.text()).not.toContain('RD Congo')
  })

  it('T-MP-05: group-stage prediction → no advance pick display', async () => {
    stubFetch([finishedMatch], [lockedPrediction])
    const wrapper = await mountMemberPage()
    expect(wrapper.find('[data-testid="advance-pick-display"]').exists()).toBe(false)
  })
})
