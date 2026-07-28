/**
 * Shared helpers for computing each team's "prior to kickoff" W-D-L record.
 *
 * ESPN's per-event `records` field reflects the team's CURRENT total record
 * at the time of the API call — not the record as it stood before that
 * specific match was played. That means a past match viewed today shows
 * today's cumulative record (including games played after that match), and
 * an already-played match can appear to "jump ahead" once later games are
 * added to the season blob.
 *
 * To show the correct historical record for every match, we self-compute
 * each team's W-D-L progression from actual final scores (chronologically),
 * using the full-season scoreboard as ground truth, then inject the correct
 * "prior" record into whichever narrower set of events we're returning.
 */

const SEASON_TTL_MS = 60 * 60_000 // 1 hour

interface SeasonBlobCache {
  events: Array<Record<string, unknown>>
  fetchedAt: number
}

let seasonBlobCache: SeasonBlobCache | null = null

export async function fetchSeasonBlob(): Promise<
  Array<Record<string, unknown>>
> {
  const now = Date.now()
  if (seasonBlobCache && now - seasonBlobCache.fetchedAt < SEASON_TTL_MS) {
    return seasonBlobCache.events
  }

  const url =
    'https://site.api.espn.com/apis/site/v2/sports/soccer/usa.1/scoreboard?dates=20260101-20261231&limit=1000'

  try {
    const data = await $fetch<Record<string, unknown>>(url)
    const events = (data.events as Array<Record<string, unknown>>) ?? []
    seasonBlobCache = { events, fetchedAt: now }
    return events
  } catch (err) {
    if (seasonBlobCache) return seasonBlobCache.events
    throw err
  }
}

interface LeaguesCupBlobCache {
  events: Array<Record<string, unknown>>
  fetchedAt: number
}

let leaguesCupBlobCache: LeaguesCupBlobCache | null = null

/**
 * Fetches the Leagues Cup scoreboard for the full 2026 calendar year.
 * Leagues Cup is a supplementary competition — if this fetch fails we fail
 * soft (return an empty list, or last-known-good cache) rather than
 * breaking the MLS schedule response.
 */
export async function fetchLeaguesCupSeasonBlob(): Promise<
  Array<Record<string, unknown>>
> {
  const now = Date.now()
  if (
    leaguesCupBlobCache &&
    now - leaguesCupBlobCache.fetchedAt < SEASON_TTL_MS
  ) {
    return leaguesCupBlobCache.events
  }

  const url =
    'https://site.api.espn.com/apis/site/v2/sports/soccer/concacaf.leagues.cup/scoreboard?dates=20260101-20261231&limit=200'

  try {
    const data = await $fetch<Record<string, unknown>>(url)
    const events = (data.events as Array<Record<string, unknown>>) ?? []
    leaguesCupBlobCache = { events, fetchedAt: now }
    return events
  } catch {
    if (leaguesCupBlobCache) return leaguesCupBlobCache.events
    return []
  }
}

function isCompleted(evt: Record<string, unknown>): boolean {
  const comp = (evt.competitions as Array<Record<string, unknown>>)?.[0]
  const status = (comp?.status ?? evt.status) as
    Record<string, unknown> | undefined
  const type = status?.type as Record<string, unknown> | undefined
  const completed = type?.completed as boolean | undefined
  const state = type?.state as string | undefined
  return completed === true || state === 'post'
}

function getCompetitors(
  evt: Record<string, unknown>
): Array<Record<string, unknown>> {
  const comp = (evt.competitions as Array<Record<string, unknown>>)?.[0]
  return (comp?.competitors as Array<Record<string, unknown>>) ?? []
}

/**
 * Return a "YYYY-MM-DD" key identifying the Monday (America/Chicago) of the
 * calendar week containing the given ISO date string.
 */
function weekKeyFor(dateStr: string): string {
  const d = new Date(dateStr)
  const ctDateStr = d.toLocaleDateString('en-CA', {
    timeZone: 'America/Chicago',
  }) // "YYYY-MM-DD"
  const [year, month, day] = ctDateStr.split('-').map(Number)
  const local = new Date(year!, month! - 1, day!)
  const dow = local.getDay() // 0=Sun
  const diffToMon = dow === 0 ? -6 : 1 - dow
  const monday = new Date(local)
  monday.setDate(local.getDate() + diffToMon)
  return monday.toISOString().slice(0, 10)
}

