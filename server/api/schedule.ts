/**
 * GET /api/schedule?teamId=<espnTeamId>
 *
 * Returns the team's full 2026 season schedule (past + future), including
 * any Leagues Cup fixtures the club plays.
 *
 * ESPN's per-team `/teams/{id}/schedule` endpoint only returns a short window
 * of near-term games, which misses everything scheduled after the World Cup
 * hiatus. Instead we fetch the whole league's full-year scoreboard ONCE
 * (~500 events, cached in a module-level variable for 1 hour, with a
 * stale-cache fallback if ESPN fails) and filter it down to the requested
 * team on every request. This keeps the response shape identical to the old
 * per-team endpoint (`{ events: [...] }`), so no client-side parsing changes
 * are needed.
 *
 * Leagues Cup (`concacaf.leagues.cup`) is a separate ESPN league entirely —
 * it never appears in the `usa.1` scoreboard — so we fetch it separately and
 * merge in any events involving the requested team. The same ESPN team ID
 * numbering is shared across both feeds, so no extra ID mapping is needed.
 * `applyPriorRecords` (which computes true historical MLS W-D-L records) is
 * only applied to the MLS-derived events — Leagues Cup competitor "records"
 * are static placeholders ('0-0-0') and irrelevant here.
 */

function teamIsInEvent(evt: Record<string, unknown>, teamId: string): boolean {
  const comps = (evt.competitions as Array<Record<string, unknown>>) ?? []
  const comp = comps[0] ?? {}
  const competitors = (comp.competitors as Array<Record<string, unknown>>) ?? []
  return competitors.some((c) => {
    const t = c.team as Record<string, unknown> | undefined
    return t?.id === teamId
  })
}

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const teamId = query.teamId as string | undefined

  if (!teamId) {
    throw createError({ statusCode: 400, message: 'teamId is required' })
  }

  try {
    const [allEvents, leaguesCupEvents] = await Promise.all([
      fetchSeasonBlob(),
      fetchLeaguesCupSeasonBlob(),
    ])

    const mlsEvents = allEvents
      .filter((evt) => teamIsInEvent(evt, teamId))
      .map((evt) => structuredClone(evt))
    await applyPriorRecords(mlsEvents)

    const leaguesCupTeamEvents = leaguesCupEvents
      .filter((evt) => teamIsInEvent(evt, teamId))
      .map((evt) => structuredClone(evt))

    const events = [...mlsEvents, ...leaguesCupTeamEvents].sort(
      (a, b) =>
        new Date(a.date as string).getTime() -
        new Date(b.date as string).getTime()
    )

    return { events }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    throw createError({
      statusCode: 502,
      message: `ESPN API error: ${message}`,
    })
  }
})
