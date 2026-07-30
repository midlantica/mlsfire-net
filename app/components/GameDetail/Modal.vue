<script setup lang="ts">
  import type { Match } from '~/composables/useScores'
  import { useMatchDetail, type MatchEvent } from '~/composables/useMatchDetail'
  import {
    TEAM_LOGO,
    TEAM_ESPN_ID,
    TEAM_ABBREV,
    ALL_STAR_TEAMS,
  } from '~/composables/useTeamTheme'
  import { useTimezone } from '~/composables/useTimezone'
  import { useConferenceBadges } from '~/composables/useStandings'
  import {
    generateMatchPreview,
    generateAllStarPreview,
  } from '~/composables/useMatchPreview'
  import { getStadiumInfo } from '~/constants/venues'
  import {
    getRoundInfo,
    isSeriesDecided,
    getCompetition,
    calcLeaguesCupHeat,
  } from '~/constants/rounds'
  import { isLigaMxTeam } from '~/constants/ligamx'

  // ── Props / emits ─────────────────────────────────────────────────────────────
  const props = defineProps<{
    open: boolean
    match: Match | null
  }>()

  const emit = defineEmits<{
    close: []
    'select-team': [team: string]
  }>()

  // ── Data fetching ─────────────────────────────────────────────────────────────
  const {
    detail,
    loading,
    error,
    fetchDetail,
    startPolling,
    stopPolling,
    clear,
  } = useMatchDetail()
  const { iana, formatTimeHtml } = useTimezone()

  function isLiveOrHT(m: Match | null) {
    return m?.status.code === 'live' || m?.status.code === 'ht'
  }

  watch(
    () => props.match,
    (m) => {
      if (m && props.open) {
        fetchDetail(m.id)
        if (isLiveOrHT(m)) startPolling(m.id)
        else stopPolling()
      }
    }
  )

  watch(
    () => props.open,
    (open) => {
      if (open && props.match) {
        fetchDetail(props.match.id)
        document.body.style.overflow = 'hidden'
        if (isLiveOrHT(props.match)) startPolling(props.match.id)
      } else {
        document.body.style.overflow = ''
        if (!open) {
          stopPolling()
          clear()
        }
      }
    }
  )

  onUnmounted(() => {
    stopPolling()
    document.body.style.overflow = ''
  })

  // ── Keyboard close ────────────────────────────────────────────────────────────
  function onKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') emit('close')
  }

  onMounted(() => window.addEventListener('keydown', onKeydown))
  onUnmounted(() => window.removeEventListener('keydown', onKeydown))

  // ── Tab state ─────────────────────────────────────────────────────────────────
  type ModalTab = 'preview' | 'overview' | 'leaders' | 'lineups' | 'h2h'
  const TAB_ORDER: ModalTab[] = [
    'preview',
    'overview',
    'leaders',
    'lineups',
    'h2h',
  ]
  const activeTab = ref<ModalTab>('overview')
  const slideDir = ref<'left' | 'right'>('left')

  function setTab(tab: ModalTab) {
    const from = TAB_ORDER.indexOf(activeTab.value)
    const to = TAB_ORDER.indexOf(tab)
    slideDir.value = to > from ? 'left' : 'right'
    activeTab.value = tab
  }

  watch(
    () => props.open,
    (open) => {
      if (open) {
        activeTab.value =
          props.match?.status.code === 'ns' ? 'preview' : 'overview'
      }
    }
  )

  // ── Derived data ──────────────────────────────────────────────────────────────
  const homeTeam = computed(() => props.match?.home ?? '')
  const awayTeam = computed(() => props.match?.away ?? '')

  const homeLogo = computed(
    () => TEAM_LOGO[homeTeam.value] ?? props.match?.homeLogo ?? null
  )
  const awayLogo = computed(
    () => TEAM_LOGO[awayTeam.value] ?? props.match?.awayLogo ?? null
  )

  const homeEspnId = computed(() => TEAM_ESPN_ID[homeTeam.value] ?? null)
  const awayEspnId = computed(() => TEAM_ESPN_ID[awayTeam.value] ?? null)

  // Compact header meta: "Sat, May 17 · 7:30 PM CDT · 2026"
  const matchMeta = computed(() => {
    if (!props.match?.date) return ''
    const d = new Date(props.match.date)
    const day = d
      .toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        timeZone: iana.value,
      })
      .toUpperCase()
    const time = d.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      timeZoneName: 'short',
      timeZone: iana.value,
    })
    const year = d.toLocaleDateString('en-US', {
      year: 'numeric',
      timeZone: iana.value,
    })
    return `${day} · ${time} · ${year}`
  })

  const matchVenue = computed(() => {
    if (!detail.value?.info.venue) return null
    return detail.value.info.city
      ? `${detail.value.info.venue}, ${detail.value.info.city}`
      : detail.value.info.venue
  })

  const matchAttendance = computed(() =>
    detail.value?.info.attendance
      ? detail.value.info.attendance.toLocaleString() + ' att.'
      : null
  )

  // Kickoff time for mobile clock block (pre-match)
  const kickoffLabel = computed(() =>
    props.match?.date ? formatTimeHtml(props.match.date) : ''
  )

  // ── Local clock ticker for mobile clock block (mirrors GameBlock logic) ──────
  const localClock = ref<string | null>(null)
  let clockBase = 0
  let clockTickedAt = 0
  let clockTimer: ReturnType<typeof setInterval> | null = null

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

  function startClockTicker() {
    stopClockTicker()
    if (props.match?.status.code !== 'live' || !props.match.status.clock) return
    clockBase = parseClock(props.match.status.clock)
    clockTickedAt = Date.now()
    localClock.value = formatClock(clockBase)
    clockTimer = setInterval(() => {
      if (props.match?.status.code !== 'live') {
        stopClockTicker()
        return
      }
      const elapsed = Math.floor((Date.now() - clockTickedAt) / 1000)
      localClock.value = formatClock(clockBase + elapsed)
    }, 1000)
  }

  function stopClockTicker() {
    if (clockTimer) {
      clearInterval(clockTimer)
      clockTimer = null
    }
  }

  watch(
    () => props.match?.status.clock,
    (newClock) => {
      if (props.match?.status.code === 'live' && newClock) {
        startClockTicker()
      } else {
        stopClockTicker()
        localClock.value = null
      }
    }
  )

  watch(
    () => props.match?.status.code,
    (code) => {
      if (code === 'live' && props.match?.status.clock) {
        startClockTicker()
      } else {
        stopClockTicker()
        localClock.value = null
      }
    }
  )

  watch(
    () => props.open,
    (open) => {
      if (
        open &&
        props.match?.status.code === 'live' &&
        props.match.status.clock
      ) {
        startClockTicker()
      } else if (!open) {
        stopClockTicker()
      }
    }
  )

  onMounted(() => {
    if (props.match?.status.code === 'live' && props.match.status.clock) {
      startClockTicker()
    }
  })

  const displayClock = computed(
    () => localClock.value ?? props.match?.status.clock ?? 'LIVE'
  )

  // Combined venue + attendance for desktop header footer line
  const matchVenueAttendance = computed(() => {
    const parts = [matchVenue.value, matchAttendance.value].filter(Boolean)
    return parts.length ? parts.join(' - ') : null
  })

  // ── Stadium detail modal ─────────────────────────────────────────────────
  const showStadiumModal = ref(false)
  const stadiumInfo = computed(() => getStadiumInfo(detail.value?.info.venue))

  function openStadiumModal() {
    if (stadiumInfo.value) showStadiumModal.value = true
  }

  // ── Playoff stage / series state ─────────────────────────────────────────
  const roundInfo = computed(() => getRoundInfo(props.match?.seasonSlug))
  const seriesNote = computed(() => props.match?.seriesNote ?? null)
  const seriesDecided = computed(() => isSeriesDecided(seriesNote.value))
  const isLeaguesCup = computed(
    () => getCompetition(props.match?.seasonSlug) === 'Leagues Cup'
  )
  // The ESPN feed tags this fixture's season as a normal "regular-season"
  // slug (no dedicated All-Star slug exists), so detect it by team name
  // instead of by competition/season metadata.
  const isAllStarGame = computed(
    () =>
      ALL_STAR_TEAMS.includes(homeTeam.value) &&
      ALL_STAR_TEAMS.includes(awayTeam.value)
  )

  const { badgeByTeam, crossLeagueStrengthFor } = useConferenceBadges()

  const leaguesCupHeat = computed(() =>
    calcLeaguesCupHeat(
      crossLeagueStrengthFor(props.match?.home),
      crossLeagueStrengthFor(props.match?.away),
      props.match?.seasonSlug
    )
  )

  const displayBadge = computed(() => {
    if (isLeaguesCup.value) {
      if (leaguesCupHeat.value === 'hot') return 'fire'
      if (leaguesCupHeat.value === 'cool') return 'wild'
      return null
    }
    return props.match?.badge ?? null
  })

  // ── Penalty shootout ─────────────────────────────────────────────────────
  const shootout = computed(() => {
    const m = props.match
    if (!m || m.homeShootout == null || m.awayShootout == null) return null
    return { home: m.homeShootout, away: m.awayShootout }
  })

  function lostBy(side: 'home' | 'away'): boolean {
    const m = props.match
    if (!m || m.status.code !== 'ft') return false
    const mine = Number((side === 'home' ? m.homeScore : m.awayScore) ?? 0)
    const theirs = Number((side === 'home' ? m.awayScore : m.homeScore) ?? 0)
    if (mine !== theirs) return mine < theirs
    const pens = shootout.value
    if (!pens) return false
    return side === 'home' ? pens.home < pens.away : pens.away < pens.home
  }

  const homeLost = computed(() => lostBy('home'))
  const awayLost = computed(() => lostBy('away'))

  // Cup ties against non-MLS clubs carry no league record, so the feed hands
  // back the "–" placeholder — nothing worth giving a line to. Leagues Cup
  // records aren't meaningful for the tie itself either, so those are
  // suppressed outright.
  function realRecord(rec?: string): string | null {
    if (isLeaguesCup.value) return null
    return rec && /\d/.test(rec) ? rec : null
  }

  const homeRecord = computed(() => realRecord(props.match?.homeRec))
  const awayRecord = computed(() => realRecord(props.match?.awayRec))

  const homeIsLigaMx = computed(() => isLigaMxTeam(homeTeam.value))
  const awayIsLigaMx = computed(() => isLigaMxTeam(awayTeam.value))

  // ── Rosters ───────────────────────────────────────────────────────────────────
  const homeRoster = computed(() => {
    if (!detail.value) return null
    const homeId = homeEspnId.value
    return (
      detail.value.rosters.find((r) => r.teamId === homeId) ??
      detail.value.rosters[0] ??
      null
    )
  })

  const awayRoster = computed(() => {
    if (!detail.value) return null
    const awayId = awayEspnId.value
    return (
      detail.value.rosters.find((r) => r.teamId === awayId) ??
      detail.value.rosters[1] ??
      null
    )
  })

  // ── Head-to-head ──────────────────────────────────────────────────────────────
  const h2h = computed(() => detail.value?.headToHead ?? [])

  // ── Short display names ───────────────────────────────────────────────────────
  const TEAM_SHORT_NAME: Record<string, string> = {
    'Atlanta United FC': 'Atlanta Utd',
    'Austin FC': 'Austin FC',
    'CF Montréal': 'CF Montréal',
    'Charlotte FC': 'Charlotte FC',
    'Chicago Fire FC': 'Chicago Fire',
    'Colorado Rapids': 'CO Rapids',
    'Columbus Crew': 'Columbus',
    'D.C. United': 'DC United',
    'FC Cincinnati': 'FC Cincinnati',
    'FC Dallas': 'FC Dallas',
    'Houston Dynamo FC': 'Houston',
    'Inter Miami CF': 'Inter Miami',
    'LA Galaxy': 'LA Galaxy',
    LAFC: 'LAFC',
    'Minnesota United FC': 'Minnesota',
    'Nashville SC': 'Nashville SC',
    'New England Revolution': 'NE Revolution',
    'New York City FC': 'NYCFC',
    'Orlando City SC': 'Orlando City',
    'Philadelphia Union': 'Philadelphia',
    'Portland Timbers': 'Portland',
    'Real Salt Lake': 'RSL',
    'Red Bull New York': 'NY Red Bulls',
    'San Diego FC': 'San Diego FC',
    'San Jose Earthquakes': 'San Jose',
    'Seattle Sounders FC': 'Seattle',
    'Sporting Kansas City': 'Sporting KC',
    'St. Louis City SC': 'St. Louis',
    'Toronto FC': 'Toronto FC',
    'Vancouver Whitecaps': 'Vancouver',
  }

  const homeAbbr = computed(
    () => TEAM_SHORT_NAME[homeTeam.value] ?? homeTeam.value
  )
  const awayAbbr = computed(
    () => TEAM_SHORT_NAME[awayTeam.value] ?? awayTeam.value
  )

  // Desktop header shows the full team name, but very long ones (22+ chars)
  // wrap onto two lines in that column — fall back to the abbreviation above
  // that threshold, same cutoff GameBlock.vue uses for its wall cards.
  const HEADER_NAME_LENGTH_THRESHOLD = 18
  const homeHeaderName = computed(() =>
    homeTeam.value.length > HEADER_NAME_LENGTH_THRESHOLD
      ? homeAbbr.value
      : homeTeam.value
  )
  const awayHeaderName = computed(() =>
    awayTeam.value.length > HEADER_NAME_LENGTH_THRESHOLD
      ? awayAbbr.value
      : awayTeam.value
  )

  // ── Plain city names for the mobile events-row team label ────────────────
  const TEAM_CITY_NAME: Record<string, string> = {
    'Atlanta United FC': 'Atlanta',
    'Austin FC': 'Austin',
    'CF Montréal': 'Montréal',
    'Charlotte FC': 'Charlotte',
    'Chicago Fire FC': 'Chicago',
    'Colorado Rapids': 'Colorado',
    'Columbus Crew': 'Columbus',
    'D.C. United': 'Washington D.C.',
    'FC Cincinnati': 'Cincinnati',
    'FC Dallas': 'Dallas',
    'Houston Dynamo FC': 'Houston',
    'Inter Miami CF': 'Miami',
    'LA Galaxy': 'LA Galaxy',
    LAFC: 'LAFC',
    'Minnesota United FC': 'Minnesota',
    'Nashville SC': 'Nashville',
    'New England Revolution': 'New England',
    'New York City FC': 'NYC',
    'Orlando City SC': 'Orlando',
    'Philadelphia Union': 'Philadelphia',
    'Portland Timbers': 'Portland',
    'Real Salt Lake': 'Salt Lake',
    'Red Bull New York': 'NY Red Bulls',
    'San Diego FC': 'San Diego',
    'San Jose Earthquakes': 'San Jose',
    'Seattle Sounders FC': 'Seattle',
    'Sporting Kansas City': 'Kansas City',
    'St. Louis City SC': 'St. Louis',
    'Toronto FC': 'Toronto',
    'Vancouver Whitecaps': 'Vancouver',
  }

  const homeEventLabel = computed(
    () => TEAM_CITY_NAME[homeTeam.value] ?? homeAbbr.value
  )
  const awayEventLabel = computed(
    () => TEAM_CITY_NAME[awayTeam.value] ?? awayAbbr.value
  )

  // ── Conference position badge (e.g. "8E" / "3W") ─────────────────────────
  const homeBadge = computed(() => badgeByTeam.value[homeTeam.value])
  const awayBadge = computed(() => badgeByTeam.value[awayTeam.value])

  // Short 3-5 char abbreviations for the events row (STL, ATX, etc.)
  const homeTeamAbbrev = computed(
    () =>
      TEAM_ABBREV[homeTeam.value] ?? homeTeam.value.slice(0, 4).toUpperCase()
  )
  const awayTeamAbbrev = computed(
    () =>
      TEAM_ABBREV[awayTeam.value] ?? awayTeam.value.slice(0, 4).toUpperCase()
  )

  // ── Match events filtered by home/away team ───────────────────────────────
  // Use the ESPN team IDs from the detail.teams array (matched by homeAway flag)
  // rather than TEAM_ESPN_ID lookup, so we don't depend on name-matching.
  const homeMatchEvents = computed<MatchEvent[]>(() => {
    if (!detail.value?.matchEvents) return []
    // Find the home team's ESPN ID from the detail teams array
    const homeTeamDetail = detail.value.teams.find((t) => t.homeAway === 'home')
    const homeId = homeTeamDetail?.id ?? homeEspnId.value ?? ''
    return detail.value.matchEvents.filter((e) => e.teamId === homeId)
  })

  const awayMatchEvents = computed<MatchEvent[]>(() => {
    if (!detail.value?.matchEvents) return []
    const awayTeamDetail = detail.value.teams.find((t) => t.homeAway === 'away')
    const awayId = awayTeamDetail?.id ?? awayEspnId.value ?? ''
    return detail.value.matchEvents.filter((e) => e.teamId === awayId)
  })

  // ── Grouped events (same player + type → one item with multiple clocks) ───
  interface GroupedEvent {
    type: MatchEvent['type']
    lastName: string
    clocks: string[]
    isOG?: boolean
    isPenalty?: boolean
    isSecondYellow?: boolean
    isMergedDouble?: boolean
  }

  function groupEvents(events: MatchEvent[]): GroupedEvent[] {
    const result: GroupedEvent[] = []
    for (const ev of events) {
      // A second-yellow red merges into that same player's existing yellow
      // group (one combined line, one double-card icon) — a straight red
      // (no prior yellow to merge with) stays as its own separate item.
      if (ev.type === 'red' && ev.isSecondYellow) {
        const priorYellow = result.find(
          (g) =>
            g.type === 'yellow' &&
            g.lastName === ev.lastName &&
            !g.isMergedDouble
        )
        if (priorYellow) {
          priorYellow.clocks.push(ev.clock)
          priorYellow.isSecondYellow = true
          priorYellow.isMergedDouble = true
          continue
        }
      }
      const existing = result.find(
        (g) =>
          g.type === ev.type &&
          g.lastName === ev.lastName &&
          !!g.isOG === !!ev.isOG &&
          !g.isMergedDouble
      )
      if (existing) {
        existing.clocks.push(ev.clock)
        // If any occurrence is a penalty, mark the group
        if (ev.isPenalty) existing.isPenalty = true
        if (ev.isSecondYellow) existing.isSecondYellow = true
      } else {
        result.push({
          type: ev.type,
          lastName: ev.lastName,
          clocks: [ev.clock],
          isOG: ev.isOG,
          isPenalty: ev.isPenalty,
          isSecondYellow: ev.isSecondYellow,
        })
      }
    }
    return result
  }

  const homeGroupedGoals = computed(() =>
    groupEvents(homeMatchEvents.value.filter((e) => e.type === 'goal'))
  )
  const homeGroupedCards = computed(() =>
    groupEvents(
      homeMatchEvents.value.filter(
        (e) => e.type === 'yellow' || e.type === 'red'
      )
    )
  )
  const awayGroupedGoals = computed(() =>
    groupEvents(awayMatchEvents.value.filter((e) => e.type === 'goal'))
  )
  const awayGroupedCards = computed(() =>
    groupEvents(
      awayMatchEvents.value.filter(
        (e) => e.type === 'yellow' || e.type === 'red'
      )
    )
  )

  const homeLeaders = computed(() => {
    if (!detail.value) return null
    const homeId = homeEspnId.value
    return (
      detail.value.leaders.find((l) => l.teamId === homeId) ??
      detail.value.leaders[0] ??
      null
    )
  })

  const awayLeaders = computed(() => {
    if (!detail.value) return null
    const awayId = awayEspnId.value
    return (
      detail.value.leaders.find((l) => l.teamId === awayId) ??
      detail.value.leaders[1] ??
      null
    )
  })

  // ── Match preview (pre-match "pre-cap") ───────────────────────────────────
  const homeTeamDetailId = computed(
    () =>
      detail.value?.teams.find((t) => t.homeAway === 'home')?.id ??
      homeEspnId.value ??
      ''
  )
  const awayTeamDetailId = computed(
    () =>
      detail.value?.teams.find((t) => t.homeAway === 'away')?.id ??
      awayEspnId.value ??
      ''
  )

  const homePoints = computed(
    () =>
      detail.value?.teams.find((t) => t.homeAway === 'home')?.points ??
      undefined
  )
  const awayPoints = computed(
    () =>
      detail.value?.teams.find((t) => t.homeAway === 'away')?.points ??
      undefined
  )

  const homeForm = computed(
    () =>
      detail.value?.form?.find((f) => f.teamId === homeTeamDetailId.value)?.form
  )
  const awayForm = computed(
    () =>
      detail.value?.form?.find((f) => f.teamId === awayTeamDetailId.value)?.form
  )

  const homeSeasonLeader = computed(() =>
    detail.value?.seasonLeaders?.find(
      (s) => s.teamId === homeTeamDetailId.value
    )
  )
  const awaySeasonLeader = computed(() =>
    detail.value?.seasonLeaders?.find(
      (s) => s.teamId === awayTeamDetailId.value
    )
  )

  const matchPreview = computed(() => {
    if (!props.match) return null
    if (isAllStarGame.value) return generateAllStarPreview(props.match.id)
    return generateMatchPreview({
      eventId: props.match.id,
      homeTeam: homeTeam.value,
      awayTeam: awayTeam.value,
      homeAbbr: homeAbbr.value,
      awayAbbr: awayAbbr.value,
      homePoints: homePoints.value,
      awayPoints: awayPoints.value,
      homeBadge: homeIsLigaMx.value ? undefined : homeBadge.value,
      awayBadge: awayIsLigaMx.value ? undefined : awayBadge.value,
      homeForm: homeForm.value,
      awayForm: awayForm.value,
      h2h: h2h.value,
      homeLeader: homeSeasonLeader.value,
      awayLeader: awaySeasonLeader.value,
      previewOdds: detail.value?.previewOdds,
    })
  })
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div
        v-if="open && match"
        class="modal-backdrop"
        role="dialog"
        aria-modal="true"
        @mousedown.self="emit('close')"
      >
        <div class="modal-shell">
          <div class="modal-panel">
            <!-- ── Header ──────────────────────────────────────────────────────── -->
            <div class="modal-header">
              <!-- Playoff stage banner — postseason matches only -->
              <div
                v-if="roundInfo"
                class="header-stage"
                :class="{ 'header-stage-lc': isLeaguesCup }"
              >
                <span
                  class="header-stage-label"
                  :class="{ 'header-stage-label-lc': isLeaguesCup }"
                >
                  <span
                    v-if="isLeaguesCup"
                    class="stage-mark"
                    aria-hidden="true"
                  />
                  <span>{{ roundInfo.stage }}</span>
                </span>
                <span
                  v-if="seriesNote"
                  class="header-series-note"
                  :class="{ 'header-series-decided': seriesDecided }"
                  >{{ seriesNote }}</span
                >
              </div>

              <!-- Mobile game-card header (hidden on desktop) -->
              <div class="header-mobile">
                <!-- Venue info — above the scores -->
                <div v-if="matchVenue" class="header-mobile-venue-row">
                  <button
                    v-if="stadiumInfo"
                    class="venue-link"
                    @click.stop="openStadiumModal"
                  >
                    {{ matchVenue }}
                  </button>
                  <template v-else>{{ matchVenue }}</template>
                </div>

                <!-- Scores + clock layout: left=teams+scores, right=clock/status+date -->
                <div class="header-mobile-scores-clock">
                  <!-- Left: stacked team rows -->
                  <div class="header-mobile-teams">
                    <!-- Home team row -->
                    <div class="header-mobile-team">
                      <component
                        :is="homeIsLigaMx ? 'span' : 'button'"
                        class="header-logo-btn"
                        :class="{ 'header-btn-static': homeIsLigaMx }"
                        @click.stop="
                          !homeIsLigaMx && emit('select-team', homeTeam)
                        "
                      >
                        <img
                          v-if="homeLogo"
                          :src="homeLogo"
                          :alt="homeTeam"
                          class="header-mobile-logo"
                        />
                        <span
                          v-else
                          class="header-mobile-swatch"
                          :style="{ background: match.homeColor }"
                        />
                      </component>
                      <component
                        :is="homeIsLigaMx ? 'span' : 'button'"
                        class="header-mobile-name header-mobile-name-btn"
                        :class="{ 'header-btn-static': homeIsLigaMx }"
                        @click.stop="
                          !homeIsLigaMx && emit('select-team', homeTeam)
                        "
                      >
                        {{ homeAbbr }}
                      </component>

                      <ConferenceBadge :badge="homeBadge" />
                      <span v-if="homeRecord" class="header-mobile-rec">{{
                        homeRecord
                      }}</span>
                      <span class="header-mobile-spacer" />
                      <span
                        v-if="match.status.code !== 'ns'"
                        class="header-mobile-score"
                        :class="{
                          'score-loser': homeLost && !isLeaguesCup,
                          'score-even': isLeaguesCup,
                        }"
                        >{{ match.homeScore ?? '0'
                        }}<span v-if="shootout" class="score-pens"
                          >({{ shootout.home }})</span
                        ></span
                      >
                    </div>
                    <!-- Away team row -->
                    <div class="header-mobile-team">
                      <component
                        :is="awayIsLigaMx ? 'span' : 'button'"
                        class="header-logo-btn"
                        :class="{ 'header-btn-static': awayIsLigaMx }"
                        @click.stop="
                          !awayIsLigaMx && emit('select-team', awayTeam)
                        "
                      >
                        <img
                          v-if="awayLogo"
                          :src="awayLogo"
                          :alt="awayTeam"
                          class="header-mobile-logo"
                        />
                        <span
                          v-else
                          class="header-mobile-swatch"
                          :style="{ background: match.awayColor }"
                        />
                      </component>
                      <component
                        :is="awayIsLigaMx ? 'span' : 'button'"
                        class="header-mobile-name header-mobile-name-btn"
                        :class="{ 'header-btn-static': awayIsLigaMx }"
                        @click.stop="
                          !awayIsLigaMx && emit('select-team', awayTeam)
                        "
                      >
                        {{ awayAbbr }}
                      </component>

                      <ConferenceBadge :badge="awayBadge" />
                      <span v-if="awayRecord" class="header-mobile-rec">{{
                        awayRecord
                      }}</span>
                      <span class="header-mobile-spacer" />
                      <span
                        v-if="match.status.code !== 'ns'"
                        class="header-mobile-score"
                        :class="{
                          'score-loser': awayLost && !isLeaguesCup,
                          'score-even': isLeaguesCup,
                        }"
                        >{{ match.awayScore ?? '0'
                        }}<span v-if="shootout" class="score-pens"
                          >({{ shootout.away }})</span
                        ></span
                      >
                    </div>
                  </div>
                  <!-- Right: clock/status badge + date -->
                  <div class="header-mobile-clock-block">
                    <span
                      v-if="match.status.code === 'ns'"
                      class="header-mobile-kickoff"
                      v-html="kickoffLabel"
                    />
                    <span
                      v-else-if="match.status.code === 'live'"
                      class="badge badge-live header-mobile-badge header-mobile-badge-live"
                      >{{ displayClock }}</span
                    >
                    <span
                      v-else-if="match.status.code === 'ht'"
                      class="badge badge-ht header-mobile-badge header-mobile-badge-compact"
                      >HT</span
                    >
                    <span
                      v-else
                      class="badge badge-ft header-mobile-badge header-mobile-badge-compact"
                      >FT</span
                    >
                    <span class="header-mobile-clock-date">{{
                      matchMeta.split(' · ')[0]
                    }}</span>
                  </div>
                </div>
                <!-- Meta info: date/time line -->
                <div class="header-mobile-meta">
                  <span class="header-meta-line">{{ matchMeta }}</span>
                </div>
              </div>

              <!-- Desktop header (hidden on mobile) -->
              <div class="header-row">
                <!-- Home team: info (right-aligned) + logo -->
                <div class="header-team header-team-home">
                  <div class="header-team-info header-team-info-home">
                    <div class="header-team-name-line">
                      <ConferenceBadge :badge="homeBadge" />
                      <component
                        :is="homeIsLigaMx ? 'span' : 'button'"
                        class="header-team-name header-team-name-btn"
                        :class="{ 'header-btn-static': homeIsLigaMx }"
                        @click.stop="
                          !homeIsLigaMx && emit('select-team', homeTeam)
                        "
                      >
                        {{ homeHeaderName }}
                      </component>
                    </div>
                    <span v-if="homeRecord" class="header-team-rec">{{
                      homeRecord
                    }}</span>
                  </div>

                  <component
                    :is="homeIsLigaMx ? 'span' : 'button'"
                    class="header-logo-btn"
                    :class="{ 'header-btn-static': homeIsLigaMx }"
                    @click.stop="!homeIsLigaMx && emit('select-team', homeTeam)"
                  >
                    <img
                      v-if="homeLogo"
                      :src="homeLogo"
                      :alt="homeTeam"
                      class="header-logo"
                    />
                    <span
                      v-else
                      class="header-swatch"
                      :style="{ background: match.homeColor }"
                    />
                  </component>
                </div>

                <!-- Center: score + meta -->
                <div class="header-score-block">
                  <div class="header-score-row">
                    <span
                      v-if="match.status.code !== 'ns'"
                      class="header-score header-score-home"
                      :class="{
                        'score-loser': homeLost && !isLeaguesCup,
                        'score-even': isLeaguesCup,
                      }"
                      >{{ match.homeScore ?? '0'
                      }}<span v-if="shootout" class="score-pens"
                        >({{ shootout.home }})</span
                      ></span
                    >
                    <span class="header-sep">
                      <span v-if="match.status.code === 'ns'" class="header-vs"
                        >VS</span
                      >
                      <span
                        v-else-if="match.status.code === 'live'"
                        class="badge badge-live"
                        >{{ match.status.clock || 'LIVE' }}</span
                      >
                      <span
                        v-else-if="match.status.code === 'ht'"
                        class="badge badge-ht"
                        >HT</span
                      >
                      <span v-else class="badge badge-ft">FT</span>
                    </span>
                    <span
                      v-if="match.status.code !== 'ns'"
                      class="header-score header-score-away"
                      :class="{
                        'score-loser': awayLost && !isLeaguesCup,
                        'score-even': isLeaguesCup,
                      }"
                      ><span v-if="shootout" class="score-pens"
                        >({{ shootout.away }})</span
                      >{{ match.awayScore ?? '0' }}</span
                    >
                  </div>
                  <div class="header-meta">
                    <span class="header-meta-line">{{ matchMeta }}</span>
                  </div>
                </div>

                <!-- Away team: logo + info (left-aligned) -->
                <div class="header-team header-team-away">
                  <component
                    :is="awayIsLigaMx ? 'span' : 'button'"
                    class="header-logo-btn"
                    :class="{ 'header-btn-static': awayIsLigaMx }"
                    @click.stop="!awayIsLigaMx && emit('select-team', awayTeam)"
                  >
                    <img
                      v-if="awayLogo"
                      :src="awayLogo"
                      :alt="awayTeam"
                      class="header-logo"
                    />
                    <span
                      v-else
                      class="header-swatch"
                      :style="{ background: match.awayColor }"
                    />
                  </component>
                  <div class="header-team-info header-team-info-away">
                    <div class="header-team-name-line">
                      <component
                        :is="awayIsLigaMx ? 'span' : 'button'"
                        class="header-team-name header-team-name-btn"
                        :class="{ 'header-btn-static': awayIsLigaMx }"
                        @click.stop="
                          !awayIsLigaMx && emit('select-team', awayTeam)
                        "
                      >
                        {{ awayHeaderName }}
                      </component>
                      <ConferenceBadge :badge="awayBadge" align="end" />
                    </div>
                    <span v-if="awayRecord" class="header-team-rec">{{
                      awayRecord
                    }}</span>
                  </div>
                </div>
              </div>

              <!-- Venue line — under the scoreline, desktop only -->
              <div
                v-if="matchVenueAttendance"
                class="header-venue-line header-venue-line-top"
              >
                <button
                  v-if="stadiumInfo"
                  class="venue-link"
                  @click.stop="openStadiumModal"
                >
                  {{ matchVenue }}
                </button>
                <template v-else>{{ matchVenue }}</template>
                <template v-if="matchAttendance">
                  - {{ matchAttendance }}</template
                >
              </div>

              <!-- Scorers / cards row — desktop: two 50/50 columns; mobile: stacked -->
              <div
                v-if="detail?.matchEvents?.length && match.status.code !== 'ns'"
                class="header-events-row"
              >
                <!-- Home team column -->
                <div class="header-events-col header-events-col-home">
                  <!-- Goals line -->
                  <div class="events-goals-line">
                    <!-- Mobile only: team label (shown once) -->
                    <span class="events-team-label">{{ homeEventLabel }}:</span>

                    <span
                      v-if="
                        !homeGroupedGoals.length && !homeGroupedCards.length
                      "
                      class="event-none"
                      >—</span
                    >
                    <span
                      v-for="(ev, i) in homeGroupedGoals"
                      :key="`hg-${i}`"
                      class="event-goal-item"
                    >
                      <span class="event-icon">⚽</span>
                      <span class="event-name">{{ ev.lastName }}</span>
                      <span v-if="ev.isOG" class="event-og">OG</span>
                      <span class="event-clock">{{
                        ev.clocks.join(', ')
                      }}</span>
                      <span v-if="ev.isPenalty" class="event-pen">P</span>
                    </span>
                  </div>
                  <!-- Cards line -->
                  <div v-if="homeGroupedCards.length" class="events-cards-line">
                    <span
                      v-for="(ev, i) in homeGroupedCards"
                      :key="`hc-${i}`"
                      class="event-card-item"
                    >
                      <span v-if="ev.isSecondYellow" class="event-card-double">
                        <span
                          class="event-card event-card-yellow event-card-double-back"
                        />
                        <span
                          class="event-card event-card-red event-card-double-front"
                        />
                      </span>
                      <span
                        v-else-if="ev.type === 'yellow'"
                        class="event-card event-card-yellow"
                      />
                      <span v-else class="event-card event-card-red" />
                      <span class="event-name">{{ ev.lastName }}</span>
                      <span class="event-clock">{{
                        ev.clocks.join(', ')
                      }}</span>
                    </span>
                  </div>
                </div>

                <!-- Away team column -->

                <div class="header-events-col header-events-col-away">
                  <!-- Goals line -->
                  <div class="events-goals-line">
                    <!-- Mobile only: team label (shown once) -->
                    <span class="events-team-label">{{ awayEventLabel }}:</span>

                    <span
                      v-if="
                        !awayGroupedGoals.length && !awayGroupedCards.length
                      "
                      class="event-none"
                      >—</span
                    >
                    <span
                      v-for="(ev, i) in awayGroupedGoals"
                      :key="`ag-${i}`"
                      class="event-goal-item"
                    >
                      <span class="event-icon">⚽</span>
                      <span class="event-name">{{ ev.lastName }}</span>
                      <span v-if="ev.isOG" class="event-og">OG</span>
                      <span class="event-clock">{{
                        ev.clocks.join(', ')
                      }}</span>
                      <span v-if="ev.isPenalty" class="event-pen">P</span>
                    </span>
                  </div>
                  <!-- Cards line -->
                  <div v-if="awayGroupedCards.length" class="events-cards-line">
                    <span
                      v-for="(ev, i) in awayGroupedCards"
                      :key="`ac-${i}`"
                      class="event-card-item"
                    >
                      <span v-if="ev.isSecondYellow" class="event-card-double">
                        <span
                          class="event-card event-card-yellow event-card-double-back"
                        />
                        <span
                          class="event-card event-card-red event-card-double-front"
                        />
                      </span>
                      <span
                        v-else-if="ev.type === 'yellow'"
                        class="event-card event-card-yellow"
                      />
                      <span v-else class="event-card event-card-red" />
                      <span class="event-name">{{ ev.lastName }}</span>
                      <span class="event-clock">{{
                        ev.clocks.join(', ')
                      }}</span>
                    </span>
                  </div>
                </div>
              </div>

              <!-- Close button -->

              <button
                class="modal-close"
                aria-label="Close"
                @click="emit('close')"
              >
                <CloseIcon />
              </button>
            </div>

            <!-- ── Tabs ────────────────────────────────────────────────────────── -->
            <div class="modal-tabs">
              <button
                v-if="match.status.code === 'ns'"
                class="modal-tab"
                :class="{ active: activeTab === 'preview' }"
                @click="setTab('preview')"
              >
                Preview
              </button>
              <button
                class="modal-tab"
                :class="{ active: activeTab === 'overview' }"
                @click="setTab('overview')"
              >
                Stats
              </button>
              <button
                class="modal-tab"
                :class="{ active: activeTab === 'leaders' }"
                @click="setTab('leaders')"
              >
                Leaders
              </button>
              <button
                class="modal-tab"
                :class="{ active: activeTab === 'lineups' }"
                @click="setTab('lineups')"
              >
                Lineups
              </button>
              <button
                class="modal-tab"
                :class="{ active: activeTab === 'h2h' }"
                @click="setTab('h2h')"
              >
                <span class="tab-label-desktop">Head to Head</span>
                <span class="tab-label-mobile">H2H</span>
              </button>
            </div>

            <!-- ── Body ────────────────────────────────────────────────────────── -->
            <div class="modal-body">
              <!-- Loading skeleton -->
              <div v-if="loading" class="skeleton-wrap">
                <div v-for="i in 5" :key="i" class="skeleton-row" />
              </div>

              <!-- Error -->
              <div v-else-if="error" class="error-msg">⚠️ {{ error }}</div>

              <!-- ── Tab content with slide transition ──────────────────────── -->
              <Transition v-else :name="`tab-slide-${slideDir}`" mode="out-in">
                <div :key="activeTab" class="tab-pane">
                  <!-- ── PREVIEW TAB ─────────────────────────────────────────── -->
                  <template v-if="activeTab === 'preview'">
                    <GameDetailPreviewTab :preview="matchPreview" />
                  </template>

                  <!-- ── STATS TAB ───────────────────────────────────────────── -->
                  <template v-else-if="activeTab === 'overview' && detail">
                    <GameDetailStatsTab
                      :detail="detail"
                      :home-logo="homeLogo"
                      :away-logo="awayLogo"
                      :home-team="homeTeam"
                      :away-team="awayTeam"
                      :home-abbr="homeAbbr"
                      :away-abbr="awayAbbr"
                      :home-team-abbrev="homeTeamAbbrev"
                      :away-team-abbrev="awayTeamAbbrev"
                    />
                  </template>

                  <!-- ── LEADERS TAB ─────────────────────────────────────────── -->
                  <template v-else-if="activeTab === 'leaders' && detail">
                    <GameDetailLeadersTab
                      :home-logo="homeLogo"
                      :away-logo="awayLogo"
                      :home-team="homeTeam"
                      :away-team="awayTeam"
                      :home-abbr="homeAbbr"
                      :away-abbr="awayAbbr"
                      :home-team-abbrev="homeTeamAbbrev"
                      :away-team-abbrev="awayTeamAbbrev"
                      :home-leaders="homeLeaders"
                      :away-leaders="awayLeaders"
                    />
                  </template>

                  <!-- ── LINEUPS TAB ─────────────────────────────────────────── -->
                  <template v-else-if="activeTab === 'lineups' && detail">
                    <GameDetailLineupsTab
                      :home-logo="homeLogo"
                      :away-logo="awayLogo"
                      :home-team="homeTeam"
                      :away-team="awayTeam"
                      :home-abbr="homeAbbr"
                      :away-abbr="awayAbbr"
                      :home-team-abbrev="homeTeamAbbrev"
                      :away-team-abbrev="awayTeamAbbrev"
                      :home-roster="homeRoster"
                      :away-roster="awayRoster"
                      :status-code="match.status.code"
                    />
                  </template>

                  <!-- ── H2H TAB ─────────────────────────────────────────────── -->
                  <template v-else-if="activeTab === 'h2h'">
                    <GameDetailH2hTab
                      :h2h="h2h"
                      :loading="loading"
                      :home-team="homeTeam"
                      :away-team="awayTeam"
                      :home-abbr="homeAbbr"
                      :away-abbr="awayAbbr"
                      @select-team="emit('select-team', $event)"
                    />
                  </template>

                  <!-- No detail yet -->
                  <div v-else-if="!loading && !detail" class="no-data">
                    Loading match details…
                  </div>
                </div>
              </Transition>
            </div>
          </div>

          <!-- Match badge — top-right corner, mirrors GameBlock's wall badge.
             Rendered as a sibling of .modal-panel (not a descendant) so it
             sits right on the panel's corner without being clipped by the
             panel's own overflow: hidden. -->
          <MatchBadgeIcon
            v-if="displayBadge"
            :badge="displayBadge"
            tooltip-side="below"
            class="modal-badge"
          />
        </div>
      </div>
    </Transition>
  </Teleport>

  <GameDetailStadiumModal
    :open="showStadiumModal"
    :stadium="stadiumInfo"
    @close="showStadiumModal = false"
  />
