/**
 * Builds the MLS Cup Playoffs bracket from the final conference seeds plus
 * whatever postseason fixtures ESPN has published so far.
 *
 * ESPN has no bracket endpoint, and it only creates a fixture once both teams
 * are known — so the bracket skeleton comes from the seeds, and each tie is
 * filled in from scoreboard events as they appear. Slots are positional (the
 * upper feeder always lands in a tie's top slot) so connector lines stay
 * straight; the seed number shows who is hosting.
 *
 * Kept free of Nitro globals so it can be exercised against past seasons.
 */

import type { PlayoffRound } from '../../app/constants/rounds'

export type BracketConference = 'West' | 'East'

type EspnRecord = Record<string, unknown>

export interface BracketTeamRaw {
  id: string
  name: string
  abbr: string
  seed: number
  conference: BracketConference
  /** Regular-season W-D-L. */
  record: string
  points: number
}

export interface BracketTieRaw {
  key: string
  round: PlayoffRound
  conference: BracketConference | null
  bestOf: 1 | 3
  top: BracketTeamRaw | null
  bottom: BracketTeamRaw | null
  /** The two teams that could still fill an empty slot (empty when more could). */
  topOptions: BracketTeamRaw[]
  bottomOptions: BracketTeamRaw[]
  topWins: number
  bottomWins: number
  winner: 'top' | 'bottom' | null
  /** ESPN event ids, chronological. Canceled games (an unneeded Game 3) are dropped. */
  gameIds: string[]
}

export interface ConferenceBracketRaw {
  conference: BracketConference
  wildCard: BracketTieRaw
  roundOne: BracketTieRaw[]
  semifinals: BracketTieRaw[]
  final: BracketTieRaw
}

export interface PlayoffBracketRaw {
  west: ConferenceBracketRaw
  east: ConferenceBracketRaw
  cup: BracketTieRaw
  events: EspnRecord[]
}

// ── Seeds ─────────────────────────────────────────────────────────────────────

/** Conference seeds keyed by seed number, from ESPN's standings payload. */
export function seedsFromStandings(
  standings: EspnRecord
): Record<BracketConference, Map<number, BracketTeamRaw>> {
  const result: Record<BracketConference, Map<number, BracketTeamRaw>> = {
    West: new Map(),
    East: new Map(),
  }
  const children = (standings.children as EspnRecord[] | undefined) ?? []
  for (const child of children) {
    const name = (child.name as string) ?? ''
    const conference: BracketConference | null = /west/i.test(name)
      ? 'West'
      : /east/i.test(name)
        ? 'East'
        : null
    if (!conference) continue

    const entries =
      ((child.standings as EspnRecord | undefined)?.entries as
        EspnRecord[] | undefined) ?? []
    const ranked = entries
      .map((entry) => {
        const stats =
          (entry.stats as Array<{ name: string; value: number }>) ?? []
        const stat = (name: string) =>
          stats.find((s) => s.name === name)?.value ?? 0
        const note = (entry.note as EspnRecord | undefined)?.description
        return {
          entry,
          rank: stat('rank'),
          record: `${stat('wins')}-${stat('ties')}-${stat('losses')}`,
          points: stat('points'),
          qualified: /playoff/i.test(String(note ?? '')),
        }
      })
      .filter((r) => r.rank > 0)
      .sort((a, b) => a.rank - b.rank)

    // ESPN tags qualifiers with a playoff note. If the notes ever vanish
    // mid-postseason, the top nine by rank is the same field.
    const qualified = ranked.some((r) => r.qualified)
      ? ranked.filter((r) => r.qualified)
      : ranked.slice(0, 9)

    for (const { entry, rank, record, points } of qualified) {
      const team = entry.team as EspnRecord
      result[conference].set(rank, {
        id: String(team.id),
        name: team.displayName as string,
        abbr: team.abbreviation as string,
        seed: rank,
        conference,
        record,
        points,
      })
    }
  }
  return result
}

// ── Events ────────────────────────────────────────────────────────────────────

interface PlayoffEvent {
  raw: EspnRecord
  id: string
  date: string
  round: PlayoffRound
  conference: BracketConference | null
  teamIds: string[]
  completed: boolean
  winnerId: string | null
}

function roundFromSlug(
  slug: string
): { round: PlayoffRound; conference: BracketConference | null } | null {
  if (slug === 'mls-cup') return { round: 'mls-cup', conference: null }
  const match = slug.match(/^(eastern|western)-conference-playoffs---(.+)$/)
  if (!match) return null
  const key = match[2]
  if (
    key !== 'wild-card' &&
    key !== 'round-one' &&
    key !== 'semifinals' &&
    key !== 'final'
  )
    return null
  return { round: key, conference: match[1] === 'western' ? 'West' : 'East' }
}

