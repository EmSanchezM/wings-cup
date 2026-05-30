/**
 * Nuxt structural tests for the MatchPredictionCard restyle (R-UX-07).
 *
 * These are ADDITIVE to predictions.nuxt.test.ts (which still guards behaviour
 * unchanged). They assert the dark redesign: country flags via TeamFlag, a
 * status Badge, a live left accent border, and the removal of the hardcoded
 * light color literals that would break on a dark surface.
 */
import { describe, it, expect } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import type { MatchListItem } from '../../shared/types/matches'

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
}

const liveMatch: MatchListItem = { ...scheduledMatch, id: '33333333-3333-4333-8333-333333333333', status: 'live' }

describe('MatchPredictionCard redesign (R-UX-07)', () => {
  it('01: renders a country flag for each team', async () => {
    const { default: Card } = await import('../../app/components/MatchPredictionCard.vue')
    const wrapper = await mountSuspended(Card, {
      props: { match: scheduledMatch, existingPrediction: null, roomId: ROOM_ID },
    })
    const srcs = wrapper.findAll('img').map((i) => i.attributes('src'))
    expect(srcs).toContain('/flags/mx.svg')
    expect(srcs).toContain('/flags/ec.svg')
  })

  it('02: scheduled match shows a "Pendiente" status badge', async () => {
    const { default: Card } = await import('../../app/components/MatchPredictionCard.vue')
    const wrapper = await mountSuspended(Card, {
      props: { match: scheduledMatch, existingPrediction: null, roomId: ROOM_ID },
    })
    expect(wrapper.html()).toContain('Pendiente')
  })

  it('03: live match has a destructive left accent border', async () => {
    const { default: Card } = await import('../../app/components/MatchPredictionCard.vue')
    const wrapper = await mountSuspended(Card, {
      props: { match: liveMatch, existingPrediction: null, roomId: ROOM_ID },
    })
    const card = wrapper.find('[data-testid="prediction-card"]')
    expect(card.classes().join(' ')).toContain('border-destructive')
  })

  it('04: no hardcoded light color literals remain in the source', async () => {
    const fs = await import('node:fs')
    const path = await import('node:path')
    const src = fs.readFileSync(
      path.resolve(process.cwd(), 'app/components/MatchPredictionCard.vue'),
      'utf-8',
    )
    expect(src).not.toMatch(/bg-yellow-50|bg-red-50|bg-green-50|bg-gray-50/)
  })
})
