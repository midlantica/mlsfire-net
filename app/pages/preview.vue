<script setup lang="ts">
  import { transformMatches, type Match } from '~/composables/useScores'
  import { useMatchView } from '~/composables/useMatchView'
  import { useStandings } from '~/composables/useStandings'
  import { TEAM_LIST } from '~/composables/useTeamTheme'
  import {
    getCompetition,
    getRoundInfo,
    type Competition,
  } from '~/constants/rounds'

  // Design sandbox only — never expose it from a deployed build.
  if (!import.meta.dev) {
    throw createError({ statusCode: 404, statusMessage: 'Not Found' })
  }

  definePageMeta({ title: 'Design Sandbox' })

  useHead({ title: 'Design Sandbox · MLS Fire' })

  interface TimeWindow {
    key: string
    label: string
    blurb: string
    league: 'usa.1' | 'concacaf.leagues.cup' | 'both'
    from: string
    to: string
    anchor: string // the CT date that plays the part of "today"
  }

  // Real historical ESPN windows — these return authentic season slugs and
  // series notes, so the postseason / Leagues Cup UI can be judged against the
  // exact payloads it will see in production rather than fabricated data.
  // `anchor` is the date the Last / This / Next Week stepper pivots around.
  const WINDOWS: TimeWindow[] = [
    {
      key: 'playoffs-open',
      label: 'Playoffs — Wild Card & Round One',
      blurb: 'Oct 2025 · series notes, conference round chips',
      league: 'usa.1',
      from: '20251013',
      to: '20251116',
      anchor: '2025-10-27',
    },
    {
      key: 'mls-cup',
      label: 'Conference Finals & MLS Cup',
      blurb: 'Nov-Dec 2025 · conference finals, then the gold MLS CUP chip',
      league: 'usa.1',
      from: '20251117',
      to: '20251215',
      anchor: '2025-11-24',
    },
    {
      key: 'leagues-cup-phase',
      label: 'Leagues Cup — League Phase',
      blurb:
        'Jul-Aug 2025 · MLS vs Liga MX, the 54-game Swiss-style league phase',
      league: 'concacaf.leagues.cup',
      from: '20250729',
      to: '20250831',
      anchor: '2025-08-04',
    },
    {
      key: 'mixed-overlap',
      label: 'MLS + Leagues Cup (overlap)',
      blurb:
        'Aug-Sep 2025 · both competitions on one wall — MLS resumes Aug 9 while the cup knockouts run',
      league: 'both',
      from: '20250804',
      to: '20250907',
      anchor: '2025-08-18',
    },
    {
      key: 'leagues-cup-ko',
      label: 'Leagues Cup — Knockouts',
      blurb: 'Aug-Sep 2025 · quarters, semis, third place, final',
      league: 'concacaf.leagues.cup',
      from: '20250815',
      to: '20250907',
      anchor: '2025-08-25',
    },
    {
      key: 'regular-all-star',
      label: 'Regular Season & All-Star Game',
      blurb:
        'Jul 2025 · control window — plain regular season plus the calendar’s only one-off',
      league: 'usa.1',
      from: '20250714',
      to: '20250803',
      anchor: '2025-07-21',
    },
  ]

  type WeekTab = 'last' | 'this' | 'next'

  const route = useRoute()

  const initial =
    WINDOWS.find((w) => w.key === route.query.window) ?? WINDOWS[0]!

  const activeWindowKey = ref<string>(initial.key)
  const activeWeek = ref<WeekTab>((route.query.week as WeekTab) ?? 'this')

  const activeWindow = computed(
    () => WINDOWS.find((w) => w.key === activeWindowKey.value) ?? WINDOWS[0]!
  )

  const matches = ref<Match[]>([])
  const loading = ref(false)
  const errorMsg = ref<string | null>(null)
  const showDebug = ref(true)
  const hideRegularSeason = ref(
    initial.key === 'playoffs-open' || initial.key === 'mls-cup'
  )
  const activeCompetition = ref<Competition | 'all'>('all')
  const viewMode = ref<'week' | 'round'>('week')

  async function load() {
    loading.value = true
    errorMsg.value = null
    try {
      const w = activeWindow.value
      const leagues =
        w.league === 'both'
          ? (['usa.1', 'concacaf.leagues.cup'] as const)
          : ([w.league] as const)
      const payloads = await Promise.all(
        leagues.map((league) =>
          $fetch<Record<string, unknown>>('/api/preview-scores', {
            query: { from: w.from, to: w.to, league },
          })
        )
      )
      matches.value = payloads
        .flatMap((data) => transformMatches(data))
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    } catch (e) {
      errorMsg.value = e instanceof Error ? e.message : String(e)
      matches.value = []
    } finally {
      loading.value = false
    }
  }

  watch(activeWindowKey, () => {
    const w = activeWindow.value
    activeWeek.value = 'this'
    activeCompetition.value = 'all'
    hideRegularSeason.value = w.key === 'playoffs-open' || w.key === 'mls-cup'
    load()
  })

  // The live wall pre-fetches standings on page load (so conference-position
  // badges are ready before the Matches tab ever renders) — the sandbox has
  // no such entry point, so it has to trigger that fetch itself or every
  // MLS team on this page would silently show no badge at all.
  const { fetchStandings } = useStandings()

  onMounted(() => {
    load()
    fetchStandings()
  })

  // ── Week maths (CT-anchored, Monday-start, matching the live wall) ─────────
  function shiftKey(dateKey: string, days: number): string {
    const d = new Date(`${dateKey}T12:00:00Z`)
    d.setUTCDate(d.getUTCDate() + days)
    return d.toISOString().slice(0, 10)
  }

  function mondayOf(dateKey: string): string {
    const d = new Date(`${dateKey}T12:00:00Z`)
    return shiftKey(dateKey, -((d.getUTCDay() + 6) % 7))
  }

  function ctKey(iso: string): string {
    return new Date(iso).toLocaleDateString('en-CA', {
      timeZone: 'America/Chicago',
    })
  }

  function prettyKey(dateKey: string): string {
    return new Date(`${dateKey}T12:00:00Z`).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC',
    })
  }

  const weekRanges = computed<
    Record<WeekTab, { start: string; end: string; label: string }>
  >(() => {
    const base = mondayOf(activeWindow.value.anchor)
    const build = (offset: number) => {
      const start = shiftKey(base, offset)
      const end = shiftKey(start, 6)
      return { start, end, label: `${prettyKey(start)} - ${prettyKey(end)}` }
    }
    return { last: build(-7), this: build(0), next: build(7) }
  })

  const filteredMatches = computed(() => {
    let list = matches.value
    if (hideRegularSeason.value) {
      list = list.filter((m) => m.seasonSlug !== 'regular-season')
    }
    if (activeCompetition.value !== 'all') {
      list = list.filter(
        (m) => getCompetition(m.seasonSlug) === activeCompetition.value
      )
    }
    return list
  })

  const weekMatches = computed(() => {
    const { start, end } = weekRanges.value[activeWeek.value]
    return filteredMatches.value.filter((m) => {
      const key = ctKey(m.date)
      return key >= start && key <= end
    })
  })

  function weekCount(tab: WeekTab): number {
    const { start, end } = weekRanges.value[tab]
    return filteredMatches.value.filter((m) => {
      const key = ctKey(m.date)
      return key >= start && key <= end
    }).length
  }

  const { weekByDayGroups } = useMatchView(weekMatches, activeWeek)

  // Leagues Cup games always land on their own day, never sharing a day with
  // MLS fixtures — so a day is a "Leagues Cup day" if every match on it is.
  function isLeaguesCupDay(dayMatches: Match[]): boolean {
    return (
      dayMatches.length > 0 &&
      dayMatches.every((m) => getCompetition(m.seasonSlug) === 'Leagues Cup')
    )
  }

  // ── Competition pills ─────────────────────────────────────────────────────
  const competitionOptions = computed<Competition[]>(() => {
    const seen = new Set<Competition>()
    for (const m of matches.value) seen.add(getCompetition(m.seasonSlug))
    return [...seen]
  })

  // ── Round view (whole window, grouped by season slug) ─────────────────────
  interface RoundGroup {
    key: string
    label: string
    matches: Match[]
  }

  function labelFor(slug: string | null): string {
    const info = getRoundInfo(slug)
    if (info) return info.stage
    if (!slug) return 'NO SEASON SLUG'
    return slug.replace(/-/g, ' ').toUpperCase()
  }

  const groups = computed<RoundGroup[]>(() => {
    const map = new Map<string, Match[]>()
    for (const m of filteredMatches.value) {
      const key = m.seasonSlug ?? 'none'
      const bucket = map.get(key)
      if (bucket) bucket.push(m)
      else map.set(key, [m])
    }
    return [...map.entries()]
      .map(([key, list]) => ({
        key,
        label: labelFor(key === 'none' ? null : key),
        matches: list,
      }))
      .sort((a, b) => {
        const wa = getRoundInfo(a.key === 'none' ? null : a.key)?.weight ?? 0
        const wb = getRoundInfo(b.key === 'none' ? null : b.key)?.weight ?? 0
        if (wa !== wb) return wa - wb
        return a.label.localeCompare(b.label)
      })
  })

  const noteCount = computed(
    () => filteredMatches.value.filter((m) => m.seriesNote).length
  )

  // ── Game detail modal ──────────────────────────────────────────────────────
  const gameDetailOpen = ref(false)
  const gameDetailMatch = ref<Match | null>(null)

  function openGameDetail(match: Match) {
    gameDetailMatch.value = match
    gameDetailOpen.value = true
  }

  function closeGameDetail() {
    gameDetailOpen.value = false
    gameDetailMatch.value = null
  }

  // Deep link straight into a match modal: ?match=<espnId>, or ?match=pens to
  // grab the first shootout in the window (handy when reviewing that layout).
  watch(
    matches,
    (list) => {
      const want = route.query.match as string | undefined
      if (!want || gameDetailOpen.value) return
      const hit =
        want === 'pens'
          ? list.find((m) => m.homeShootout != null)
          : list.find((m) => m.id === want)
      if (hit) openGameDetail(hit)
    },
    { immediate: true }
  )

  // ── My Club modal ─────────────────────────────────────────────────────────
  // The sandbox has no AppHeader, so it needs its own way in.
  const clubTeam = ref<string>(
    (route.query.club as string) ?? TEAM_LIST[0] ?? ''
  )
  const clubOpen = ref(Boolean(route.query.club))

  // ── Leagues Cup info modal ─────────────────────────────────────────────────
  const leaguesCupInfoOpen = ref(false)
