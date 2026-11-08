/**
 * Match-detail payload for a playoff matchup ESPN hasn't scheduled yet.
 *
 * ESPN only creates a postseason fixture shortly before it's played, but the
 * bracket knows the pairing well before that. Everything the modal's Preview
 * and H2H tabs need before kickoff — records, recent form, this season's
 * meetings, the home venue, each club's top scorer — can be derived from the
 * standings and the season's completed games, so the modal works from the
 * moment a pairing is set.
 *
 * Matchup ids look like `matchup-<homeEspnTeamId>-<awayEspnTeamId>`.
 */

type EspnRecord = Record<string, unknown>

export const MATCHUP_ID = /^matchup-(\d+)-(\d+)$/

function competitionOf(evt: EspnRecord): EspnRecord {
  return (evt.competitions as EspnRecord[] | undefined)?.[0] ?? {}
}

function competitorsOf(evt: EspnRecord): EspnRecord[] {
  return (competitionOf(evt).competitors as EspnRecord[] | undefined) ?? []
}

function teamIdOf(competitor: EspnRecord | undefined): string {
  return String((competitor?.team as EspnRecord | undefined)?.id ?? '')
}

function isCompleted(evt: EspnRecord): boolean {
  const type = (evt.status as EspnRecord | undefined)?.type as
    EspnRecord | undefined
  return type?.completed === true
}

/** W / D / L for `teamId` in a completed game (a shootout settles it). */
function resultFor(evt: EspnRecord, teamId: string): 'W' | 'D' | 'L' {
  const [a, b] = competitorsOf(evt)
  const us = teamIdOf(a) === teamId ? a : b
  const them = us === a ? b : a
  if (us?.winner === true) return 'W'
  if (them?.winner === true) return 'L'
  const diff = Number(us?.score ?? 0) - Number(them?.score ?? 0)
  return diff > 0 ? 'W' : diff < 0 ? 'L' : 'D'
}

function involves(evt: EspnRecord, teamId: string): boolean {
  return competitorsOf(evt).some((c) => teamIdOf(c) === teamId)
}

function standingsTeam(standings: EspnRecord, teamId: string) {
  const children = (standings.children as EspnRecord[] | undefined) ?? []
  for (const child of children) {
    const entries =
      ((child.standings as EspnRecord | undefined)?.entries as
        EspnRecord[] | undefined) ?? []
    for (const entry of entries) {
      const team = entry.team as EspnRecord
      if (String(team.id) !== teamId) continue
      const stats =
        (entry.stats as Array<{ name: string; value: number }>) ?? []
      const stat = (name: string) =>
        stats.find((s) => s.name === name)?.value ?? 0
      return {
        displayName: team.displayName as string,
        abbreviation: team.abbreviation as string,
        logo: (team.logos as EspnRecord[] | undefined)?.[0]?.href as
          string | undefined,
        record: `${stat('wins')}-${stat('ties')}-${stat('losses')}`,
        points: String(stat('points')),
      }
    }
  }
  return null
}

/** Top league scorer per team, counting regular-season goals (no own goals, no shootout kicks). */
function topScorers(
  events: EspnRecord[],
  teamIds: string[]
): Array<{ teamId: string; name: string; goals: number }> {
  const tally = new Map<string, Map<string, { name: string; goals: number }>>()
  for (const evt of events) {
    const slug = (evt.season as EspnRecord | undefined)?.slug
    if (slug !== 'regular-season') continue
    const details =
      (competitionOf(evt).details as EspnRecord[] | undefined) ?? []
    for (const d of details) {
      if (d.scoringPlay !== true || d.ownGoal === true || d.shootout === true)
        continue
      const teamId = String((d.team as EspnRecord | undefined)?.id ?? '')
      if (!teamIds.includes(teamId)) continue
      const athlete = (d.athletesInvolved as EspnRecord[] | undefined)?.[0]
      if (!athlete?.id) continue
      const players = tally.get(teamId) ?? new Map()
      const current = players.get(String(athlete.id)) ?? {
        name:
          (athlete.shortName as string) ??
          (athlete.displayName as string) ??
          '',
        goals: 0,
      }
      current.goals++
      players.set(String(athlete.id), current)
      tally.set(teamId, players)
    }
  }
  // Only an outright leader — the preview says they "lead the line".
  return teamIds.flatMap((teamId) => {
    const [best, next] = [...(tally.get(teamId)?.values() ?? [])].sort(
      (a, b) => b.goals - a.goals
    )
    return best && best.goals > (next?.goals ?? 0) ? [{ teamId, ...best }] : []
  })
}

export function buildMatchupPreview(
  eventId: string,
  homeId: string,
  awayId: string,
  standings: EspnRecord,
  seasonEvents: EspnRecord[]
) {
  const home = standingsTeam(standings, homeId)
  const away = standingsTeam(standings, awayId)
  if (!home || !away) return null

  // Newest first. The All-Star Game isn't a club result.
  const played = seasonEvents
    .filter(
      (evt) =>
        isCompleted(evt) &&
        (evt.season as EspnRecord | undefined)?.slug !== 'all-star-game'
    )
    .sort(
      (a, b) =>
        new Date(b.date as string).getTime() -
        new Date(a.date as string).getTime()
    )

  const form = [homeId, awayId].map((teamId) => ({
    teamId,
    form: played
      .filter((evt) => involves(evt, teamId))
      .slice(0, 5)
      .map((evt) => resultFor(evt, teamId))
      .join('-'),
  }))

  // Same perspective as the ESPN-backed route: scores read home team first.
  const headToHead = played
    .filter((evt) => involves(evt, homeId) && involves(evt, awayId))
    .slice(0, 5)
    .map((evt) => {
      const competitors = competitorsOf(evt)
      const ours = competitors.find((c) => teamIdOf(c) === homeId)
      const theirs = competitors.find((c) => c !== ours)
      return {
        id: String(evt.id),
        date: evt.date as string,
        score: `${ours?.score ?? '–'}-${theirs?.score ?? '–'}`,
        result: resultFor(evt, homeId),
        atVs: ours?.homeAway === 'home' ? 'vs' : 'at',
        competition: 'MLS',
      }
    })

  const lastHomeGame = played.find((evt) =>
    competitorsOf(evt).some(
      (c) => teamIdOf(c) === homeId && c.homeAway === 'home'
    )
  )
  const venue = lastHomeGame
    ? (competitionOf(lastHomeGame).venue as EspnRecord | undefined)
    : undefined
  const address = venue?.address as EspnRecord | undefined

  return {
    eventId,
    teams: [
      { id: homeId, homeAway: 'home', score: null, ...home },
      { id: awayId, homeAway: 'away', score: null, ...away },
    ],
    teamStats: [],
    odds: { home: {}, away: {}, draw: {} },
    rosters: [],
    leaders: [],
    headToHead,
    info: {
      venue: venue?.fullName as string | undefined,
      city: address?.city as string | undefined,
      country: address?.country as string | undefined,
    },
    matchEvents: [],
    form,
    seasonLeaders: topScorers(seasonEvents, [homeId, awayId]),
    previewOdds: {},
  }
}
