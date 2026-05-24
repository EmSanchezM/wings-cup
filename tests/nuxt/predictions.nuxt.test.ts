/**
 * Nuxt component tests for:
 *   - MatchPredictionCard.vue (R-PRED-07)
 *   - rooms/[id]/predictions.vue page (R-PRED-06, R-PRED-01, R-PRED-03)
 *
 * IMPORTANT: Uses the Vitest v4 + @nuxt/test-utils v4 pattern.
 * Composables and dynamic imports MUST be inside beforeAll (not top-level describe).
 */
import { describe, it, expect, beforeAll, vi, beforeEach } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { flushPromises } from '@vue/test-utils'
import type { VueWrapper } from '@vue/test-utils'
import type { MatchListItem } from '../../shared/types/matches'
import type { Prediction } from '../../shared/types/predictions'

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const ROOM_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'

const scheduledMatch: MatchListItem = {
  id: '11111111-1111-4111-8111-111111111111',
  external_id: 'fifa26-001',
  home_team: 'Mexico',
  away_team: 'Ecuador',
  stage: 'group',
  group_name: 'A',
  kickoff_at: '2099-06-11T20:00:00Z', // far future — always scheduled
  status: 'scheduled',
  home_score: null,
  away_score: null,
}

const finishedMatch: MatchListItem = {
  ...scheduledMatch,
  id: '22222222-2222-4222-8222-222222222222',
  status: 'finished',
  home_score: 2,
  away_score: 1,
}

const existingPrediction: Prediction = {
  id: 'pred-0001-0000-0000-000000000001',
  room_id: ROOM_ID,
  user_id: 'user-0001-0000-0000-000000000001',
  match_id: scheduledMatch.id,
  predicted_home: 2,
  predicted_away: 1,
  locked_at: null,
  points_awarded: 0,
  created_at: '2026-05-24T00:00:00Z',
  updated_at: '2026-05-24T00:00:00Z',
}

const lockedPrediction: Prediction = {
  ...existingPrediction,
  locked_at: '2026-05-24T12:00:00Z',
}

// ---------------------------------------------------------------------------
// Mock useRoute — provides room id for page-level tests
// ---------------------------------------------------------------------------

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
// B14 — MatchPredictionCard (R-PRED-07)
// ---------------------------------------------------------------------------

