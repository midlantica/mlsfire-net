<script setup lang="ts">
  const props = defineProps<{ open: boolean }>()
  const emit = defineEmits<{ (e: 'close'): void }>()

  type FormState = 'idle' | 'submitting' | 'success' | 'error'

  const state = ref<FormState>('idle')
  const name = ref('')
  const email = ref('')
  const message = ref('')

  function handleClose() {
    emit('close')
    setTimeout(() => {
      state.value = 'idle'
      name.value = ''
      email.value = ''
      message.value = ''
    }, 250)
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.key !== 'Escape' || !props.open) return
    const active = document.activeElement
    if (
      active instanceof HTMLElement &&
      (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')
    ) {
      active.blur()
      return
    }
    handleClose()
  }

  onMounted(() => window.addEventListener('keydown', onKeydown))
  onUnmounted(() => window.removeEventListener('keydown', onKeydown))

  async function handleSubmit() {
    state.value = 'submitting'
    try {
      const body = new URLSearchParams({
        'form-name': 'contact',
        subject: `MLSfire.net Form from ${name.value}`,
        name: name.value,
        email: email.value,
        message: message.value,
      })

      const res = await fetch('/netlify-forms.html', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      })
      state.value = res.ok ? 'success' : 'error'
    } catch {
      state.value = 'error'
    }
  }
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div
        v-if="open"
        class="modal-backdrop"
        role="dialog"
        aria-modal="true"
        aria-labelledby="contact-title"
        @mousedown.self="handleClose"
      >
        <div class="modal-panel">
          <div class="modal-header">
            <h2 id="contact-title" class="modal-title">Contact</h2>

            <button class="modal-close" aria-label="Close" @click="handleClose">
              <CloseIcon />
            </button>
          </div>

          <div v-if="state === 'success'" class="modal-success">
            <span class="modal-success-icon">🎉</span>
            <p class="modal-success-msg">Thanks! Message received.</p>
            <button class="btn-secondary" @click="handleClose">Close</button>
          </div>

          <form
            v-else
            name="contact"
            netlify
            netlify-honeypot="bot-field"
            class="modal-form"
            @submit.prevent="handleSubmit"
          >
            <input type="hidden" name="form-name" value="contact" />
            <p class="honeypot">
              <label>Don't fill this out: <input name="bot-field" /></label>
            </p>

            <div class="form-field">
              <label class="form-label" for="contact-name">Name</label>
              <input
                id="contact-name"
                v-model="name"
                type="text"
                name="name"
                class="form-input"
                placeholder="Your name"
                required
                autocomplete="name"
              />
            </div>

            <div class="form-field">
              <label class="form-label" for="contact-email">Email</label>
              <input
                id="contact-email"
                v-model="email"
                type="email"
                name="email"
                class="form-input"
                placeholder="you@example.com"
                required
                autocomplete="email"
              />
            </div>

            <div class="form-field">
              <label class="form-label" for="contact-message">Message</label>
              <textarea
                id="contact-message"
                v-model="message"
                name="message"
                class="form-input form-textarea"
                placeholder="Say hello…"
                rows="5"
                required
              />
            </div>

            <p v-if="state === 'error'" class="form-error">
              Something went wrong — please try again.
            </p>

            <div class="modal-actions">
              <button type="button" class="btn-secondary" @click="handleClose">
                Cancel
              </button>
              <button
                type="submit"
                class="btn-primary"
                :disabled="state === 'submitting'"
              >
                {{ state === 'submitting' ? 'Sending…' : 'Submit' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
  .honeypot {
    display: none;
  }

  .modal-backdrop {
    position: fixed;
    inset: 0;
    z-index: 9500;
    background: oklab(0% 0 0 / 0.75);
    display: flex;
    align-items: flex-start;
    justify-content: center;
    padding: 1rem;
    overflow-y: auto;
  }

  .modal-panel {
    margin-top: 4rem;
    font-family: var(--font-condensed);
    letter-spacing: 0.03rem;
    background: oklch(18% 0.01 260);
    border: 1px solid oklab(100% 0 0 / 0.08);
    border-bottom: 3px solid oklab(100% 0 0 / 0.08);
    border-radius: 0.75rem;
    width: 100%;
    max-width: 28rem;
    max-height: 88dvh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    box-shadow: 0 8px 24px oklab(0% 0 0 / 1);
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.65rem 0.75rem 0.5rem 1.1rem;
    border-bottom: 1px solid oklab(100% 0 0 / 0.08);
  }

  .modal-title {
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--color-text-primary);
  }

  .modal-close {
    background: transparent;
    border: none;
    color: oklab(100% 0 0 / 0.35);
    line-height: 1;
    padding: 0.35rem;
    cursor: pointer;
    transition: color 0.15s;
  }

  .modal-close:hover {
    color: oklab(100% 0 0);
  }

  .modal-form {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    padding: 1.1rem;
    overflow-y: auto;
  }

  .form-field {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }

  .form-label {
    font-size: 0.9rem;
    color: var(--color-text-secondary);
  }

  .form-input {
    width: 100%;
    border: 1px solid oklab(100% 0 0 / 0.1);
    background: oklab(100% 0 0 / 0.05);
    color: var(--color-text-primary);
    font-family: inherit;
    font-size: var(--modal-copy-size, 1rem);
    padding: 0.5rem 0.65rem;
    border-radius: 0.25rem;
    outline: none;
    transition:
      border-color 0.15s,
      background 0.15s;
  }

  .form-input::placeholder {
    color: oklab(100% 0 0 / 0.3);
  }

  .form-input:focus {
    border-color: oklab(100% 0 0 / 0.3);
    background: oklab(100% 0 0 / 0.08);
  }

  .form-textarea {
    resize: vertical;
    min-height: 7rem;
  }

  .form-error {
    background: oklch(35% 0.12 25 / 0.45);
    color: oklch(80% 0.11 25);
    font-size: 0.9rem;
    padding: 0.5rem 0.65rem;
    border-radius: 0.25rem;
  }

  .modal-actions {
    display: flex;
    justify-content: flex-end;
    align-items: center;
    gap: 0.75rem;
    padding-top: 0.25rem;
  }

  .btn-secondary {
    background: transparent;
    border: none;
    color: oklab(100% 0 0 / 0.6);
    font-family: inherit;
    font-size: 1rem;
    padding: 0.5rem 1rem;
    border-radius: 0.25rem;
    cursor: pointer;
    transition:
      color 0.15s,
      background 0.15s;
  }

  .btn-secondary:hover {
    color: oklab(100% 0 0);
    background: oklab(100% 0 0 / 0.08);
  }

  .btn-primary {
    background: oklab(100% 0 0 / 0.1);
    border: 1px solid oklab(100% 0 0 / 0.15);
    color: var(--color-text-primary);
    font-family: inherit;
    font-size: 1.05rem;
    font-weight: 600;
    letter-spacing: 0.07rem;
    padding: 0.55rem 1.4rem;
    border-radius: 0.25rem;
    cursor: pointer;
    transition:
      background 0.15s,
      border-color 0.15s,
      opacity 0.15s;
  }

  .btn-primary:hover:not(:disabled) {
    background: oklab(100% 0 0 / 0.18);
    border-color: oklab(100% 0 0 / 0.28);
  }

  .btn-primary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .modal-success {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
    padding: 2rem;
    text-align: center;
  }

  .modal-success-icon {
    font-size: 2.5rem;
  }

  .modal-success-msg {
    color: var(--color-text-primary);
    font-size: 1.1rem;
  }

  .modal-enter-active,
  .modal-leave-active {
    transition:
      opacity 0.18s ease,
      transform 0.22s ease;
  }

  .modal-enter-from,
  .modal-leave-to {
    opacity: 0;
    transform: translateY(1.5rem);
  }

  @media (max-width: 599px) {
    .modal-panel {
      margin-top: 1.5rem;
    }
  }
</style>