function winnerIdOf(competitors: EspnRecord[]): string | null {
  const flagged = competitors.find((c) => c.winner === true)
  if (flagged) return String((flagged.team as EspnRecord).id)
  const [a, b] = competitors
  if (!a || !b) return null
  const goals = (c: EspnRecord) => Number(c.score ?? 0)
  const pens = (c: EspnRecord) => Number(c.shootoutScore ?? 0)
  const diff = goals(a) - goals(b) || pens(a) - pens(b)
  if (!diff) return null
  return String(((diff > 0 ? a : b).team as EspnRecord).id)
}

/** Parse ESPN scoreboard events into postseason games, dropping canceled ones. */
export function parsePlayoffEvents(events: EspnRecord[]): PlayoffEvent[] {
  const parsed: PlayoffEvent[] = []
  for (const raw of events) {
    const slug = ((raw.season as EspnRecord | undefined)?.slug as string) ?? ''
    const round = roundFromSlug(slug.toLowerCase())
    if (!round) continue

    const statusType = (raw.status as EspnRecord | undefined)?.type as
      EspnRecord | undefined
    const completed = statusType?.completed === true
    // A Game 3 that turned out to be unnecessary stays in the feed as
    // "post" but never completes.
    if (statusType?.state === 'post' && !completed) continue

    const comp = (raw.competitions as EspnRecord[] | undefined)?.[0] ?? {}
    const competitors = (comp.competitors as EspnRecord[] | undefined) ?? []
    parsed.push({
      raw,
      id: String(raw.id),
      date: raw.date as string,
      ...round,
      teamIds: competitors.map((c) => String((c.team as EspnRecord)?.id)),
      completed,
      winnerId: completed ? winnerIdOf(competitors) : null,
    })
  }
  return parsed.sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  )
}

// ── Bracket assembly ──────────────────────────────────────────────────────────

interface TieBuild {
  tie: BracketTieRaw
  /** Every team that could reach this tie — used to match ESPN events to it. */
  pool: Set<string>
  topPool: Set<string>
  bottomPool: Set<string>
}

function winnerTeam(tie: BracketTieRaw): BracketTeamRaw | null {
  if (tie.winner === 'top') return tie.top
  if (tie.winner === 'bottom') return tie.bottom
  return null
}

function optionsFor(feeder: BracketTieRaw): BracketTeamRaw[] {
  if (feeder.winner || !feeder.top || !feeder.bottom) return []
  return [feeder.top, feeder.bottom]
}

function teamPool(...teams: Array<BracketTeamRaw | null>): Set<string> {
  return new Set(teams.filter((t): t is BracketTeamRaw => !!t).map((t) => t.id))
}

function unionPool(a: Set<string>, b: Set<string>): Set<string> {
  return new Set([...a, ...b])
}

function makeTie(
  key: string,
  round: PlayoffRound,
  conference: BracketConference | null,
  top: {
    team: BracketTeamRaw | null
    pool: Set<string>
    feeder?: BracketTieRaw
  },
  bottom: {
    team: BracketTeamRaw | null
    pool: Set<string>
    feeder?: BracketTieRaw
  }
): TieBuild {
  return {
    tie: {
      key,
      round,
      conference,
      bestOf: round === 'round-one' ? 3 : 1,
      top: top.team,
      bottom: bottom.team,
      topOptions: !top.team && top.feeder ? optionsFor(top.feeder) : [],
      bottomOptions:
        !bottom.team && bottom.feeder ? optionsFor(bottom.feeder) : [],
      topWins: 0,
      bottomWins: 0,
      winner: null,
      gameIds: [],
    },
    pool: unionPool(top.pool, bottom.pool),
    topPool: top.pool,
    bottomPool: bottom.pool,
  }
}

/**
 * Attach this tie's ESPN games and settle it. Slots the seeds couldn't fill
 * yet (feeder still undecided on our side) are taken from the event itself.
 */
function resolveTie(
  build: TieBuild,
  events: PlayoffEvent[],
  teamsById: Map<string, BracketTeamRaw>
) {
  const { tie } = build
  const games = events.filter(
    (e) =>
      e.round === tie.round &&
      e.conference === tie.conference &&
      e.teamIds.some((id) => build.pool.has(id)) &&
      e.teamIds.every((id) => build.pool.has(id) || !teamsById.has(id))
  )

  for (const game of games) {
    for (const id of game.teamIds) {
      const team = teamsById.get(id)
      if (!team) continue
      if (!tie.top && build.topPool.has(id)) tie.top = team
      if (!tie.bottom && build.bottomPool.has(id)) tie.bottom = team
    }
  }
  if (tie.top) tie.topOptions = []
  if (tie.bottom) tie.bottomOptions = []

  tie.gameIds = games.map((g) => g.id)
  tie.topWins = games.filter(
    (g) => g.winnerId && g.winnerId === tie.top?.id
  ).length
  tie.bottomWins = games.filter(
    (g) => g.winnerId && g.winnerId === tie.bottom?.id
  ).length

  const needed = tie.bestOf === 3 ? 2 : 1
  tie.winner =
    tie.topWins >= needed ? 'top' : tie.bottomWins >= needed ? 'bottom' : null
}

