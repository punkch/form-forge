<script setup lang="ts">
/**
 * Cross-route credential-vault dialog. Mounted once at the App root (beside
 * `<ConfirmDialog/>`) because it must be reachable from the library, the editor
 * and settings — it is driven by `central.unlockPromptOpen`, NOT
 * `editor.activeDialog` (which resets on every form load).
 *
 * The three-face (create / unlock / reset) passphrase machine is shared with the
 * inline `DrawerUnlock` gate via `useVaultForm`; this component owns only the
 * modal shell, the open-time face sync from `central.unlockMode`, and cancelling
 * the parked `ensureUnlocked` awaiter on dismiss.
 */
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import { computed, watch } from 'vue'

import { useVaultForm } from '@/composables/useVaultForm'
import { useAppI18n } from '@/i18n'
import { useCentralStore } from '@/stores/central'

const central = useCentralStore()
const { t } = useAppI18n()
const {
  face, passphrase, confirmPassphrase, error, submitting, needsConfirm, submitLabel, submit, forgot, clearFields,
} = useVaultForm({ resetConfirmTestId: 'unlock-vault-reset-confirm' })

const title = computed((): string =>
  face.value === 'unlock' ? t('central.vault.unlockTitle') : t('central.vault.createTitle'))
const intro = computed((): string =>
  face.value === 'unlock' ? t('central.vault.unlockIntro') : t('central.vault.createIntro'))

// Sync the local face + clear fields whenever the prompt (re)opens.
watch(() => central.unlockPromptOpen, (open) => {
  if (!open) return
  face.value = central.unlockMode
  clearFields()
})

// User-initiated close (X / Escape / mask) rejects the parked unlock awaiters.
const onVisible = (value: boolean): void => { if (!value) central.cancelUnlock() }
</script>

<template>
  <Dialog
    :visible="central.unlockPromptOpen"
    :header="title"
    modal
    :style="{ width: '30rem' }"
    :closable="!submitting"
    data-testid="unlock-vault-dialog"
    @update:visible="onVisible"
    @hide="clearFields"
  >
    <div class="unlock-vault">
      <p class="unlock-intro">{{ intro }}</p>

      <label class="prop-field">
        <span>{{ t('central.vault.passphraseLabel') }}</span>
        <InputText
          v-model="passphrase"
          type="password"
          autocomplete="off"
          :placeholder="t('central.vault.passphrasePlaceholder')"
          data-testid="unlock-vault-passphrase"
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
          data-testid="unlock-vault-confirm"
          @keyup.enter="submit"
        />
      </label>

      <small v-if="error !== ''" class="prop-issue" data-testid="unlock-vault-error">{{ error }}</small>

      <button
        v-if="face === 'unlock'"
        type="button"
        class="unlock-forgot"
        data-testid="unlock-vault-forgot"
        @click="forgot"
      >
        {{ t('central.vault.forgot') }}
      </button>
    </div>

    <template #footer>
      <Button
        :label="t('central.vault.cancel')"
        severity="secondary"
        text
        :disabled="submitting"
        @click="central.cancelUnlock()"
      />
      <Button
        :label="submitLabel"
        :loading="submitting"
        data-testid="unlock-vault-submit"
        @click="submit"
      />
    </template>
  </Dialog>
</template>

<style scoped>
@import '../properties/prop-section.css';

.unlock-vault {
  display: flex;
  flex-direction: column;
  gap: var(--odk-spacing-l);
}

.unlock-intro {
  margin: 0;
  color: var(--odk-muted-text-color);
  font-size: var(--odk-hint-font-size);
}

.unlock-forgot {
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
