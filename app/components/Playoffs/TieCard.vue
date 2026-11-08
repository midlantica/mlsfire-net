<script setup lang="ts">
  import type { Match } from '~/composables/useScores'
  import type { BracketTeam, BracketTie } from '~/composables/usePlayoffs'
  import { useTimezone } from '~/composables/useTimezone'

  const props = defineProps<{
    tie: BracketTie
    favorite?: string | null
  }>()

  const emit = defineEmits<{
    'open-game-detail': [match: Match]
  }>()

  const { formatTimeHtml, iana } = useTimezone()

  const isOn = (m: Match) => m.status.code === 'live' || m.status.code === 'ht'

  // The game a click on the card should open: the one in play, else the next
  // one up, else the last one played.
  const focusGame = computed<Match | null>(() => {
    const games = props.tie.games
    return (
      games.find(isOn) ??
      games.find((m) => m.status.code === 'ns') ??
      games[games.length - 1] ??
      null
    )
  })

  const isLive = computed(() => !!focusGame.value && isOn(focusGame.value))
  const isSeries = computed(() => props.tie.bestOf === 3)

  function shortDate(iso: string): string {
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      timeZone: iana.value,
    })
  }

  function numericDate(iso: string): string {
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'numeric',
      day: 'numeric',
      timeZone: iana.value,
    })
  }

  const metaHtml = computed(() => {
    const game = focusGame.value
    if (props.tie.winner) return 'Final'
    if (!game) return 'TBD'
    if (game.status.code === 'ht') return 'HT'
    if (game.status.code === 'live') return `Live ${game.status.clock ?? ''}`
    if (game.status.code === 'ns')
      return `${shortDate(game.date)}, ${formatTimeHtml(game.date)}`
    return 'Final'
  })

  function sideOf(match: Match, team: BracketTeam) {
    const home = match.home === team.name
    return {
      goals: home ? match.homeScore : match.awayScore,
      pens: home ? match.homeShootout : match.awayShootout,
    }
  }

  const seriesStarted = computed(() =>
    props.tie.games.some((m) => m.status.code !== 'ns')
  )

  const slots = computed(() =>
    (['top', 'bottom'] as const).map((side) => {
      const team = props.tie[side]
      const options =
        side === 'top' ? props.tie.topOptions : props.tie.bottomOptions
      let score: string | null = null
      let pens: number | null = null
      if (team && isSeries.value && seriesStarted.value) {
        score = String(
          side === 'top' ? props.tie.topWins : props.tie.bottomWins
        )
      } else if (
        team &&
        !isSeries.value &&
        focusGame.value &&
        focusGame.value.status.code !== 'ns'
      ) {
        const s = sideOf(focusGame.value, team)
        score = s.goals ?? '0'
        pens = s.pens
      }
      return {
        side,
        team,
        options,
        score,
        pens,
        won: props.tie.winner === side,
        out: !!props.tie.winner && props.tie.winner !== side,
        fav: !!team && team.name === props.favorite,
      }
    })
  )

  const pills = computed(() => {
    const { top, bottom } = props.tie
    if (!isSeries.value || !top || !bottom) return []
    return props.tie.games.map((game, i) => {
      const t = sideOf(game, top)
      const b = sideOf(game, bottom)
      const n = i + 1
      if (game.status.code === 'ns') {
        return {
          game,
          text: numericDate(game.date),
          pens: false,
          state: 'ns',
          label: `Game ${n}, ${shortDate(game.date)}`,
        }
      }
      const shootout = t.pens != null && b.pens != null
      const score = `${t.goals ?? 0}–${b.goals ?? 0}`
      return {
        game,
        text: score,
        pens: shootout,
        state: isOn(game) ? 'live' : 'ft',
        label: `Game ${n}, ${top.abbr} ${score} ${bottom.abbr}${shootout ? `, ${t.pens}–${b.pens} on penalties` : ''}`,
      }
    })
  })

  // Before ESPN schedules the game, a set pairing still opens its preview.
  const target = computed(() => focusGame.value ?? props.tie.preview)

  // With game pills, those are the keyboard targets; otherwise the card is.
  const isButton = computed(() => !!target.value && !pills.value.length)

  function open() {
    if (target.value) emit('open-game-detail', target.value)
  }

  const label = computed(() => {
    const name = (t: BracketTeam | null, opts: BracketTeam[]) =>
      t?.name ?? (opts.length ? opts.map((o) => o.abbr).join(' or ') : 'TBD')
    return `${name(props.tie.top, props.tie.topOptions)} vs ${name(props.tie.bottom, props.tie.bottomOptions)}`
  })
