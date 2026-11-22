import type { Match } from './useScores'

/** Seconds from ESPN's clock: "63'", "63:12", or stoppage time as "90'+3'". */
function parseClock(clock: string): number {
  const [regular = '0', added = '0'] = clock.replace(/['‘’′`]/g, '').split('+')
  const [m = '0', s = '0'] = regular.split(':')
  return (
    (parseInt(m, 10) + (parseInt(added, 10) || 0)) * 60 + (parseInt(s, 10) || 0)
  )
}

function formatClock(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

// When each "match + ESPN minute" was first seen, shared by every clock on
// the page so a bracket card and its popup count from the same instant.
const firstSeen = new Map<string, number>()

function seenAt(key: string): number {
  const known = firstSeen.get(key)
  if (known !== undefined) return known
  if (firstSeen.size > 200) firstSeen.clear()
  const now = Date.now()
  firstSeen.set(key, now)
  return now
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
    if (!/\d/.test(clock)) {
      local.value = clock
      return
    }
    const base = parseClock(clock)
    const syncedAt = seenAt(`${match()?.id}|${clock}`)
    const update = () => {
      local.value = formatClock(
        base + Math.floor((Date.now() - syncedAt) / 1000)
      )
    }
    update()
    timer = setInterval(update, 1000)
  }

  // Separate sources, so a bracket refresh that swaps in a new Match object
  // with the same clock doesn't snap the ticker back.
  watch(
    [
      () => match()?.id,
      () => match()?.status.code,
      () => match()?.status.clock,
    ],
    sync
  )
  onMounted(sync)
  onUnmounted(stop)

  return computed(() =>
    isLive() ? (local.value ?? match()?.status.clock ?? 'LIVE') : null
  )
}
