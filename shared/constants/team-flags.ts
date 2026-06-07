/**
 * Source of truth: World Cup 2026 country name (Spanish) → ISO 3166-1 alpha-2 code.
 *
 * Match data stores country NAMES (matches.home_team/away_team) in Spanish, so
 * this map is the single place that bridges name → flag asset. Flags are
 * vendored SVGs in `public/flags/{code}.svg` (circle-flags, MIT).
 *
 * Keys MUST match the exact names used in `supabase/seeds/matches.sql`.
 * Knockout placeholders ("2do A", "1ro E", "Ganador P73", "Perdedor P101")
 * are intentionally absent — they have no country, so the UI falls back to
 * initials. Add a key here when a new participant name enters the data.
 *
 * 48 teams across 12 groups (A–L), per the December 2025 final draw.
 */
export const TEAM_FLAG_CODES: Record<string, string> = {
  // Grupo A
  Mexico: 'mx',
  Sudafrica: 'za',
  'Corea del Sur': 'kr',
  Chequia: 'cz',
  // Grupo B
  Canada: 'ca',
  'Bosnia y Herzegovina': 'ba',
  Suiza: 'ch',
  Qatar: 'qa',
  // Grupo C
  Brasil: 'br',
  Marruecos: 'ma',
  Haiti: 'ht',
  Escocia: 'gb-sct',
  // Grupo D
  'Estados Unidos': 'us',
  Paraguay: 'py',
  Australia: 'au',
  Turquia: 'tr',
  // Grupo E
  Alemania: 'de',
  Curazao: 'cw',
  'Costa de Marfil': 'ci',
  Ecuador: 'ec',
  // Grupo F
  'Paises Bajos': 'nl',
  Japon: 'jp',
  Suecia: 'se',
  Tunez: 'tn',
  // Grupo G
  Belgica: 'be',
  Egipto: 'eg',
  Iran: 'ir',
  'Nueva Zelanda': 'nz',
  // Grupo H
  Espana: 'es',
  'Cabo Verde': 'cv',
  'Arabia Saudita': 'sa',
  Uruguay: 'uy',
  // Grupo I
  Francia: 'fr',
  Senegal: 'sn',
  Irak: 'iq',
  Noruega: 'no',
  // Grupo J
  Argentina: 'ar',
  Argelia: 'dz',
  Austria: 'at',
  Jordania: 'jo',
  // Grupo K
  Portugal: 'pt',
  'RD Congo': 'cd',
  Uzbekistan: 'uz',
  Colombia: 'co',
  // Grupo L
  Inglaterra: 'gb-eng',
  Croacia: 'hr',
  Ghana: 'gh',
  Panama: 'pa',
}

/** ISO code for a team name, or null when the name has no flag (knockout placeholder / unknown). */
export function flagCode(team: string): string | null {
  return TEAM_FLAG_CODES[team] ?? null
}

/** Public path to the team's flag SVG, or null when there is no flag. */
export function flagSrc(team: string): string | null {
  const code = flagCode(team)
  return code ? `/flags/${code}.svg` : null
}

/** Up to two uppercase letters for the initials fallback when no flag exists. */
export function teamInitials(team: string): string {
  const words = team.trim().split(/\s+/).filter(Boolean)
  if (words.length >= 2) {
    return (words[0]![0]! + words[1]![0]!).toUpperCase()
  }
  return (words[0] ?? '').slice(0, 2).toUpperCase()
}
