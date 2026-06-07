/**
 * Unit tests for the team → flag mapping (flags feature).
 *
 * Our match data stores country NAMES (home_team/away_team) in Spanish, so a
 * single source-of-truth maps name → ISO code → /flags/{code}.svg. Knockout
 * placeholders ("2do A", "Ganador P73") have no flag and MUST resolve to null
 * so the UI can fall back to initials.
 *
 * Scenarios:
 *   01: known country resolves to its ISO code and /flags path
 *   02: England (Inglaterra) maps to the gb-eng subdivision flag
 *   03: every group-stage country in the map has a code
 *   04: knockout placeholders resolve to null (no flag)
 *   05: initials fallback derives up to 2 uppercase letters
 */
import { describe, it, expect } from 'vitest'
import { flagCode, flagSrc, teamInitials, TEAM_FLAG_CODES } from '#shared/constants/team-flags'

describe('team-flags mapping', () => {
  it('01: known country resolves to ISO code and /flags path', () => {
    expect(flagCode('Argentina')).toBe('ar')
    expect(flagSrc('Argentina')).toBe('/flags/ar.svg')
    expect(flagSrc('Brasil')).toBe('/flags/br.svg')
  })

  it('02: Inglaterra maps to the gb-eng subdivision flag', () => {
    expect(flagCode('Inglaterra')).toBe('gb-eng')
    expect(flagSrc('Inglaterra')).toBe('/flags/gb-eng.svg')
  })

  it('03: all 48 group-stage participants have a code', () => {
    const participants = [
      'Mexico', 'Sudafrica', 'Corea del Sur', 'Chequia',
      'Canada', 'Bosnia y Herzegovina', 'Suiza', 'Qatar',
      'Brasil', 'Marruecos', 'Haiti', 'Escocia',
      'Estados Unidos', 'Paraguay', 'Australia', 'Turquia',
      'Alemania', 'Curazao', 'Costa de Marfil', 'Ecuador',
      'Paises Bajos', 'Japon', 'Suecia', 'Tunez',
      'Belgica', 'Egipto', 'Iran', 'Nueva Zelanda',
      'Espana', 'Cabo Verde', 'Arabia Saudita', 'Uruguay',
      'Francia', 'Senegal', 'Irak', 'Noruega',
      'Argentina', 'Argelia', 'Austria', 'Jordania',
      'Portugal', 'RD Congo', 'Uzbekistan', 'Colombia',
      'Inglaterra', 'Croacia', 'Ghana', 'Panama',
    ]
    expect(participants).toHaveLength(48)
    for (const team of participants) {
      expect(TEAM_FLAG_CODES[team], `missing code for ${team}`).toBeTruthy()
      expect(flagSrc(team)).toMatch(/^\/flags\/[a-z-]+\.svg$/)
    }
  })

  it('04: knockout placeholders resolve to null', () => {
    expect(flagCode('2do A')).toBeNull()
    expect(flagSrc('2do A')).toBeNull()
    expect(flagCode('Ganador P73')).toBeNull()
    expect(flagSrc('Perdedor P101')).toBeNull()
  })

  it('05: teamInitials derives up to 2 uppercase letters', () => {
    expect(teamInitials('Argentina')).toBe('AR')
    expect(teamInitials('Costa de Marfil')).toBe('CD')
    expect(teamInitials('Ganador P73')).toBe('GP')
  })
})
