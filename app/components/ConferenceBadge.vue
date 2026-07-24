<script setup lang="ts">
  import type { ConferenceBadge } from '../composables/useStandings'

  defineProps<{
    badge: ConferenceBadge | null | undefined
  }>()
</script>

<template>
  <span v-if="badge" class="conf-badge"
    >{{ badge.rank }}{{ badge.letter }}</span
  >
</template>

<style scoped>
  .conf-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 0.6875rem;
    font-weight: 200;
    letter-spacing: 0.1em;
    color: oklch(96% 0.03 150);
    background: oklch(0.4 0.16 147.26);
    border-radius: 2px;
    padding: 0.01rem 0.15rem 0.04rem 0.225rem;
    line-height: 1.4;
    white-space: nowrap;
    flex-shrink: 0;
  }
</style>
