<script setup lang="ts">
  const { seasons, displaySeason, selectSeason } = useStandings()

  const open = ref(false)
  const wrapRef = ref<HTMLElement | null>(null)

  function choose(year: number) {
    open.value = false
    selectSeason(year)
  }

  function onDocClick(e: MouseEvent) {
    if (open.value && !wrapRef.value?.contains(e.target as Node))
      open.value = false
  }
  function onKey(e: KeyboardEvent) {
    if (e.key === 'Escape') open.value = false
  }

  onMounted(() => {
    document.addEventListener('click', onDocClick)
    document.addEventListener('keydown', onKey)
  })
  onBeforeUnmount(() => {
    document.removeEventListener('click', onDocClick)
    document.removeEventListener('keydown', onKey)
  })
</script>

<template>
  <span v-if="seasons.length > 1" ref="wrapRef" class="season-picker">
    <button
      class="season-btn"
      aria-haspopup="listbox"
      :aria-expanded="open"
      :aria-label="`Season ${displaySeason} — choose another season`"
      @click.stop="open = !open"
    >
      {{ displaySeason }}<span class="caret" aria-hidden="true">▾</span>
    </button>
    <ul v-if="open" class="season-menu" role="listbox">
      <li v-for="year in seasons" :key="year">
        <button
          class="season-option"
          :class="{ selected: year === displaySeason }"
          role="option"
          :aria-selected="year === displaySeason"
          @click="choose(year)"
        >
          <span class="marker" aria-hidden="true">▸</span>{{ year }}
        </button>
      </li>
    </ul>
  </span>
  <span v-else-if="displaySeason">{{ displaySeason }}</span>
</template>

<style scoped>
  .season-picker {
    position: relative;
    display: inline-block;
  }

  .season-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.2rem;
    padding: 0 0.15rem 0 0.2rem;
    margin: 0 -0.15rem 0 -0.2rem;
    border: none;
    border-radius: 0.25rem;
    background: none;
    font: inherit;
    letter-spacing: inherit;
    text-transform: inherit;
    color: inherit;
    cursor: pointer;
    transition: background 0.15s;
  }
  .season-btn:hover,
  .season-btn[aria-expanded='true'] {
    background: oklab(100% 0 0 / 0.08);
  }
  .season-btn:focus-visible {
    outline: 2px solid var(--color-theme-400);
    outline-offset: 1px;
  }

  .caret {
    font-size: 0.75em;
    color: var(--color-theme-600);
    line-height: 1;
  }
  .season-btn:hover .caret {
    color: var(--color-theme-400);
  }

  .season-menu {
    position: absolute;
    top: calc(100% + 0.25rem);
    left: 50%;
    transform: translateX(-50%);
    z-index: 200;
    margin: 0;
    padding: 0.2rem 0;
    list-style: none;
    background: oklch(18% 0.025 260);
    border: 1px solid var(--color-theme-800);
    border-radius: 0.4rem;
    box-shadow: 0 6px 18px oklab(0% 0 0 / 0.5);
    min-width: 4.5rem;
  }

  .season-option {
    display: flex;
    align-items: center;
    width: 100%;
    padding: 0.25rem 0.6rem 0.25rem 0.4rem;
    border: none;
    background: transparent;
    font: inherit;
    letter-spacing: 0.08em;
    color: oklab(80% 0 0);
    cursor: pointer;
  }
  .season-option:hover {
    background: oklab(100% 0 0 / 0.08);
    color: oklab(95% 0 0);
  }
  .season-option.selected {
    color: var(--color-theme-300);
  }

  .marker {
    width: 0.9rem;
    font-size: 0.7em;
    visibility: hidden;
  }
  .season-option.selected .marker {
    visibility: visible;
  }
</style>
