/**
 * useMatchView — day-tab navigation, view-mode toggle, and match grouping
 *
 * Encapsulates all the "how do we display this week's matches?" logic that
 * previously lived inline in index.vue:
 *   • Day sub-tabs (built from the active week's matches, CT-anchored)
 *   • Active day selection (auto-selects today / nearest day; resets on week change)
 *   • View mode: By Time | Day's Best | Week's Best
 *   • byTimeGroups — matches grouped by 30-min kickoff slot, sorted by quality
 *   • bestMatches  — flat list sorted by quality (Day's Best / Week's Best)
 */

import type { Match } from './useScores'
import { useTimezone } from './useTimezone'

export type ViewMode = 'weekbytime' | 'bytime' | 'todaybest' | 'weekbest'

export interface DayTab {
  key: string // e.g. "2026-05-14"
  label: string // e.g. "Wed"
  shortDate: string // e.g. "May 14"
  matches: Match[]
}

// ── CT date helpers ───────────────────────────────────────────────────────────
function toCTDateKey(iso: string): string {
  return new Date(iso).toLocaleDateString('en-CA', {
    timeZone: 'America/Chicago',
  })
}
function toCTDayLabel(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    weekday: 'long',
    timeZone: 'America/Chicago',
  })
}
function toCTShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'America/Chicago',
  })
}

function autoSelectDay(days: DayTab[]): string {
  if (days.length === 0) return ''
  const todayKey = new Date().toLocaleDateString('en-CA', {
    timeZone: 'America/Chicago',
  })
  const todayTab = days.find((d) => d.key === todayKey)
  if (todayTab) return todayKey
  const todayMs = new Date(todayKey).getTime()
  return days.reduce((best: DayTab, d: DayTab) => {
    const dMs = new Date(d.key).getTime()
    const bestMs = new Date(best.key).getTime()
    const dDiff = Math.abs(dMs - todayMs)
    const bestDiff = Math.abs(bestMs - todayMs)
    if (dDiff < bestDiff) return d
    if (dDiff === bestDiff && dMs > bestMs) return d
    return best
  }).key
}

export function useMatchView(
  allWeekMatches: Readonly<Ref<Match[]>>,
  activeTab: Readonly<Ref<string>>
) {
  const { kickoffKeyHtml } = useTimezone()

  const viewMode = ref<ViewMode>('weekbytime')

  // ── Day tabs ──────────────────────────────────────────────────────────────
  const dayTabs = computed<DayTab[]>(() => {
    const map = new Map<string, Match[]>()
    for (const m of allWeekMatches.value) {
      const key = toCTDateKey(m.date)
      const arr = map.get(key) ?? []
      arr.push(m)
      map.set(key, arr)
    }
    return [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, matches]) => ({
        key,
        label: toCTDayLabel(matches[0]!.date),
        shortDate: toCTShortDate(matches[0]!.date),
        matches,
      }))
  })

  // ── Active day key ────────────────────────────────────────────────────────
  // Manual selection is reset when the user switches week tabs (not on poll).
  const _manualDayKey = ref<string | null>(null)

  watch(activeTab, () => {
    _manualDayKey.value = null
  })

  const activeDayKey = computed({
    get() {
      if (
        _manualDayKey.value &&
        dayTabs.value.some((d) => d.key === _manualDayKey.value)
      ) {
        return _manualDayKey.value
      }
      return autoSelectDay(dayTabs.value)
    },
    set(val: string) {
      _manualDayKey.value = val
    },
  })

  function selectDay(key: string) {
    activeDayKey.value = key
    if (viewMode.value === 'weekbest') viewMode.value = 'todaybest'
  }

  // ── Derived match lists ───────────────────────────────────────────────────
  const selectedDayMatches = computed(() => {
    if (viewMode.value === 'weekbest') return allWeekMatches.value
    const day = dayTabs.value.find((d) => d.key === activeDayKey.value)
    return day?.matches ?? []
  })

  // A placeholder kickoff (`timeTbd`) gets its own "TBD" group after the real slots.
  function groupBySlot(matches: Match[]): [string, Match[]][] {
    const slotMap = new Map<number, Match[]>()
    for (const m of matches) {
      const slot = m.timeTbd ? Number.POSITIVE_INFINITY : m.kickoffSlot
      const arr = slotMap.get(slot) ?? []
      arr.push(m)
      slotMap.set(slot, arr)
    }
    return [...slotMap.entries()]
      .sort(([a], [b]) => a - b)
      .map(([slot, slotMatches]) => [
        Number.isFinite(slot)
          ? kickoffKeyHtml(new Date(slot).toISOString())
          : 'TBD',
        [...slotMatches].sort((a, b) => b.qualityScore - a.qualityScore),
      ])
  }

  const byTimeGroups = computed(() => groupBySlot(selectedDayMatches.value))

  const bestMatches = computed(() =>
    [...selectedDayMatches.value].sort(
      (a, b) => b.qualityScore - a.qualityScore
    )
  )

  // ── Week-by-time: all week matches grouped by day, then by kickoff slot ───
  // Used by the 'weekbytime' view mode — shows every game this week with
  // day headers and time sub-headings, sorted chronologically.
  const weekByDayGroups = computed(
    (): { day: DayTab; slots: [string, Match[]][] }[] => {
      return dayTabs.value.map((day) => ({
        day,
        slots: groupBySlot(day.matches),
      }))
    }
  )

  return {
    viewMode,
    dayTabs,
    activeDayKey,
    selectDay,
    selectedDayMatches,
    byTimeGroups,
    bestMatches,
    weekByDayGroups,
  }
}
