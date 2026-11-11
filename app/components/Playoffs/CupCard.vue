<script setup lang="ts">
  import { PLAYOFFS_SEASON } from '~/constants/mls'
  import type { Match } from '~/composables/useScores'
  import type { BracketTie } from '~/composables/usePlayoffs'
  import { useTimezone } from '~/composables/useTimezone'

  const props = defineProps<{
    tie: BracketTie
    favorite?: string | null
  }>()

  const emit = defineEmits<{
    'open-game-detail': [match: Match]
  }>()

  const { formatTimeHtml, iana } = useTimezone()

  const game = computed<Match | null>(() => props.tie.games[0] ?? null)
  const target = computed(() => game.value ?? props.tie.preview)
  const isLive = computed(
    () => game.value?.status.code === 'live' || game.value?.status.code === 'ht'
  )

  const metaHtml = computed(() => {
    const g = game.value
    if (props.tie.winner) return 'Final'
    if (!g) return 'Time TBD'
    if (g.status.code === 'ht') return 'HT'
    if (g.status.code === 'live') return `Live ${g.status.clock ?? ''}`
    if (g.status.code === 'ns') {
      const day = new Date(g.date).toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        timeZone: iana.value,
      })
      return `${day}, ${formatTimeHtml(g.date)}`
    }
    return 'Final'
  })

  const sides = computed(() =>
    (
      [
        ['top', 'West'],
        ['bottom', 'East'],
      ] as const
    ).map(([side, conference]) => {
      const team = props.tie[side]
      const options =
        side === 'top' ? props.tie.topOptions : props.tie.bottomOptions
      let score: string | null = null
      let pens: number | null = null
      const g = game.value
      if (team && g && g.status.code !== 'ns') {
        const home = g.home === team.name
        score = (home ? g.homeScore : g.awayScore) ?? '0'
        pens = home ? g.homeShootout : g.awayShootout
      }
      return {
        side,
        conference,
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

  function open() {
    if (target.value) emit('open-game-detail', target.value)
  }
</script>

<template>
  <div
    class="cup"
    :class="{ 'cup-open': !!target, 'cup-live': isLive }"
    :role="target ? 'button' : 'group'"
    :tabindex="target ? 0 : undefined"
    :aria-label="`MLS Cup ${PLAYOFFS_SEASON}${target ? ', match details' : ''}`"
    @click="open"
    @keydown.self.enter.space.prevent="open"
  >
    <svg class="trophy" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7 3.5h10V9a5 5 0 0 1-10 0V3.5Z" />
      <path
        d="M17 5.5h2.25a1.75 1.75 0 0 1 0 3.5H17M7 5.5H4.75a1.75 1.75 0 0 0 0 3.5H7"
      />
      <path d="M12 14v4M8.5 20.5h7M9.5 18h5" />
    </svg>

    <div class="cup-teams">
      <div
        v-for="s in sides"
        :key="s.side"
        class="cup-side"
        :class="{ 'side-won': s.won, 'side-out': s.out, 'side-fav': s.fav }"
      >
        <span class="cup-logo" aria-hidden="true">
          <img v-if="s.team?.logo" :src="s.team.logo" alt="" />
          <svg v-else viewBox="0 0 24 24">
            <path
              d="M12 3 4.5 6v5.5c0 4.6 3.1 8.2 7.5 9.5 4.4-1.3 7.5-4.9 7.5-9.5V6L12 3Z"
            />
          </svg>
        </span>
        <span v-if="s.team" class="cup-abbr" :title="s.team.name">{{
          s.team.abbr
        }}</span>
        <template v-else>
          <span class="cup-abbr cup-abbr-pending">{{ s.conference }}</span>
          <span v-if="s.options.length" class="cup-options">{{
            s.options.map((o) => o.abbr).join('/')
          }}</span>
        </template>
        <span v-if="s.score != null" class="cup-score"
          >{{ s.score
          }}<span v-if="s.pens != null" class="cup-pens"
            >({{ s.pens }})</span
          ></span
        >
        <span v-if="s.won" class="cup-champ">Champions</span>
      </div>
    </div>

    <div class="cup-meta" :class="{ 'meta-live': isLive }" v-html="metaHtml" />
  </div>
</template>

<style scoped>
  .cup {
    direction: ltr;
    font-family: var(--font-condensed);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.45rem;
    width: 100%;
    padding: 0.75rem 0.5rem 0.65rem;
    border-radius: 0.5rem;
    border: 1px solid oklab(100% 0 0 / 0.14);
    background:
      radial-gradient(
        120% 80% at 50% 0%,
        oklab(100% 0 0 / 0.09),
        transparent 70%
      ),
      oklab(100% 0 0 / 0.06);
  }

  .cup-open {
    cursor: pointer;
  }

  .cup-open:hover {
    border-color: oklab(100% 0 0 / 0.28);
  }

  .cup:focus-visible {
    outline: 2px solid var(--color-theme-400);
    outline-offset: 2px;
  }

  .cup-live {
    border-color: oklab(100% 0 0 / 0.35);
  }

  .trophy {
    width: 1.9rem;
    height: 1.9rem;
    fill: none;
    stroke: var(--color-theme-300);
    stroke-width: 1.25;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .cup-teams {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.5rem;
    width: 100%;
  }

  .cup-side {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.15rem;
    min-width: 0;
  }

  .cup-logo {
    display: inline-flex;
    width: 2rem;
    height: 2rem;
  }

  .cup-logo img {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }

  .cup-logo svg {
    width: 100%;
    height: 100%;
    fill: none;
    stroke: oklab(100% 0 0 / 0.22);
    stroke-width: 1.25;
  }

  .cup-abbr {
    font-size: 1.125rem;
    font-weight: 500;
    letter-spacing: 0.03em;
    line-height: 1.1;
    color: var(--color-text-primary);
  }

  .cup-abbr-pending {
    font-weight: 300;
    color: var(--color-text-secondary);
  }

  .cup-options {
    font-size: 0.75rem;
    font-weight: 300;
    color: var(--color-text-tertiary);
    white-space: nowrap;
  }

  .cup-score {
    display: flex;
    align-items: center;
    font-size: 1.5rem;
    font-weight: 600;
    line-height: 1;
    color: var(--color-text-primary);
    font-variant-numeric: tabular-nums;
  }

  .cup-pens {
    font-size: 0.8rem;
    font-weight: 400;
    margin-left: 0.1rem;
    color: var(--color-text-secondary);
  }

  .side-won .cup-abbr,
  .side-won .cup-score {
    color: oklab(100% 0 0);
    font-weight: 700;
  }

  .side-out {
    opacity: 0.42;
  }

  .side-out .cup-logo img {
    filter: grayscale(1);
  }

  .side-fav .cup-abbr {
    color: var(--color-theme-300);
  }

  .cup-champ {
    font-size: 0.75rem;
    font-weight: 500;
    letter-spacing: 0.04em;
    color: var(--color-theme-200);
  }

  .cup-meta {
    font-size: 0.8125rem;
    font-weight: 300;
    color: var(--color-text-secondary);
    white-space: nowrap;
  }

  .cup-meta :deep(.ampm) {
    font-size: 0.85em;
    margin-left: 0.05em;
  }

  .meta-live {
    color: var(--color-text-primary);
    font-weight: 500;
  }
</style>
