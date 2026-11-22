import { oklch, parse } from 'culori'
import {
  NEXT_SEASON_FIRST_WEEK,
  OFFSEASON_START,
  PLAYOFF_ROUND_DATES,
  PLAYOFF_ROUND_START,
  PLAYOFFS_TAB_FROM,
} from '~/constants/mls'
import type { PlayoffRound } from '~/constants/rounds'
import type {
  BracketConference,
  BracketTeamRaw,
  BracketTieRaw,
  ConferenceBracketRaw,
  PlayoffBracketRaw,
} from '../../server/utils/playoffBracket'
import {
  calcBadge,
  calcQuality,
  normalizeTeamName,
  transformMatches,
} from './useScores'
import type { Match } from './useScores'
import { TEAM_COLOR_PAIRS } from './useTeamColors'
import { TEAM_LOGO } from './useTeamTheme'

export type { BracketConference }

export interface BracketTeam {
  id: string
  name: string
  abbr: string
  seed: number
  logo: string | null
  record: string
  points: number
}

export interface BracketTie {
  key: string
  round: PlayoffRound
  conference: BracketConference | null
  bestOf: 1 | 3
  top: BracketTeam | null
  bottom: BracketTeam | null
  topOptions: BracketTeam[]
  bottomOptions: BracketTeam[]
  topWins: number
  bottomWins: number
  winner: 'top' | 'bottom' | null
  games: Match[]
  /** Both teams set but ESPN hasn't scheduled the game yet — opens a matchup preview. */
  preview: Match | null
}

export interface ConferenceBracket {
  conference: BracketConference
  wildCard: BracketTie
  roundOne: BracketTie[]
  semifinals: BracketTie[]
  final: BracketTie
}

export interface PlayoffBracket {
  west: ConferenceBracket
  east: ConferenceBracket
  cup: BracketTie
}

/** Today in Central time as YYYY-MM-DD, built from parts so no locale's date format can skew it. */
function todayCT(): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Chicago',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())
  const part = (type: string) => parts.find((p) => p.type === type)?.value
  return `${part('year')}-${part('month')}-${part('day')}`
}

function inPlayoffsWindow(): boolean {
  const today = todayCT()
  return today >= PLAYOFFS_TAB_FROM && today < NEXT_SEASON_FIRST_WEEK
}

function inOffseason(): boolean {
  return todayCT() >= OFFSEASON_START
}

/**
 * Whether "MLS Cup Playoffs" replaces the "Next" week tab. Decided during SSR
 * and reused by the client so the two can't disagree; a page left open needs
 * `recheck()` once the date rolls over.
 */
export function usePlayoffsTab() {
  const active = useState<boolean>('playoffs-tab-active', inPlayoffsWindow)
  /** MLS Cup week is over — copy talks about next season, not the playoffs. */
  const offseason = useState<boolean>('playoffs-offseason', inOffseason)
  function recheck() {
    active.value = inPlayoffsWindow()
    offseason.value = inOffseason()
  }
  return { active, offseason, recheck }
}

function toTeam(raw: BracketTeamRaw): BracketTeam {
  const name = normalizeTeamName(raw.name)
  return {
    id: raw.id,
    name,
    abbr: raw.abbr,
    seed: raw.seed,
    logo: TEAM_LOGO[name] ?? null,
    record: raw.record,
    points: raw.points,
  }
}

function seasonSlug(
  round: PlayoffRound,
  conference: BracketConference | null
): string {
  if (round === 'mls-cup' || !conference) return 'mls-cup'
  return `${conference === 'West' ? 'western' : 'eastern'}-conference-playoffs---${round}`
}

/**
 * A stand-in Match for a set pairing ESPN hasn't scheduled. The higher seed
 * hosts (in MLS Cup, the club with more regular-season points); the id routes
 * the match-detail API to a preview built from the season's results.
 */
function previewMatch(
  round: PlayoffRound,
  conference: BracketConference | null,
  top: BracketTeam,
  bottom: BracketTeam
): Match {
  const topHosts = conference
    ? top.seed <= bottom.seed
    : top.points >= bottom.points
  const [home, away] = topHosts ? [top, bottom] : [bottom, top]
  const date = `${PLAYOFF_ROUND_START[round]}T12:00:00Z`
  return {
    id: `matchup-${home.id}-${away.id}`,
    date,
    home: home.name,
    homeRec: home.record,
    homeScore: null,
    homeShootout: null,
    homeColor: TEAM_COLOR_PAIRS[home.name]?.primary ?? '',
    homeLogo: home.logo,
    away: away.name,
    awayRec: away.record,
    awayScore: null,
    awayShootout: null,
    awayColor: TEAM_COLOR_PAIRS[away.name]?.primary ?? '',
    awayLogo: away.logo,
    status: { code: 'ns' },
    kickoffSlot: new Date(date).getTime(),
    qualityScore: calcQuality(home.record, away.record),
    badge: calcBadge(home.record, away.record, home.name, away.name),
    seasonSlug: seasonSlug(round, conference),
    seriesNote: round === 'round-one' ? 'Best-of-3 series' : null,
    windowLabel: PLAYOFF_ROUND_DATES[round],
  }
}

