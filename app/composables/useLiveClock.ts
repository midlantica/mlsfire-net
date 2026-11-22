import type { Match } from './useScores'

function parseClock(clock: string): number {
  const cleaned = clock.replace(/['''′`]/g, '')
  const [m = '0', s = '0'] = cleaned.split(':')
  return parseInt(m, 10) * 60 + parseInt(s, 10)
}

function formatClock(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

/**
 * A live match's clock, ticking every second between API refreshes and
 * re-synced whenever ESPN's clock changes. Runs on past 90:00 into stoppage
 * time; null unless the match is in play (so it holds still at half time).
 */
export function useLiveClock(match: () => Match | null | undefined) {
  const local = ref<string | null>(null)
  let timer: ReturnType<typeof setInterval> | null = null

  const isLive = () => match()?.status.code === 'live'

  function stop() {
    if (timer) {
      clearInterval(timer)
      timer = null
    }
  }

  function sync() {
    stop()
    const clock = match()?.status.clock
    if (!isLive() || !clock) {
      local.value = null
      return
    }
    const base = parseClock(clock)
    const syncedAt = Date.now()
    local.value = formatClock(base)
    timer = setInterval(() => {
      local.value = formatClock(
        base + Math.floor((Date.now() - syncedAt) / 1000)
      )
    }, 1000)
  }

  watch(() => [match()?.id, match()?.status.code, match()?.status.clock], sync)
  onMounted(sync)
  onUnmounted(stop)

  return computed(() =>
    isLive() ? (local.value ?? match()?.status.clock ?? 'LIVE') : null
  )
}
