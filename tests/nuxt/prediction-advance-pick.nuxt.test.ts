/**
 * Nuxt structural tests for the knockout tiebreak pick on MatchPredictionCard.
 *
 * A knockout fixture can end level and be decided on penalties, which still has
 * a winner. The card exposes a "who advances" pick (stored as the side) that
 * powers the +1 bonus. Group-stage matches draw legitimately and must NOT show
 * the control.
 */
import { describe, it, expect } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import type { MatchListItem } from '#shared/types/matches'
import type { Prediction } from '#shared/types/predictions'

const ROOM_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'

const groupMatch: MatchListItem = {
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

const knockoutMatch: MatchListItem = {
  ...groupMatch,
  id: '22222222-2222-4222-8222-222222222222',
  external_id: 'fifa26-057',
  stage: 'round_of_16',
  group_name: null,
}

describe('MatchPredictionCard knockout advance pick', () => {
  it('01: hides the advance pick for group-stage matches', async () => {
    const { default: Card } = await import('../../app/components/MatchPredictionCard.vue')
    const wrapper = await mountSuspended(Card, {
      props: { match: groupMatch, existingPrediction: null, roomId: ROOM_ID },
    })
    expect(wrapper.find('[data-testid="advance-pick"]').exists()).toBe(false)
  })

  it('02: shows the advance pick with both teams for knockout matches', async () => {
    const { default: Card } = await import('../../app/components/MatchPredictionCard.vue')
    const wrapper = await mountSuspended(Card, {
      props: { match: knockoutMatch, existingPrediction: null, roomId: ROOM_ID },
    })
    const pick = wrapper.find('[data-testid="advance-pick"]')
    expect(pick.exists()).toBe(true)
    expect(pick.findAll('input[type="radio"]')).toHaveLength(2)
    expect(pick.html()).toContain('Mexico')
    expect(pick.html()).toContain('Ecuador')
  })

  it('03: pre-selects the side from an existing prediction', async () => {
    const existing = {
      id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      room_id: ROOM_ID,
      user_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      match_id: knockoutMatch.id,
      predicted_home: 1,
      predicted_away: 1,
      predicted_advances: 'away',
      points_awarded: 0,
      locked_at: null,
      created_at: '2026-06-01T00:00:00Z',
      updated_at: '2026-06-01T00:00:00Z',
    } as unknown as Prediction

    const { default: Card } = await import('../../app/components/MatchPredictionCard.vue')
    const wrapper = await mountSuspended(Card, {
      props: { match: knockoutMatch, existingPrediction: existing, roomId: ROOM_ID },
    })
    const awayRadio = wrapper.find('input[type="radio"][value="away"]')
    expect((awayRadio.element as HTMLInputElement).checked).toBe(true)
  })
})
