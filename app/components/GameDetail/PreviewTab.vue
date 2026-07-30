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
      <div v-if="preview.links?.length" class="preview-links">
        <a
          v-for="link in preview.links"
          :key="link.url"
          :href="link.url"
          target="_blank"
          rel="noopener noreferrer"
          class="preview-link"
        >
          {{ link.label }} ↗
        </a>
      </div>
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

  .preview-links {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
    padding-top: 0.5rem;
    border-top: 1px solid oklab(100% 0 0 / 0.1);
    width: 100%;
    max-width: 24rem;
  }

  .preview-link {
    font-size: 0.8125rem;
    font-weight: 400;
    letter-spacing: 0.05em;
    color: oklab(100% 0 0 / 0.6);
    text-decoration: none;
    transition: color 0.15s;
  }

  .preview-link:hover {
    color: oklab(100% 0 0);
    text-decoration: underline;
    text-underline-offset: 0.2em;
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