</script>

<template>
  <div
    class="tie"
    :class="{
      'tie-live': isLive,
      'tie-open': !!target,
      'tie-decided': !!tie.winner,
    }"
    :role="isButton ? 'button' : 'group'"
    :tabindex="isButton ? 0 : undefined"
    :aria-label="isButton ? `${label}, match details` : label"
    @click="open"
    @keydown.self.enter.space.prevent="open"
  >
    <div class="tie-meta" :class="{ 'meta-live': isLive }">
      <span v-if="isLive" class="live-dot" aria-hidden="true" />
      <span v-html="metaHtml" />
    </div>

    <div
      v-for="slot in slots"
      :key="slot.side"
      class="tie-row"
      :class="{
        'row-won': slot.won,
        'row-out': slot.out,
        'row-fav': slot.fav,
      }"
    >
      <template v-if="slot.team">
        <span class="seed">{{ slot.team.seed }}</span>
        <span class="logo" aria-hidden="true">
          <img v-if="slot.team.logo" :src="slot.team.logo" alt="" />
        </span>
        <span class="abbr" :title="slot.team.name">{{ slot.team.abbr }}</span>
        <span v-if="slot.score != null" class="score"
          >{{ slot.score
          }}<span v-if="slot.pens != null" class="pens"
            >({{ slot.pens }})</span
          ></span
        >
      </template>
      <template v-else>
        <span class="seed" />
        <span class="logo logo-pending" aria-hidden="true">
          <svg viewBox="0 0 24 24">
            <path
              d="M12 3 4.5 6v5.5c0 4.6 3.1 8.2 7.5 9.5 4.4-1.3 7.5-4.9 7.5-9.5V6L12 3Z"
            />
          </svg>
        </span>
        <span
          class="abbr abbr-pending"
          :title="slot.options.map((o) => o.name).join(' or ') || undefined"
          >{{
            slot.options.length
              ? slot.options.map((o) => o.abbr).join('/')
              : 'TBD'
          }}</span
        >
      </template>
    </div>

    <div v-if="pills.length" class="tie-games">
      <button
        v-for="pill in pills"
        :key="pill.game.id"
        type="button"
        class="pill"
        :class="`pill-${pill.state}`"
        :aria-label="pill.label"
        :title="pill.label"
        @click.stop="emit('open-game-detail', pill.game)"
      >
        {{ pill.text }}<span v-if="pill.pens" class="pill-pens">p</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
  .tie {
    container-type: inline-size;
    direction: ltr;
    font-family: var(--font-condensed);
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    width: 100%;
    min-width: 0;
    padding: 0.35rem 0.45rem 0.45rem;
    border-radius: 0.375rem;
    border: 1px solid oklab(100% 0 0 / 0.07);
    background: oklab(100% 0 0 / 0.07);
  }

  .tie-open {
    cursor: pointer;
  }

  .tie-open:hover {
    border-color: oklab(100% 0 0 / 0.22);
    background: oklab(100% 0 0 / 0.09);
  }

  .tie:focus-visible {
    outline: 2px solid var(--color-theme-400);
    outline-offset: 2px;
  }

  .tie-live {
    border-color: oklab(100% 0 0 / 0.3);
  }

  /* ── Meta line (kickoff / live / final) ───────────────────────────────── */
  .tie-meta {
    display: flex;
    align-items: center;
    gap: 0.3rem;
    min-height: 1rem;
    font-size: 0.75rem;
    font-weight: 300;
    letter-spacing: 0.02em;
    color: var(--color-text-secondary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .tie-meta :deep(.ampm) {
    font-size: 0.85em;
    margin-left: 0.05em;
  }

  .tie-decided .tie-meta {
    color: var(--color-text-tertiary);
  }

  .meta-live {
    color: var(--color-text-primary);
    font-weight: 500;
  }

  .live-dot {
    width: 0.4rem;
    height: 0.4rem;
    border-radius: 50%;
    background: var(--color-theme-300);
    flex-shrink: 0;
    animation: live-pulse 1.6s ease-in-out infinite;
  }

  @keyframes live-pulse {
    50% {
      opacity: 0.3;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .live-dot {
      animation: none;
    }
  }

  /* ── Team rows ────────────────────────────────────────────────────────── */
  .tie-row {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    min-width: 0;
    height: 1.45rem;
  }

  .seed {
    width: 0.6rem;
    flex-shrink: 0;
    font-size: 0.7rem;
    font-weight: 400;
    color: var(--color-text-tertiary);
    text-align: right;
    font-variant-numeric: tabular-nums;
  }

  .logo {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 1.15rem;
    height: 1.15rem;
    flex-shrink: 0;
  }

  .logo img {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }

  .logo-pending svg {
    width: 0.95rem;
    height: 0.95rem;
    fill: none;
    stroke: oklab(100% 0 0 / 0.25);
    stroke-width: 1.5;
  }

  .abbr {
    flex: 1;
    min-width: 0;
    font-size: 1.0625rem;
    font-weight: 400;
    letter-spacing: 0.03em;
    color: var(--color-text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .abbr-pending {
    font-size: 0.8125rem;
    font-weight: 300;
    color: var(--color-text-tertiary);
  }

  .score {
    display: flex;
    align-items: center;
    flex-shrink: 0;
    font-size: 1.0625rem;
    font-weight: 600;
    color: var(--color-text-primary);
    font-variant-numeric: tabular-nums;
  }

  .pens {
    font-size: 0.7rem;
    font-weight: 400;
    margin-left: 0.1rem;
    color: var(--color-text-secondary);
  }

  .row-won .abbr {
    font-weight: 600;
    color: oklab(100% 0 0);
  }

  .row-won .score {
    color: oklab(100% 0 0);
  }

  .row-out {
    opacity: 0.42;
  }

  .row-out .logo img {
    filter: grayscale(1);
  }

  .row-out .score {
    font-weight: 400;
  }

  .row-fav .abbr {
    color: var(--color-theme-300);
  }

  /* ── Best-of-3 game strip ─────────────────────────────────────────────── */
  .tie-games {
    display: flex;
    flex-wrap: wrap;
    gap: 0.2rem;
    margin-top: 0.15rem;
    padding-left: 0.85rem;
  }

  /* Tight columns (narrow mirrored bracket, phones): drop the indent, and
     give a shootout tally the seed's room so the abbreviation stays whole. */
  @container (max-width: 8rem) {
    .tie-games {
      padding-left: 0;
    }
  }

  @container (max-width: 7.5rem) {
    .tie-row:has(.pens) .seed {
      display: none;
    }
  }

  @container (max-width: 6.5rem) {
    .tie-row:has(.abbr-pending) .seed {
      display: none;
    }
  }

  .pill {
    font-family: inherit;
    font-size: 0.75rem;
    font-weight: 400;
    line-height: 1;
    padding: 0.15rem 0.25rem 0.18rem;
    border: none;
    border-radius: 0.2rem;
    background: oklab(100% 0 0 / 0.08);
    color: var(--color-text-secondary);
    white-space: nowrap;
    cursor: pointer;
    font-variant-numeric: tabular-nums;
  }

  .pill:hover {
    background: oklab(100% 0 0 / 0.16);
    color: var(--color-text-primary);
  }

  .pill:focus-visible {
    outline: 2px solid var(--color-theme-400);
    outline-offset: 1px;
  }

  .pill-ns {
    background: none;
    box-shadow: inset 0 0 0 1px oklab(100% 0 0 / 0.1);
    color: var(--color-text-tertiary);
  }

  .pill-live {
    color: var(--color-text-primary);
    box-shadow: inset 0 0 0 1px oklab(100% 0 0 / 0.35);
  }

  .pill-pens {
    font-size: 0.85em;
    margin-left: 0.08rem;
    opacity: 0.8;
  }
</style>
