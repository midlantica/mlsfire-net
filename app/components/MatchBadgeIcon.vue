<script setup lang="ts">
  import type { MatchBadge } from '~/composables/useScores'

  type LeaguesCupBadge = 'lc-hot' | 'lc-cool' | 'lc-plain'
  type BadgeKind = Exclude<MatchBadge, null> | LeaguesCupBadge

  const props = withDefaults(
    defineProps<{
      badge: BadgeKind
      size?: string
      tooltipSide?: 'above' | 'below'
    }>(),
    { size: '1.15rem', tooltipSide: 'above' }
  )

  const BADGE_ICONS: Record<BadgeKind, { src?: string; label: string }> = {
    fire: {
      src: '/fire-hot.svg',
      label: 'Top match — both teams winning and closely matched',
    },
    wild: {
      src: '/fire-cool.svg',
      label: 'Could be good — derby or evenly matched underdogs',
    },
    'lc-hot': {
      label: 'Leagues Cup — marquee tie between two in-form clubs',
    },
    'lc-cool': {
      label: 'Leagues Cup — could be good, evenly matched clubs',
    },
    'lc-plain': {
      label: 'Leagues Cup match',
    },
  }

  const icon = computed(() => BADGE_ICONS[props.badge])
  const isLeaguesCup = computed(() => props.badge.startsWith('lc-'))

  // A pure CSS :hover tooltip only ever flashes for an instant here — the
  // whole card is a click target that opens the match modal, which covers
  // the tooltip before a real hover (no click) would otherwise reveal it.
  // Explicit enter/leave state sidesteps that and is trivially debuggable.
  const showTooltip = ref(false)
</script>

<template>
  <span
    class="match-badge-tooltip"
    :class="{ 'tooltip-below': tooltipSide === 'below' }"
    tabindex="0"
    @mouseenter="showTooltip = true"
    @mouseleave="showTooltip = false"
    @focus="showTooltip = true"
    @blur="showTooltip = false"
  >
    <span
      v-if="isLeaguesCup"
      role="img"
      :aria-label="icon.label"
      class="match-badge-icon lc-mark"
      :class="`lc-${badge.slice(3)}`"
      :style="{ height: size, width: size }"
    />
    <img
      v-else
      :src="icon.src"
      :alt="icon.label"
      class="match-badge-icon"
      :style="{ height: size }"
    />
    <span v-if="showTooltip" class="tooltip-bubble">{{ icon.label }}</span>
  </span>
</template>

<style scoped>
  .match-badge-tooltip {
    position: relative;
    display: inline-flex;
    line-height: 0;
    outline: none;
  }

  /* Invisible hit-area larger than the tiny visible icon, so hover is easy
     to land on without needing pixel-precise mouse placement. */
  .match-badge-tooltip::before {
    content: '';
    position: absolute;
    inset: -0.4rem;
  }

  .tooltip-bubble {
    position: absolute;
    bottom: calc(100% + 0.35rem);
    right: -0.2rem;
    width: max-content;
    max-width: 11rem;
    padding: 0.35rem 0.5rem;
    border-radius: 0.3rem;
    background: oklab(12% 0 0 / 0.95);
    color: oklab(97% 0 0);
    font-family: var(--font-sans, inherit);
    font-size: 0.7rem;
    font-weight: 400;
    letter-spacing: 0.01em;
    line-height: 1.3;
    text-align: left;
    white-space: normal;
    pointer-events: none;
    z-index: 10;
  }

  /* Some hosts (e.g. the match modal header) have no clearance above the
     badge — an ancestor with overflow:hidden would clip an upward tooltip —
     so the tooltip opens downward there instead. */
  .tooltip-below .tooltip-bubble {
    bottom: auto;
    top: calc(100% + 0.35rem);
  }

  .match-badge-icon {
    width: auto;
    display: inline-block;
    user-select: none;
    -webkit-user-drag: none;
  }

  /* An <img> cannot be recoloured, so the symbol is painted as a mask. */
  .lc-mark {
    background: currentColor;
    mask: url('/Leagues-cup-symbol.svg') no-repeat center / contain;
    -webkit-mask: url('/Leagues-cup-symbol.svg') no-repeat center / contain;
  }

  .lc-hot {
    color: oklch(65% 0.18 52.22);
  }

  .lc-cool {
    color: oklch(52% 0.14 238.55);
  }

  .lc-plain {
    color: oklch(65% 0 0);
  }
</style>