export function gameWinner(m: Match): string | null {
  if (m.status.code !== 'ft') return null
  const diff =
    Number(m.homeScore ?? 0) - Number(m.awayScore ?? 0) ||
    Number(m.homeShootout ?? 0) - Number(m.awayShootout ?? 0)
  return diff ? (diff > 0 ? m.home : m.away) : null
}

/**
 * ESPN no longer tags Round One games with "CLB leads series 1-0", so the
 * match modal's series note is rebuilt from the results: each game carries
 * the series score after it (or, until it ends, going into it). Each game
 * also carries its place in the series for the playoff preview.
 */
function withSeriesNotes(
  games: Match[],
  top: BracketTeam,
  bottom: BracketTeam
): Match[] {
  const wins = new Map([
    [top.name, 0],
    [bottom.name, 0],
  ])
  return games.map((game, i) => {
    const series = {
      game: i + 1,
      earlier: games.slice(0, i),
      next: games[i + 1] ?? null,
    }
    const winner = gameWinner(game)
    if (winner && wins.has(winner)) wins.set(winner, wins.get(winner)! + 1)
    if (game.seriesNote) return { ...game, series }
    const [t, b] = [wins.get(top.name)!, wins.get(bottom.name)!]
    const lead = t > b ? top : bottom
    const [hi, lo] = [Math.max(t, b), Math.min(t, b)]
    const state =
      t + b === 0
        ? 'Best of 3'
        : t === b
          ? `Series tied ${t}–${b}`
          : `${lead.abbr} ${hi === 2 ? 'win series' : 'leads series'} ${hi}–${lo}`
    return { ...game, series, seriesNote: `Game ${i + 1} · ${state}` }
  })
}

function toTie(raw: BracketTieRaw, gamesById: Map<string, Match>): BracketTie {
  const { gameIds, ...rest } = raw
  const top = raw.top ? toTeam(raw.top) : null
  const bottom = raw.bottom ? toTeam(raw.bottom) : null
  const found = gameIds
    .map((id) => gamesById.get(id))
    .filter((m): m is Match => !!m)
  const games =
    raw.bestOf === 3 && top && bottom
      ? withSeriesNotes(found, top, bottom)
      : found
  return {
    ...rest,
    top,
    bottom,
    topOptions: raw.topOptions.map(toTeam),
    bottomOptions: raw.bottomOptions.map(toTeam),
    games,
    preview:
      top && bottom && !games.length && !raw.winner
        ? previewMatch(raw.round, raw.conference, top, bottom)
        : null,
  }
}

function toConference(
  raw: ConferenceBracketRaw,
  gamesById: Map<string, Match>
): ConferenceBracket {
  const tie = (t: BracketTieRaw) => toTie(t, gamesById)
  return {
    conference: raw.conference,
    wildCard: tie(raw.wildCard),
    roundOne: raw.roundOne.map(tie),
    semifinals: raw.semifinals.map(tie),
    final: tie(raw.final),
  }
}

type Lch = { l: number; c: number; h: number }

const SILVER: Lch = { l: 0.86, c: 0, h: 0 }
const STEEL: Lch = { l: 0.74, c: 0.1, h: 250 }
const EMBER: Lch = { l: 0.72, c: 0.15, h: 50 }

/** A club color lifted to read on the dark bracket, or null for near-greys. */
function accent(hex: string | undefined): Lch | null {
  const c = hex ? oklch(parse(hex)) : undefined
  if (!c || (c.c ?? 0) < 0.04) return null
  return {
    l: Math.min(Math.max(c.l, 0.66), 0.88),
    c: Math.min(c.c ?? 0, 0.17),
    h: c.h ?? 0,
  }
}

/** Too close to tell apart as small tinted pills (distance in oklab). */
function clashes(a: Lch, b: Lch): boolean {
  const rad = Math.PI / 180
  const da = a.c * Math.cos(a.h * rad) - b.c * Math.cos(b.h * rad)
  const db = a.c * Math.sin(a.h * rad) - b.c * Math.sin(b.h * rad)
  return Math.hypot(a.l - b.l, da, db) < 0.1
}