</template>

<style scoped>
  /* ── Backdrop & panel ─────────────────────────────────────────────────────── */
  .modal-backdrop {
    position: fixed;
    inset: 0;
    z-index: 9000;
    background: oklab(0% 0 0 / 0.75);
    display: flex;
    align-items: flex-start;
    justify-content: center;
    padding: 1rem;
    overflow-y: auto;
  }

  /* Wraps .modal-panel so the fire/wild/LC badge can be positioned as a
     sibling, hanging off the panel's corner (like GameBlock's wall badge)
     without being clipped by the panel's own overflow: hidden. */
  .modal-shell {
    position: relative;
    margin-top: 1rem;
    width: 100%;
    max-width: 44rem;
  }

  .modal-panel {
    font-family: var(--font-condensed);
    font-weight: 100;
    letter-spacing: 0.03rem;
    background: oklch(18% 0.01 260);
    border: 1px solid oklab(100% 0 0 / 0.08);
    border-bottom: 3px solid oklab(100% 0 0 / 0.08);
    border-radius: 0.75rem;
    width: 100%;
    max-height: 88dvh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    font-size: 0.85rem;
    box-shadow: 0 8px 24px oklab(0% 0 0 / 1);
  }

  @media (min-width: 600px) {
    .modal-panel {
      max-height: 80dvh;
      font-size: 1rem;
    }
  }

  /* ── Transition ───────────────────────────────────────────────────────────── */
  .modal-enter-active,
  .modal-leave-active {
    transition:
      opacity 0.18s ease,
      transform 0.22s ease;
  }

  .modal-enter-from,
  .modal-leave-to {
    opacity: 0;
    transform: translateY(1.5rem);
  }

  @media (min-width: 600px) {
    .modal-enter-from,
    .modal-leave-to {
      transform: scale(0.97) translateY(0.5rem);
    }
  }

  /* ── Mobile header ────────────────────────────────────────────────────────── */
  .header-mobile {
    display: none;
  }

  @media (max-width: 599px) {
    .header-mobile {
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
      width: 100%;
    }

    .header-row {
      display: none;
    }
  }

  .header-mobile-team {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    width: 100%;
  }

  .header-mobile-logo {
    width: 1.625rem;
    height: 1.625rem;
    object-fit: contain;
    flex-shrink: 0;
  }

  .header-mobile-swatch {
    width: 1.375rem;
    height: 1.375rem;
    border-radius: 0.2rem;
    flex-shrink: 0;
  }

  .header-mobile-name {
    font-size: 1.3rem;
    font-weight: 200;
    color: oklab(100% 0 0);
    letter-spacing: 0.02em;
    line-height: 1.4;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    min-width: 0;
  }

  .header-mobile-name-btn {
    font-family: inherit;
    background: none;
    border: none;
    padding: 0;
    margin: 0;
    cursor: pointer;
    text-align: left;
    transition: opacity 0.15s;
  }

  .header-mobile-name-btn:hover {
    text-decoration: underline;
    text-underline-offset: 0.2em;
    opacity: 0.85;
  }

  /* Liga MX opponents in Leagues Cup ties get no TeamDetail modal (their
     season data isn't sourced) — render as plain static text, no hover
     affordance. */
  .header-btn-static {
    cursor: default;
  }

  .header-btn-static:hover {
    opacity: 1;
    text-decoration: none;
  }

  .header-mobile-rec {
    font-size: 1rem;
    font-weight: 200;
    color: oklab(100% 0 0 / 0.85);
    letter-spacing: 0.06em;
    flex-shrink: 0;
  }

  .header-mobile-spacer {
    flex: 1;
  }

  .header-mobile-score {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    font-size: 1.375rem;
    font-weight: 600;
    color: oklab(100% 0 0);
    letter-spacing: 0.01em;
    line-height: 1.4;
    min-width: 1.25ch;
    flex-shrink: 0;
    align-self: center;
  }

  /* Losing score after FT — dimmed, lighter weight */
  .score-loser {
    color: oklab(0.63 0 0);
    font-weight: 300;
  }

  /* Leagues Cup ties are settled on the night — no aggregate, no second leg —
     so both scorelines carry equal weight instead of dimming the loser. */
  .score-even,
  .header-score.score-even {
    color: oklab(94% 0 0);
    font-weight: 500;
  }

  /* Penalty shootout tally, a thin space away from the score */
  .score-pens {
    font-size: 1.25rem;
    font-weight: inherit;
    color: inherit;
    letter-spacing: 0;
    margin-left: 0.22em;
  }

  /* Held to the same ratio against the smaller mobile scoreline */
  .header-mobile-score .score-pens {
    font-size: 0.9375rem;
  }

  /* The away half is mirrored so both tallies hug the centre axis */
  .header-score-away .score-pens {
    margin-left: 0;
    margin-right: 0.22em;
  }

  .header-mobile-meta {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.15rem;
    padding-top: 0.25rem;
    border-top: 1px solid oklab(100% 0 0 / 0.08);
    margin-top: 0.1rem;
  }

  /* ── Mobile scores + clock layout ─────────────────────────────────────────── */
  .header-mobile-scores-clock {
    display: flex;
    flex-direction: row;
    align-items: stretch;
    gap: 0.7rem;
    width: 100%;
  }

  .header-mobile-teams {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    flex: 1;
    min-width: 0;
  }

  /* Right block: clock badge on top, date below — matches game card style */
  .header-mobile-clock-block {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.25rem;
    flex-shrink: 0;
    padding-left: 0.75rem;
    min-width: 5rem;
    text-align: center;
    border-left: 1px solid oklab(100% 0 0 / 0.1);
  }

  /* Badge in the clock block — matches game card badge exactly, scaled up */
  .header-mobile-badge {
    font-size: 1.15rem;
    font-weight: 200;
    letter-spacing: 0.12em;
    padding: 0.2rem 0.5rem;
    border-radius: 0.2rem;
    background: oklab(28% -0.01 -0.02 / 0.85) !important;
    color: white !important;
    white-space: nowrap;
    text-align: center;
    font-variant-numeric: tabular-nums;
    font-feature-settings: 'tnum';
  }

  /* Live clock badge fills the full width of the date below */
  .header-mobile-badge-live {
    width: 100%;
    box-sizing: border-box;
    align-self: stretch;
  }

  /* HT / FT badge: auto-width, centered above the date */
  .header-mobile-badge-compact {
    width: auto;
    align-self: center;
  }

  /* Pre-match kickoff time — centered in clock block */
  .header-mobile-kickoff {
    font-size: 1.15rem;
    font-weight: 100;
    color: oklab(100% 0 0);
    letter-spacing: 0.03em;
    line-height: 1.2;
    text-align: center;
    white-space: nowrap;
  }

  .header-mobile-kickoff :deep(.ampm) {
    font-size: 1em;
    font-weight: 100;
  }

  /* Date text below clock — matches game card status-date */
  .header-mobile-clock-date {
    font-size: 1rem;
    font-weight: 100;
    color: oklab(90% 0 0);
    letter-spacing: 0.03em;
    white-space: nowrap;
    text-align: center;
  }

  /* Venue row — sits ABOVE the scores, with border-bottom separator */
  .header-mobile-venue-row {
    border-bottom: 1px solid oklab(100% 0 0 / 0.08);
    padding-bottom: 0.4rem;
    margin-bottom: 0.05rem;
    text-align: center;
    font-size: 0.8rem;
    font-weight: 300;
    color: oklab(100% 0 0 / 0.75);
    letter-spacing: 0.04em;
    width: 100%;
  }

  /* Venue name as clickable button — reset button chrome, no underline.
     Starts dim (inherited), brightens to solid white on hover to read as a link. */
  .venue-link {
    font-family: inherit;
    font-size: inherit;
    font-weight: inherit;
    letter-spacing: inherit;
    color: inherit;
    background: none;
    border: none;
    padding: 0;
    margin: 0;
    cursor: pointer;
    text-decoration: none;
    transition: color 0.15s;
  }

  .venue-link:hover {
    color: oklab(100% 0 0);
  }

  /* ── Header ───────────────────────────────────────────────────────────────── */
  .modal-header {
    background: linear-gradient(
      180deg,
      oklch(12% 0.01 260) 0%,
      oklch(16% 0.01 260) 100%
    );
    border-bottom: 1px solid oklab(100% 0 0 / 0.1);
    position: relative;
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 1.2rem 0.7rem 0.325rem;
  }

  @media (max-width: 599px) {
    .modal-header {
      padding: 0.625rem 0.875rem 0.5rem;
    }
  }

  .header-row {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    gap: 0.625rem;
    width: 100%;
  }

  @media (max-width: 599px) {
    .header-row {
      display: none;
    }
  }

  .header-team {
    display: flex;
    align-items: center;
    gap: 0.625rem;
  }

  .header-team-home {
    justify-content: flex-end;
  }

  .header-team-away {
    justify-content: flex-start;
  }

  .header-logo {
    width: 3.5rem;
    height: 3.5rem;
    object-fit: contain;
    flex-shrink: 0;
  }

  .header-swatch {
    width: 2.5rem;
    height: 2.5rem;
    border-radius: 0.25rem;
    flex-shrink: 0;
  }

  .header-team-info {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
  }

  .header-team-info-home {
    text-align: right;
  }

  .header-team-info-away {
    text-align: left;
  }

  .header-team-name {
    font-size: 1.125rem;
    font-weight: 400;
    color: oklab(100% 0 0);
    line-height: 1.2;
    letter-spacing: 0.04em;
  }

  .header-team-name-line {
    display: flex;
    align-items: center;
    gap: 0.4rem;
  }

  .header-team-home .header-team-name-line {
    justify-content: flex-end;
  }

  .header-team-away .header-team-name-line {
    justify-content: flex-start;
  }

  /* Logo as clickable button — reset button chrome, add hover opacity */
  .header-logo-btn {
    background: none;
    border: none;
    padding: 0;
    margin: 0;
    cursor: pointer;
    display: flex;
    align-items: center;
    flex-shrink: 0;
    transition: opacity 0.15s;
  }

  .header-logo-btn:hover {
    opacity: 0.75;
  }

  /* Team name as clickable button — reset button chrome, add hover underline */
  .header-team-name-btn {
    font-family: inherit;
    background: none;
    border: none;
    padding: 0;
    margin: 0;
    cursor: pointer;
    text-decoration: none;
    transition: opacity 0.15s;
  }

  .header-team-name-btn:hover {
    text-decoration: underline;
    text-underline-offset: 0.2em;
    opacity: 0.85;
  }

  .header-team-rec {
    font-size: 1rem;
    font-weight: 400;
    color: oklab(100% 0 0 / 0.7);
    letter-spacing: 0.07em;
    line-height: 1.2;
  }

  /* Score block — center column */
  .header-score-block {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.3rem;
    padding: 0.2rem 0rem 0;
    justify-content: flex-end;
  }

  .header-score-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  /* Equal-basis halves keep the status badge pinned to the centre axis even
     though the winning score is heavier (and wider) than the losing one.
     Flex (rather than text-align) so the smaller shootout tally centres on the
     score's midline instead of sitting on its baseline. */
  .header-score {
    flex: 1 1 0;
    display: flex;
    align-items: center;
    font-size: 1.875rem;
    font-weight: 600;
    color: oklab(100% 0 0);
    line-height: 1;
    min-width: 1.25ch;
    letter-spacing: 0.01em;
  }

  .header-score-home {
    justify-content: flex-end;
  }

  .header-score-away {
    justify-content: flex-start;
  }

  .header-score.score-loser {
    color: oklab(0.63 0 0);
    font-weight: 300;
  }

  .header-sep {
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 2.5rem;
  }

  .header-vs {
    font-size: 1.125rem;
    font-weight: 600;
    color: oklab(100% 0 0);
    letter-spacing: 0.04em;
  }

  .header-meta {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.05rem;
  }

  .header-meta-line {
    font-size: 0.85rem;
    font-weight: 400;
    color: oklab(100% 0 0 / 0.85);
    text-align: center;
    letter-spacing: 0.02em;
    line-height: 1.35;
    margin-top: 0.3rem;
  }

  /* Venue line — sits under the scoreline row, desktop only */
  .header-venue-line-top {
    font-size: 0.8rem;
    font-weight: 400;
    color: oklab(100% 0 0 / 0.5);
    text-align: center;
    letter-spacing: 0.05em;
    line-height: 1.35;
    width: 100%;
    margin-top: 0.4rem;
    margin-bottom: 0.4rem;
  }

  @media (max-width: 599px) {
    .header-venue-line-top {
      display: none;
    }
  }

  /* Playoff stage banner — first element in the header, shown at all widths */
  .header-stage {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.2rem;
    width: 100%;
    margin-bottom: 0.5rem;
  }

  /* Leagues Cup only: sits closer to the top of the modal, with more room
     below it before the team/score row. */
  .header-stage-lc {
    margin-top: -0.4rem;
    margin-bottom: 0.85rem;
  }

  .header-stage-label {
    display: inline-flex;
    align-items: center;
    gap: 0.45em;
    font-size: 0.75rem;
    font-weight: 500;
    letter-spacing: 0.22em;
    text-transform: uppercase;
    color: oklab(100% 0 0 / 0.6);
    text-align: center;
    line-height: 1.3;
  }

  /* Leagues Cup only: ~15% larger and brighter/whiter than the standard
     postseason stage label. */
  .header-stage-label-lc {
    font-size: 0.8625rem;
    color: oklab(97% 0 0 / 0.92);
  }

  /* The Leagues Cup mark is painted via mask so it inherits the label colour
     the same way currentColor would on an inline SVG. Sized to match the
     label text's cap height rather than its full em box. */
  .stage-mark {
    width: 0.75em;
    height: 0.77em;
    flex-shrink: 0;
    background: currentColor;
    mask: url('/Leagues-cup-symbol.svg') no-repeat center / contain;
    -webkit-mask: url('/Leagues-cup-symbol.svg') no-repeat center / contain;
  }

  .header-series-note {
    font-size: 0.75rem;
    font-weight: 400;
    letter-spacing: 0.06em;
    color: oklab(100% 0 0 / 0.75);
    background: oklab(100% 0 0 / 0.1);
    border-radius: 0.2rem;
    padding: 0.1rem 0.4rem;
    text-align: center;
  }

  .header-series-decided {
    color: oklab(20% 0.02 0.03);
    background: oklab(84% 0.03 0.14);
    font-weight: 600;
  }

  @media (max-width: 599px) {
    .header-stage-label {
      font-size: 0.65rem;
      letter-spacing: 0.16em;
    }
    .header-stage-label-lc {
      font-size: 0.7475rem;
    }
    .header-series-note {
      font-size: 0.68rem;
    }
  }

  /* ── Scorers / cards row ──────────────────────────────────────────────────── */
  .header-events-row {
    display: flex;
    width: 100%;
    margin-top: 0.4rem;
    padding-top: 0.3rem;
    border-top: 1px solid oklab(100% 0 0 / 0.07);
    gap: 4rem;
  }

  @media (max-width: 599px) {
    .header-events-row {
      flex-direction: column;
      gap: 0;
    }
  }

  /* Each team's block: goals line stacked above cards line */
  .header-events-col {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
    flex: 1;
    min-width: 0;
  }

  /* Desktop: hug the central vertical axis (home flush right, away flush left) */
  .header-events-col-home {
    align-items: flex-end;
  }

  .header-events-col-away {
    align-items: flex-start;
  }

  @media (max-width: 599px) {
    .header-events-col {
      align-items: center;
    }

    .header-events-col-home {
      padding-bottom: 0.3rem;
      border-bottom: 1px solid oklab(100% 0 0 / 0.08);
      margin-bottom: 0.3rem;
    }
  }

  .events-goals-line,
  .events-cards-line {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.1rem 0.35rem;
    font-size: 0.85rem;
    font-weight: 200;
    color: oklab(100% 0 0 / 0.85);
    letter-spacing: 0.03em;
    width: 100%;
  }

  .header-events-col-home .events-goals-line,
  .header-events-col-home .events-cards-line {
    justify-content: flex-end;
  }

  .header-events-col-away .events-goals-line,
  .header-events-col-away .events-cards-line {
    justify-content: flex-start;
  }

  @media (max-width: 599px) {
    .header-events-col-home .events-goals-line,
    .header-events-col-home .events-cards-line,
    .header-events-col-away .events-goals-line,
    .header-events-col-away .events-cards-line {
      justify-content: center;
    }
  }

  /* Mobile: show team abbreviation label; hidden on desktop */
  .events-team-label {
    display: none;
    font-weight: 400;
    color: oklab(100% 0 0 / 0.55);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    flex-shrink: 0;
  }

  @media (max-width: 599px) {
    .events-team-label {
      display: inline;
    }
  }

  .event-goal-item,
  .event-card-item {
    display: inline-flex;
    align-items: center;
    gap: 0.2rem;
    white-space: nowrap;
  }

  .event-none {
    color: oklab(100% 0 0 / 0.4);
    font-weight: 200;
  }

  .event-icon {
    font-size: 0.85rem;
    line-height: 1;
  }

  /* Tiny coloured card square */
  .event-card {
    display: inline-block;
    width: 0.5rem;
    height: 0.65rem;
    border-radius: 0.075rem;
    flex-shrink: 0;
  }

  .event-card-yellow {
    background: #f5c518;
  }

  .event-card-red {
    background: #e03030;
  }

  /* Second-yellow red card — yellow square behind, red square angled in front */
  .event-card-double {
    display: inline-flex;
    position: relative;
    width: 0.75rem;
    height: 0.7rem;
    flex-shrink: 0;
  }

  .event-card-double-back {
    position: absolute;
    left: 0;
    top: 0.05rem;
  }

  .event-card-double-front {
    position: absolute;
    left: 0.2rem;
    top: 0;
    transform: rotate(14deg);
    box-shadow: -1px 0 2px oklab(0% 0 0 / 0.4);
  }

  .event-clock {
    font-size: 0.85rem;
    color: oklab(100% 0 0 / 0.5);
  }

  /* Penalty badge — small square box with a "P" cap */
  .event-goal-item .event-pen {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 0.6rem;
    font-weight: 600 !important;
    letter-spacing: 0.04em;
    line-height: 1;
    color: oklab(100% 0 0 / 0.75);
    background: oklab(100% 0 0 / 0.12);
    border: 1px solid oklab(100% 0 0 / 0.2);
    border-radius: 0.15rem;
    padding: 0.1rem 0.2rem;
    text-transform: uppercase;
    flex-shrink: 0;
  }

  /* Badges */
  .badge {
    font-size: 1rem;
    font-weight: 300;
    letter-spacing: 0.08em;
    padding: 0.15rem 0.4rem;
    border-radius: 0.2rem;
  }

  .badge-live {
    color: var(--color-text-accent);
  }

  .badge-ht {
    background: #3a2a10;
    color: #c8a060;
  }

  .badge-ft {
    background: rgba(255, 255, 255, 0.08);
    color: #ffffff;
  }

  /* Fire/wild/LC badge — hangs off the panel's top-right corner, same mark
     and offsets as GameBlock's wall-card badge. Rendered as a sibling of
     .modal-panel (see template) so this negative-offset overflow isn't
     clipped by the panel's own overflow: hidden. Combined-selector
     out-specificities MatchBadgeIcon's own position:relative on the same
     fallthrough root element. */
  .modal-badge.match-badge-tooltip {
    position: absolute;
    top: -0.4rem;
    right: -0.2rem;
    line-height: 1;
    z-index: 9050;
  }

  /* Close button — plain X in top-right corner, no circle */
  .modal-close {
    position: absolute;
    top: 0.4rem;
    right: 0.4rem;

    background: transparent;
    border: none;
    color: oklab(100% 0 0 / 0.3);
    font-size: 1rem;
    line-height: 1;
    padding: 0.25rem;
    cursor: pointer;
    transition: color 0.15s;
    z-index: 9100;
  }

  .modal-close:hover {
    color: oklab(100% 0 0);
  }

  @media (max-width: 599px) {
    .modal-close {
      display: none;
    }
  }

  /* ── Tabs ─────────────────────────────────────────────────────────────────── */
  .modal-tabs {
    display: flex;
    justify-content: center;
    gap: 0;
    padding: 0 0.75rem;
    flex-shrink: 0;
    background: linear-gradient(180deg, #000000d6, #00000000);
    border-bottom: 1px solid oklab(1 0 0 / 0.12);
  }

  .modal-tab {
    font-family: var(--font-condensed);
    font-size: 0.8125rem;
    font-weight: 400;
    letter-spacing: 0.12em;
    padding: 0.4rem 0.875rem;
    color: oklab(100% 0 0 / 0.55);
    background: transparent;
    border: none;
    border-bottom: 2px solid transparent;
    cursor: pointer;
    transition:
      color 0.15s,
      border-color 0.15s;
    text-transform: uppercase;
  }

  .modal-tab.active {
    color: oklab(100% 0 0);
    border-bottom-color: oklab(100% 0 0);
  }

  .modal-tab:hover:not(.active) {
    color: oklab(100% 0 0 / 0.75);
  }

  /* Tab label responsive visibility */
  .tab-label-mobile {
    display: none;
  }

  @media (max-width: 599px) {
    .tab-label-desktop {
      display: none;
    }
    .tab-label-mobile {
      display: inline;
    }
  }

  /* ── Body ─────────────────────────────────────────────────────────────────── */
  .modal-body {
    overflow-y: auto;
    overflow-x: hidden;
    flex: 1;
    padding: 0rem 0.85rem 1rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  /* ── Tab pane & slide transitions ─────────────────────────────────────────── */
  .tab-pane {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  /* Slide left (going to a later tab) */
  .tab-slide-left-enter-active,
  .tab-slide-left-leave-active,
  .tab-slide-right-enter-active,
  .tab-slide-right-leave-active {
    transition:
      transform 0.1s cubic-bezier(0.4, 0, 0.2, 1),
      opacity 0.08s ease;
    will-change: transform, opacity;
  }

  .tab-slide-left-enter-from {
    transform: translateX(16px);
    opacity: 0;
  }
  .tab-slide-left-leave-to {
    transform: translateX(-16px);
    opacity: 0;
  }

  .tab-slide-right-enter-from {
    transform: translateX(-16px);
    opacity: 0;
  }
  .tab-slide-right-leave-to {
    transform: translateX(16px);
    opacity: 0;
  }

  /* ── Skeleton ─────────────────────────────────────────────────────────────── */
  .skeleton-wrap {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding: 0.25rem 0;
  }

  .skeleton-row {
    height: 1.75rem;
    border-radius: 0.25rem;
    background: oklab(100% 0 0 / 0.05);
    animation: pulse 1.4s ease-in-out infinite;
  }

  @keyframes pulse {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0.35;
    }
  }

  /* ── Error ────────────────────────────────────────────────────────────────── */
  .error-msg {
    padding: 0.625rem 0.875rem;
    border-radius: 0.375rem;
    background: oklab(30.8% 0.072 0.028 / 0.3);
    border: 1px solid oklab(68.5% 0.13 0.048 / 0.2);
    font-size: 0.875rem;
    font-weight: 100;
    color: oklab(75.8% 0.107 0.04);
  }

  /* ── Section ──────────────────────────────────────────────────────────────── */
  .section {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .section-title {
    font-size: 0.6875rem;
    font-weight: 400;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: oklab(100% 0 0);
    margin: 0;
    display: flex;
    align-items: baseline;
    gap: 0.5rem;
  }

  .section-subtitle {
    font-size: 0.6875rem;
    font-weight: 100;
    letter-spacing: 0.06em;
    text-transform: none;
    color: oklab(100% 0 0 / 0.6);
  }

  /* ── Win probability ──────────────────────────────────────────────────────── */
  .prob-bar-wrap {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .prob-bar {
    flex: 1;
    height: 0.375rem;
    border-radius: 0.25rem;
    overflow: hidden;
    display: flex;
    background: oklab(100% 0 0 / 0.06);
  }

  .prob-fill {
    height: 100%;
    transition: width 0.4s ease;
  }

  .prob-fill-home {
    background: oklab(75% 0 0);
  }
  .prob-fill-draw {
    background: oklab(100% 0 0 / 0.15);
  }
  .prob-fill-away {
    background: oklab(45% 0 0);
  }

  .prob-label {
    display: flex;
    align-items: center;
    gap: 0.2rem;
    flex-shrink: 0;
  }

  .prob-label-home {
    flex-direction: row;
  }
  .prob-label-away {
    flex-direction: row-reverse;
  }

  .prob-abbr {
    font-size: 0.6875rem;
    font-weight: 400;
    color: oklab(100% 0 0);
    letter-spacing: 0.09em;
  }

  .prob-pct {
    font-size: 0.9rem;
    font-weight: 400;
    color: oklab(100% 0 0);
  }

  /* ── No data ──────────────────────────────────────────────────────────────── */
  .no-data {
    font-size: var(--modal-copy-size);
    font-weight: 100;
    color: oklab(100% 0 0);
    text-align: center;
    padding: 1.25rem 0;
    letter-spacing: 0.06em;
  }
</style>
