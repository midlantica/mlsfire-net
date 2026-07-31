<script setup lang="ts">
  const props = defineProps<{ open: boolean }>()
  const emit = defineEmits<{ (e: 'close'): void }>()

  function onKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape' && props.open) emit('close')
  }

  onMounted(() => window.addEventListener('keydown', onKeydown))
  onUnmounted(() => window.removeEventListener('keydown', onKeydown))
</script>

<template>
  <Teleport to="body">
    <Transition name="lc-info-modal">
      <div
        v-if="open"
        class="lc-info-backdrop"
        role="dialog"
        aria-modal="true"
        aria-labelledby="lc-info-title"
        @mousedown.self="emit('close')"
      >
        <div class="lc-info-panel">
          <button
            class="lc-info-close"
            aria-label="Close"
            @click="emit('close')"
          >
            <CloseIcon />
          </button>

          <div class="lc-info-logo-row">
            <img
              src="/leagues-cup-logo.svg"
              alt="Leagues Cup"
              class="lc-info-logo"
            />
            <img
              src="/mls-logo.svg"
              alt="MLS"
              class="lc-info-comp-logo lc-info-mls-logo"
            />
            <img
              src="/liga-mx-logo.svg"
              alt="Liga MX"
              class="lc-info-comp-logo"
            />
          </div>

          <h2 id="lc-info-title" class="sr-only">About Leagues Cup</h2>

          <div class="lc-info-body">
            <p>
              Leagues Cup is the annual cross-border tournament between MLS and
              Liga MX.
            </p>

            <h3 class="lc-info-heading">36 teams compete:</h3>
            <ul>
              <li>All 18 Liga MX clubs</li>
              <li>
                18 MLS clubs (the top 9 from each conference that qualified for
                the previous year's MLS Cup Playoffs)
              </li>
            </ul>

            <h3 class="lc-info-heading">Phase One</h3>
            <ul>
              <li>
                Every team plays 3 matches — all against the other league.
              </li>
              <li>
                Results go into two separate tables (one for MLS, one for Liga
                MX).
              </li>
              <li>The top 4 from each table advance.</li>
            </ul>

            <h3 class="lc-info-heading">Knockout Stage</h3>
            <ul>
              <li>Quarterfinals → Semifinals → Final (+ 3rd-place match).</li>
              <li>
                Every game through the quarterfinals remains MLS vs. Liga MX.
              </li>
              <li>No draws. Tied games go straight to penalties.</li>
            </ul>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }

  .lc-info-backdrop {
    position: fixed;
    inset: 0;
    z-index: 9500;
    background: oklab(0% 0 0 / 0.75);
    display: flex;
    align-items: safe center;
    justify-content: center;
    padding: 1rem;
    overflow-y: auto;
  }

  .lc-info-panel {
    position: relative;
    font-family: var(--font-condensed);
    letter-spacing: 0.03rem;
    background: oklch(18% 0.01 260);
    border: 1px solid oklab(100% 0 0 / 0.08);
    border-bottom: 3px solid oklab(100% 0 0 / 0.08);
    border-radius: 0.75rem;
    width: 100%;
    max-width: 540px;
    max-height: 88dvh;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    overflow-y: auto;
    padding: 1.7rem 2.25rem 1.5rem;
    box-shadow: 0 8px 24px oklab(0% 0 0 / 1);
  }

  @media (min-width: 768px) {
    .lc-info-panel {
      width: 65vw;
    }
  }

  .lc-info-close {
    position: absolute;
    top: 0.65rem;
    right: 0.65rem;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 1.9rem;
    height: 1.9rem;
    background: none;
    border: none;
    color: oklab(100% 0 0 / 0.35);
    cursor: pointer;
    transition: color 0.15s;
  }

  .lc-info-close:hover {
    color: oklab(100% 0 0);
  }

  .lc-info-logo-row {
    display: flex;
    align-items: flex-start;
    gap: 0.6rem;
    margin-bottom: 1rem;
  }

  .lc-info-logo {
    height: 2.25rem;
    width: auto;
  }

  .lc-info-comp-logo {
    height: 1.75rem;
    width: auto;
    margin-top: -0.1rem;
  }

  .lc-info-mls-logo {
    filter: brightness(0) invert(1);
  }

  .lc-info-body {
    width: 100%;
    font-size: var(--modal-copy-size, 1rem);
    font-weight: 100;
    line-height: 1.55;
    color: oklab(100% 0 0);
  }

  .lc-info-body p {
    margin: 0 0 0.85rem;
  }

  .lc-info-body ul {
    margin: 0 0 0.85rem;
    padding-left: 0;
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }

  .lc-info-body li {
    position: relative;
    padding-left: 1em;
    line-height: 1.4;
    letter-spacing: 0.04rem;
    color: oklab(100% 0 0);
  }

  .lc-info-body li::before {
    content: '';
    position: absolute;
    left: 0;
    top: 0.45em;
    width: 0.4em;
    height: 0.4em;
    background: oklab(100% 0 0);
  }

  .lc-info-heading {
    margin: 0 0 0.5rem;
    font-weight: 500;
    color: oklab(100% 0 0);
    text-transform: uppercase;
    letter-spacing: 0.1em;
    font-size: 1em;
  }

  .lc-info-body ul:last-child,
  .lc-info-body p:last-child {
    margin-bottom: 0;
  }

  .lc-info-modal-enter-active,
  .lc-info-modal-leave-active {
    transition:
      opacity 0.18s ease,
      transform 0.22s ease;
  }

  .lc-info-modal-enter-from,
  .lc-info-modal-leave-to {
    opacity: 0;
    transform: translateY(1.5rem);
  }
</style>
