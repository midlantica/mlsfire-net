<script setup lang="ts">
  defineProps<{ showScoreLegend?: boolean }>()

  const year = new Date().getFullYear()
  const contactOpen = ref(false)
</script>

<template>
  <footer class="footer">
    <span v-if="showScoreLegend" class="footer-info">
      <MatchBadgeIcon badge="fire" size="1rem" class="legend-icon" />
      both winning &amp; close ·
      <MatchBadgeIcon badge="wild" size="1rem" class="legend-icon" />
      derby or equal underdogs
    </span>
    <span class="footer-credit">
      MLS Fire 🔥 &bull; {{ year }} &bull; Vibe coded by Drew Harper &bull;
      <button class="footer-contact-link" @click="contactOpen = true">
        Contact
      </button>
    </span>
    <span class="footer-disclaimer"
      >This is an unofficial fan site and is not affiliated with, endorsed by,
      or sponsored by MLS. The MLS name, crest, and all team logos are
      trademarks of their respective owners and are used here for informational
      and fan purposes only.</span
    >
  </footer>

  <ClientOnly>
    <ContactModal :open="contactOpen" @close="contactOpen = false" />
  </ClientOnly>
</template>

<style scoped>
  .footer {
    margin-top: 1.5rem;
    padding-top: 0.5rem;
    border-top: 1px solid #343434;
    color: var(--color-text-tertiary);
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 0.375rem;
  }

  .footer-info {
    font-size: 0.75rem;
    color: var(--color-text-secondary);
  }

  .legend-icon {
    vertical-align: -0.2em;
    margin-right: 0.1rem;
  }

  .footer-credit {
    font-size: 0.8rem;
    color: var(--color-text-secondary);
  }

  .footer-contact-link {
    color: oklab(80% 0 0);
    text-decoration: underline;
    text-underline-offset: 2px;
    background: none;
    border: none;
    padding: 0;
    cursor: pointer;
    font: inherit;
    transition: color 0.15s ease;
  }

  .footer-contact-link:hover {
    color: oklab(100% 0 0);
  }

  .footer-disclaimer {
    font-size: 0.6rem;
  }
</style>
