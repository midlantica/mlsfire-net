<script setup lang="ts">
  import type { Match } from '../composables/useScores'
  import { useTimezone } from '../composables/useTimezone'
  import { useConferenceBadges } from '../composables/useStandings'
  import { TEAM_SHORT_NAME } from '../composables/useMyTeam'
  import {
    getRoundInfo,
    getCompetition,
    calcLeaguesCupHeat,
  } from '../constants/rounds'
  import { useClubStrength } from '../composables/useClubStrength'

  const props = defineProps<{
    match: Match
    showDate?: boolean // show full date instead of just time (Week's Best)
    hideConferenceBadge?: boolean
    conferenceTooltipSide?: 'bottom' | 'right'
  }>()

  const emit = defineEmits<{
    'open-game-detail': [match: Match]
  }>()

  const { formatTimeHtml, iana } = useTimezone()
  const { badgeByTeam } = useConferenceBadges()

  const homeBadge = computed(() => badgeByTeam.value[props.match.home])
  const awayBadge = computed(() => badgeByTeam.value[props.match.away])

  const NAME_LENGTH_THRESHOLD = 18

  function displayTeamName(fullName: string): string {
    if (fullName.length <= NAME_LENGTH_THRESHOLD) return fullName
    return TEAM_SHORT_NAME[fullName] ?? fullName
  }

  const homeDisplayName = computed(() => displayTeamName(props.match.home))
  const awayDisplayName = computed(() => displayTeamName(props.match.away))

  const kickoffLabel = computed(() => formatTimeHtml(props.match.date))

  const roundInfo = computed(() => getRoundInfo(props.match.seasonSlug))

  const dateTimeLabel = computed(() => {
    const d = new Date(props.match.date)
    const day = d.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      timeZone: iana.value,
    })
    const time = d.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      timeZone: iana.value,
    })
    return { day, time }
  })

  const isLive = computed(() => props.match.status.code === 'live')
  const isHT = computed(() => props.match.status.code === 'ht')
  const isFT = computed(() => props.match.status.code === 'ft')
  const isNS = computed(() => props.match.status.code === 'ns')

  const { strengthFor, load: loadClubStrength } = useClubStrength()

  const isLeaguesCup = computed(
    () => getCompetition(props.match.seasonSlug) === 'Leagues Cup'
  )

  onMounted(() => {
    if (isLeaguesCup.value) loadClubStrength()
  })

  const leaguesCupHeat = computed(() =>
    calcLeaguesCupHeat(
      strengthFor(props.match.home),
      strengthFor(props.match.away),
      props.match.seasonSlug
    )
  )

  const isFire = computed(
    () =>
      (isLeaguesCup.value && leaguesCupHeat.value === 'hot') ||
      props.match.badge === 'fire'
  )
  const isWild = computed(
    () =>
      (isLeaguesCup.value && leaguesCupHeat.value === 'cool') ||
      (!isLeaguesCup.value && props.match.badge === 'wild')
  )

  const displayBadge = computed(() => {
    if (isFire.value) return 'fire'
    if (isWild.value) return 'wild'
    return null
  })

  // ── Penalty shootout ──────────────────────────────────────────────────────
  const shootout = computed(() => {
    const m = props.match
    if (m.homeShootout == null || m.awayShootout == null) return null
    return { home: m.homeShootout, away: m.awayShootout }
  })

  // ── Winner / loser (FT only) ──────────────────────────────────────────────
  // A level scoreline is only a draw in league play; in a cup tie the shootout
  // decides who advances, so it settles the winner styling instead.
  const homeWins = computed(() => {
    if (!isFT.value) return false
    const h = parseInt(props.match.homeScore ?? '0', 10)
    const a = parseInt(props.match.awayScore ?? '0', 10)
    if (h !== a) return h > a
    const pens = shootout.value
    return pens ? pens.home > pens.away : false
  })
  const awayWins = computed(() => {
    if (!isFT.value) return false
    const h = parseInt(props.match.homeScore ?? '0', 10)
    const a = parseInt(props.match.awayScore ?? '0', 10)
    if (h !== a) return a > h
    const pens = shootout.value
    return pens ? pens.away > pens.home : false
  })

  // ── Local clock ticker ────────────────────────────────────────────────────
  // Parse "MM:SS" → total seconds, tick every second, display as "MM:SS"
  // Resets whenever the prop clock changes (i.e. after each API refresh).
  // Runs freely past 90:00 into stoppage/extra time. Won't tick during HT.
  const localClock = ref<string | null>(null)
  let clockBase = 0 // total seconds at last prop update
  let clockTickedAt = 0 // Date.now() when we last synced from the prop
  let clockTimer: ReturnType<typeof setInterval> | null = null

  function parseClock(clock: string): number {
    // Strip trailing prime/apostrophe (e.g. "35'" → "35")
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
    if (!isLive.value || !props.match.status.clock) return
    clockBase = parseClock(props.match.status.clock)
    clockTickedAt = Date.now()
    localClock.value = formatClock(clockBase)

    clockTimer = setInterval(() => {
      if (!isLive.value) {
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

  // Re-sync whenever the API clock prop changes
  watch(
    () => props.match.status.clock,
    (newClock) => {
      if (isLive.value && newClock) {
        startClockTicker()
      } else {
        stopClockTicker()
        localClock.value = null
      }
    }
  )

  // Also react to status code changes (e.g. going live or ending)
  watch(isLive, (live) => {
    if (live && props.match.status.clock) {
      startClockTicker()
    } else {
      stopClockTicker()
      localClock.value = null
    }
  })

  onMounted(() => {
    if (isLive.value && props.match.status.clock) startClockTicker()
  })

  onUnmounted(stopClockTicker)

  // The clock label shown in the badge: prefer local ticker, fall back to prop
  const displayClock = computed(
    () => localClock.value ?? props.match.status.clock ?? 'LIVE'
  )

  // ── Goal flash animation ──────────────────────────────────────────────────
  const justScored = ref(false)
  let flashTimer: ReturnType<typeof setTimeout> | null = null

  watch(
    () => `${props.match.homeScore}-${props.match.awayScore}`,
    (newVal, oldVal) => {
      // Only trigger during live/HT matches, and skip the initial render
      if (!oldVal || !isLive.value) return
      justScored.value = true
      if (flashTimer) clearTimeout(flashTimer)
      flashTimer = setTimeout(() => {
        justScored.value = false
      }, 425) // animation duration
    }
  )

  onUnmounted(() => {
    if (flashTimer) clearTimeout(flashTimer)
  })
</script>

<template>
  <div
    class="game-block"
    :class="{
      'game-block-live': isLive || isHT,
      'game-block-fire': isFire,
      'game-block-wild': isWild,
      'game-block-goal': justScored,
      'game-block-home-wins': homeWins,
      'game-block-away-wins': awayWins,
    }"
    role="button"
    tabindex="0"
    @click="emit('open-game-detail', match)"
    @keydown.enter.space.prevent="emit('open-game-detail', match)"
  >
    <!-- Badge indicator — same fire/wild icons for MLS and Leagues Cup -->
    <MatchBadgeIcon
      v-if="displayBadge"
      :badge="displayBadge"
      class="match-badge"
    />

    <!-- Home team row -->
    <div class="team-row team-row-home">
      <div class="team-left">
        <span class="logo-slot" aria-hidden="true">
          <img
            v-if="match.homeLogo"
            :src="match.homeLogo"
            :alt="match.home"
            class="team-logo"
          />
          <span
            v-else
            class="swatch"
            :style="{ background: match.homeColor }"
          />
        </span>
        <span class="team-name-text">{{ homeDisplayName }}</span>
        <ConferenceBadge
          v-if="!hideConferenceBadge"
          :badge="homeBadge"
          :tooltip-side="conferenceTooltipSide"
        />

        <span v-if="match.homeRec && !isLeaguesCup" class="team-rec">{{
          match.homeRec
        }}</span>
      </div>
      <div v-if="!isNS" class="score-cell">
        <span
          class="team-score"
          :class="{
            'score-winner': homeWins && !isLeaguesCup,
            'score-loser': isFT && !homeWins && !isLeaguesCup,
            'score-even': isFT && isLeaguesCup,
          }"
          >{{ match.homeScore ?? '0'
          }}<span v-if="shootout" class="score-pens"
            >({{ shootout.home }})</span
          ></span
        >
      </div>
    </div>

    <!-- Away team row -->
    <div class="team-row team-row-away">
      <div class="team-left">
        <span class="logo-slot" aria-hidden="true">
          <img
            v-if="match.awayLogo"
            :src="match.awayLogo"
            :alt="match.away"
            class="team-logo"
          />
          <span
            v-else
            class="swatch"
            :style="{ background: match.awayColor }"
          />
        </span>
        <span class="team-name-text">{{ awayDisplayName }}</span>
        <ConferenceBadge
          v-if="!hideConferenceBadge"
          :badge="awayBadge"
          :tooltip-side="conferenceTooltipSide"
        />

        <span v-if="match.awayRec && !isLeaguesCup" class="team-rec">{{
          match.awayRec
        }}</span>
      </div>
      <div v-if="!isNS" class="score-cell">
        <span
          class="team-score"
          :class="{
            'score-winner': awayWins && !isLeaguesCup,
            'score-loser': isFT && !awayWins && !isLeaguesCup,
            'score-even': isFT && isLeaguesCup,
          }"
          >{{ match.awayScore ?? '0'
          }}<span v-if="shootout" class="score-pens"
            >({{ shootout.away }})</span
          ></span
        >
      </div>
    </div>

    <!-- Right column: status / time -->
    <div class="status-col">
      <span
        v-if="roundInfo"
        class="round-chip"
        :class="{ 'round-chip-cup': roundInfo.weight === 5 }"
        :title="roundInfo.stage"
        >{{ roundInfo.short }}</span
      >
      <template v-if="isLive">
        <span class="badge badge-live">{{ displayClock }}</span>
        <span class="status-date">{{ dateTimeLabel.day }}</span>
      </template>
      <template v-else-if="isHT">
        <span class="badge badge-ht">HT</span>
        <span class="status-date">{{ dateTimeLabel.day }}</span>
      </template>
      <template v-else-if="isFT">
        <span class="badge badge-ft">FT</span>
        <span class="status-date">{{ dateTimeLabel.day }}</span>
      </template>
      <template v-else>
        <!-- Not started -->
        <span class="status-time" v-html="kickoffLabel" />
        <span class="status-date">{{ dateTimeLabel.day }}</span>
      </template>
    </div>
  </div>
</template>

<style scoped>
  /* Match badge — absolutely positioned top-right corner.
     Combined-selector to out-specificity MatchBadgeIcon's own
     position:relative on the same fallthrough root element. */
  .match-badge.match-badge-tooltip {
    position: absolute;
    top: -0.3rem;
    right: -0.4rem;
    line-height: 1;
    z-index: 1;
  }

  .game-block-fire {
    border-color: oklab(100% 0 0 / 0.12);
  }

  .game-block {
    font-family: var(--font-condensed);
    display: grid;
    grid-template-columns: 1fr auto;
    grid-template-rows: auto auto;
    grid-template-areas:
      'home home status'
      'away away status';
    align-items: center;
    gap: 0.3rem 0.4rem;
    padding: 0.425rem 0.5rem;
    border-radius: 0.375rem;
    background: oklab(100% 0 0 / 0.09);
    transition: border-color 0.15s;
    min-width: 0;
    cursor: pointer;
    position: relative; /* anchors .match-badge */
    z-index: 0; /* own stacking context, so the badge/tooltip never races
                   against a neighboring card's box for paint order */
  }

  .game-block:hover {
    border-color: oklab(100% 0 0 / 0.2);
  }

  /* While this card's badge tooltip is open, guarantee it paints above
     every sibling card, since the badge overflows outside this card's own
     box (negative top/right) and can otherwise sit under a neighbor. */
  .game-block:has(.tooltip-bubble) {
    z-index: 20;
  }

  .game-block-live {
    outline: 1px solid oklab(100% 0 0 / 0.25);
    outline-offset: -1px;
  }

  /* ── Goal scored: shimmy-shake — rotation + expand only, no color change ── */
  @keyframes goal-flash {
    0% {
      transform: rotate(0deg) scale(1);
    }
    10% {
      transform: rotate(-4deg) scale(1.04);
    }
    25% {
      transform: rotate(3.5deg) scale(1.05);
    }
    40% {
      transform: rotate(-2.5deg) scale(1.03);
    }
    55% {
      transform: rotate(2deg) scale(1.02);
    }
    70% {
      transform: rotate(-1deg) scale(1.01);
    }
    85% {
      transform: rotate(0.5deg) scale(1);
    }
    100% {
      transform: rotate(0deg) scale(1);
    }
  }

  .game-block-goal {
    animation: goal-flash 0.425s ease-out forwards;
    /* Override the global transition so the flash keyframes aren't smoothed */
    transition: none !important;
  }

  /* Team rows */
  .team-row {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    min-width: 0;
    padding: 0.125rem 0;
    position: relative; /* needed for winner-caret ::after positioning */
  }

  @media (max-width: 530px) {
    .team-row {
      padding: 0rem 0;
    }
  }

  .team-row-home {
    grid-area: home;
  }
  .team-row-away {
    grid-area: away;
  }

  .team-left {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    flex: 1;
    min-width: 0;
  }

  /* Logo slot — fixed size, holds either an <img> or a color swatch */
  .logo-slot {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 1.3em;
    height: auto;
    flex-shrink: 0;
  }

  .team-logo {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }

  .swatch {
    display: inline-block;
    width: 0.875em;
    height: 0.875em;
    border-radius: 0.125em;
    flex-shrink: 0;
  }

  .team-name-text {
    font-size: var(--modal-copy-size);
    font-weight: 200;
    color: var(--color-text-primary);
    letter-spacing: 0.025rem;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    flex: 1;
    min-width: 0;
  }

  .team-rec {
    font-size: 0.75rem;
    font-weight: 300;
    color: oklab(80% 0 0 / 0.6);
    white-space: nowrap;
    flex-shrink: 0;
    margin-right: 0.15rem;
  }

  /* Score cell wraps the number + optional winner caret side-by-side */
  .score-cell {
    display: flex;
    align-items: center;
    gap: 0.2rem;
    position: relative;
    right: 3px;
    margin-left: 0.25rem;
  }

  /* Flex (rather than text-align) so the smaller shootout tally centres on the
     score's midline instead of sitting on its baseline. */
  .team-score {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    font-size: 1.0625rem;
    font-weight: 700;
    color: var(--color-text-primary);
    line-height: 1;
    min-width: 1ch;
  }

  /* Live/HT scores: bolder so they read as a live scoreline */
  .game-block-live .team-score {
    font-weight: 800;
    font-size: 1.1875rem;
  }

  /* FT winner: hard white */
  .score-winner {
    color: #ffffff;
    font-weight: 400;
  }

  /* FT loser: muted — distinct from winner but not invisible */
  .score-loser {
    color: oklab(65% 0 0);
  }

  /* Leagues Cup ties are settled on the night — no aggregate, no second leg —
     so both scorelines carry equal weight instead of dimming the loser. The
     caret still marks who advanced. */
  .score-even {
    color: oklab(94% 0 0);
    font-weight: 400;
  }

  /* Penalty shootout tally, a thin space away from the score */
  .score-pens {
    font-size: 0.85em;
    font-weight: inherit;
    color: inherit;
    margin-left: 0.35em;
  }

  /* Green winner caret ◀ */
  .winner-caret {
    font-size: 0.6rem;
    line-height: 1;
    color: #4ade80; /* green-400 */
    flex-shrink: 0;
  }

  /* Status column — fixed width so cards always line up down the page */
  .status-col {
    grid-area: status;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.075rem;
    padding-left: 0.5rem;
    border-left: 1px solid oklab(100% 0 0 / 0.07);
    width: 4rem;
    flex-shrink: 0;
    text-align: center;
    position: relative;
  }

  /* Winner caret — CSS triangle on the right edge of the winning team row,
     sitting right on the vertical border between scores and status column.
     Using ::after on the team-row means it's always perfectly centered on
     that row regardless of row height. */
  .game-block-home-wins .team-row-home::after,
  .game-block-away-wins .team-row-away::after {
    content: '';
    position: absolute;
    right: calc(-0.1rem - 5px);
    top: 52%;
    transform: translateY(-50%);
    width: 0;
    height: 0;
    border-top: 6px solid transparent;
    border-bottom: 6px solid transparent;
    border-right: 5px solid #aaaaaa; /* pointing left */
    pointer-events: none;
  }

  .status-time {
    font-size: 1rem;
    font-weight: 100;
    color: var(--color-text-primary);
    white-space: nowrap;
    line-height: 1;
    letter-spacing: 0.03rem;
  }

  .status-time :deep(.ampm) {
    font-size: 1em;
  }

  .status-date {
    font-size: 0.8rem;
    font-weight: 100;
    color: oklab(90% 0 0);
    white-space: nowrap;
    letter-spacing: 0.03rem;
    line-height: 1.3;
  }

  /* Shared badge base */
  .badge {
    font-size: 0.85rem;
    font-weight: 200;
    letter-spacing: 0.12em;
    color: white;
    padding: 0rem 0.25rem 0.04rem 0.35rem;
    border-radius: 0.2rem;
    white-space: nowrap;
    text-align: center;
    background: oklab(0 0 0 / 0.3);
  }

  /* Live clock: fill the full column width so the clock never shifts the layout.
     Tabular nums keep each digit the same width as it ticks. */
  .badge-live {
    width: 100%;
    font-variant-numeric: tabular-nums;
    font-feature-settings: 'tnum';
    box-sizing: border-box;
  }

  /* HT / FT: stay compact (roughly square), centered in the column */
  .badge-ht,
  .badge-ft {
    width: auto;
  }

  /* Playoff round label — sits above the status badge in the fixed-width
     column, so it must stay narrow enough for "WILD CARD" to fit. */
  .round-chip {
    font-size: 0.5625rem;
    font-weight: 400;
    letter-spacing: 0.08em;
    line-height: 1;
    color: oklab(88% 0 0 / 0.85);
    background: oklab(100% 0 0 / 0.1);
    border-radius: 0.15rem;
    padding: 0.12rem 0.25rem;
    margin-bottom: 0.2rem;
    white-space: nowrap;
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .round-chip-cup {
    color: oklab(20% 0.02 0.03);
    background: oklab(84% 0.03 0.14);
    font-weight: 600;
  }
</style>
