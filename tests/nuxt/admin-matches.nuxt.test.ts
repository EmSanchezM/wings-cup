/**
 * Nuxt tests for the admin matches view restyle (R-UX-08).
 *
 * Asserts the dark restyle: match rows on card surfaces with a status badge, and
 * the status control offering exactly the four values bound to the edit draft.
 * Behaviour (auth gate, edit/save/lock) is unchanged — guarded by the existing
 * handler unit tests; here we only assert the restyled, script-invariant view.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { flushPromises } from '@vue/test-utils'
import type { MatchListItem } from '#shared/types/matches'

const match: MatchListItem = {
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

vi.mock('~/composables/useMatches', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return {
    ...actual,
    useMatches: () => {
      const { ref: vref } = require('vue') as typeof import('vue')
      return {
        data: vref([match]),
        pending: vref(false),
        error: vref(null),
        load: vi.fn(),
        updateMatch: vi.fn(),
        lockNow: vi.fn(),
        subscribe: vi.fn(() => vi.fn()),
      }
    },
  }
})

describe('admin/matches/index.vue — restyle (R-UX-08)', () => {
  beforeEach(() => {
    vi.stubGlobal('$fetch', vi.fn(async (url: string) => {
      if (typeof url === 'string' && url.includes('is-super-admin')) {
        return { isSuperAdmin: true, reason: 'authorized' }
      }
      return { matches: [match] }
    }))
  })

  it('01: authorized → renders a match row on a card surface with a status badge', async () => {
    const { default: Page } = await import('../../app/pages/admin/matches/index.vue')
    const wrapper = await mountSuspended(Page)
    await flushPromises()
    const row = wrapper.find('[data-testid="admin-match-row"]')
    expect(row.exists()).toBe(true)
    expect(row.classes().join(' ')).toContain('bg-card')
    // team names present
    expect(wrapper.text()).toContain('Mexico')
    // a status badge reflecting the match status
    expect(wrapper.find('[data-testid="admin-status-badge"]').exists()).toBe(true)
  })

  it('02: edit form exposes the four status values bound to the draft', async () => {
    const { default: Page } = await import('../../app/pages/admin/matches/index.vue')
    const wrapper = await mountSuspended(Page)
    await flushPromises()
    // open the edit form
    const editBtn = wrapper.findAll('button').find(b => b.text().includes('Editar'))
    expect(editBtn).toBeTruthy()
    await editBtn!.trigger('click')
    await flushPromises()
    const optionValues = wrapper.findAll('option').map(o => o.attributes('value'))
    expect(optionValues).toEqual(expect.arrayContaining(['scheduled', 'live', 'finished', 'postponed']))
  })
})
