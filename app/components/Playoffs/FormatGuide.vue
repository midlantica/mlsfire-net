<script setup lang="ts">
  import type { PlayoffRound } from '~/constants/rounds'

  const props = defineProps<{
    current: PlayoffRound | null
  }>()

  const STAGES: {
    name: string
    format: string
    rule: string
    rounds: PlayoffRound[]
  }[] = [
    {
      name: 'Wild Card',
      format: 'One game',
      rule: 'Level after 90′? Straight to penalties.',
      rounds: ['wild-card'],
    },
    {
      name: 'Round One',
      format: 'Best of 3',
      rule: 'First to two wins, so Game 3 only if it’s 1–1. Draws go to penalties.',
      rounds: ['round-one'],
    },
    {
      name: 'Semis → MLS Cup',
      format: 'One game',
      rule: 'Level after 90′? Extra time, then penalties.',
      rounds: ['semifinals', 'final', 'mls-cup'],
    },
  ]

  const isCurrent = (rounds: PlayoffRound[]) =>
    !!props.current && rounds.includes(props.current)
</script>

<template>
  <section class="format" aria-label="Playoff format">
    <p class="format-title">How it works</p>
    <dl class="stages">
      <div
        v-for="stage in STAGES"
        :key="stage.name"
        class="stage"
        :class="{ 'stage-now': isCurrent(stage.rounds) }"
      >
        <dt>
          <span class="stage-name">{{ stage.name }}</span>
          <span class="stage-format">{{ stage.format }}</span>
        </dt>
        <dd>{{ stage.rule }}</dd>
      </div>
    </dl>
  </section>
</template>

<style scoped>
  .format {
    container-type: inline-size;
  }

  .format-title {
    font-family: var(--font-condensed);
    font-size: 0.6875rem;
    font-weight: 500;
    line-height: 1.2;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--color-text-tertiary);
    margin-bottom: 0.3rem;
  }

  .stages {
    display: grid;
    gap: 0.35rem;
  }

  .stage {
    padding-inline-start: 0.55rem;
    border-inline-start: 2px solid oklab(100% 0 0 / 0.1);
    font-size: 0.75rem;
    line-height: 1.4;
    color: var(--color-text-tertiary);
  }

  .stage-now {
    border-inline-start-color: var(--color-theme-400);
    color: var(--color-text-secondary);
  }

  /* Run-in: the stage name leads straight into its rule, saving a line each. */
  .stage dt,
  .stage dd {
    display: inline;
  }

  .stage dt {
    margin-inline-end: 0.3rem;
    font-family: var(--font-condensed);
  }

  .stage-name {
    font-size: 0.875rem;
    color: var(--color-text-secondary);
  }

  .stage-now .stage-name {
    color: var(--color-text-primary);
    font-weight: 500;
  }

  .stage-format {
    margin-inline-start: 0.3rem;
    font-size: 0.6875rem;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--color-text-tertiary);
  }

  @container (min-width: 34rem) {
    .stages {
      grid-template-columns: repeat(3, 1fr);
      gap: 1rem;
    }
  }
</style>
