<script setup lang="ts">
  import type { Match } from '~/composables/useScores'
  import { bracketTies, usePlayoffs } from '~/composables/usePlayoffs'
  import type { BracketConference, BracketTie } from '~/composables/usePlayoffs'
  import { TEAM_CONFERENCE } from '~/composables/useTeamTheme'
  import { PLAYOFF_ROUND_DATES, PLAYOFFS_SEASON } from '~/constants/mls'
  import type { PlayoffRound } from '~/constants/rounds'

  const emit = defineEmits<{
    'open-game-detail': [match: Match]
  }>()

  const { bracket, error, fetchBracket } = usePlayoffs()
  const favorite = useState<string | null>('favoriteTeam', () => null)

  onMounted(() => fetchBracket())

  const CONFERENCE_NAME: Record<BracketConference, string> = {
    West: 'Western Conference',
    East: 'Eastern Conference',
  }

  // On narrow screens only one conference fits; open on the favorite team's.
  const selectedConf = ref<BracketConference>('West')
  let confPicked = false
  watch(
    favorite,
    (name) => {
      if (confPicked || !name) return
      selectedConf.value =
        TEAM_CONFERENCE[name] === 'Eastern Conference' ? 'East' : 'West'
    },
    { immediate: true }
  )
  const scroller = ref<HTMLElement | null>(null)

  function pickConf(conf: BracketConference) {
    confPicked = true
    selectedConf.value = conf
    // Start each conference at its first round. Mirrored, the East's start
    // is the right edge, which is scrollLeft 0 in a right-to-left scroller.
    nextTick(() => {
      if (scroller.value) scroller.value.scrollLeft = 0
    })
  }

  const halves = computed(() =>
    bracket.value ? [bracket.value.west, bracket.value.east] : []
  )

  const eliminated = computed(() => {
    const out = new Set<string>()
    if (!bracket.value) return out
    for (const tie of bracketTies(bracket.value)) {
      if (tie.winner === 'top' && tie.bottom) out.add(tie.bottom.id)
      if (tie.winner === 'bottom' && tie.top) out.add(tie.top.id)
    }
    return out
  })

  // A connector lights up while the team that came through it is still alive,
  // so the lit lines always trace the surviving teams' paths.
  function advancing(...ties: Array<BracketTie | undefined>): boolean {
    return ties.some((tie) => {
      const team =
        tie?.winner === 'top'
          ? tie.top
          : tie?.winner === 'bottom'
            ? tie.bottom
            : null
      return !!team && !eliminated.value.has(team.id)
    })
  }

  const ROUND_ORDER: PlayoffRound[] = [
    'wild-card',
    'round-one',
    'semifinals',
    'final',
    'mls-cup',
  ]

  const currentRound = computed<PlayoffRound | null>(() => {
    if (!bracket.value) return null
    const ties = bracketTies(bracket.value)
    return (
      ROUND_ORDER.find((round) =>
        ties.some((t) => t.round === round && !t.winner)
      ) ?? null
    )
  })

  const COLUMNS: { round: PlayoffRound; title: string; col: number }[] = [
    { round: 'wild-card', title: 'Wild Card', col: 1 },
    { round: 'round-one', title: 'Round One', col: 3 },
    { round: 'semifinals', title: 'Conf. Semifinals', col: 5 },
    { round: 'final', title: 'Conf. Final', col: 7 },
  ]

  const open = (match: Match) => emit('open-game-detail', match)

  const champion = computed(() => {
    const cup = bracket.value?.cup
    const team =
      cup?.winner === 'top'
        ? cup.top
        : cup?.winner === 'bottom'
          ? cup.bottom
          : null
    if (!cup || !team) return null
    const final = cup.games.at(-1) ?? null
    let score = ''
    if (final) {
      score = `${final.home} ${final.homeScore}–${final.awayScore} ${final.away}`
      if (final.homeShootout != null && final.awayShootout != null)
        score += ` (${final.homeShootout}–${final.awayShootout} pens)`
    }
    return { team, final, score }
  })
</script>

