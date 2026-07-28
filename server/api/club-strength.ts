type StandingsEntry = {
  team?: { displayName?: string }
  stats?: Array<{ name?: string; value?: number }>
}

type StandingsGroup = {
  standings?: { entries?: StandingsEntry[] }
  children?: StandingsGroup[]
}

type ClubRow = { name: string; ppg: number; gamesPlayed: number }

export type ClubStrength = {
  mls: Record<string, number>
  ligamx: Record<string, number>
}

const TTL_MS = 60 * 60_000

let cache: { fetchedAt: number; data: ClubStrength } | null = null

function statOf(entry: StandingsEntry, name: string): number | null {
  const stat = entry.stats?.find((s) => s.name === name)
  return typeof stat?.value === 'number' ? stat.value : null
}

function flatten(group: StandingsGroup): ClubRow[] {
  const rows: ClubRow[] = []
  const entries = group.standings?.entries ?? []
  for (const entry of entries) {
    const name = entry.team?.displayName
    const gamesPlayed = statOf(entry, 'gamesPlayed')
    let ppg = statOf(entry, 'ppg')
    if (ppg == null) {
      const points = statOf(entry, 'points')
      if (points != null && gamesPlayed) ppg = points / gamesPlayed
    }
    if (!name || ppg == null || gamesPlayed == null) continue
    rows.push({ name, ppg, gamesPlayed })
  }
  for (const child of group.children ?? []) rows.push(...flatten(child))
  return rows
}

// 1 = strongest club in its own league, 0 = weakest.
function toPercentiles(rows: ClubRow[]): Record<string, number> {
  const map: Record<string, number> = {}
  if (rows.length < 2) return map
  const sorted = [...rows].sort((a, b) => b.ppg - a.ppg)
  const last = sorted.length - 1
  sorted.forEach((row, i) => {
    map[row.name] = (last - i) / last
  })
  return map
}

async function fetchStandings(url: string): Promise<ClubRow[]> {
  try {
    const data = await $fetch<StandingsGroup>(url)
    return flatten(data)
  } catch {
    return []
  }
}

async function fetchMls(): Promise<Record<string, number>> {
  const rows = await fetchStandings(
    'https://site.api.espn.com/apis/v2/sports/soccer/usa.1/standings'
  )
  // Early-season tables are noise; wait until clubs have a real sample.
  if (rows.some((r) => r.gamesPlayed < 5)) return {}
  return toPercentiles(rows)
}

// Leagues Cup runs while Liga MX is only ~2 rounds into its Apertura, so the
// live table is meaningless. Walk back until a completed tournament (a full
// 17-game round robin) is found — ESPN mislabels these seasons, so the only
// trustworthy signal is gamesPlayed.
async function fetchLigaMx(): Promise<Record<string, number>> {
  const year = new Date().getFullYear()
  for (const season of [year, year - 1, year - 2]) {
    const rows = await fetchStandings(
      `https://site.api.espn.com/apis/v2/sports/soccer/mex.1/standings?season=${season}`
    )
    if (rows.length >= 10 && rows.every((r) => r.gamesPlayed >= 17)) {
      return toPercentiles(rows)
    }
  }
  return {}
}

export default defineEventHandler(async (): Promise<ClubStrength> => {
  const now = Date.now()
  if (cache && now - cache.fetchedAt < TTL_MS) return cache.data

  const [mls, ligamx] = await Promise.all([fetchMls(), fetchLigaMx()])
  const data: ClubStrength = { mls, ligamx }

  // Only cache a useful answer, otherwise retry on the next request.
  if (Object.keys(mls).length || Object.keys(ligamx).length) {
    cache = { fetchedAt: now, data }
  }
  return data
})
