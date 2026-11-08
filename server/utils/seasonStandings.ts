import { SEASON_YEAR } from '../../app/constants/mls'

const STANDINGS_TTL_MS = 10 * 60_000

let standingsCache: {
  data: Record<string, unknown>
  fetchedAt: number
} | null = null

/**
 * ESPN conference standings for `SEASON_YEAR`, pinned to that season so the
 * playoff seeds survive ESPN rolling its default over to the next year.
 */
export async function fetchSeasonStandings(): Promise<Record<string, unknown>> {
  const now = Date.now()
  if (standingsCache && now - standingsCache.fetchedAt < STANDINGS_TTL_MS) {
    return standingsCache.data
  }
  try {
    const data = await $fetch<Record<string, unknown>>(
      `https://site.api.espn.com/apis/v2/sports/soccer/usa.1/standings?season=${SEASON_YEAR}`,
      { retry: 1 }
    )
    standingsCache = { data, fetchedAt: now }
    return data
  } catch (err) {
    if (standingsCache) return standingsCache.data
    throw err
  }
}