<template>
  <div class="playoffs">
    <div v-if="!bracket && error" class="bracket-error">
      <p>The bracket didn't load. ESPN may be slow to respond.</p>
      <button type="button" class="retry" @click="fetchBracket(true)">
        Try again
      </button>
    </div>

    <div
      v-else-if="!bracket"
      class="bracket-skeleton"
      role="status"
      aria-label="Loading bracket"
    />

    <template v-else>
      <component
        :is="champion.final ? 'button' : 'div'"
        v-if="champion"
        class="champion"
        :type="champion.final ? 'button' : undefined"
        @click="champion.final && open(champion.final)"
      >
        <img
          v-if="champion.team.logo"
          :src="champion.team.logo"
          alt=""
          class="champion-logo"
        />
        <span class="champion-text">
          <span class="champion-kicker"
            >🏆 {{ PLAYOFFS_SEASON }} MLS Cup Champions</span
          >
          <span class="champion-name">{{ champion.team.name }}</span>
          <span v-if="champion.score" class="champion-score">{{
            champion.score
          }}</span>
        </span>
      </component>

      <div class="conf-switch" role="tablist" aria-label="Conference">
        <button
          v-for="conf in ['West', 'East'] as const"
          :key="conf"
          type="button"
          role="tab"
          class="conf-tab"
          :class="{ active: selectedConf === conf }"
          :aria-selected="selectedConf === conf"
          @click="pickConf(conf)"
        >
          <span class="conf-full">{{ CONFERENCE_NAME[conf] }}</span>
          <span class="conf-short">{{ conf }}</span>
        </button>
      </div>

      <div class="conf-labels" aria-hidden="true">
        <span>{{ CONFERENCE_NAME.West }}</span>
        <span>{{ CONFERENCE_NAME.East }}</span>
      </div>

      <div
        ref="scroller"
        class="bracket-scroll"
        :class="{ 'conf-east': selectedConf === 'East' }"
      >
        <div class="bracket">
          <section
            v-for="half in halves"
            :key="half.conference"
            class="half"
            :class="[
              `half-${half.conference.toLowerCase()}`,
              { 'half-active': selectedConf === half.conference },
            ]"
            :aria-label="CONFERENCE_NAME[half.conference]"
          >
            <div
              v-for="c in COLUMNS"
              :key="c.round"
              class="col-head"
              :class="{
                'col-head-now': currentRound === c.round,
                'narrow-only': c.round === 'final',
              }"
              :style="{ gridColumn: c.col }"
            >
              <span class="col-title">{{ c.title }}</span>
              <span class="col-dates">{{ PLAYOFF_ROUND_DATES[c.round] }}</span>
            </div>

            <PlayoffsTieCard
              class="slot"
              :style="{ gridColumn: 1, gridRow: 2 }"
              :tie="half.wildCard"
              :favorite="favorite"
              @open-game-detail="open"
            />
            <div class="link" :style="{ gridColumn: 2, gridRow: 2 }">
              <span class="stub" :class="{ lit: advancing(half.wildCard) }" />
            </div>

            <PlayoffsTieCard
              v-for="(tie, i) in half.roundOne"
              :key="tie.key"
              class="slot"
              :style="{ gridColumn: 3, gridRow: i + 2 }"
              :tie="tie"
              :favorite="favorite"
              @open-game-detail="open"
            />
            <div
              v-for="j in [0, 1]"
              :key="`r1-link-${j}`"
              class="link link-join"
              :style="{ gridColumn: 4, gridRow: `${2 * j + 2} / span 2` }"
            >
              <span
                class="leg leg-top"
                :class="{ lit: advancing(half.roundOne[2 * j]) }"
              />
              <span
                class="leg leg-bottom"
                :class="{ lit: advancing(half.roundOne[2 * j + 1]) }"
              />
              <span
                class="stub"
                :class="{
                  lit: advancing(
                    half.roundOne[2 * j],
                    half.roundOne[2 * j + 1]
                  ),
                }"
              />
            </div>

            <PlayoffsTieCard
              v-for="(tie, j) in half.semifinals"
              :key="tie.key"
              class="slot"
              :style="{ gridColumn: 5, gridRow: `${2 * j + 2} / span 2` }"
              :tie="tie"
              :favorite="favorite"
              @open-game-detail="open"
            />
            <div
              class="link link-join"
              :style="{ gridColumn: 6, gridRow: '2 / span 4' }"
            >
              <span
                class="leg leg-top"
                :class="{ lit: advancing(half.semifinals[0]) }"
              />
              <span
                class="leg leg-bottom"
                :class="{ lit: advancing(half.semifinals[1]) }"
              />
              <span
                class="stub"
                :class="{ lit: advancing(...half.semifinals) }"
              />
            </div>

            <!-- Narrow screens only; wide screens show both finals under MLS Cup. -->
            <PlayoffsTieCard
              class="slot narrow-only"
              :style="{ gridColumn: 7, gridRow: '2 / span 4' }"
              :tie="half.final"
              :favorite="favorite"
              @open-game-detail="open"
            />
            <div
              class="link narrow-only"
              :style="{ gridColumn: 8, gridRow: '2 / span 4' }"
            >
              <span class="stub" :class="{ lit: advancing(half.final) }" />
            </div>
          </section>

          <section class="cup-col" aria-label="MLS Cup">
            <div
              class="col-head"
              :class="{ 'col-head-now': currentRound === 'mls-cup' }"
            >
              <span class="col-title">MLS Cup</span>
              <span class="col-dates">{{
                PLAYOFF_ROUND_DATES['mls-cup']
              }}</span>
            </div>
            <!-- Wide: MLS Cup on top, both conference finals centred below it
                 so the semifinal connectors run straight into them. -->
            <div class="cup-body">
              <div class="cup-top">
                <div class="cup-card">
                  <PlayoffsCupCard
                    :tie="bracket.cup"
                    :favorite="favorite"
                    @open-game-detail="open"
                  />
                </div>
                <div class="cup-feed wide-only" aria-hidden="true">
                  <span :class="{ lit: advancing(bracket.west.final) }" />
                  <span :class="{ lit: advancing(bracket.east.final) }" />
                </div>
              </div>
              <div class="cf-row wide-only">
                <PlayoffsTieCard
                  :tie="bracket.west.final"
                  :favorite="favorite"
                  @open-game-detail="open"
                />
                <PlayoffsTieCard
                  :tie="bracket.east.final"
                  :favorite="favorite"
                  @open-game-detail="open"
                />
                <p
                  class="cf-caption"
                  :class="{ 'cf-caption-now': currentRound === 'final' }"
                >
                  <span class="col-title">Conf. Finals</span>
                  <span class="col-dates">{{ PLAYOFF_ROUND_DATES.final }}</span>
                </p>
              </div>
            </div>
          </section>
        </div>
      </div>

      <p class="bracket-note">
        Round One is a best-of-3 series. Every other round is a single match
        hosted by the higher seed. Select a match for details.
      </p>
    </template>
  </div>
