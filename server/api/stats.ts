/**
 * GET /api/stats
 *
 * Returns top-10 MLS season leaders for Goals, Assists, Accurate Passes, Saves,
 * Yellow Cards, and Red Cards.
 * Fetches ESPN Core API, resolves athlete $ref links in parallel,
 * and caches the result for 1 hour.
 */

interface LeaderEntry {
  rank: number
  athleteId: string
  displayName: string
  team: string
  headshot: string
  value: number
}

interface StatsResponse {
  goals: LeaderEntry[]
  assists: LeaderEntry[]
  accuratePasses: LeaderEntry[]
  saves: LeaderEntry[]
  yellowCards: LeaderEntry[]
  redCards: LeaderEntry[]
}

// ── In-memory cache ───────────────────────────────────────────────────────────
let cache: StatsResponse | null = null
let cacheTime = 0
const CACHE_TTL = 60 * 60 * 1000 // 1 hour

// ── ESPN team ID → display name (reverse lookup) ──────────────────────────────
// We'll resolve team names from the athlete ref's team data
const ESPN_TEAM_ID_TO_NAME: Record<string, string> = {
  '18418': 'Atlanta United FC',
  '20906': 'Austin FC',
  '9720': 'CF Montréal',
  '21300': 'Charlotte FC',
  '182': 'Chicago Fire FC',
  '184': 'Colorado Rapids',
  '183': 'Columbus Crew',
  '193': 'D.C. United',
  '18267': 'FC Cincinnati',
  '185': 'FC Dallas',
  '6077': 'Houston Dynamo FC',
  '20232': 'Inter Miami CF',
  '187': 'LA Galaxy',
  '18966': 'LAFC',
  '17362': 'Minnesota United FC',
  '18986': 'Nashville SC',
  '189': 'New England Revolution',
  '17606': 'New York City FC',
  '12011': 'Orlando City SC',
  '10739': 'Philadelphia Union',
  '9723': 'Portland Timbers',
  '4771': 'Real Salt Lake',
  '190': 'Red Bull New York',
  '22529': 'San Diego FC',
  '191': 'San Jose Earthquakes',
  '9726': 'Seattle Sounders FC',
  '186': 'Sporting Kansas City',
  '21812': 'St. Louis City SC',
  '7318': 'Toronto FC',
  '9727': 'Vancouver Whitecaps',
}

function extractId(refUrl: string, segment: string): string | null {
  const match = new RegExp(`${segment}\\/(\\d+)`).exec(refUrl)
  return match?.[1] ?? null
}

// ESPN moves an athlete's "current team" to the All-Star team ID as soon as
// they play in the MLS All-Star Game, which overwrites their real club in
// both the leaders feed and the athlete profile's `team` field. When we see
// this ID, we fall back to the athlete's event log to find their real club.
const ALL_STAR_TEAM_ID = '9817'

// Manually-curated headshots for players whose ESPN/Wikipedia photos are
// missing or low quality. These take priority over ESPN/Wikipedia. If ESPN
// starts serving a real headshot for one of these players, a console
// message is logged (see resolveLeaders loop below) so it can be flagged.
const MANUAL_HEADSHOTS: Record<string, string> = {
  'Bryan Ramirez': '/player-headshots/Bryan-Ramirez.jpg',
  'Carlos Garcés': '/player-headshots/Carlos-Garcés.jpg',
  'Édier Ocampo': '/player-headshots/Édier-Ocampo.jpg',
  'Felipe Andrade': '/player-headshots/Felipe-Andrade.jpg',
  'Guilherme Augusto': '/player-headshots/Guilherme-Augusto.jpg',
  'Hamzat Ojediran': '/player-headshots/Hamzat-Ojediran.jpg',
  'Jimer Fory': '/player-headshots/Jimer-Fory.jpg',
  'Joaquín Pereyra': '/player-headshots/Joaquín-Pereyra.jpg',
  'Manu Duah': '/player-headshots/Manu-Duah.jpg',
  'Marcus Ingvartsen': '/player-headshots/Marcus-Ingvartsen.jpg',
  'Maxwell Woledzi': '/player-headshots/Maxwell-Woledzi.jpg',
  'Nicolás Fernández': '/player-headshots/Nicolás-Fernández.jpg',
  'Pep Biel': '/player-headshots/Pep-Biel.jpg',
  'Prince Owusu': '/player-headshots/Prince-Owuso.jpg',
}

