<script setup lang="ts">
  import type { MatchPreview } from '~/composables/useMatchPreview'

  defineProps<{
    preview: MatchPreview | null
  }>()
</script>

<template>
  <div class="preview-tab">
    <div v-if="preview" class="preview-card">
      <p class="preview-text">{{ preview.text }}</p>
    </div>
    <div v-else class="no-data">
      Preview unavailable for this matchup — check back closer to kickoff.
    </div>
  </div>
</template>

<style scoped>
  .preview-tab {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .preview-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1.25rem;
    padding: 1.25rem 0.5rem 0.5rem;
  }

  .preview-text {
    font-size: 1.15rem;
    font-weight: 200;
    line-height: 1.6;
    letter-spacing: 0.02em;
    color: oklab(100% 0 0 / 0.9);
    text-align: center;
    max-width: 34rem;
    margin: 0;
  }

  @media (max-width: 768px) {
    .preview-text {
      max-width: 28rem;
    }
  }

  @media (max-width: 425px) {
    .preview-card {
      gap: 1rem;
      padding: 1rem 0.25rem 0.5rem;
    }
  }
</style>