/**
 * Build a map of teamId -> (eventId -> "W-D-L" record to display for that
 * event).
 *
 * - Completed matches show the precise chronological record as it stood
 *   immediately BEFORE that specific match kicked off (cascading per game).
 * - Not-yet-played (or in-progress) matches show the last FULLY SETTLED
 *   record — the cumulative total through the most recent calendar week
 *   (Mon–Sun, America/Chicago) in which ALL of that team's games are
 *   complete. This can never advance past what is fully known: a scheduled
 *   match doesn't reflect the outcome of another game the team already
 *   played earlier the same week (that week isn't "settled" until every
 *   game in it has been played), and this frozen value carries forward
 *   unchanged into any future week until the current week fully concludes.
 */
export function buildPriorRecordsMap(
  seasonEvents: Array<Record<string, unknown>>
): Map<string, Map<string, string>> {
  const byTeam = new Map<string, Array<Record<string, unknown>>>()

  for (const evt of seasonEvents) {
    const competitors = getCompetitors(evt)
    for (const c of competitors) {
      const team = c.team as Record<string, unknown> | undefined
      const teamId = team?.id as string | undefined
      if (!teamId) continue
      if (!byTeam.has(teamId)) byTeam.set(teamId, [])
      byTeam.get(teamId)!.push(evt)
    }
  }

  const result = new Map<string, Map<string, string>>()

  for (const [teamId, events] of byTeam) {
    const sorted = [...events].sort(
      (a, b) =>
        new Date(a.date as string).getTime() -
        new Date(b.date as string).getTime()
    )

    // A week is "fully settled" only once every game the team plays in it
    // has been completed.
    const weekFullySettled = new Map<string, boolean>()
    for (const evt of sorted) {
      const wk = weekKeyFor(evt.date as string)
      const completed = isCompleted(evt)
      const prior = weekFullySettled.get(wk)
      weekFullySettled.set(
        wk,
        prior === undefined ? completed : prior && completed
      )
    }

    let w = 0
    let d = 0
    let l = 0
    let settledW = 0
    let settledD = 0
    let settledL = 0
    let currentWeekKey: string | null = null
    const eventMap = new Map<string, string>()

    const flushWeek = (wk: string) => {
      if (weekFullySettled.get(wk)) {
        settledW = w
        settledD = d
        settledL = l
      }
    }

    for (const evt of sorted) {
      const eventId = evt.id as string
      const dateStr = evt.date as string
      const wk = weekKeyFor(dateStr)

      if (wk !== currentWeekKey) {
        if (currentWeekKey !== null) flushWeek(currentWeekKey)
        currentWeekKey = wk
      }

      if (!isCompleted(evt)) {
        eventMap.set(eventId, `${settledW}-${settledD}-${settledL}`)
        continue
      }

      eventMap.set(eventId, `${w}-${d}-${l}`)

      const competitors = getCompetitors(evt)
      const me = competitors.find(
        (c) => (c.team as Record<string, unknown> | undefined)?.id === teamId
      )
      const opp = competitors.find(
        (c) => (c.team as Record<string, unknown> | undefined)?.id !== teamId
      )
      const myScore = Number(me?.score)
      const oppScore = Number(opp?.score)
      if (Number.isNaN(myScore) || Number.isNaN(oppScore)) continue

      if (myScore > oppScore) w++
      else if (myScore < oppScore) l++
      else d++
    }
    if (currentWeekKey !== null) flushWeek(currentWeekKey)

    result.set(teamId, eventMap)
  }

  return result
}

/**
 * Mutates the given events in place, overwriting each competitor's "total"
 * record summary with the correct display record. Safe to call repeatedly /
 * on cached data since the computed value is deterministic.
 */
export function injectPriorRecords(
  events: Array<Record<string, unknown>>,
  recordsMap: Map<string, Map<string, string>>
): void {
  for (const evt of events) {
    const eventId = evt.id as string
    const competitors = getCompetitors(evt)
    for (const c of competitors) {
      const team = c.team as Record<string, unknown> | undefined
      const teamId = team?.id as string | undefined
      if (!teamId) continue
      const prior = recordsMap.get(teamId)?.get(eventId)
      if (prior === undefined) continue

      const records = c.records as Array<Record<string, unknown>> | undefined
      const totalRec = records?.find(
        (r) => r.type === 'total' || r.abbreviation === 'Total'
      )
      if (totalRec) {
        totalRec.summary = prior
      } else {
        c.records = [...(records ?? []), { type: 'total', summary: prior }]
      }
    }
  }
}

/** Convenience: fetch the season blob, build the map, and inject into `events`. */
export async function applyPriorRecords(
  events: Array<Record<string, unknown>>
): Promise<void> {
  if (!events.length) return
  try {
    const seasonEvents = await fetchSeasonBlob()
    const recordsMap = buildPriorRecordsMap(seasonEvents)
    injectPriorRecords(events, recordsMap)
  } catch {
    // If the season blob fails, leave ESPN's original (possibly-current)
    // record in place rather than breaking the response.
  }
}
