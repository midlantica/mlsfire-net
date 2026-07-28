<script setup lang="ts">
  import type { StadiumInfo } from '~/constants/venues'

  const props = defineProps<{
    open: boolean
    stadium: StadiumInfo | null
  }>()

  const emit = defineEmits<{
    close: []
  }>()

  function onKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') emit('close')
  }

  onMounted(() => window.addEventListener('keydown', onKeydown))
  onUnmounted(() => window.removeEventListener('keydown', onKeydown))
</script>

<template>
  <Teleport to="body">
    <Transition name="stadium-modal">
      <div
        v-if="open && stadium"
        class="stadium-backdrop"
        role="dialog"
        aria-modal="true"
        @mousedown.self="emit('close')"
      >
        <div class="stadium-panel">
          <button
            class="stadium-close"
            aria-label="Close"
            @click="emit('close')"
          >
            <CloseIcon />
          </button>
          <img
            :src="stadium.image"
            :alt="stadium.venue"
            class="stadium-image"
          />
          <div class="stadium-body">
            <h3 class="stadium-name">{{ stadium.venue }}</h3>
            <div class="stadium-meta">
              <span class="stadium-city">{{ stadium.city }}</span>
              <span class="stadium-dot">·</span>
              <span>{{ stadium.capacity.toLocaleString() }} cap.</span>
            </div>
            <p class="stadium-bio">{{ stadium.bio }}</p>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
  .stadium-backdrop {
    position: fixed;
    inset: 0;
    z-index: 9200;
    background: oklab(0% 0 0 / 0.75);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem;
    overflow-y: auto;
  }

  .stadium-panel {
    position: relative;
    font-family: var(--font-condensed);
    background: oklch(18% 0.01 260);
    border: 1px solid oklab(100% 0 0 / 0.08);
    border-bottom: 3px solid oklab(100% 0 0 / 0.08);
    border-radius: 0.75rem;
    width: 100%;
    max-width: 30rem;
    max-height: 90dvh;
    overflow-y: auto;
    box-shadow: 0 8px 24px oklab(0% 0 0 / 1);
  }

  .stadium-image {
    display: block;
    width: 100%;
    height: 12rem;
    object-fit: cover;
    border-top-left-radius: 0.75rem;
    border-top-right-radius: 0.75rem;
  }

  @media (min-width: 425px) {
    .stadium-image {
      height: 14rem;
    }
  }

  .stadium-close {
    position: absolute;
    top: 0.6rem;
    right: 0.6rem;
    z-index: 9300;
    background: oklab(0% 0 0 / 0.5);
    border: none;
    border-radius: 50%;
    width: 1.75rem;
    height: 1.75rem;
    display: flex;
    align-items: center;
    justify-content: center;
    color: oklab(100% 0 0 / 0.85);
    cursor: pointer;
    transition: background 0.15s;
  }

  .stadium-close:hover {
    background: oklab(0% 0 0 / 0.75);
  }

  .stadium-body {
    padding: 1rem 1.25rem 1.25rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .stadium-name {
    margin: 0;
    font-size: 1.15rem;
    font-weight: 500;
    letter-spacing: 0.02em;
    color: oklab(100% 0 0);
  }

  .stadium-meta {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.8rem;
    font-weight: 300;
    letter-spacing: 0.03em;
    color: oklab(100% 0 0 / 0.65);
  }

  .stadium-dot {
    color: oklab(100% 0 0 / 0.35);
  }

  .stadium-bio {
    margin: 0.25rem 0 0;
    font-size: var(--modal-copy-size, 0.85rem);
    font-weight: 300;
    line-height: 1.5;
    letter-spacing: 0.01em;
    color: oklab(100% 0 0 / 0.85);
  }

  .stadium-modal-enter-active,
  .stadium-modal-leave-active {
    transition: opacity 0.18s ease;
  }

  .stadium-modal-enter-active .stadium-panel,
  .stadium-modal-leave-active .stadium-panel {
    transition: transform 0.2s ease;
  }

  .stadium-modal-enter-from,
  .stadium-modal-leave-to {
    opacity: 0;
  }

  .stadium-modal-enter-from .stadium-panel,
  .stadium-modal-leave-to .stadium-panel {
    transform: scale(0.96) translateY(0.5rem);
  }
</style>
