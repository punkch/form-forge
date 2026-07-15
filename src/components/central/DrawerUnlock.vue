<script setup lang="ts">
/**
 * Inline credential-vault gate for the Central drawers — the "unlock once per
 * session" step. Renders INSIDE the drawer instead of the app-global
 * `UnlockVaultDialog`, so a publish/import flow is never interrupted by a modal
 * thrown over it (the modal-stacking bug this whole re-shaping fixes).
 *
 * Shares the three-face (create / unlock / reset) state machine with the modal
 * via `useVaultForm`. Here the face is resolved once on mount from whether a
 * vault already exists; submit is disabled until it resolves so a fast Enter
 * can't misfire an unlock before the create face is known. On success
 * `central.isUnlocked` flips and the drawer swaps this gate for its content.
 */
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import { onMounted, ref } from 'vue'

import { useVaultForm } from '@/composables/useVaultForm'
import { useAppI18n } from '@/i18n'
import { useCentralStore } from '@/stores/central'

const central = useCentralStore()
const { t } = useAppI18n()
const {
  face, passphrase, confirmPassphrase, error, submitting, needsConfirm, submitLabel, submit, forgot,
} = useVaultForm({ resetConfirmTestId: 'central-unlock-reset-confirm' })

// Whether the create-vs-unlock face has been resolved from IndexedDB yet — the
// submit button waits for it so a first-ever user can't unlock an absent vault.
const ready = ref(false)

onMounted(async () => {
  face.value = (await central.hasVaultMeta()) ? 'unlock' : 'create'
  ready.value = true
})
</script>

<template>
  <div class="drawer-unlock" data-testid="central-unlock">
    <h3 class="drawer-unlock-heading">
      {{ face === 'create' ? t('central.drawer.createHeading') : t('central.drawer.unlockHeading') }}
    </h3>
    <p class="drawer-unlock-intro">
      {{ face === 'create' ? t('central.drawer.createIntro') : t('central.drawer.unlockIntro') }}
    </p>

    <label class="prop-field">
      <span>{{ t('central.vault.passphraseLabel') }}</span>
      <InputText
        v-model="passphrase"
        type="password"
        autocomplete="off"
        :placeholder="t('central.vault.passphrasePlaceholder')"
        data-testid="central-unlock-passphrase"
        @keyup.enter="submit"
      />
    </label>

    <label v-if="needsConfirm" class="prop-field">
      <span>{{ t('central.vault.confirmLabel') }}</span>
      <InputText
        v-model="confirmPassphrase"
        type="password"
        autocomplete="off"
        :placeholder="t('central.vault.confirmPlaceholder')"
        data-testid="central-unlock-confirm"
        @keyup.enter="submit"
      />
    </label>

    <small v-if="error !== ''" class="prop-issue" data-testid="central-unlock-error">{{ error }}</small>

    <div class="drawer-unlock-actions">
      <Button
        :label="submitLabel"
        :loading="submitting"
        :disabled="!ready"
        data-testid="central-unlock-submit"
        @click="submit"
      />
    </div>

    <button
      v-if="face === 'unlock'"
      type="button"
      class="drawer-unlock-forgot"
      data-testid="central-unlock-forgot"
      @click="forgot"
    >
      {{ t('central.vault.forgot') }}
    </button>
  </div>
</template>

<style scoped>
@import '../properties/prop-section.css';

.drawer-unlock {
  display: flex;
  flex-direction: column;
  gap: var(--odk-spacing-m);
}

.drawer-unlock-heading {
  margin: 0;
  font-size: var(--odk-font-size, 1rem);
}

.drawer-unlock-intro {
  margin: 0;
  color: var(--odk-muted-text-color);
  font-size: var(--odk-hint-font-size);
}

.drawer-unlock-actions {
  display: flex;
  justify-content: flex-end;
}

.drawer-unlock-forgot {
  align-self: flex-start;
  padding: 0;
  border: 0;
  background: none;
  color: var(--odk-primary-color, var(--p-primary-color));
  font-size: var(--odk-hint-font-size);
  cursor: pointer;
  text-decoration: underline;
}
</style>