</script>

<template>
  <main class="sandbox">
    <header class="sandbox-head">
      <h1>Design Sandbox</h1>
      <p class="sandbox-sub">
        Dev-only time machine. Loads real historical ESPN windows so postseason
        and Leagues Cup wall items can be designed in situ.
      </p>
    </header>

    <section class="panel">
      <div class="control-row">
        <label class="ctl ctl-wide">
          <span>Time window</span>
          <select v-model="activeWindowKey">
            <option v-for="w in WINDOWS" :key="w.key" :value="w.key">
              {{ w.label }}
            </option>
          </select>
        </label>

        <label class="ctl">
          <span>View</span>
          <select v-model="viewMode">
            <option value="week">Week wall</option>
            <option value="round">By round</option>
          </select>
        </label>

        <label class="ctl ctl-wide">
          <span>My Club modal</span>
          <div class="club-row">
            <select v-model="clubTeam">
              <option v-for="t in TEAM_LIST" :key="t" :value="t">
                {{ t }}
              </option>
            </select>
            <button class="go" @click="clubOpen = true">Open</button>
          </div>
        </label>

        <label class="toggle">
          <input v-model="showDebug" type="checkbox" />
          <span>Debug labels</span>
        </label>

        <label class="toggle">
          <input v-model="hideRegularSeason" type="checkbox" />
          <span>Hide regular season</span>
        </label>
      </div>

      <p class="blurb">{{ activeWindow.blurb }}</p>

      <div v-if="competitionOptions.length > 1" class="pill-row">
        <button
          class="pill"
          :class="{ 'pill-on': activeCompetition === 'all' }"
          @click="activeCompetition = 'all'"
        >
          All
        </button>
        <button
          v-for="c in competitionOptions"
          :key="c"
          class="pill"
          :class="{ 'pill-on': activeCompetition === c }"
          @click="activeCompetition = c"
        >
          {{ c }}
        </button>
      </div>

      <p class="stat-line">
        <strong>{{ filteredMatches.length }}</strong> matches in window ·
        <strong>{{ groups.length }}</strong> rounds ·
        <strong>{{ noteCount }}</strong> with a series note
      </p>

      <p v-if="errorMsg" class="err">{{ errorMsg }}</p>
    </section>

    <!-- ── Week wall ────────────────────────────────────────────────────── -->
    <template v-if="viewMode === 'week'">
      <div class="week-tabs">
        <button
          v-for="tab in ['last', 'this', 'next'] as const"
          :key="tab"
          class="week-tab"
          :class="{ active: activeWeek === tab }"
          @click="activeWeek = tab"
        >
          <span v-if="tab === 'last'">← Last</span>
          <span v-else-if="tab === 'this'">This Week</span>
          <span v-else>Next →</span>
          <span class="week-label">
            {{ weekRanges[tab].label }} · {{ weekCount(tab) }}
          </span>
        </button>
      </div>

      <p v-if="!loading && !weekMatches.length" class="empty">
        No matches in this week. Try another week tab, another window, or untick
        “Hide regular season”.
      </p>

      <section
        v-for="{ day, slots } in weekByDayGroups"
        :key="day.key"
        class="day-section"
        :class="{ 'lc-day': isLeaguesCupDay(day.matches) }"
      >
        <div v-if="isLeaguesCupDay(day.matches)" class="lc-logo-row">
          <img src="/leagues-cup-logo.svg" alt="Leagues Cup" class="lc-logo" />
          <button
            class="lc-info-btn"
            aria-label="About Leagues Cup"
            @click="leaguesCupInfoOpen = true"
          >
            <img src="/info-rounded.svg" alt="" class="lc-info-icon" />
          </button>
        </div>
        <h2 class="day-heading">{{ day.label }}, {{ day.shortDate }}</h2>

        <div
          v-for="[slot, slotMatches] in slots"
          :key="slot"
          class="slot-section"
        >
          <h3 class="slot-heading" v-html="slot" />
          <div class="cards-grid">
            <div v-for="m in slotMatches" :key="m.id" class="card-wrap">
              <GameBlock
                :match="m"
                conference-tooltip-side="right"
                @open-game-detail="openGameDetail"
              />
              <code v-if="showDebug" class="debug">
                {{ m.seasonSlug ?? 'no-slug' }} · {{ m.seriesNote ?? '—' }}
              </code>
            </div>
          </div>
        </div>
      </section>
    </template>

    <!-- ── Round view ───────────────────────────────────────────────────── -->
    <template v-else>
      <p v-if="!loading && !filteredMatches.length" class="empty">
        No matches in this window.
      </p>

      <section v-for="g in groups" :key="g.key" class="round-group">
        <h2 class="round-heading">
          {{ g.label }}
          <span class="round-count">{{ g.matches.length }}</span>
        </h2>
        <code v-if="showDebug" class="slug-echo"
          >season.slug = {{ g.key }}</code
        >

        <div class="cards-grid">
          <div v-for="m in g.matches" :key="m.id" class="card-wrap">
            <GameBlock
              :match="m"
              show-date
              conference-tooltip-side="right"
              @open-game-detail="openGameDetail"
            />
            <code v-if="showDebug" class="debug">
              note = {{ m.seriesNote ?? '—' }}
            </code>
          </div>
        </div>
      </section>
    </template>

    <ClientOnly>
      <GameDetailModal
        :open="gameDetailOpen"
        :match="gameDetailMatch"
        @close="closeGameDetail"
      />
      <TeamDetailModal
        :open="clubOpen"
        :view-team="clubTeam"
        @close="clubOpen = false"
        @select-team="clubTeam = $event"
        @open-game-detail="openGameDetail"
      />
      <LeaguesCupInfoModal
        :open="leaguesCupInfoOpen"
        @close="leaguesCupInfoOpen = false"
      />
    </ClientOnly>
  </main>
