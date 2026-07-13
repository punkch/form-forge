<script setup lang="ts">
/**
 * Cross-route credential-vault dialog. Mounted once at the App root (beside
 * `<ConfirmDialog/>`) because it must be reachable from the library, the editor
 * and settings — it is driven by `central.unlockPromptOpen`, NOT
 * `editor.activeDialog` (which resets on every form load).
 *
 * Three faces:
 * - `create` — first-ever use: set a passphrase (+ confirm) → `submitCreate`.
 * - `unlock` — a vault exists: enter the passphrase → `submitUnlock`. A wrong
 *   passphrase surfaces `central.vault.wrongPassphrase` and keeps the dialog open
 *   (verified against the key-check, never by decrypting a real secret).
 * - `reset` — reached from the forgotten-passphrase link via a danger confirm:
 *   set a NEW passphrase → `resetVault` (wipes stored passwords, keeps servers).
 */
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import { useConfirm } from 'primevue/useconfirm'
import { computed, ref, watch } from 'vue'

import { useAppI18n } from '@/i18n'
import { useCentralStore } from '@/stores/central'

const central = useCentralStore()
const confirm = useConfirm()
const { t } = useAppI18n()

type Face = 'create' | 'unlock' | 'reset'

const face = ref<Face>('unlock')
const passphrase = ref('')
const confirmPassphrase = ref('')
const error = ref('')
const submitting = ref(false)

const needsConfirm = computed((): boolean => face.value !== 'unlock')

const title = computed((): string =>
  face.value === 'unlock' ? t('central.vault.unlockTitle') : t('central.vault.createTitle'))
const intro = computed((): string =>
  face.value === 'unlock' ? t('central.vault.unlockIntro') : t('central.vault.createIntro'))
const submitLabel = computed((): string => {
  if (face.value === 'unlock') return t('central.vault.unlock')
  if (face.value === 'reset') return t('central.vault.resetAccept')
  return t('central.vault.create')
})

// Sync the local face + clear fields whenever the prompt (re)opens.
watch(() => central.unlockPromptOpen, (open) => {
  if (!open) return
  face.value = central.unlockMode
  passphrase.value = ''
  confirmPassphrase.value = ''
  error.value = ''
  submitting.value = false
})

const validate = (): boolean => {
  if (passphrase.value.length === 0) {
    error.value = t('central.vault.required')
    return false
  }
  if (needsConfirm.value) {
    if (passphrase.value.length < 8) {
      error.value = t('central.vault.tooShort')
      return false
    }
    if (passphrase.value !== confirmPassphrase.value) {
      error.value = t('central.vault.mismatch')
      return false
    }
  }
  error.value = ''
  return true
}

const submit = async (): Promise<void> => {
  if (submitting.value || !validate()) return
  submitting.value = true
  try {
    if (face.value === 'create') {
      await central.submitCreate(passphrase.value)
    } else if (face.value === 'reset') {
      await central.resetVault(passphrase.value)
    } else {
      const ok = await central.submitUnlock(passphrase.value)
      if (!ok) error.value = t('central.vault.wrongPassphrase')
    }
  } catch {
    // A crypto/IndexedDB failure (not a wrong passphrase) — surface something
    // rather than leaving the dialog looking inert.
    error.value = t('central.vault.failed')
  } finally {
    submitting.value = false
  }
}

const forgot = (): void => {
  confirm.require({
    header: t('central.vault.resetTitle'),
    message: t('central.vault.resetConfirm'),
    icon: 'pi pi-exclamation-triangle',
    acceptLabel: t('central.vault.resetAccept'),
    rejectLabel: t('central.vault.cancel'),
    acceptProps: { severity: 'danger', 'data-testid': 'unlock-vault-reset-confirm' },
    accept: () => {
      face.value = 'reset'
      passphrase.value = ''
      confirmPassphrase.value = ''
      error.value = ''
    },
  })
}

// User-initiated close (X / Escape / mask) rejects the parked unlock awaiters.
const onVisible = (value: boolean): void => { if (!value) central.cancelUnlock() }
const cancel = (): void => { central.cancelUnlock() }
const resetFields = (): void => {
  passphrase.value = ''
  confirmPassphrase.value = ''
  error.value = ''
  submitting.value = false
}
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
    @hide="resetFields"
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
        @click="cancel"
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
