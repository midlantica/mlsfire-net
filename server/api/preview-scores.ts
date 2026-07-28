const CACHE_TTL_MS = 5 * 60 * 1000

const cache = new Map<string, { data: Record<string, unknown>; at: number }>()

export default defineEventHandler(async (event) => {
  // Design sandbox only — this route pulls arbitrary historical windows so the
  // postseason / Leagues Cup UI can be worked on out of season. It must never
  // be reachable from a deployed build.
  if (!import.meta.dev) {
    throw createError({ statusCode: 404, statusMessage: 'Not Found' })
  }

  const query = getQuery(event)
  const from = String(query.from ?? '')
  const to = String(query.to ?? from)
  const league = String(query.league ?? 'usa.1')

  if (!/^\d{8}$/.test(from) || !/^\d{8}$/.test(to)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'from/to must be YYYYMMDD',
    })
  }

  if (league !== 'usa.1' && league !== 'concacaf.leagues.cup') {
    throw createError({ statusCode: 400, statusMessage: 'unsupported league' })
  }

  const cacheKey = `${league}:${from}-${to}`
  const cached = cache.get(cacheKey)
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return cached.data
  }

  const url = `https://site.api.espn.com/apis/site/v2/sports/soccer/${league}/scoreboard?dates=${from}-${to}`

  try {
    const data = await $fetch<Record<string, unknown>>(url)
    cache.set(cacheKey, { data, at: Date.now() })
    return data
  } catch {
    return { events: [] }
  }
})
