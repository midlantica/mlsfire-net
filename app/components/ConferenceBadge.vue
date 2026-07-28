<script setup lang="ts">
  import { computed } from 'vue'
  import type { ConferenceBadge } from '../composables/useStandings'

  const props = defineProps<{
    badge: ConferenceBadge | null | undefined
  }>()

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
</script>

<template>
  <span
    v-if="badge"
    class="conf-badge-wrap"
    :class="{ 'conf-badge-wrap-ligamx': isLigaMx }"
  >
    <span class="conf-badge" :aria-label="tooltip">{{ badgeText }}</span>
    <span class="conf-tip" role="tooltip">{{ tooltip }}</span>
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
    bottom: calc(100% + 7px);
    left: 50%;
    transform: translateX(-50%) translateY(3px);
    padding: 0.25rem 0.5rem 0.3rem;
    border-radius: 5px;
    background: oklch(0.44 0.14 242);
    color: oklch(99% 0.01 150);
    font-size: 0.75rem;
    font-weight: 600;
    letter-spacing: 0.01em;
    line-height: 1.2;
    white-space: nowrap;
    pointer-events: none;
    opacity: 0;
    visibility: hidden;
    z-index: 40;
    transition:
      opacity 120ms ease,
      transform 120ms ease;
  }

  .conf-tip::after {
    content: '';
    position: absolute;
    top: 100%;
    left: 50%;
    transform: translateX(-50%);
    border: 5px solid transparent;
    border-top-color: oklch(0.44 0.14 242);
  }

  .conf-badge-wrap-ligamx .conf-tip {
    background: oklch(0.55 0.19 146);
  }

  .conf-badge-wrap-ligamx .conf-tip::after {
    border-top-color: oklch(0.55 0.19 146);
  }

  @media (hover: hover) and (pointer: fine) {
    .conf-badge-wrap:hover .conf-tip {
      opacity: 1;
      visibility: visible;
      transform: translateX(-50%) translateY(0);
    }
  }

  @media (max-width: 768px) {
    .conf-tip {
      display: none;
    }
  }
</style>
