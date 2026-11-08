// Server-side API route: the MLS Cup Playoffs bracket.
//
// Seeds come from ESPN's standings; results from the scoreboard for each
// month the postseason spans (ESPN rejects date ranges but accepts YYYYMM).
// In-memory cache: 30 s while a bracket game is live, 2 min otherwise.
// `?_t=` bypasses the cache. On ESPN failure stale data is returned silently.

import { MLS_CUP_DATE, PLAYOFFS_START } from '../../app/constants/mls'
import {
  bracketHasLiveGames,
  buildPlayoffBracket,
  type PlayoffBracketRaw,
} from '../utils/playoffBracket'
import { fetchSeasonStandings } from '../utils/seasonStandings'

const CACHE_TTL_LIVE_MS = 30_000
const CACHE_TTL_IDLE_MS = 120_000

let cache: { data: PlayoffBracketRaw; fetchedAt: number } | null = null

function playoffMonths(): string[] {
  const months: string[] = []
  const cursor = new Date(`${PLAYOFFS_START.slice(0, 7)}-01T00:00:00Z`)
  const end = new Date(`${MLS_CUP_DATE}T00:00:00Z`)
  while (cursor <= end) {
    months.push(cursor.toISOString().slice(0, 7).replace('-', ''))
    cursor.setUTCMonth(cursor.getUTCMonth() + 1)
  }
  return months
}

async function fetchBracket(): Promise<PlayoffBracketRaw> {
  const [standings, ...months] = await Promise.all([
    fetchSeasonStandings(),
    ...playoffMonths().map((month) =>
      $fetch<Record<string, unknown>>(
        `https://site.api.espn.com/apis/site/v2/sports/soccer/usa.1/scoreboard?dates=${month}&limit=1000`,
        { retry: 1 }
      )
    ),
  ])
  const events = months.flatMap(
    (page) => (page.events as Array<Record<string, unknown>> | undefined) ?? []
  )
  return buildPlayoffBracket(standings, events)
}

export default defineEventHandler(async (event) => {
  const bustCache = !!getQuery(event)._t
  const now = Date.now()

  if (!bustCache && cache) {
    const ttl = bracketHasLiveGames(cache.data.events)
      ? CACHE_TTL_LIVE_MS
      : CACHE_TTL_IDLE_MS
    if (now - cache.fetchedAt < ttl) return cache.data
  }

  try {
    const data = await fetchBracket()
    cache = { data, fetchedAt: now }
    return data
  } catch {
    if (cache) return { ...cache.data, _stale: true }
    return { _error: true }
  }
})
