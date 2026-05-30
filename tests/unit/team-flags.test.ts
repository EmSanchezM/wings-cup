/**
 * Unit tests for the team → flag mapping (flags feature).
 *
 * Our match data stores country NAMES (home_team/away_team), so a single
 * source-of-truth maps name → ISO code → /flags/{code}.svg. Knockout
 * placeholders ("Group A Winner", "Winner Match 49") have no flag and MUST
 * resolve to null so the UI can fall back to initials.
 *
 * Scenarios:
 *   01: known country resolves to its ISO code and /flags path
 *   02: England maps to the gb-eng subdivision flag
 *   03: every group-stage country in the map has a code
 *   04: knockout placeholders resolve to null (no flag)
 *   05: initials fallback derives up to 2 uppercase letters
 */
import { describe, it, expect } from 'vitest'
import { flagCode, flagSrc, teamInitials, TEAM_FLAG_CODES } from '../../shared/constants/team-flags'

describe('team-flags mapping', () => {
  it('01: known country resolves to ISO code and /flags path', () => {
    expect(flagCode('Argentina')).toBe('ar')
    expect(flagSrc('Argentina')).toBe('/flags/ar.svg')
    expect(flagSrc('Brazil')).toBe('/flags/br.svg')
  })

  it('02: England maps to the gb-eng subdivision flag', () => {
    expect(flagCode('England')).toBe('gb-eng')
    expect(flagSrc('England')).toBe('/flags/gb-eng.svg')
  })

  it('03: all 32 group-stage participants have a code', () => {
    const participants = [
      'Mexico', 'Ecuador', 'USA', 'Canada',
      'Argentina', 'Peru', 'Chile', 'Bolivia',
      'Brazil', 'Venezuela', 'Colombia', 'Paraguay',
      'France', 'Australia', 'Belgium', 'New Zealand',
      'Germany', 'Japan', 'Spain', 'Costa Rica',
      'Portugal', 'Algeria', 'Morocco', 'Senegal',
      'England', 'Serbia', 'Netherlands', 'Ukraine',
      'Italy', 'Saudi Arabia', 'South Korea', 'Iran',
    ]
    for (const team of participants) {
      expect(TEAM_FLAG_CODES[team], `missing code for ${team}`).toBeTruthy()
      expect(flagSrc(team)).toMatch(/^\/flags\/[a-z-]+\.svg$/)
    }
  })

  it('04: knockout placeholders resolve to null', () => {
    expect(flagCode('Group A Winner')).toBeNull()
    expect(flagSrc('Group A Winner')).toBeNull()
    expect(flagCode('Winner Match 49')).toBeNull()
    expect(flagSrc('Loser Match 61')).toBeNull()
  })

  it('05: teamInitials derives up to 2 uppercase letters', () => {
    expect(teamInitials('Argentina')).toBe('AR')
    expect(teamInitials('Costa Rica')).toBe('CR')
    expect(teamInitials('Group A Winner')).toBe('GA')
  })
})
