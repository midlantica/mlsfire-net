// MLS postseason round metadata.
//
// ESPN tags every scoreboard event with a `season.slug`. During the regular
// season that value is simply `regular-season`, but from mid-October onward it
// carries the exact playoff round, e.g.:
//
//   eastern-conference-playoffs---wild-card
//   western-conference-playoffs---round-one
//   eastern-conference-playoffs---semifinals
//   western-conference-playoffs---final
//   mls-cup
//
// No extra endpoint is needed — the regular scoreboard feed already supplies
// this, so playoff support is presentation-only.

export type Conference = 'East' | 'West'

export interface RoundInfo {
  /** Compact badge text for the match wall, e.g. "RD 1" */
  short: string
  /** Full round name, e.g. "Round One" */
  label: string
  /** Header line shown in the match modal, e.g. "EASTERN CONFERENCE · ROUND ONE" */
  stage: string
  conference: Conference | null
  /** Rank used for emphasis — higher rounds get stronger styling */
  weight: number
}

const ROUND_BY_KEY: Record<string, Omit<RoundInfo, 'conference' | 'stage'>> = {
  'wild-card': { short: 'WILD CARD', label: 'Wild Card', weight: 1 },
  'round-one': { short: 'RD 1', label: 'Round One', weight: 2 },
  semifinals: { short: 'CONF SEMI', label: 'Conference Semifinal', weight: 3 },
  final: { short: 'CONF FINAL', label: 'Conference Final', weight: 4 },
}

// Leagues Cup tags its events with bare, unprefixed slugs. MLS never emits
// these (its playoff slugs are always prefixed with the bracket, and its finale
// is `mls-cup`), so there's no collision and the slug alone is enough to
// identify the round without a separate competition field.
const LEAGUES_CUP_ROUNDS: Record<
  string,
  Omit<RoundInfo, 'conference' | 'stage'>
> = {
  // The icon already marks these as Leagues Cup, so the short label just
  // names the round.
  'league-phase': { short: 'PHASE ONE', label: 'Phase One', weight: 1 },
  quarterfinals: { short: 'QUARTER', label: 'Quarterfinal', weight: 2 },
  semifinals: { short: 'SEMI', label: 'Semifinal', weight: 3 },
  '3rd-place-match': { short: '3RD', label: 'Third Place Match', weight: 3 },
  final: { short: 'FINAL', label: 'Final', weight: 4 },
}

export type Competition = 'MLS' | 'Leagues Cup' | 'All-Star Game'

/**
 * Which competition a match belongs to, derived from its `season.slug`.
 * Across the whole 2025 MLS calendar the only non-MLS one-off is the All-Star
 * Game — everything else is either the regular season or the postseason.
 */
export function getCompetition(seasonSlug?: string | null): Competition {
  if (!seasonSlug) return 'MLS'
  const slug = seasonSlug.toLowerCase()
  if (slug === 'all-star-game') return 'All-Star Game'
  if (slug in LEAGUES_CUP_ROUNDS) return 'Leagues Cup'
  return 'MLS'
}

function conferenceFrom(slug: string): Conference | null {
  if (slug.startsWith('eastern')) return 'East'
  if (slug.startsWith('western')) return 'West'
  return null
}

/**
 * Map an ESPN `season.slug` to display metadata.
 * Returns null for the regular season and anything unrecognised, so callers
 * can treat "no round info" as the normal case.
 */
export function getRoundInfo(seasonSlug?: string | null): RoundInfo | null {
  if (!seasonSlug) return null
  const slug = seasonSlug.toLowerCase()

  if (slug === 'mls-cup') {
    return {
      short: 'MLS CUP',
      label: 'MLS Cup',
      stage: 'MLS CUP FINAL',
      conference: null,
      weight: 5,
    }
  }

  if (!slug.includes('conference-playoffs')) {
    const cup = LEAGUES_CUP_ROUNDS[slug]
    if (!cup) return null
    return {
      ...cup,
      conference: null,
      stage: `LEAGUES CUP · ${cup.label.toUpperCase()}`,
    }
  }

  // Slugs use a triple hyphen as the separator between the bracket and round.
  const key = slug.split('---')[1]
  if (!key) return null

  const round = ROUND_BY_KEY[key]
  if (!round) return null

  const conference = conferenceFrom(slug)
  const stage = conference
    ? `${conference === 'East' ? 'EASTERN' : 'WESTERN'} CONFERENCE · ${round.label.toUpperCase()}`
    : round.label.toUpperCase()

  return { ...round, conference, stage }
}

/**
 * ESPN's team-schedule feed omits `season.slug` but exposes the equivalent as
 * `seasonType.name`, e.g. "Eastern Conference Playoffs - Round One".
 * Convert it to the scoreboard slug form so both feeds share one lookup.
 */
export function slugFromSeasonTypeName(name?: string | null): string | null {
  if (!name) return null
  return name
    .trim()
    .toLowerCase()
    .replace(/\s+-\s+/g, '---')
    .replace(/\s+/g, '-')
}

/**
 * ESPN puts the series state in `competitions[0].notes[0].headline`, e.g.
 * "CIN leads series 1-0", "Series tied 1-1", "PHI win series 2-0",
 * "Vancouver Whitecaps advance 4-3 on penalties".
 *
 * Best-of-three round-one games always carry one; single-leg rounds don't.
 */
export function isSeriesDecided(note?: string | null): boolean {
  if (!note) return false
  return /\bwin series\b|\badvance\b/i.test(note)
}

export type LeaguesCupHeat = 'hot' | 'cool' | 'plain'

const TOP_THIRD = 2 / 3
const LOW_THIRD = 1 / 3

/**
 * Rates a Leagues Cup tie from the weaker side's league-strength percentile,
 * so a giant-vs-minnow pairing never reads as a marquee match.
 * Percentiles are within each club's own league (see /api/club-strength).
 */
export function calcLeaguesCupHeat(
  homePct: number | null,
  awayPct: number | null,
  seasonSlug?: string | null
): LeaguesCupHeat {
  const round = seasonSlug ? LEAGUES_CUP_ROUNDS[seasonSlug.toLowerCase()] : null
  // weight 1 is the league phase; only weight >= 2 is knockout football.
  const isKnockout = !!round && round.weight >= 2

  if (round && round.weight >= 3) return 'hot'
  if (homePct == null || awayPct == null) return isKnockout ? 'cool' : 'plain'

  const weaker = Math.min(homePct, awayPct)
  if (weaker >= TOP_THIRD) return 'hot'
  if (weaker >= LOW_THIRD || isKnockout) return 'cool'
  return 'plain'
}
