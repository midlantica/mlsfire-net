<script setup lang="ts">
  import { MLS_CUP_FINALS, type CupFinal } from '~/constants/mlsCupHistory'
  import { TEAM_LOGO } from '~/composables/useTeamTheme'

  const props = defineProps<{
    open: boolean
    /** This season's final once it's decided, until the history list has it. */
    latest?: CupFinal | null
  }>()

  const emit = defineEmits<{
    close: []
  }>()

  // Closes only this popup, not the game popup underneath it.
  function onKeydown(e: KeyboardEvent) {
    if (!(e.key === 'Escape' && props.open)) return
    e.stopImmediatePropagation()
    emit('close')
  }

  onMounted(() => window.addEventListener('keydown', onKeydown))
  onUnmounted(() => window.removeEventListener('keydown', onKeydown))

  const finals = computed(() => {
    const latest = props.latest
    return latest && !MLS_CUP_FINALS.some((f) => f.year === latest.year)
      ? [latest, ...MLS_CUP_FINALS]
      : MLS_CUP_FINALS
  })

  const mostTitles = computed(() => {
    const counts = new Map<string, number>()
    for (const f of finals.value)
      counts.set(f.club, (counts.get(f.club) ?? 0) + 1)
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([club, titles]) => ({ club, titles, logo: TEAM_LOGO[club] }))
  })
</script>

