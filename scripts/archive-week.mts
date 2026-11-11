/**
 * pnpm archive:week <monday YYYY-MM-DD> [--site=http://localhost:3000] [--force]
 *
 * Freezes one finished Mon–Sun week of matches into
 * server/assets/scoreboard/<from>-<to>.json, which /api/scores then serves
 * instead of calling ESPN. Reads the site's own /api/scores (so records are
 * the same ones the live site computed) — run `pnpm dev` first, or pass
 * --site. Only the fields transformMatches() reads are kept.
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

type Obj = Record<string, unknown>

const args = process.argv.slice(2)
const monday = args.find((a) => /^\d{4}-\d{2}-\d{2}$/.test(a))
const force = args.includes('--force')
const site = (
  args.find((a) => a.startsWith('--site='))?.slice(7) ?? 'http://localhost:3000'
).replace(/\/$/, '')

if (!monday || new Date(`${monday}T12:00:00Z`).getUTCDay() !== 1) {
  console.error(
    'Usage: pnpm archive:week <monday YYYY-MM-DD> [--site=URL] [--force]'
  )
  process.exit(1)
}

const compact = (d: Date) => d.toISOString().slice(0, 10).replace(/-/g, '')
const start = new Date(`${monday}T12:00:00Z`)
const end = new Date(start)
end.setUTCDate(start.getUTCDate() + 6)
const from = compact(start)
const to = compact(end)

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const out = join(root, 'server/assets/scoreboard', `${from}-${to}.json`)
if (existsSync(out) && !force) {
  console.error(`${out} already exists — pass --force to overwrite.`)
  process.exit(1)
}

const res = await fetch(`${site}/api/scores?from=${from}&to=${to}`)
if (!res.ok) throw new Error(`${site} responded ${res.status}`)
const data = (await res.json()) as Obj
if (data._error || data._stale) throw new Error('ESPN data was stale — retry.')
const events = (data.events as Obj[]) ?? []
if (!events.length) throw new Error(`No matches between ${from} and ${to}.`)

const pick = (o: Obj | undefined, keys: string[]): Obj =>
  Object.fromEntries(
    keys.filter((k) => o?.[k] !== undefined).map((k) => [k, o![k]])
  )

const trimmed = events.map((evt) => {
  const status = evt.status as Obj | undefined
  const comp = (evt.competitions as Obj[] | undefined)?.[0]
  return {
    ...pick(evt, ['id', 'date', 'name']),
    season: pick(evt.season as Obj, ['slug', 'year']),
    status: {
      ...pick(status, ['displayClock']),
      type: pick(status?.type as Obj, ['name', 'state', 'completed']),
    },
    competitions: [
      {
        notes: ((comp?.notes as Obj[]) ?? []).map((n) => pick(n, ['headline'])),
        competitors: ((comp?.competitors as Obj[]) ?? []).map((c) => ({
          ...pick(c, ['homeAway', 'score', 'shootoutScore']),
          team: pick(c.team as Obj, ['displayName', 'color', 'alternateColor']),
          records: ((c.records as Obj[]) ?? []).map((r) =>
            pick(r, ['type', 'abbreviation', 'summary'])
          ),
        })),
      },
    ],
  }
})

const unfinished = trimmed.filter((e) => !(e.status.type as Obj).completed)
if (unfinished.length && !force) {
  console.error(
    `${unfinished.length} match(es) not final yet — a frozen week must be finished. Pass --force to save anyway.`
  )
  process.exit(1)
}

mkdirSync(dirname(out), { recursive: true })
writeFileSync(out, JSON.stringify({ events: trimmed }) + '\n')
console.log(`Saved ${trimmed.length} matches → ${out}`)
