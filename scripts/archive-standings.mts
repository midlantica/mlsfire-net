/**
 * pnpm archive:standings <year> [--force]
 *
 * Freezes a finished season's final standings into
 * server/assets/standings/<year>.json, which /api/standings then serves
 * instead of calling ESPN. Run it once the regular season ends (after
 * Decision Day). Only the fields the standings table reads are kept.
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const KEEP_STATS = new Set([
  'rank',
  'gamesPlayed',
  'wins',
  'ties',
  'losses',
  'points',
  'pointsFor',
  'pointsAgainst',
  'pointDifferential',
  'ppg',
  'overall',
])

interface EspnStat {
  name: string
  value?: number
  summary?: string
}
interface EspnEntry {
  team: { displayName: string }
  note?: { description?: string }
  stats: EspnStat[]
}
interface EspnStandings {
  children: Array<{
    name: string
    standings: { season?: number; entries: EspnEntry[] }
  }>
}

const args = process.argv.slice(2)
const year = Number(args.find((a) => /^\d{4}$/.test(a)))
const force = args.includes('--force')
if (!year) {
  console.error('Usage: pnpm archive:standings <year> [--force]')
  process.exit(1)
}

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const out = join(root, 'server/assets/standings', `${year}.json`)
if (existsSync(out) && !force) {
  console.error(`${out} already exists — pass --force to overwrite.`)
  process.exit(1)
}

const res = await fetch(
  `https://site.api.espn.com/apis/v2/sports/soccer/usa.1/standings?season=${year}`
)
if (!res.ok) throw new Error(`ESPN responded ${res.status}`)
const data = (await res.json()) as EspnStandings

const children = data.children.map((conf) => {
  if (conf.standings.season !== year) {
    throw new Error(
      `ESPN returned season ${conf.standings.season} for ${conf.name}, not ${year}`
    )
  }
  return {
    name: conf.name,
    standings: {
      season: year,
      entries: conf.standings.entries.map((e) => ({
        team: { displayName: e.team.displayName },
        ...(e.note?.description
          ? { note: { description: e.note.description } }
          : {}),
        stats: e.stats
          .filter((s) => KEEP_STATS.has(s.name))
          .map(({ name, value, summary }) => ({ name, value, summary })),
      })),
    },
  }
})

const gamesPlayed = new Set(
  children.flatMap((c) =>
    c.standings.entries.map(
      (e) => e.stats.find((s) => s.name === 'gamesPlayed')?.value
    )
  )
)
if (gamesPlayed.size !== 1) {
  console.warn(
    `Warning: teams have played different numbers of games (${[...gamesPlayed].join(', ')}) — is the season really over?`
  )
}

mkdirSync(dirname(out), { recursive: true })
writeFileSync(out, JSON.stringify({ children }) + '\n')
console.log(
  `Saved ${children.map((c) => `${c.name} (${c.standings.entries.length})`).join(', ')} → ${out}`
)
