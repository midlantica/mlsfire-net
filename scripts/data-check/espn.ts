import { SEASON_YEAR } from '../../app/constants/mls'

export type Severity = 'error' | 'warn' | 'info'
export type Category =
  'teams' | 'venues' | 'season' | 'rosters' | 'assets' | 'site'

export interface Finding {
  key: string
  severity: Severity
  category: Category
  title: string
  detail: string
  fix?: string
}

export interface EspnTeamRef {
  id: string
  displayName: string
}

export interface EspnEvent {
  id: string
  date: string
  competitions: Array<{
    venue?: { fullName?: string }
    competitors: Array<{ homeAway: 'home' | 'away'; team: EspnTeamRef }>
    status: { type: { completed: boolean } }
  }>
}

export const ESPN = 'https://site.api.espn.com/apis'
// ESPN 403s bot-style UAs (e.g. "compatible; …Check/1.0"), while our own edge
// function 410s scripted ones (node/curl) — so each side gets a UA it accepts.
const ESPN_USER_AGENT = 'node'
const SITE_USER_AGENT =
  'Mozilla/5.0 (compatible; MLSFireDataCheck/1.0; +https://mlsfire.net)'

export async function getJson<T>(url: string, attempts = 2): Promise<T> {
  const userAgent = url.startsWith(ESPN) ? ESPN_USER_AGENT : SITE_USER_AGENT
  let lastError: unknown
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url, {
        headers: { accept: 'application/json', 'user-agent': userAgent },
        signal: AbortSignal.timeout(20_000),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status} from ${url}`)
      return (await res.json()) as T
    } catch (err) {
      lastError = err
    }
  }
  throw lastError
}

export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

export function slug(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

// Each ESPN endpoint is fetched once per run and shared between checks.
export function createContext() {
  const memo = new Map<string, Promise<unknown>>()
  const once = <T>(key: string, load: () => Promise<T>): Promise<T> => {
    if (!memo.has(key)) memo.set(key, load())
    return memo.get(key) as Promise<T>
  }

  return {
    teams: () =>
      once('teams', async () => {
        const data = await getJson<{
          sports: Array<{
            leagues: Array<{
              teams: Array<{ team: EspnTeamRef & { isAllStar?: boolean } }>
            }>
          }>
        }>(`${ESPN}/site/v2/sports/soccer/usa.1/teams`)
        return (data.sports[0]?.leagues[0]?.teams ?? [])
          .map((t) => t.team)
          .filter((t) => !t.isAllStar)
      }),

    seasonEvents: () =>
      once('season', async () => {
        // ESPN rejects dates=A-B ranges but accepts whole months (YYYYMM).
        const months = Array.from(
          { length: 12 },
          (_, i) => `${SEASON_YEAR}${String(i + 1).padStart(2, '0')}`
        )
        const pages = await Promise.all(
          months.map((m) =>
            getJson<{ events?: EspnEvent[] }>(
              `${ESPN}/site/v2/sports/soccer/usa.1/scoreboard?dates=${m}&limit=1000`
            )
          )
        )
        const byId = new Map<string, EspnEvent>()
        for (const page of pages)
          for (const evt of page.events ?? []) byId.set(evt.id, evt)
        return [...byId.values()].sort((a, b) => a.date.localeCompare(b.date))
      }),

    rosterSize: (teamId: string) =>
      once(`roster:${teamId}`, async () => {
        const data = await getJson<{
          athletes?: Array<{ items?: unknown[] }>
        }>(`${ESPN}/site/v2/sports/soccer/usa.1/teams/${teamId}/roster`)
        return (data.athletes ?? []).reduce(
          (n, entry) =>
            n + (Array.isArray(entry.items) ? entry.items.length : 1),
          0
        )
      }),
  }
}

export type Context = ReturnType<typeof createContext>
export type Add = (finding: Finding) => void

export interface Check {
  category: Category
  name: string
  run: (ctx: Context, add: Add) => Promise<void>
}