<template>
  <Teleport to="body">
    <Transition name="trophy-modal">
      <div
        v-if="open"
        class="trophy-backdrop"
        role="dialog"
        aria-modal="true"
        aria-labelledby="trophy-title"
        @mousedown.self="emit('close')"
      >
        <div class="trophy-panel">
          <button
            class="trophy-close"
            aria-label="Close"
            @click="emit('close')"
          >
            <CloseIcon />
          </button>

          <div class="trophy-hero">
            <img
              class="trophy-image"
              src="/mls-cup-trophy.webp"
              alt="The Philip F. Anschutz Trophy"
              width="183"
              height="260"
              decoding="async"
            />
            <div class="trophy-intro">
              <p class="trophy-eyebrow">The MLS Cup</p>
              <h2 id="trophy-title" class="trophy-title">
                Philip F. Anschutz Trophy
              </h2>
              <p class="trophy-bio">
                Since 2008 the MLS Cup champion has lifted a trophy named for
                league co-founder Philip F. Anschutz. It replaced two trophies
                named for league founder Alan Rothenberg, awarded from 1996 to
                1998 and from 1999 to 2007.
              </p>
              <p class="trophy-bio">
                Two handles with 11 facets each stand for the 22 players on the
                field, and the gold star for the championship. A map of North
                America on the base marks every MLS Cup-winning market with a
                star. The champions keep the original over the off-season; the
                club is given a duplicate to keep.
              </p>
              <ul class="trophy-facts">
                <li>Sterling silver</li>
                <li>24 in tall</li>
                <li>43 lb</li>
              </ul>
            </div>
          </div>

          <div class="trophy-most">
            <span class="trophy-label">Most titles</span>
            <span
              v-for="c in mostTitles"
              :key="c.club"
              class="trophy-most-club"
            >
              <img v-if="c.logo" :src="c.logo" alt="" />
              {{ c.club }} <strong>{{ c.titles }}</strong>
            </span>
          </div>

          <div class="trophy-list-head">
            <span class="trophy-label">Champions</span>
            <span class="trophy-count">{{ finals.length }} finals</span>
          </div>
          <ol class="trophy-list">
            <li v-for="f in finals" :key="f.year" class="trophy-row">
              <span class="row-year">{{ f.year }}</span>
              <span class="row-logo" aria-hidden="true">
                <img v-if="TEAM_LOGO[f.club]" :src="TEAM_LOGO[f.club]" alt="" />
              </span>
              <span class="row-champ">{{ f.champion }}</span>
              <span class="row-score">{{ f.score }}</span>
              <span class="row-note">{{ f.note }}</span>
              <span class="row-runner">v {{ f.runnerUp }}</span>
            </li>
          </ol>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
  .trophy-backdrop {
    position: fixed;
    inset: 0;
    z-index: 9200;
    display: flex;
    align-items: flex-start;
    justify-content: center;
    padding: 1rem;
    overflow-y: auto;
    background:
      radial-gradient(
        60% 50% at 50% 30%,
        oklch(34% 0.06 82 / 0.45),
        transparent 75%
      ),
      oklab(0% 0 0 / 0.8);
  }

  /* Same metallic border-box gradient as the gold card and Cup Final popup. */
  .trophy-panel {
    position: relative;
    width: 100%;
    max-width: 42rem;
    max-height: calc(100dvh - 2rem);
    overflow-y: auto;
    margin-top: 1rem;
    padding: 1.5rem 1.5rem 1.25rem;
    font-family: var(--font-condensed);
    color: oklch(95% 0.03 92);
    border: 2px solid transparent;
    border-radius: 1rem;
    background:
      radial-gradient(
          55% 45% at 22% 26%,
          oklch(84% 0.11 88 / 0.18),
          transparent 72%
        )
        padding-box,
      linear-gradient(180deg, oklch(24% 0.04 80), oklch(15% 0.018 72))
        padding-box,
      linear-gradient(
          140deg,
          oklch(94% 0.09 95),
          oklch(70% 0.12 78) 35%,
          oklch(90% 0.1 92) 62%,
          oklch(62% 0.11 72)
        )
        border-box;
    box-shadow:
      0 28px 80px -20px oklch(78% 0.12 85 / 0.45),
      0 8px 24px oklab(0% 0 0 / 0.8);
  }

  .trophy-close {
    position: absolute;
    top: 0.85rem;
    right: 0.85rem;
    display: flex;
    padding: 0.3rem;
    border: none;
    background: transparent;
    color: oklch(88% 0.08 88 / 0.55);
    cursor: pointer;
    transition: color 0.15s;
  }

  .trophy-close :deep(svg) {
    width: 1.1rem;
    height: 1.1rem;
  }

  .trophy-close:hover {
    color: oklch(96% 0.05 95);
  }

  .trophy-hero {
    display: grid;
    grid-template-columns: auto 1fr;
    align-items: center;
    gap: 1.75rem;
  }

  .trophy-image {
    width: auto;
    height: 19rem;
    filter: drop-shadow(0 12px 22px oklch(0% 0 0 / 0.55));
  }

  .trophy-eyebrow,
  .trophy-label {
    font-size: 0.75rem;
    font-weight: 600;
    letter-spacing: 0.22em;
    text-transform: uppercase;
    color: oklch(84% 0.12 88);
  }

  .trophy-title {
    margin: 0.2rem 0 0.75rem;
    font-size: 1.75rem;
    font-weight: 600;
    line-height: 1.1;
    letter-spacing: 0.02em;
    background: linear-gradient(180deg, oklch(97% 0.06 95), oklch(80% 0.12 84));
    background-clip: text;
    -webkit-background-clip: text;
    color: transparent;
  }

  .trophy-bio {
    font-size: var(--modal-copy-size, 0.95rem);
    font-weight: 300;
    line-height: 1.5;
    letter-spacing: 0.01em;
    color: oklch(92% 0.03 90 / 0.88);
  }

  .trophy-bio + .trophy-bio {
    margin-top: 0.6rem;
  }

  .trophy-facts {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
    margin-top: 0.9rem;
  }

  .trophy-facts li {
    padding: 0.15rem 0.55rem;
    border: 1px solid oklch(84% 0.11 88 / 0.4);
    border-radius: 999px;
    font-size: 0.8125rem;
    letter-spacing: 0.04em;
    color: oklch(92% 0.06 90);
  }

  .trophy-most {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem 1.1rem;
    margin-top: 1.4rem;
    padding: 0.75rem 0;
    border-block: 1px solid oklch(82% 0.1 86 / 0.2);
  }

  .trophy-most-club {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    font-size: 1rem;
  }

  .trophy-most-club img {
    width: 1.35rem;
    height: 1.35rem;
    object-fit: contain;
  }

  .trophy-most-club strong {
    font-weight: 600;
    color: oklch(88% 0.12 88);
  }

  .trophy-list-head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    margin: 1rem 0 0.4rem;
  }

  .trophy-count {
    font-size: 0.8125rem;
    color: oklch(88% 0.04 88 / 0.55);
  }

  .trophy-row {
    display: grid;
    grid-template-columns: 2.6rem 1.5rem minmax(0, 1fr) 2.4rem 4.2rem minmax(
        0,
        0.9fr
      );
    align-items: center;
    gap: 0.6rem;
    padding: 0.35rem 0.25rem;
    font-size: 1rem;
    border-bottom: 1px solid oklab(100% 0 0 / 0.06);
  }

  .trophy-row:first-child .row-champ {
    color: oklch(90% 0.12 88);
  }

  .row-year {
    font-variant-numeric: tabular-nums;
    color: oklch(84% 0.1 86);
  }

  .row-logo {
    display: flex;
    width: 1.5rem;
    height: 1.5rem;
  }

  .row-logo img {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }

  .row-champ {
    font-weight: 500;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .row-score {
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
    text-align: center;
  }

  .row-note {
    font-size: 0.75rem;
    color: oklch(88% 0.04 88 / 0.6);
    white-space: nowrap;
  }

  .row-runner {
    font-size: 0.9375rem;
    color: oklch(88% 0.03 88 / 0.6);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .trophy-modal-enter-active,
  .trophy-modal-leave-active {
    transition:
      opacity 0.18s ease,
      transform 0.22s ease;
  }

  .trophy-modal-enter-from,
  .trophy-modal-leave-to {
    opacity: 0;
    transform: scale(0.97) translateY(0.5rem);
  }

  @media (max-width: 599px) {
    .trophy-panel {
      padding: 1.1rem 1rem 1rem;
    }
    .trophy-hero {
      grid-template-columns: 1fr;
      justify-items: center;
      gap: 1rem;
      text-align: center;
    }
    .trophy-image {
      height: 13rem;
    }
    .trophy-facts {
      justify-content: center;
    }
    .trophy-row {
      grid-template-columns: 2.4rem 1.35rem minmax(0, 1fr) auto;
      gap: 0.5rem;
      font-size: 0.9375rem;
    }
    /* Runner-up and any shootout note share a second line. */
    .row-runner {
      grid-column: 3;
      grid-row: 2;
      margin-top: -0.3rem;
      font-size: 0.8125rem;
    }
    .row-note {
      grid-column: 4;
      grid-row: 2;
      justify-self: end;
      margin-top: -0.3rem;
    }
  }
</style>
