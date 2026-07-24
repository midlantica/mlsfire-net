import { TEAM_CONFERENCE } from '~/composables/useMyTeam'
import { normalizeTeamName } from '~/composables/useScores'

export interface StandingEntry {
  rank: number
  rankChange: number
  team: string
  gp: number
  w: number
  d: number
  l: number
  pts: number
  gf: number
  ga: number
  gd: number
  ppg: number
  overall: string
}

export interface ConferenceStandings {
  name: string
  entries: StandingEntry[]
}

function getStat(
  stats: Array<{ name: string; value: number }>,
  name: string
): number {
  return stats.find((s) => s.name === name)?.value ?? 0
}

export function useStandings() {
  const conferences = useState<ConferenceStandings[]>(
    'standings-conferences',
    () => []
  )
  const loading = useState<boolean>('standings-loading', () => false)
  const error = useState<string | null>('standings-error', () => null)
  const loaded = useState<boolean>('standings-loaded', () => false)

  async function fetchStandings() {
    if (loading.value || loaded.value) return
    loading.value = true
    error.value = null
    try {
      const data = await $fetch<Record<string, unknown>>('/api/standings')
      const children = (data.children as Array<Record<string, unknown>>) ?? []
      conferences.value = children.map((conf) => {
        const name = conf.name as string
        const standingsData = conf.standings as Record<string, unknown>
        const entries =
          (standingsData?.entries as Array<Record<string, unknown>>) ?? []
        const seen = new Set<string>()
        return {
          name,
          entries: entries
            .map((entry) => {
              const stats =
                (entry.stats as Array<{ name: string; value: number }>) ?? []
              return {
                rank: getStat(stats, 'rank'),
                rankChange: getStat(stats, 'rankChange'),
                team: normalizeTeamName(
                  ((entry.team as Record<string, unknown>)
                    ?.displayName as string) ?? '?'
                ),
                gp: getStat(stats, 'gamesPlayed'),
                w: getStat(stats, 'wins'),
                d: getStat(stats, 'ties'),
                l: getStat(stats, 'losses'),
                pts: getStat(stats, 'points'),
                gf: getStat(stats, 'pointsFor'),
                ga: getStat(stats, 'pointsAgainst'),
                gd: getStat(stats, 'pointDifferential'),
                ppg: getStat(stats, 'ppg'),
                overall:
                  ((
                    stats.find((s) => s.name === 'overall') as
                      Record<string, unknown> | undefined
                  )?.summary as string) ?? '',
              }
            })
            // ESPN's standings API has occasionally returned one conference's
            // entries polluted with teams from the other conference (or
            // duplicates). Guard against that by cross-checking our known
            // conference map and deduping by team name.
            .filter((e) => {
              if (TEAM_CONFERENCE[e.team] && TEAM_CONFERENCE[e.team] !== name)
                return false
              if (seen.has(e.team)) return false
              seen.add(e.team)
              return true
            })
            .sort((a, b) => a.rank - b.rank),
        }
      })

      loaded.value = true
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : 'Failed to load standings'
    } finally {
      loading.value = false
    }
  }

  return { conferences, loading, error, loaded, fetchStandings }
}

export interface ConferenceBadge {
  rank: number
  letter: 'E' | 'W'
}

// ── Shared team → conference-rank badge lookup ────────────────────────────
// Derived from the shared `conferences` state, keyed by full team display
// name. Used by GameBlock and GameDetail/Modal to render the small
// "8E" / "7W" style conference-position badge next to team names.
export function useConferenceBadges() {
  const { conferences } = useStandings()

  const badgeByTeam = computed(() => {
    const map: Record<string, ConferenceBadge> = {}
    for (const conf of conferences.value) {
      const letter: 'E' | 'W' = conf.name.toLowerCase().includes('western')
        ? 'W'
        : 'E'
      for (const entry of conf.entries) {
        map[entry.team] = { rank: entry.rank, letter }
      }
    }
    return map
  })

  return { badgeByTeam }
}