export default defineEventHandler(async () => {
  // Serve from cache if fresh
  if (cache && Date.now() - cacheTime < CACHE_TTL) {
    return cache
  }

  // ── 1. Fetch season leaders ───────────────────────────────────────────────
  const leadersUrl =
    'https://sports.core.api.espn.com/v2/sports/soccer/leagues/usa.1/seasons/2026/types/1/leaders'

  const leadersRaw = await $fetch<Record<string, unknown>>(leadersUrl).catch(
    () => null
  )
  if (!leadersRaw) {
    throw createError({ statusCode: 502, message: 'Failed to fetch leaders' })
  }

  const categories =
    (leadersRaw.categories as Array<Record<string, unknown>>) ?? []

  // ── 2. Extract top-10 for each category ──────────────────────────────────
  type RawLeader = {
    value: number
    athleteRef: string
    teamRef: string
  }

  function extractCategory(name: string): RawLeader[] {
    const cat = categories.find(
      (c) => (c.name as string)?.toLowerCase() === name
    )
    if (!cat) return []
    const leaders = (cat.leaders as Array<Record<string, unknown>>) ?? []
    return leaders.slice(0, 10).map((l) => ({
      value: l.value as number,
      athleteRef: (l.athlete as Record<string, unknown>)?.['$ref'] as string,
      teamRef: (l.team as Record<string, unknown>)?.['$ref'] as string,
    }))
  }

  const rawGoals = extractCategory('goals')
  const rawAssists = extractCategory('assists')
  const rawAccuratePasses = extractCategory('accuratepasses')
  const rawSaves = extractCategory('saves')
  const rawYellowCards = extractCategory('yellowcards')
  const rawRedCards = extractCategory('redcards')

  // ── 3. Collect unique athlete refs to fetch ───────────────────────────────
  const allRefs = new Set<string>()
  for (const l of [
    ...rawGoals,
    ...rawAssists,
    ...rawAccuratePasses,
    ...rawSaves,
    ...rawYellowCards,
    ...rawRedCards,
  ]) {
    if (l.athleteRef) allRefs.add(l.athleteRef)
  }

  // ── 4. Fetch all athlete refs in parallel ─────────────────────────────────
  // The leaders endpoint returns season-scoped athlete refs like:
  //   /seasons/2026/athletes/12345
  // These return no headshot and no team data. Strip the season scope to get
  // the full athlete profile which includes headshot.
  function toBaseAthleteUrl(seasonRef: string): string {
    return seasonRef.replace(/\/seasons\/\d+\/athletes\//, '/athletes/')
  }

  // Wikipedia REST summary API — free, no key, returns thumbnail for most players
  async function fetchWikipediaHeadshot(name: string): Promise<string> {
    try {
      // Convert "First Last" → "First_Last" for Wikipedia URL
      const slug = name.trim().replace(/\s+/g, '_')
      const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(slug)}`
      const wiki = await $fetch<Record<string, unknown>>(url)
      const thumb = (wiki.thumbnail as Record<string, unknown> | null)
        ?.source as string | undefined
      return thumb ?? ''
    } catch {
      return ''
    }
  }

  // When an athlete's team resolves to the All-Star team (or an otherwise
  // unrecognized ID), walk their event log backwards to find the last game
  // played for a real club, and use that team instead.
  async function fetchClubTeamId(athleteId: string): Promise<string | null> {
    try {
      const url = `https://sports.core.api.espn.com/v2/sports/soccer/leagues/usa.1/athletes/${athleteId}/eventlog?lang=en&region=us`
      const data = await $fetch<Record<string, unknown>>(url)
      const items =
        ((data.events as Record<string, unknown> | undefined)?.items as Array<
          Record<string, unknown>
        >) ?? []
      for (let i = items.length - 1; i >= 0; i--) {
        const teamId = items[i]?.teamId as string | undefined

        if (
          teamId &&
          teamId !== ALL_STAR_TEAM_ID &&
          ESPN_TEAM_ID_TO_NAME[teamId]
        ) {
          return teamId
        }
      }
      return null
    } catch {
      return null
    }
  }

  const athleteCache = new Map<
    string,
    { displayName: string; headshot: string; teamId: string }
  >()

  await Promise.all(
    Array.from(allRefs).map(async (ref) => {
      const baseUrl = toBaseAthleteUrl(ref)
      const athleteId = extractId(ref, 'athletes') ?? ''
      try {
        const data = await $fetch<Record<string, unknown>>(baseUrl)
        const displayName = (data.displayName as string) ?? 'Unknown'
        const headshotObj = data.headshot as
          Record<string, unknown> | null | undefined
        let headshot = (headshotObj?.href as string) ?? ''

        // If ESPN has no headshot, try Wikipedia
        if (!headshot && displayName && displayName !== 'Unknown') {
          headshot = await fetchWikipediaHeadshot(displayName)
        }

        // Manual override always wins for players with missing/poor photos.
        // Log when ESPN now has its own headshot for one of these players,
        // so it can be flagged and the override potentially removed.
        const manualOverride = MANUAL_HEADSHOTS[displayName]
        if (manualOverride) {
          if (headshotObj?.href) {
            console.log(
              `[stats] ESPN now has a headshot for "${displayName}" ` +
                `(overridden by MANUAL_HEADSHOTS): ${headshotObj.href as string}`
            )
          }
          headshot = manualOverride
        }

        // Nothing available from ESPN, Wikipedia, or manual override — flag
        // it so a headshot can be sourced and added to MANUAL_HEADSHOTS.
        if (!headshot && displayName && displayName !== 'Unknown') {
          console.log(
            `[stats] MISSING HEADSHOT for "${displayName}" — no ESPN, ` +
              `Wikipedia, or MANUAL_HEADSHOTS image found. Add one to ` +
              `public/player-headshots/ and MANUAL_HEADSHOTS in stats.ts.`
          )
        }

        let teamId =
          extractId(
            (data.team as Record<string, unknown> | undefined)?.[
              '$ref'
            ] as string,
            'teams'
          ) ?? ''

        // Athletes who played in the All-Star Game get their "current team"
        // overwritten by ESPN — recover their real club from the event log.
        if ((!teamId || teamId === ALL_STAR_TEAM_ID) && athleteId) {
          const clubTeamId = await fetchClubTeamId(athleteId)
          if (clubTeamId) teamId = clubTeamId
        }

        athleteCache.set(ref, { displayName, headshot, teamId })
      } catch {
        athleteCache.set(ref, {
          displayName: 'Unknown',
          headshot: '',
          teamId: '',
        })
      }
    })
  )

  // ── 5. Build resolved leader lists ────────────────────────────────────────
  function resolveLeaders(raw: RawLeader[]): LeaderEntry[] {
    return raw.map((l, i) => {
      const athleteId = extractId(l.athleteRef, 'athletes') ?? ''
      const leaderTeamId = extractId(l.teamRef, 'teams') ?? ''
      const resolved = athleteCache.get(l.athleteRef)

      // Prefer the athlete-resolved team (which accounts for the All-Star
      // Game override); fall back to the leaders feed's own teamRef.
      const teamId =
        resolved?.teamId && resolved.teamId !== ALL_STAR_TEAM_ID
          ? resolved.teamId
          : leaderTeamId
      const team = (teamId && ESPN_TEAM_ID_TO_NAME[teamId]) || 'MLS'

      return {
        rank: i + 1,
        athleteId,
        displayName: resolved?.displayName ?? 'Unknown',
        team,
        headshot: resolved?.headshot ?? '',
        value: Math.round(l.value),
      }
    })
  }

  const result: StatsResponse = {
    goals: resolveLeaders(rawGoals),
    assists: resolveLeaders(rawAssists),
    accuratePasses: resolveLeaders(rawAccuratePasses),
    saves: resolveLeaders(rawSaves),
    yellowCards: resolveLeaders(rawYellowCards),
    redCards: resolveLeaders(rawRedCards),
  }

  cache = result
  cacheTime = Date.now()

  return result
})
