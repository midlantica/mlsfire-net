// Server-side API route: MLS standings, ?season=YYYY (defaults to SEASON_YEAR).
// Finished seasons are frozen in server/assets/standings/<year>.json
// (`pnpm archive:standings <year>`) and served from there — no ESPN call.
// Every response carries `_seasons` so the client can offer the year picker.
import { SEASON_YEAR } from '../../app/constants/mls'

const ESPN_STANDINGS =
  'https://site.api.espn.com/apis/v2/sports/soccer/usa.1/standings'

async function archivedSeasons(): Promise<number[]> {
  const keys = await useStorage('assets:server').getKeys('standings')
  return keys
    .map((k) => Number(k.match(/(\d{4})\.json$/)?.[1]))
    .filter((y) => y > 0)
}

export default defineEventHandler(async (event) => {
  const archived = await archivedSeasons()
  const seasons = [...new Set([SEASON_YEAR, ...archived])].sort((a, b) => b - a)
  const requested = Number(getQuery(event).season)
  const season = seasons.includes(requested) ? requested : SEASON_YEAR
  const meta = { _season: season, _seasons: seasons }

  if (archived.includes(season)) {
    const data = await useStorage('assets:server').getItem<
      Record<string, unknown>
    >(`standings:${season}.json`)
    if (data) {
      setHeader(event, 'cache-control', 'public, max-age=3600')
      return { ...data, ...meta, _final: true }
    }
  }

  try {
    const data = await $fetch<Record<string, unknown>>(ESPN_STANDINGS, {
      query: { season },
    })
    return { ...data, ...meta, _final: false }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    throw createError({
      statusCode: 502,
      message: `ESPN API error: ${message}`,
    })
  }
})
