<script setup lang="ts">
  import type { Match } from '~/composables/useScores'
  import type { BracketTeam, BracketTie } from '~/composables/usePlayoffs'
  import { seriesColors } from '~/composables/usePlayoffs'
  import { useTimezone } from '~/composables/useTimezone'

  const props = defineProps<{
    tie: BracketTie
    /** The game on screen, marked and not clickable. */
    current?: string
    /** Name the winner after the score ("0–1 CIN"), where there's room. */
    showWinner?: boolean
  }>()

  const emit = defineEmits<{
    'open-game-detail': [match: Match]
  }>()

  const { formatTime, iana } = useTimezone()

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

  const isOn = (m: Match) => m.status.code === 'live' || m.status.code === 'ht'

  const pills = computed(() => {
    const { top, bottom } = props.tie
    if (props.tie.bestOf !== 3 || !top || !bottom) return []
    const colors = seriesColors(top, bottom)
    return props.tie.games.map((game, i) => {
      const n = i + 1
      const current = game.id === props.current
      if (game.status.code === 'ns') {
        return {
          game,
          current,
          text: numericDate(game.date),
          pens: false,
          winner: null,
          state: 'ns',
          color: null,
          label: `Game ${n}, ${shortDate(game.date)}, ${game.timeTbd ? 'time TBD' : formatTime(game.date).replace(/\s+/, '').toLowerCase()}`,
        }
      }
      const a = sideOf(game, top)
      const b = sideOf(game, bottom)
      const shootout = a.pens != null && b.pens != null
      const score = `${a.goals ?? 0}–${b.goals ?? 0}`
      const diff =
        Number(a.goals ?? 0) - Number(b.goals ?? 0) ||
        Number(a.pens ?? 0) - Number(b.pens ?? 0)
      const winner =
        game.status.code === 'ft' && diff ? (diff > 0 ? top : bottom) : null
      return {
        game,
        current,
        text: score,
        pens: shootout,
        winner: winner?.abbr ?? null,
        state: isOn(game) ? 'live' : 'ft',
        color: winner ? colors[winner === top ? 'top' : 'bottom'] : null,
        label: `Game ${n}, ${top.abbr} ${score} ${bottom.abbr}${shootout ? `, ${a.pens}–${b.pens} on penalties` : ''}`,
      }
    })
  })

  function select(game: Match) {
    if (game.id !== props.current) emit('open-game-detail', game)
  }
</script>

<template>
  <div v-if="pills.length" class="series-pills">
    <button
      v-for="pill in pills"
      :key="pill.game.id"
      type="button"
      class="pill"
      :class="[
        `pill-${pill.state}`,
        { 'pill-won': pill.color, 'pill-current': pill.current },
      ]"
      :style="
        pill.color
          ? {
              '--pill-color': pill.color.fill,
              '--pill-border': pill.color.border,
            }
          : undefined
      "
      :aria-label="pill.label"
      :aria-current="pill.current ? 'true' : undefined"
      :title="pill.label"
      @click.stop="select(pill.game)"
    >
      {{ pill.text }}<span v-if="pill.pens" class="pill-pens">p</span
      ><span v-if="showWinner && pill.winner" class="pill-winner">{{
        pill.winner
      }}</span>
    </button>
  </div>
</template>

<style scoped>
  .series-pills {
    display: flex;
    flex-wrap: wrap;
    gap: 0.2rem;
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

  .pill-current {
    cursor: default;
    outline: 1px solid oklab(100% 0 0 / 0.55);
    outline-offset: 2px;
  }

  .pill-winner {
    margin-left: 0.3em;
    font-weight: 600;
  }

  .pill-pens {
    font-size: 0.85em;
    margin-left: 0.08rem;
    opacity: 0.8;
  }
</style>