function buildConference(
  conference: BracketConference,
  seeds: Map<number, BracketTeamRaw>,
  events: PlayoffEvent[],
  teamsById: Map<string, BracketTeamRaw>
): { bracket: ConferenceBracketRaw; pool: Set<string> } {
  const prefix = conference.toLowerCase()
  const seed = (n: number) => seeds.get(n) ?? null
  const fixed = (n: number) => ({ team: seed(n), pool: teamPool(seed(n)) })
  const from = (feeder: TieBuild) => ({
    team: winnerTeam(feeder.tie),
    pool: feeder.pool,
    feeder: feeder.tie,
  })
  const settle = (build: TieBuild) => {
    resolveTie(build, events, teamsById)
    return build
  }

  const wildCard = settle(
    makeTie(`${prefix}-wc`, 'wild-card', conference, fixed(8), fixed(9))
  )

  // Display order matches the official bracket: 1v8/9 and 4v5 meet in one
  // semifinal, 3v6 and 2v7 in the other.
  const roundOne = [
    makeTie(
      `${prefix}-r1-1`,
      'round-one',
      conference,
      fixed(1),
      from(wildCard)
    ),
    makeTie(`${prefix}-r1-4`, 'round-one', conference, fixed(4), fixed(5)),
    makeTie(`${prefix}-r1-3`, 'round-one', conference, fixed(3), fixed(6)),
    makeTie(`${prefix}-r1-2`, 'round-one', conference, fixed(2), fixed(7)),
  ].map(settle)

  const semifinals = [
    makeTie(
      `${prefix}-sf-1`,
      'semifinals',
      conference,
      from(roundOne[0]!),
      from(roundOne[1]!)
    ),
    makeTie(
      `${prefix}-sf-2`,
      'semifinals',
      conference,
      from(roundOne[2]!),
      from(roundOne[3]!)
    ),
  ].map(settle)

  const final = settle(
    makeTie(
      `${prefix}-final`,
      'final',
      conference,
      from(semifinals[0]!),
      from(semifinals[1]!)
    )
  )

  return {
    bracket: {
      conference,
      wildCard: wildCard.tie,
      roundOne: roundOne.map((b) => b.tie),
      semifinals: semifinals.map((b) => b.tie),
      final: final.tie,
    },
    pool: final.pool,
  }
}

export function buildPlayoffBracket(
  standings: EspnRecord,
  scoreboardEvents: EspnRecord[]
): PlayoffBracketRaw {
  const seeds = seedsFromStandings(standings)
  const teamsById = new Map<string, BracketTeamRaw>()
  for (const conf of [seeds.West, seeds.East])
    for (const team of conf.values()) teamsById.set(team.id, team)

  const events = parsePlayoffEvents(scoreboardEvents)
  const west = buildConference('West', seeds.West, events, teamsById)
  const east = buildConference('East', seeds.East, events, teamsById)

  const westFinal = { tie: west.bracket.final, pool: west.pool }
  const eastFinal = { tie: east.bracket.final, pool: east.pool }
  const cupBuild = makeTie(
    'mls-cup',
    'mls-cup',
    null,
    {
      team: winnerTeam(westFinal.tie),
      pool: westFinal.pool,
      feeder: westFinal.tie,
    },
    {
      team: winnerTeam(eastFinal.tie),
      pool: eastFinal.pool,
      feeder: eastFinal.tie,
    }
  )
  resolveTie(cupBuild, events, teamsById)

  const usedIds = new Set(
    [
      ...[west.bracket, east.bracket].flatMap((c) => [
        c.wildCard,
        ...c.roundOne,
        ...c.semifinals,
        c.final,
      ]),
      cupBuild.tie,
    ].flatMap((t) => t.gameIds)
  )

  return {
    west: west.bracket,
    east: east.bracket,
    cup: cupBuild.tie,
    events: events.filter((e) => usedIds.has(e.id)).map((e) => e.raw),
  }
}

/** True when any bracket game is in play, or past kickoff without an update yet. */
export function bracketHasLiveGames(events: EspnRecord[]): boolean {
  const now = Date.now()
  return events.some((evt) => {
    const type = (evt.status as EspnRecord | undefined)?.type as
      EspnRecord | undefined
    if (type?.state === 'in') return true
    return (
      type?.state === 'pre' && new Date(evt.date as string).getTime() <= now
    )
  })
}
