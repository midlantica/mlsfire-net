export interface ClubStrength {
  mls: Record<string, number>
  ligamx: Record<string, number>
}

export function useClubStrength() {
  const strength = useState<ClubStrength>('club-strength', () => ({
    mls: {},
    ligamx: {},
  }))
  const loaded = useState<boolean>('club-strength-loaded', () => false)
  const loading = useState<boolean>('club-strength-loading', () => false)

  async function load() {
    if (loaded.value || loading.value) return
    loading.value = true
    try {
      strength.value = await $fetch<ClubStrength>('/api/club-strength')
      loaded.value = true
    } catch {
      loaded.value = true
    } finally {
      loading.value = false
    }
  }

  // 1 = strongest club in its own league, 0 = weakest, null = unranked.
  function strengthFor(team?: string | null): number | null {
    if (!team) return null
    const { mls, ligamx } = strength.value
    const pct = mls[team] ?? ligamx[team]
    return typeof pct === 'number' ? pct : null
  }

  return { strength, loaded, loading, load, strengthFor }
}
