/**
 * Source of truth: World Cup 2026 country name → ISO 3166-1 alpha-2 code.
 *
 * Match data stores country NAMES (matches.home_team/away_team), not codes,
 * so this map is the single place that bridges name → flag asset. Flags are
 * vendored SVGs in `public/flags/{code}.svg` (circle-flags, MIT).
 *
 * Keys MUST match the exact names used in `supabase/seeds/matches.sql`.
 * Knockout placeholders ("Group A Winner", "Winner Match 49", "Loser Match 61")
 * are intentionally absent — they have no country, so the UI falls back to
 * initials. Add a key here when a new participant name enters the data.
 */
export const TEAM_FLAG_CODES: Record<string, string> = {
  // Group A
  Mexico: 'mx',
  Ecuador: 'ec',
  USA: 'us',
  Canada: 'ca',
  // Group B
  Argentina: 'ar',
  Peru: 'pe',
  Chile: 'cl',
  Bolivia: 'bo',
  // Group C
  Brazil: 'br',
  Venezuela: 've',
  Colombia: 'co',
  Paraguay: 'py',
  // Group D
  France: 'fr',
  Australia: 'au',
  Belgium: 'be',
  'New Zealand': 'nz',
  // Group E
  Germany: 'de',
  Japan: 'jp',
  Spain: 'es',
  'Costa Rica': 'cr',
  // Group F
  Portugal: 'pt',
  Algeria: 'dz',
  Morocco: 'ma',
  Senegal: 'sn',
  // Group G
  England: 'gb-eng',
  Serbia: 'rs',
  Netherlands: 'nl',
  Ukraine: 'ua',
  // Group H
  Italy: 'it',
  'Saudi Arabia': 'sa',
  'South Korea': 'kr',
  Iran: 'ir',
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