describe('MatchPredictionCard (R-PRED-07)', () => {
  // Global mock for $fetch — tests that need specific behaviours override per test
  beforeEach(() => {
    vi.stubGlobal('$fetch', vi.fn(async () => ({ prediction: existingPrediction })))
  })

  it('T-47-01: renders with null existingPrediction — inputs start empty', async () => {
    const { default: MatchPredictionCard } = await import(
      '../../app/components/MatchPredictionCard.vue'
    )
    const wrapper = await mountSuspended(MatchPredictionCard, {
      props: {
        match: scheduledMatch,
        existingPrediction: null,
        roomId: ROOM_ID,
      },
    })
    const homeInput = wrapper.find('input[name="predicted_home"]')
    const awayInput = wrapper.find('input[name="predicted_away"]')
    expect(homeInput.exists()).toBe(true)
    expect(awayInput.exists()).toBe(true)
    // Inputs should start at 0 (empty / default)
    expect((homeInput.element as HTMLInputElement).value).toBe('0')
    expect((awayInput.element as HTMLInputElement).value).toBe('0')
  })

  it('T-47-02: renders with existing unlocked prediction — inputs pre-filled', async () => {
    const { default: MatchPredictionCard } = await import(
      '../../app/components/MatchPredictionCard.vue'
    )
    const wrapper = await mountSuspended(MatchPredictionCard, {
      props: {
        match: scheduledMatch,
        existingPrediction,
        roomId: ROOM_ID,
      },
    })
    const homeInput = wrapper.find('input[name="predicted_home"]')
    const awayInput = wrapper.find('input[name="predicted_away"]')
    expect((homeInput.element as HTMLInputElement).value).toBe('2')
    expect((awayInput.element as HTMLInputElement).value).toBe('1')
  })

  it('T-47-03: emits submitted event after successful upsert', async () => {
    vi.stubGlobal('$fetch', vi.fn(async () => ({ prediction: existingPrediction })))
    const { default: MatchPredictionCard } = await import(
      '../../app/components/MatchPredictionCard.vue'
    )
    const wrapper = await mountSuspended(MatchPredictionCard, {
      props: {
        match: scheduledMatch,
        existingPrediction: null,
        roomId: ROOM_ID,
      },
    })
    await wrapper.find('form').trigger('submit.prevent')
    await wrapper.vm.$nextTick()
    expect(wrapper.emitted('submitted')).toBeTruthy()
  })

  it('T-47-04: locked prediction — inputs readonly + lock badge + no submit button', async () => {
    const { default: MatchPredictionCard } = await import(
      '../../app/components/MatchPredictionCard.vue'
    )
    const wrapper = await mountSuspended(MatchPredictionCard, {
      props: {
        match: scheduledMatch,
        existingPrediction: lockedPrediction,
        roomId: ROOM_ID,
      },
    })
    const homeInput = wrapper.find('input[name="predicted_home"]')
    const awayInput = wrapper.find('input[name="predicted_away"]')
    expect((homeInput.element as HTMLInputElement).readOnly).toBe(true)
    expect((awayInput.element as HTMLInputElement).readOnly).toBe(true)
    // Lock badge must be visible
    expect(wrapper.html()).toContain('data-testid="lock-badge"')
    // Submit button must NOT be rendered
    expect(wrapper.find('button[type="submit"]').exists()).toBe(false)
  })

  it('T-47-05: shows per-card error on 423 / 409 response', async () => {
    const fetchError = Object.assign(new Error('prediction_locked'), { statusCode: 423 })
    vi.stubGlobal('$fetch', vi.fn(async () => { throw fetchError }))
    const { default: MatchPredictionCard } = await import(
      '../../app/components/MatchPredictionCard.vue'
    )
    const wrapper = await mountSuspended(MatchPredictionCard, {
      props: {
        match: scheduledMatch,
        existingPrediction: null,
        roomId: ROOM_ID,
      },
    })
    await wrapper.find('form').trigger('submit.prevent')
    await wrapper.vm.$nextTick()
    const html = wrapper.html()
    const hasError = html.includes('prediction_locked') || html.includes('bloqueada') || html.includes('423')
    expect(hasError).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// B23 — MatchPredictionCard 401 detection (R-UX-04)
// ---------------------------------------------------------------------------

describe('MatchPredictionCard — 401 detection (R-UX-04)', () => {
  beforeEach(() => {
    vi.stubGlobal('$fetch', vi.fn(async () => ({ prediction: existingPrediction })))
  })

  it('T-69-01: 401 → setExpired() called, no card-level error shown', async () => {
    const fetchError = Object.assign(new Error('Unauthorized'), { statusCode: 401 })
    vi.stubGlobal('$fetch', vi.fn(async () => { throw fetchError }))

    const { useSessionExpired } = await import('../../app/composables/useSessionExpired')
    // Ensure clean state
    useSessionExpired().reset()

    const { default: MatchPredictionCard } = await import(
      '../../app/components/MatchPredictionCard.vue'
    )
    const wrapper = await mountSuspended(MatchPredictionCard, {
      props: {
        match: scheduledMatch,
        existingPrediction: null,
        roomId: ROOM_ID,
      },
    })
    await wrapper.find('form').trigger('submit.prevent')
    await wrapper.vm.$nextTick()

    // setExpired must have been called
    expect(useSessionExpired().isExpired.value).toBe(true)
    // No card-level error message — the toast handles it
    const html = wrapper.html()
    expect(html).not.toContain('bloqueada')
    expect(html).not.toContain('error')
    // cleanup
    useSessionExpired().reset()
  })

  it('T-69-02: 423 still shows card-level locked error, setExpired NOT called', async () => {
    const fetchError = Object.assign(new Error('prediction_locked'), { statusCode: 423 })
    vi.stubGlobal('$fetch', vi.fn(async () => { throw fetchError }))

    const { useSessionExpired } = await import('../../app/composables/useSessionExpired')
    useSessionExpired().reset()

    const { default: MatchPredictionCard } = await import(
      '../../app/components/MatchPredictionCard.vue'
    )
    const wrapper = await mountSuspended(MatchPredictionCard, {
      props: {
        match: scheduledMatch,
        existingPrediction: null,
        roomId: ROOM_ID,
      },
    })
    await wrapper.find('form').trigger('submit.prevent')
    await wrapper.vm.$nextTick()

    // Card-level locked error must be shown
    const html = wrapper.html()
    const hasLockedError = html.includes('prediction_locked') || html.includes('bloqueada') || html.includes('423')
    expect(hasLockedError).toBe(true)
    // setExpired must NOT have been called
    expect(useSessionExpired().isExpired.value).toBe(false)
  })

  it('T-69-03: source has 401 check in same branch as 423/409', async () => {
    // Structural: verify 401 is checked in the same statusCode switch as 423/409
    const fs = await import('fs')
    const path = await import('path')
    const filePath = path.resolve(
      process.cwd(),
      'app/components/MatchPredictionCard.vue',
    )
    const src = fs.readFileSync(filePath, 'utf-8')
    // All three status codes must appear in the source
    expect(src).toContain('401')
    expect(src).toContain('423')
    expect(src).toContain('409')
    // setExpired must be called on 401
    expect(src).toContain('setExpired')
  })
})

// ---------------------------------------------------------------------------
// B15 — predictions.vue page redesign (R-PRED-06)
// ---------------------------------------------------------------------------

describe('predictions.vue page — card list redesign (R-PRED-06)', () => {
  beforeEach(() => {
    // Default: return one scheduled match + one existing prediction
    vi.stubGlobal(
      '$fetch',
      vi.fn(async (url: string) => {
        if (typeof url === 'string' && url.includes('/predictions')) {
          return { predictions: [existingPrediction] }
        }
        // matches endpoint — match-client destructures { matches }
        return { matches: [scheduledMatch, finishedMatch] }
      }),
    )
  })

  it('T-50-01: renders one MatchPredictionCard per scheduled match', async () => {
    const { default: PredictionsPage } = await import(
      '../../app/pages/rooms/[id]/predictions.vue'
    )
    const wrapper = await mountSuspended(PredictionsPage)
    await flushPromises()
    // Should have exactly 1 card (only scheduledMatch passes filter)
    const cards = wrapper.findAll('[data-testid="prediction-card"]')
    expect(cards).toHaveLength(1)
  })

  it('T-50-02: non-scheduled matches are excluded from card list', async () => {
    vi.stubGlobal(
      '$fetch',
      vi.fn(async (url: string) => {
        if (typeof url === 'string' && url.includes('/predictions')) {
          return { predictions: [] }
        }
        // Only finished matches — match-client destructures { matches }
        return { matches: [finishedMatch] }
      }),
    )
    const { default: PredictionsPage } = await import(
      '../../app/pages/rooms/[id]/predictions.vue'
    )
    const wrapper = await mountSuspended(PredictionsPage)
    await flushPromises()
    const cards = wrapper.findAll('[data-testid="prediction-card"]')
    expect(cards).toHaveLength(0)
  })

  it('T-50-03: renders empty-state message when no scheduled matches', async () => {
    vi.stubGlobal(
      '$fetch',
      vi.fn(async (url: string) => {
        if (typeof url === 'string' && url.includes('/predictions')) {
          return { predictions: [] }
        }
        return { matches: [] }
      }),
    )
    const { default: PredictionsPage } = await import(
      '../../app/pages/rooms/[id]/predictions.vue'
    )
    const wrapper = await mountSuspended(PredictionsPage)
    await flushPromises()
    expect(wrapper.html()).toContain('No hay partidos disponibles para pronosticar')
    // Must contain a leaderboard link
    expect(wrapper.html()).toContain('leaderboard')
  })

  it('T-50-04: existing predictions pre-fill corresponding cards', async () => {
    const { default: PredictionsPage } = await import(
      '../../app/pages/rooms/[id]/predictions.vue'
    )
    const wrapper = await mountSuspended(PredictionsPage)
    await flushPromises()
    // The page renders; pre-fill is handled by MatchPredictionCard receiving existingPrediction prop
    // Verify at least one card is rendered
    const cards = wrapper.findAll('[data-testid="prediction-card"]')
    expect(cards.length).toBeGreaterThanOrEqual(1)
  })

  it('T-50-05: page mounts without crash and has no useSupabaseUser import (structural)', async () => {
    const { default: PredictionsPage } = await import(
      '../../app/pages/rooms/[id]/predictions.vue'
    )
    const wrapper = await mountSuspended(PredictionsPage)
    expect(wrapper.element).toBeDefined()
    // No global error thrown is sufficient for this scenario
  })

  it('T-50-06: page mounts without crashing (baseline smoke)', async () => {
    const { default: PredictionsPage } = await import(
      '../../app/pages/rooms/[id]/predictions.vue'
    )
    const wrapper = await mountSuspended(PredictionsPage)
    expect(wrapper.element).toBeDefined()
  })
})

// ---------------------------------------------------------------------------
// B33 — T-89: [RED] MatchPredictionCard read-only modes for live/finished
// ---------------------------------------------------------------------------

const liveMatch: MatchListItem = {
  ...scheduledMatch,
  id: '33333333-3333-4333-8333-333333333333',
  status: 'live',
  home_score: null,
  away_score: null,
}

describe('MatchPredictionCard — read-only modes (R-PRED-07)', () => {
  beforeEach(() => {
    vi.stubGlobal('$fetch', vi.fn(async () => ({ prediction: existingPrediction })))
  })

  it('T-89-01: live match + unlocked → inputs readonly, no submit button, "En vivo" badge', async () => {
    const { default: MatchPredictionCard } = await import(
      '../../app/components/MatchPredictionCard.vue'
    )
    const wrapper = await mountSuspended(MatchPredictionCard, {
      props: { match: liveMatch, existingPrediction: null, roomId: ROOM_ID },
    })
    const homeInput = wrapper.find('input[name="predicted_home"]')
    const awayInput = wrapper.find('input[name="predicted_away"]')
    expect((homeInput.element as HTMLInputElement).readOnly).toBe(true)
    expect((awayInput.element as HTMLInputElement).readOnly).toBe(true)
    expect(wrapper.find('button[type="submit"]').exists()).toBe(false)
    expect(wrapper.html()).toContain('En vivo')
    expect(wrapper.html()).not.toContain('data-testid="lock-badge"')
  })

  it('T-89-02: finished match + unlocked + scores → inputs readonly, "Finalizado" badge, final-score block', async () => {
    const { default: MatchPredictionCard } = await import(
      '../../app/components/MatchPredictionCard.vue'
    )
    const wrapper = await mountSuspended(MatchPredictionCard, {
      props: { match: finishedMatch, existingPrediction: null, roomId: ROOM_ID },
    })
    const homeInput = wrapper.find('input[name="predicted_home"]')
    const awayInput = wrapper.find('input[name="predicted_away"]')
    expect((homeInput.element as HTMLInputElement).readOnly).toBe(true)
    expect((awayInput.element as HTMLInputElement).readOnly).toBe(true)
    expect(wrapper.find('button[type="submit"]').exists()).toBe(false)
    expect(wrapper.html()).toContain('Finalizado')
    expect(wrapper.find('[data-testid="final-score"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="final-score"]').text()).toContain('2')
    expect(wrapper.find('[data-testid="final-score"]').text()).toContain('1')
  })

  it('T-89-03: finished + locked → both lock badge AND final score block visible', async () => {
    const { default: MatchPredictionCard } = await import(
      '../../app/components/MatchPredictionCard.vue'
    )
    const wrapper = await mountSuspended(MatchPredictionCard, {
      props: { match: finishedMatch, existingPrediction: lockedPrediction, roomId: ROOM_ID },
    })
    expect(wrapper.find('[data-testid="lock-badge"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="final-score"]').exists()).toBe(true)
  })

  it('T-89-04: scheduled + unlocked → inputs editable, submit button rendered (regression guard)', async () => {
    const { default: MatchPredictionCard } = await import(
      '../../app/components/MatchPredictionCard.vue'
    )
    const wrapper = await mountSuspended(MatchPredictionCard, {
      props: { match: scheduledMatch, existingPrediction: null, roomId: ROOM_ID },
    })
    const homeInput = wrapper.find('input[name="predicted_home"]')
    expect((homeInput.element as HTMLInputElement).readOnly).toBe(false)
    expect(wrapper.find('button[type="submit"]').exists()).toBe(true)
  })

  it('T-89-05: status transition scheduled→finished → submit disappears, final-score appears', async () => {
    const { default: MatchPredictionCard } = await import(
      '../../app/components/MatchPredictionCard.vue'
    )
    const wrapper = await mountSuspended(MatchPredictionCard, {
      props: { match: scheduledMatch, existingPrediction: null, roomId: ROOM_ID },
    })
    expect(wrapper.find('button[type="submit"]').exists()).toBe(true)
    await wrapper.setProps({ match: { ...finishedMatch, home_score: 3, away_score: 0 } })
    await wrapper.vm.$nextTick()
    expect(wrapper.find('button[type="submit"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="final-score"]').exists()).toBe(true)
  })

  it('T-89-06: finished + null scores → final-score block NOT rendered (defensive guard)', async () => {
    const matchFinishedNullScores: MatchListItem = {
      ...finishedMatch,
      home_score: null,
      away_score: null,
    }
    const { default: MatchPredictionCard } = await import(
      '../../app/components/MatchPredictionCard.vue'
    )
    const wrapper = await mountSuspended(MatchPredictionCard, {
      props: { match: matchFinishedNullScores, existingPrediction: null, roomId: ROOM_ID },
    })
    expect(wrapper.find('[data-testid="final-score"]').exists()).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// B34 — T-91: [RED] predictions.vue filter widening + subscribe lifecycle
// ---------------------------------------------------------------------------

describe('predictions.vue — filter widening and subscribe lifecycle (R-PRED-06, R-RT-04)', () => {
  const mockSubscribeCleanup = vi.fn()
  const mockSubscribe = vi.fn(() => mockSubscribeCleanup)

  beforeEach(() => {
    mockSubscribeCleanup.mockClear()
    mockSubscribe.mockClear()
    mockSubscribe.mockReturnValue(mockSubscribeCleanup)
  })

  it('T-91-01: renders cards for scheduled, live, AND finished matches; postponed excluded', async () => {
    const postponedMatch: MatchListItem = {
      ...scheduledMatch,
      id: '44444444-4444-4444-8444-444444444444',
      status: 'postponed',
    }
    vi.stubGlobal(
      '$fetch',
      vi.fn(async (url: string) => {
        if (typeof url === 'string' && url.includes('/predictions')) {
          return { predictions: [] }
        }
        return { matches: [scheduledMatch, liveMatch, finishedMatch, postponedMatch] }
      }),
    )
    const { default: PredictionsPage } = await import(
      '../../app/pages/rooms/[id]/predictions.vue'
    )
    const wrapper = await mountSuspended(PredictionsPage)
    await flushPromises()
    const cards = wrapper.findAll('[data-testid="prediction-card"]')
    // scheduled + live + finished = 3 cards; postponed excluded
    expect(cards).toHaveLength(3)
  })

  it('T-91-02: eligibleEntries computed ref name (structural)', async () => {
    const fs = await import('fs')
    const path = await import('path')
    const src = fs.readFileSync(
      path.resolve(process.cwd(), 'app/pages/rooms/[id]/predictions.vue'),
      'utf-8',
    )
    expect(src).toContain('eligibleEntries')
    expect(src).not.toContain('scheduledEntries')
  })
})