</template>

<style scoped>
  /* Wide screens: the full mirrored bracket needs more room than the page
     column, so it breaks out to the viewport (minus a gutter). */
  .playoffs {
    margin-inline: calc(50% - min(50vw - 1.5rem, 40rem));
  }

  /* ── Champion banner (after MLS Cup) ────────────────────────────────── */
  .champion {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 1.25rem;
    width: min(100%, 36rem);
    margin: 1.25rem auto 1.5rem;
    padding: 1.25rem 1.5rem;
    border: 1px solid oklch(78% 0.12 85 / 0.45);
    border-radius: 0.75rem;
    background: radial-gradient(
      120% 140% at 50% 0%,
      oklch(78% 0.12 85 / 0.16),
      oklch(20% 0.03 260 / 0.6) 70%
    );
    font: inherit;
    color: inherit;
    text-align: left;
  }
  button.champion {
    cursor: pointer;
    transition: border-color 0.15s;
  }
  button.champion:hover {
    border-color: oklch(78% 0.12 85 / 0.8);
  }

  .champion-logo {
    width: 4.5rem;
    height: 4.5rem;
    object-fit: contain;
    flex-shrink: 0;
  }

  .champion-text {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
    min-width: 0;
  }

  .champion-kicker {
    font-family: var(--font-condensed);
    font-size: 0.8rem;
    font-weight: 600;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: oklch(85% 0.11 85);
  }

  .champion-name {
    font-family: var(--font-condensed);
    font-size: 2rem;
    font-weight: 600;
    line-height: 1.1;
    color: var(--color-text-primary);
  }

  .champion-score {
    font-size: 0.85rem;
    color: var(--color-text-secondary);
  }

  @media (max-width: 425px) {
    .champion {
      gap: 0.85rem;
      padding: 1rem;
      margin-inline: 1rem;
      width: auto;
    }
    .champion-logo {
      width: 3.25rem;
      height: 3.25rem;
    }
    .champion-name {
      font-size: 1.5rem;
    }
  }

  /* ── Loading / error ────────────────────────────────────────────────── */
  .bracket-skeleton {
    height: 24rem;
    border-radius: 0.5rem;
    background: oklab(100% 0 0 / 0.05);
    animation: pulse 1.5s ease-in-out infinite;
  }

  @keyframes pulse {
    50% {
      opacity: 0.4;
    }
  }

  .bracket-error {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.75rem;
    padding: 4rem 1rem;
    color: var(--color-text-secondary);
    text-align: center;
  }

  .retry {
    font-family: var(--font-condensed);
    font-size: 0.9375rem;
    padding: 0.3rem 0.9rem;
    border-radius: 0.375rem;
    border: 1px solid oklab(100% 0 0 / 0.2);
    background: oklab(100% 0 0 / 0.06);
    color: var(--color-text-primary);
    cursor: pointer;
  }

  .retry:hover {
    background: oklab(100% 0 0 / 0.12);
  }

  /* ── Conference labels (wide) / switch (narrow) ─────────────────────── */
  .conf-labels {
    display: flex;
    justify-content: space-between;
    font-family: var(--font-condensed);
    font-size: 0.9375rem;
    font-weight: 300;
    letter-spacing: 0.06em;
    color: var(--color-text-secondary);
    padding-inline: 0.25rem;
    margin-bottom: 0.25rem;
  }

  .conf-switch {
    display: none;
    border-bottom: 1px solid oklab(100% 0 0 / 0.1);
    margin-bottom: 0.75rem;
  }

  .conf-tab {
    flex: 1;
    font-family: var(--font-condensed);
    font-size: 0.9375rem;
    font-weight: 400;
    letter-spacing: 0.02em;
    padding: 0.4rem 0.5rem 0.5rem;
    background: transparent;
    border: none;
    border-bottom: 2px solid transparent;
    color: var(--color-text-secondary);
    cursor: pointer;
    position: relative;
    bottom: -1px;
    white-space: nowrap;
  }

  .conf-tab:hover:not(.active) {
    color: var(--color-text-primary);
  }

  .conf-tab.active {
    color: var(--color-text-primary);
    border-bottom-color: var(--color-theme-400);
  }

  .conf-short {
    display: none;
  }

  /* ── Bracket grid ───────────────────────────────────────────────────── */
  .bracket-scroll {
    padding: 3px;
    margin: -3px;
  }

  /* Plain `1fr` keeps each conference at least as wide as its own columns,
     so it can never slide underneath the MLS Cup card. */
  .bracket {
    --cf-gap: 0.6rem;
    display: grid;
    grid-template-columns: 1fr minmax(14rem, 16rem) 1fr;
  }

  .half {
    --card-min: 6.25rem;
    --link-w: 1.1rem;
    display: grid;
    grid-template-columns:
      minmax(var(--card-min), 1fr) var(--link-w)
      minmax(calc(var(--card-min) + 1rem), 1.1fr) var(--link-w)
      minmax(var(--card-min), 1fr) var(--link-w);
    grid-template-rows: auto repeat(4, 1fr);
  }

  /* Specific enough to beat `.col-head`, which sets its own display. */
  @media (min-width: 1024px) {
    .half > .narrow-only {
      display: none;
    }
  }

  .half-west {
    order: 1;
  }

  .cup-col {
    order: 2;
    display: flex;
    flex-direction: column;
  }

  /* Mirror the East half so both conferences converge on MLS Cup. The
     connectors use logical properties, so they flip with it. */
  .half-east {
    order: 3;
    direction: rtl;
  }

  .col-head {
    direction: ltr;
    grid-row: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 2.6rem;
    margin-bottom: 0.25rem;
    font-family: var(--font-condensed);
    text-align: center;
    border-bottom: 1px solid oklab(100% 0 0 / 0.08);
  }

  .col-title {
    font-size: 0.9375rem;
    font-weight: 400;
    line-height: 1.15;
    color: var(--color-text-secondary);
    white-space: nowrap;
  }

  .col-dates {
    font-size: 0.75rem;
    font-weight: 300;
    color: var(--color-text-tertiary);
    white-space: nowrap;
  }

  .col-head-now {
    border-bottom-color: var(--color-theme-400);
  }

  .col-head-now .col-title {
    color: var(--color-text-primary);
    font-weight: 500;
  }

  .col-head-now .col-dates {
    color: var(--color-text-secondary);
  }

  .slot {
    align-self: center;
    margin-block: 0.35rem;
  }

  /* Equal 1fr rows above and below keep the finals on the bracket's
     midline, level with the semifinal connectors. */
  .cup-body {
    flex: 1;
    display: grid;
    grid-template-rows: 1fr auto 1fr;
  }

  .cup-top {
    grid-row: 1;
    align-self: end;
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .cup-card {
    display: flex;
    width: min(100%, 12rem);
  }

  /* Each final's line rises from the centre of its card into MLS Cup. */
  .cup-feed {
    position: relative;
    align-self: stretch;
    height: 1.4rem;
  }
  .cup-feed > span {
    position: absolute;
    inset-block: 0;
    border-inline-start: 1px solid oklab(100% 0 0 / 0.16);
  }
  .cup-feed > span:first-child {
    inset-inline-start: calc((100% - var(--cf-gap)) / 4);
  }
  .cup-feed > span:last-child {
    inset-inline-end: calc((100% - var(--cf-gap)) / 4);
  }
  .cup-feed > span.lit {
    z-index: 1;
    border-inline-start-width: 2px;
    border-color: var(--color-theme-400);
  }

  .cf-row {
    grid-row: 2;
    position: relative;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--cf-gap);
    align-items: center;
  }

  .cf-caption {
    position: absolute;
    inset-inline: 0;
    top: calc(100% + 0.5rem);
    display: flex;
    flex-direction: column;
    align-items: center;
    font-family: var(--font-condensed);
    text-align: center;
  }
  .cf-caption-now .col-title {
    color: var(--color-text-primary);
    font-weight: 500;
  }

  /* ── Connectors ─────────────────────────────────────────────────────── */
  .link {
    position: relative;
  }

  .link > span {
    position: absolute;
    border: 0 solid oklab(100% 0 0 / 0.16);
  }

  .link > .stub {
    inset-inline: 0;
    inset-block-start: 50%;
    border-block-start-width: 1px;
  }

  .link-join > .stub {
    inset-inline-start: 50%;
  }

  /* Each leg runs from a feeder card's centre to the pair's midpoint. */
  .link > .leg {
    inset-inline: 0 50%;
    border-inline-end-width: 1px;
  }

  .link > .leg-top {
    inset-block: 25% 50%;
    border-block-start-width: 1px;
  }

  .link > .leg-bottom {
    inset-block: 50% 25%;
    border-block-end-width: 1px;
  }

  .link > .lit {
    z-index: 1;
    border-color: var(--color-theme-400);
  }

  .link > .stub.lit {
    border-block-start-width: 2px;
  }

  .link > .leg.lit {
    border-inline-end-width: 2px;
  }

  .link > .leg-top.lit {
    border-block-start-width: 2px;
  }

  .link > .leg-bottom.lit {
    border-block-end-width: 2px;
  }

  .bracket-note {
    margin-top: 1rem;
    font-size: 0.8125rem;
    line-height: 1.5;
    color: var(--color-text-tertiary);
    text-align: center;
  }

  /* ── Narrow: one conference at a time, flowing into MLS Cup ─────────── */
  @media (max-width: 1023px) {
    .wide-only {
      display: none;
    }
    .half {
      grid-template-columns:
        minmax(var(--card-min), 1fr) var(--link-w)
        minmax(calc(var(--card-min) + 1rem), 1.1fr) var(--link-w)
        minmax(var(--card-min), 1fr) var(--link-w)
        minmax(var(--card-min), 1fr) var(--link-w);
    }
    .cup-body {
      display: flex;
      align-items: center;
    }
    .cup-top {
      align-self: center;
      width: 100%;
    }
    .cup-card {
      width: 100%;
    }

    .playoffs {
      margin-inline: 0;
    }

    .conf-labels {
      display: none;
    }

    .conf-switch {
      display: flex;
    }

    .bracket-scroll {
      overflow-x: auto;
      overscroll-behavior-x: contain;
    }

    /* Grow past the screen instead of squeezing; the wrapper scrolls. */
    .bracket {
      grid-template-columns: 1fr minmax(9rem, 10.5rem);
      min-width: min-content;
    }

    .half {
      display: none;
    }

    .half.half-active {
      display: grid;
      order: 1;
    }

    /* The East mirrors here too: it runs right to left into MLS Cup, which
       sits on its left, and the scroller starts at the right edge. */
    .bracket-scroll.conf-east {
      direction: rtl;
    }

    .bracket-note {
      text-align: left;
    }
  }

  @media (max-width: 599px) {
    .half {
      --card-min: 6rem;
      --link-w: 0.8rem;
    }
  }

  @media (max-width: 425px) {
    .conf-full {
      display: none;
    }

    .conf-short {
      display: inline;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .bracket-skeleton {
      animation: none;
    }
  }
</style>
