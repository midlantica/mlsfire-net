<script setup lang="ts">
  import type { MatchBadge } from '~/composables/useScores'

  type BadgeKind = Exclude<MatchBadge, null>

  const props = withDefaults(
    defineProps<{
      badge: BadgeKind
      size?: string
    }>(),
    { size: '1.15rem' }
  )

  const BADGE_ICONS: Record<BadgeKind, { src: string; label: string }> = {
    fire: {
      src: '/fire-hot.svg',
      label: 'Top match — both teams winning and closely matched',
    },
    wild: {
      src: '/fire-cool.svg',
      label: 'Could be good — derby or evenly matched underdogs',
    },
  }

  const icon = computed(() => BADGE_ICONS[props.badge])
</script>

<template>
  <img
    :src="icon.src"
    :alt="icon.label"
    :title="icon.label"
    class="match-badge-icon"
    :style="{ height: size }"
  />
</template>

<style scoped>
  .match-badge-icon {
    width: auto;
    display: inline-block;
    user-select: none;
    -webkit-user-drag: none;
  }
</style>
