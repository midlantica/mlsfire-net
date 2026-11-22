<script setup lang="ts">
  import type { Match } from '~/composables/useScores'
  import type { BracketTeam, BracketTie } from '~/composables/usePlayoffs'
  import { seriesColors } from '~/composables/usePlayoffs'
  import { useLiveClock } from '~/composables/useLiveClock'
  import { useTimezone } from '~/composables/useTimezone'

  const props = defineProps<{
    tie: BracketTie
    favorite?: string | null
    /** Silver title above the matchup, e.g. "West Conf. Final". */
    heading?: string
  }>()

  const emit = defineEmits<{
    'open-game-detail': [match: Match]
  }>()

  const { kickoffTimeHtml, formatTime, iana } = useTimezone()

  const isOn = (m: Match) => m.status.code === 'live' || m.status.code === 'ht'

  // The game the card's status line describes and a click opens: the one in
  // play, else the last one played (its result is what the card shows), else
  // the first one up. The pills still reach every game in a series.
  const focusGame = computed<Match | null>(() => {
    const games = props.tie.games
    const played = games.filter((m) => m.status.code !== 'ns')
    return games.find(isOn) ?? played[played.length - 1] ?? games[0] ?? null
  })

  const isLive = computed(() => !!focusGame.value && isOn(focusGame.value))
  const liveClock = useLiveClock(() => focusGame.value)
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

  function sideOf(match: Match, team: BracketTeam) {
    const home = match.home === team.name
    return {
      goals: home ? match.homeScore : match.awayScore,
      pens: home ? match.homeShootout : match.awayShootout,
    }
  }

  // The rows carry the status line's game score — the same one its match
  // detail shows. A series' other games are in the pills.
  const slots = computed(() =>
    (['top', 'bottom'] as const).map((side) => {
      const team = props.tie[side]
      const options =
        side === 'top' ? props.tie.topOptions : props.tie.bottomOptions
      let score: string | null = null
      let pens: number | null = null
      const game = focusGame.value
      if (team && game && game.status.code !== 'ns') {
        const s = sideOf(game, team)
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

  const colors = computed(() => {
    const { top, bottom } = props.tie
    return isSeries.value && top && bottom ? seriesColors(top, bottom) : null
  })

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
          color: null,
          label: `Game ${n}, ${shortDate(game.date)}, ${game.timeTbd ? 'time TBD' : formatTime(game.date).replace(/\s+/, '').toLowerCase()}`,
        }
      }
      const shootout = t.pens != null && b.pens != null
      const score = `${t.goals ?? 0}–${b.goals ?? 0}`
      const diff =
        Number(t.goals ?? 0) - Number(b.goals ?? 0) ||
        Number(t.pens ?? 0) - Number(b.pens ?? 0)
      const winner =
        game.status.code === 'ft' && diff ? (diff > 0 ? 'top' : 'bottom') : null
      return {
        game,
        text: score,
        pens: shootout,
        state: isOn(game) ? 'live' : 'ft',
        color: winner && colors.value ? colors.value[winner] : null,
        label: `Game ${n}, ${top.abbr} ${score} ${bottom.abbr}${shootout ? `, ${t.pens}–${b.pens} on penalties` : ''}`,
      }
    })
  })

  // "CLB leads 1–0" / "Tied 1–1" / "CLB won 2–1", once a series game is final.
  const seriesLead = computed(() => {
    const { top, bottom, topWins, bottomWins, winner } = props.tie
    if (!isSeries.value || !top || !bottom || topWins + bottomWins === 0)
      return null
    if (topWins === bottomWins)
      return { team: null, color: null, text: `Tied ${topWins}–${bottomWins}` }
    const side = topWins > bottomWins ? 'top' : 'bottom'
    const [hi, lo] = [topWins, bottomWins].sort((a, b) => b - a)
    return {
      team: props.tie[side]!.abbr,
      color: colors.value?.[side].fill ?? null,
      text: `${winner ? 'won' : 'leads'} ${hi}–${lo}`,
    }
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
      'tie-featured': !!heading,
    }"
    :role="isButton ? 'button' : 'group'"
    :tabindex="isButton ? 0 : undefined"
    :aria-label="isButton ? `${label}, match details` : label"
    @click="open"
    @keydown.self.enter.space.prevent="open"
  >
    <div class="tie-body">
      <p v-if="heading" class="tie-heading">{{ heading }}</p>
      <div class="tie-meta" :class="{ 'meta-live': isLive }">
        <span class="meta-date">{{
          focusGame ? shortDate(focusGame.date) : tie.winner ? 'Final' : 'TBD'
        }}</span>
        <span v-if="seriesLead" class="meta-lead"
          ><span class="lead-sep" aria-hidden="true">· </span
          ><span
            v-if="seriesLead.team"
            class="lead-team"
            :style="seriesLead.color ? { color: seriesLead.color } : undefined"
            >{{ seriesLead.team }}</span
          >{{ seriesLead.text }}</span
        >
        <span v-if="focusGame" class="meta-status">
          <template v-if="focusGame.status.code === 'live'">
            <span class="live-dot" aria-hidden="true" />
            <span class="badge badge-live">{{ liveClock }}</span>
          </template>
          <span v-else-if="focusGame.status.code === 'ht'" class="badge"
            >HT</span
          >
          <span v-else-if="focusGame.status.code === 'ft'" class="badge"
            >FT</span
          >
          <span v-else v-html="kickoffTimeHtml(focusGame)" />
        </span>
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
          :class="[`pill-${pill.state}`, { 'pill-won': pill.color }]"
          :style="
            pill.color
              ? {
                  '--pill-color': pill.color.fill,
                  '--pill-border': pill.color.border,
                }
              : undefined
          "
          :aria-label="pill.label"
          :title="pill.label"
          @click.stop="emit('open-game-detail', pill.game)"
        >
          {{ pill.text }}<span v-if="pill.pens" class="pill-pens">p</span>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
  .tie {
    container-type: inline-size;
    direction: ltr;
    font-family: var(--font-condensed);
    width: 100%;
    min-width: 0;
    padding: 0.35rem 0.45rem 0.45rem;
    border-radius: 0.375rem;
    border: 1px solid oklab(100% 0 0 / 0.07);
    background: oklab(100% 0 0 / 0.07);
  }

  .tie-body {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
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

  /* Headed cards (the wide bracket's conference finals) are silver, a step
     below the gold MLS Cup card. */
  .tie-featured {
    padding: 0.5rem 0.55rem 0.55rem;
    border-color: oklab(100% 0 0 / 0.18);
    background:
      radial-gradient(
        120% 70% at 50% 0%,
        oklab(100% 0 0 / 0.08),
        transparent 70%
      ),
      oklab(100% 0 0 / 0.07);
    box-shadow: inset 0 1px 0 oklab(100% 0 0 / 0.08);
  }

  .tie-featured.tie-open:hover {
    border-color: oklab(100% 0 0 / 0.32);
  }

  .tie-heading {
    margin-bottom: 0.2rem;
    font-size: 0.875rem;
    font-weight: 600;
    line-height: 1.15;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    text-align: center;
    white-space: nowrap;
    background: linear-gradient(
      180deg,
      oklch(97% 0.005 250),
      oklch(74% 0.02 250)
    );
    background-clip: text;
    -webkit-background-clip: text;
    color: transparent;
  }

  @container (max-width: 7.75rem) {
    .tie-heading {
      font-size: 0.6875rem;
      letter-spacing: 0.08em;
    }
  }

  .tie-live {
    border-color: oklab(100% 0 0 / 0.3);
  }

  /* ── Meta line (kickoff / live / final) ───────────────────────────────── */
  .tie-meta {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.3rem;
    min-height: 1rem;
    font-size: 0.75rem;
    font-weight: 300;
    letter-spacing: 0.02em;
    color: var(--color-text-secondary);
    white-space: nowrap;
  }

  .meta-date {
    flex-shrink: 0;
  }

  .meta-lead {
    flex: 0 1 auto;
    min-width: 0;
    margin-left: -0.05rem;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .lead-team {
    margin-right: 0.25em;
    font-weight: 500;
  }

  .meta-status {
    display: flex;
    align-items: center;
    gap: 0.3rem;
    flex-shrink: 0;
    margin-left: auto;
  }

  /* Too tight for "Nov 21 · CLB leads 1–0" beside the status: the lead takes
     its own line under the date. A live clock (dot + "63:08") needs more
     room than FT, so in play that happens on wider cards too. */
  @container (max-width: 8rem) {
    .tie-meta {
      flex-wrap: wrap;
      row-gap: 0.1rem;
    }
    .meta-lead {
      order: 1;
      flex-basis: 100%;
      margin-left: 0;
    }
    .lead-sep {
      display: none;
    }
  }

  @container (max-width: 10.5rem) {
    .tie-live .tie-meta {
      flex-wrap: wrap;
      row-gap: 0.1rem;
    }
    .tie-live .meta-lead {
      order: 1;
      flex-basis: 100%;
      margin-left: 0;
    }
    .tie-live .lead-sep {
      display: none;
    }
  }

  .tie-meta :deep(.ampm) {
    font-size: 0.85em;
    margin-left: 0.05em;
  }

  .tie-decided .tie-meta {
    color: var(--color-text-tertiary);
  }

  .badge {
    flex-shrink: 0;
    font-size: 0.6875rem;
    font-weight: 400;
    line-height: 1;
    letter-spacing: 0.1em;
    padding: 0.12rem 0.2rem 0.14rem 0.28rem;
    border-radius: 0.2rem;
    background: oklab(100% 0 0 / 0.12);
    color: var(--color-text-primary);
  }

  .tie-decided .badge {
    color: var(--color-text-secondary);
  }

  .badge-live {
    letter-spacing: 0.04em;
    padding-inline: 0.25rem;
    font-variant-numeric: tabular-nums;
    background: oklab(100% 0 0 / 0.18);
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

  /* Roomy cards: stack the game strip beside the two team rows instead of
     under them, which keeps Round One — and so the whole bracket — shorter. */
  @container (min-width: 8.75rem) {
    .tie-body {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      column-gap: 0.3rem;
      row-gap: 0.2rem;
    }
    .tie-meta {
      grid-column: 1 / -1;
    }
    .tie-row {
      grid-column: 1;
    }
    .tie-games {
      grid-column: 2;
      grid-row: 2 / span 2;
      flex-direction: column;
      flex-wrap: nowrap;
      justify-content: center;
      gap: 0.1rem;
      margin-top: 0;
      padding-left: 0;
    }
    .tie-games .pill {
      padding-block: 0.1rem 0.12rem;
      text-align: center;
    }
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

  .pill-won {
    color: var(--color-text-primary);
    background: color-mix(in oklab, var(--pill-color) 26%, transparent);
    box-shadow: inset 0 0 0 1px
      color-mix(in oklab, var(--pill-border) 70%, transparent);
  }

  .pill-won:hover {
    background: color-mix(in oklab, var(--pill-color) 40%, transparent);
  }

  .pill-pens {
    font-size: 0.85em;
    margin-left: 0.08rem;
    opacity: 0.8;
  }
</style>
