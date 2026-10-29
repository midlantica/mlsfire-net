/**
 * useStats — fetch and cache season leaders
 * (Goals / Assists / Accurate Passes / Saves / Yellow Cards / Red Cards)
 */

export interface LeaderEntry {
  rank: number
  athleteId: string
  displayName: string
  team: string
  headshot: string
  value: number
}

export interface StatsData {
  goals: LeaderEntry[]
  assists: LeaderEntry[]
  accuratePasses: LeaderEntry[]
  saves: LeaderEntry[]
  yellowCards: LeaderEntry[]
  redCards: LeaderEntry[]
}

export function useStats() {
  const data = useState<StatsData | null>('stats-data', () => null)
  const loading = ref(false)
  const error = ref<string | null>(null)
  const loaded = ref(false)

  /** `force` refetches in the background, keeping current leaders on screen. */
  async function fetchStats(force = false) {
    if (loaded.value && !force) return
    const background = force && !!data.value
    if (!background) loading.value = true
    error.value = null
    try {
      const result = await $fetch<StatsData>('/api/stats')
      data.value = result
      loaded.value = true
    } catch (e: unknown) {
      if (!background) {
        error.value = e instanceof Error ? e.message : 'Failed to load stats'
      }
    } finally {
      if (!background) loading.value = false
    }
  }

  return { data, loading, error, loaded, fetchStats }
}
