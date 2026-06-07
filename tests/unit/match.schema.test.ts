import { describe, it, expect } from 'vitest'
import { MatchSchema, UpdateMatchSchema } from '#shared/schemas/match.schema'

describe('MatchSchema (R-MATCHES-02, R-MATCHES-04)', () => {
  it('accepts a valid scheduled match row', () => {
    const result = MatchSchema.parse({
      id: '11111111-1111-4111-8111-111111111111',
      external_id: 'fifa26-001',
      home_team: 'Mexico',
      away_team: 'Ecuador',
      stage: 'group',
      group_name: 'A',
      kickoff_at: '2026-06-11T20:00:00Z',
      status: 'scheduled',
      home_score: null,
      away_score: null,
      created_at: '2026-05-17T00:00:00Z',
    })
    expect(result.home_team).toBe('Mexico')
  })

  it('accepts a finished match with non-null scores', () => {
    const result = MatchSchema.parse({
      id: '22222222-2222-4222-8222-222222222222',
      external_id: 'fifa26-002',
      home_team: 'Argentina',
      away_team: 'Brazil',
      stage: 'final',
      group_name: null,
      kickoff_at: '2026-07-19T23:00:00Z',
      status: 'finished',
      home_score: 1,
      away_score: 0,
      created_at: '2026-05-17T00:00:00Z',
    })
    expect(result.status).toBe('finished')
  })

  it('rejects invalid stage value', () => {
    expect(() =>
      MatchSchema.parse({
        id: '33333333-3333-4333-8333-333333333333',
        external_id: null,
        home_team: 'A',
        away_team: 'B',
        stage: 'group_stage',
        group_name: 'A',
        kickoff_at: '2026-06-11T20:00:00Z',
        status: 'scheduled',
        home_score: null,
        away_score: null,
        created_at: '2026-05-17T00:00:00Z',
      }),
    ).toThrow()
  })
})

describe('UpdateMatchSchema (R-MATCHES-04)', () => {
  it('accepts a partial update with only status=finished and scores', () => {
    const result = UpdateMatchSchema.parse({
      status: 'finished',
      home_score: 3,
      away_score: 1,
    })
    expect(result.home_score).toBe(3)
    expect(result.away_score).toBe(1)
  })

  it('accepts a partial update with only scores (no status)', () => {
    const result = UpdateMatchSchema.parse({
      home_score: 2,
      away_score: 1,
    })
    expect(result.home_score).toBe(2)
    expect(result.status).toBeUndefined()
  })

  it('rejects invalid stage value', () => {
    expect(() =>
      UpdateMatchSchema.parse({ stage: 'group_stage' }),
    ).toThrow()
  })

  it('rejects string score', () => {
    expect(() =>
      UpdateMatchSchema.parse({ home_score: 'two' }),
    ).toThrow()
  })

  it('rejects status=finished when scores are missing', () => {
    expect(() =>
      UpdateMatchSchema.parse({ status: 'finished' }),
    ).toThrow()
  })

  it('accepts status=finished with both scores provided', () => {
    const result = UpdateMatchSchema.parse({
      status: 'finished',
      home_score: 0,
      away_score: 0,
    })
    expect(result.status).toBe('finished')
  })

  it('accepts empty object (all fields optional)', () => {
    const result = UpdateMatchSchema.parse({})
    expect(result).toEqual({})
  })
})