const toCss = ({ l, c, h }: Lch) =>
  `oklch(${(l * 100).toFixed(1)}% ${c.toFixed(3)} ${h.toFixed(1)})`

export interface SideColors {
  /** Pill fill and series-lead text. */
  fill: string
  /** Pill border — the club's own accent, even when the fill had to change. */
  border: string
}

/**
 * Colors per side of a series, for its game pills. The top (higher) seed
 * keeps its accent; when the two would read as the same color, the other
 * side's fill steps to its secondary, then silver, while its border keeps
 * its own accent so the pill still reads as that club.
 */
export function seriesColors(
  top: BracketTeam,
  bottom: BracketTeam
): { top: SideColors; bottom: SideColors } {
  const topPair = TEAM_COLOR_PAIRS[top.name]
  const topColor =
    accent(topPair?.primary) ?? accent(topPair?.secondary) ?? SILVER
  const pair = TEAM_COLOR_PAIRS[bottom.name]
  const own = accent(pair?.primary) ?? accent(pair?.secondary)
  const fill =
    // STEEL and EMBER sit too far apart for one color to clash with both,
    // so a distinct fill always exists.
    [own, accent(pair?.secondary), SILVER, STEEL, EMBER].find(
      (c): c is Lch => !!c && !clashes(topColor, c)
    ) ?? EMBER
  const topCss = toCss(topColor)
  return {
    top: { fill: topCss, border: topCss },
    bottom: { fill: toCss(fill), border: toCss(own ?? fill) },
  }
}

export function bracketTies(bracket: PlayoffBracket): BracketTie[] {
  return [
    ...[bracket.west, bracket.east].flatMap((c) => [
      c.wildCard,
      ...c.roundOne,
      ...c.semifinals,
      c.final,
    ]),
    bracket.cup,
  ]
}

let inFlight: Promise<void> | null = null

export function usePlayoffs() {
  const bracket = useState<PlayoffBracket | null>(
    'playoffs-bracket',
    () => null
  )
  const loading = useState<boolean>('playoffs-loading', () => false)
  const loaded = useState<boolean>('playoffs-loaded', () => false)
  const error = useState<boolean>('playoffs-error', () => false)

  // A caller that arrives mid-fetch (a /game?id= refresh while the bracket
  // tab is mounting) waits on the same request instead of returning early.
  function fetchBracket(force = false): Promise<void> {
    if (loading.value && inFlight) return inFlight
    if (loaded.value && !force) return Promise.resolve()
    inFlight = loadBracket(force).finally(() => {
      inFlight = null
    })
    return inFlight
  }

  async function loadBracket(force: boolean) {
    loading.value = true
    try {
      const url = force ? `/api/playoffs?_t=${Date.now()}` : '/api/playoffs'
      const data = await $fetch<PlayoffBracketRaw & { _error?: boolean }>(url)
      if (data._error) {
        // Keep whatever bracket is already on screen.
        error.value = !bracket.value
        return
      }
      const games = transformMatches({ events: data.events })
      const gamesById = new Map(games.map((m) => [m.id, m]))
      bracket.value = {
        west: toConference(data.west, gamesById),
        east: toConference(data.east, gamesById),
        cup: toTie(data.cup, gamesById),
      }
      loaded.value = true
      error.value = false
    } catch {
      error.value = !bracket.value
    } finally {
      loading.value = false
    }
  }

  const matches = computed<Match[]>(() =>
    bracket.value ? bracketTies(bracket.value).flatMap((t) => t.games) : []
  )

  // Kept apart from `matches`: a preview's placeholder date isn't a kickoff,
  // so it must never count as an overdue game for live polling.
  const previews = computed<Match[]>(() =>
    bracket.value
      ? bracketTies(bracket.value).flatMap((t) =>
          t.preview ? [t.preview] : []
        )
      : []
  )

  /** Live, at half time, or past kickoff without a status update yet. */
  const hasLiveGames = computed(() => {
    const now = Date.now()
    return matches.value.some(
      (m) =>
        m.status.code === 'live' ||
        m.status.code === 'ht' ||
        (m.status.code === 'ns' &&
          !m.timeTbd &&
          new Date(m.date).getTime() <= now)
    )
  })

  return {
    bracket,
    loading,
    loaded,
    error,
    matches,
    previews,
    hasLiveGames,
    fetchBracket,
  }
}