</template>

<style scoped>
  .sandbox {
    max-width: 82rem;
    margin: 0 auto;
    padding: 1.5rem 1rem 6rem;
    color: oklab(95% 0 0);
  }

  .sandbox-head h1 {
    font-size: 1.5rem;
    font-weight: 700;
    letter-spacing: 0.02em;
    margin: 0;
  }

  .sandbox-sub {
    margin: 0.35rem 0 0;
    font-size: 0.85rem;
    line-height: 1.5;
    color: oklab(80% 0 0 / 0.75);
    max-width: 44rem;
  }

  .panel {
    margin: 1.25rem 0 1.5rem;
    padding: 1rem;
    border: 1px solid oklab(100% 0 0 / 0.12);
    border-radius: 0.5rem;
    background: oklab(24% 0 0 / 0.5);
  }

  .control-row {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-end;
    gap: 0.75rem;
  }

  .ctl {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    font-size: 0.65rem;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: oklab(80% 0 0 / 0.65);
  }

  .ctl-wide select {
    min-width: 14rem;
  }

  .club-row {
    display: flex;
    gap: 0.35rem;
  }

  .ctl select {
    font-size: 0.8rem;
    font-family: inherit;
    padding: 0.3rem 0.4rem;
    border: 1px solid oklab(100% 0 0 / 0.18);
    border-radius: 0.25rem;
    background: oklab(18% 0 0);
    color: oklab(95% 0 0);
  }

  .go {
    font-size: 0.8rem;
    font-weight: 600;
    letter-spacing: 0.06em;
    padding: 0.35rem 0.8rem;
    border: none;
    border-radius: 0.25rem;
    background: oklab(84% 0.03 0.14);
    color: oklab(20% 0.02 0.03);
    cursor: pointer;
  }

  .toggle {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    font-size: 0.75rem;
    color: oklab(85% 0 0 / 0.8);
    cursor: pointer;
  }

  .blurb {
    margin: 0.7rem 0 0;
    font-size: 0.75rem;
    color: oklab(80% 0 0 / 0.65);
  }

  .pill-row {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;
    margin-top: 0.8rem;
    padding-top: 0.8rem;
    border-top: 1px solid oklab(100% 0 0 / 0.1);
  }

  .pill {
    font-size: 0.7rem;
    letter-spacing: 0.06em;
    padding: 0.25rem 0.6rem;
    border: 1px solid oklab(100% 0 0 / 0.14);
    border-radius: 1rem;
    background: oklab(100% 0 0 / 0.05);
    color: oklab(88% 0 0 / 0.85);
    cursor: pointer;
  }

  .pill-on {
    background: oklab(84% 0.03 0.14 / 0.2);
    border-color: oklab(84% 0.03 0.14 / 0.7);
    color: oklab(95% 0 0);
  }

  .stat-line {
    margin: 0.8rem 0 0;
    font-size: 0.75rem;
    color: oklab(80% 0 0 / 0.7);
  }

  .err {
    margin: 0.6rem 0 0;
    font-size: 0.78rem;
    color: oklch(70% 0.19 25);
  }

  .empty {
    font-size: 0.85rem;
    color: oklab(80% 0 0 / 0.7);
  }

  /* ── Week tabs ─────────────────────────────────────────────────────────── */
  .week-tabs {
    display: flex;
    width: 100%;
    border-bottom: 1px solid oklab(100% 0 0 / 0.1);
    margin-bottom: 1rem;
  }

  .week-tab {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.1rem;
    padding: 0.4rem 0.5rem;
    font-size: 0.8125rem;
    color: oklab(82% 0 0 / 0.75);
    background: transparent;
    border: none;
    border-bottom: 2px solid transparent;
    position: relative;
    bottom: -1px;
    white-space: nowrap;
    cursor: pointer;
  }

  .week-tab.active {
    color: oklab(96% 0 0);
    border-bottom-color: oklab(84% 0.03 0.14);
  }

  .week-label {
    font-size: 0.65rem;
    letter-spacing: 0.05em;
    color: oklab(78% 0 0 / 0.6);
  }

  /* ── Day / slot headings ───────────────────────────────────────────────── */
  .day-section {
    margin-bottom: 1rem;
  }

  /* ── Leagues Cup day section ────────────────────────────────────────────── */
  .day-section.lc-day {
    background: #29000e;
    border-radius: 0.75rem;
    padding: 1rem;
  }

  .lc-logo-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.75rem;
  }

  .lc-logo {
    display: block;
    height: 1.75rem;
    width: auto;
  }

  .lc-info-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 1.75rem;
    height: 1.75rem;
    padding: 0;
    border: none;
    background: none;
    cursor: pointer;
  }

  .lc-info-icon {
    width: 100%;
    height: 100%;
    opacity: 0.9;
    transition: opacity 0.15s;
  }

  .lc-info-btn:hover .lc-info-icon {
    opacity: 1;
  }

  .day-section.lc-day .day-heading {
    color: oklab(100% 0 0);
  }

  .day-heading {
    font-size: 0.9rem;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    margin: 0 0 0.4rem;
    color: oklab(92% 0 0 / 0.9);
  }

  .slot-section {
    margin-bottom: 1rem;
  }

  .slot-section:last-child {
    margin-bottom: 0;
  }

  .slot-heading {
    font-size: 0.75rem;
    font-weight: 600;
    letter-spacing: 0.1em;
    margin: 0 0 0.4rem;
    color: oklab(82% 0 0 / 0.75);
  }

  /* ── Round view ────────────────────────────────────────────────────────── */
  .round-group {
    margin-bottom: 2.25rem;
  }

  .round-heading {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.8rem;
    font-weight: 600;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    margin: 0;
    color: oklab(90% 0 0 / 0.9);
  }

  .round-count {
    font-size: 0.65rem;
    font-weight: 500;
    letter-spacing: 0.05em;
    padding: 0.1rem 0.35rem;
    border-radius: 1rem;
    background: oklab(100% 0 0 / 0.1);
    color: oklab(85% 0 0 / 0.8);
  }

  .slug-echo {
    display: block;
    margin-top: 0.25rem;
    font-size: 0.68rem;
    color: oklab(75% 0 0 / 0.6);
  }

  .cards-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 0.75rem;
  }

  @media (min-width: 560px) {
    .cards-grid {
      grid-template-columns: repeat(2, 1fr);
    }
  }

  @media (min-width: 820px) {
    .cards-grid {
      grid-template-columns: repeat(3, 1fr);
    }
  }

  .card-wrap {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
  }

  .debug {
    font-size: 0.65rem;
    line-height: 1.3;
    color: oklab(75% 0 0 / 0.6);
    padding-left: 0.15rem;
  }
</style>
