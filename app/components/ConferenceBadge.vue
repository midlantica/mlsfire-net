<script setup lang="ts">
  import { computed, ref } from 'vue'
  import type { ConferenceBadge } from '../composables/useStandings'

  const props = withDefaults(
    defineProps<{
      badge: ConferenceBadge | null | undefined
      align?: 'start' | 'end'
      tooltipSide?: 'bottom' | 'right'
    }>(),
    { align: 'start', tooltipSide: 'bottom' }
  )

  const isLigaMx = computed(() => props.badge?.league === 'ligamx')

  const tooltip = computed(() => {
    if (!props.badge) return ''
    if (isLigaMx.value) return `Liga MX ${props.badge.rank}`
    return `#${props.badge.rank} ${props.badge.letter === 'W' ? 'Western' : 'Eastern'} Con`
  })

  const badgeText = computed(() =>
    props.badge
      ? isLigaMx.value
        ? `M${props.badge.rank}`
        : `${props.badge.rank}${props.badge.letter}`
      : ''
  )

  // A pure CSS :hover tooltip only ever flashes for an instant here — the
  // whole card is a click target that opens the match modal, which covers
  // the tooltip before a real hover (no click) would otherwise reveal it.
  // Explicit enter/leave state sidesteps that (mirrors MatchBadgeIcon).
  const showTooltip = ref(false)
</script>

<template>
  <span
    v-if="badge"
    class="conf-badge-wrap"
    :class="{ 'conf-badge-wrap-ligamx': isLigaMx }"
    tabindex="0"
    @mouseenter="showTooltip = true"
    @mouseleave="showTooltip = false"
    @focus="showTooltip = true"
    @blur="showTooltip = false"
  >
    <span class="conf-badge" :aria-label="tooltip">{{ badgeText }}</span>
    <template v-if="showTooltip">
      <span
        class="conf-tip-arrow"
        :class="{ 'conf-tip-arrow-right': tooltipSide === 'right' }"
      />
      <span
        class="conf-tip"
        :class="{
          'conf-tip-end': align === 'end' && tooltipSide === 'bottom',
          'conf-tip-right': tooltipSide === 'right',
        }"
        role="tooltip"
        >{{ tooltip }}</span
      >
    </template>
  </span>
</template>

<style scoped>
  .conf-badge-wrap {
    position: relative;
    display: inline-flex;
    flex-shrink: 0;
  }

  .conf-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-family: var(--font-condensed);
    font-size: 0.6875rem;
    font-weight: 200;
    letter-spacing: 0.1em;
    color: oklch(96% 0.03 150);
    background: oklch(0.39 0.12 241.94);
    border-radius: 2px;
    padding: 0.01rem 0.15rem 0.04rem 0.225rem;
    line-height: 1.4;
    white-space: nowrap;
    flex-shrink: 0;
  }

  .conf-badge-wrap-ligamx .conf-badge {
    background: oklch(0.4 0.16 147.26);
  }

  .conf-tip {
    position: absolute;
    top: calc(100% + 8px);
    left: 0;
    padding: 0.2rem 0.45rem 0.25rem;
    border-radius: 3.5px;

    background: oklch(0.44 0.14 242);
    color: oklch(99% 0.01 150);
    font-family: var(--font-condensed);
    font-size: 0.72rem;
    font-weight: 600;
    letter-spacing: 0.01em;
    line-height: 1.2;
    white-space: nowrap;
    pointer-events: none;
    z-index: 40;
  }

  .conf-tip-end {
    left: auto;
    right: 0;
  }

  /* Right-side flyout — used on Wall GameBlock cards, where a tooltip
     flowing directly below the badge sits right under the mouse cursor and
     gets visually obscured by the pointer icon. Flowing to the side instead
     keeps the text clear of the cursor. */
  .conf-tip-right {
    top: 50%;
    left: calc(100% + 8px);
    transform: translateY(-50%);
  }

  /* Arrow — a small square rotated into a diamond, anchored at the exact
     point where the tooltip box begins. Sitting behind the tooltip
     (lower z-index) with matching background color, half of it hides
     seamlessly under the tooltip while the other half pokes out into the
     gap toward the badge, guaranteeing a visible connecting point (unlike
     the old border-triangle trick, which could render as nothing depending
     on gap/border-width alignment). */
  .conf-tip-arrow {
    position: absolute;
    top: calc(100% + 8px);
    left: 50%;
    width: 6px;
    height: 6px;

    transform: translate(-50%, -50%) rotate(45deg);
    background: oklch(0.44 0.14 242);
    z-index: 39;
  }

  .conf-tip-arrow-right {
    top: 50%;
    left: calc(100% + 8px);
    transform: translate(-50%, -50%) rotate(45deg);
  }

  .conf-badge-wrap-ligamx .conf-tip {
    background: oklch(0.55 0.19 146);
  }

  .conf-badge-wrap-ligamx .conf-tip-arrow {
    background: oklch(0.55 0.19 146);
  }

  @media (max-width: 768px) {
    .conf-tip,
    .conf-tip-arrow {
      display: none;
    }
  }
</style>
