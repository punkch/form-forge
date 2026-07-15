/**
 * The credential-vault passphrase form — shared by the app-global
 * `UnlockVaultDialog` (modal, reachable from anywhere) and the inline
 * `DrawerUnlock` gate inside the Central drawers.
 *
 * Both surfaces run the identical three-face (create / unlock / reset) state
 * machine over a security-sensitive passphrase; keeping it in one place stops the
 * two from drifting. Each consumer owns only how the face is chosen (the modal
 * from `central.unlockMode`, the drawer from `central.hasVaultMeta()`) and its
 * own reset-confirm testid; everything else — validation, submit dispatch, and
 * the forgotten-passphrase confirm → reset transition — lives here.
 */
import { useConfirm } from 'primevue/useconfirm'
import { computed, ref } from 'vue'

import { useAppI18n } from '@/i18n'
import { useCentralStore } from '@/stores/central'

export type VaultFace = 'create' | 'unlock' | 'reset'

export const useVaultForm = (options: { resetConfirmTestId: string }) => {
  const central = useCentralStore()
  const confirm = useConfirm()
  const { t } = useAppI18n()

  const face = ref<VaultFace>('unlock')
  const passphrase = ref('')
  const confirmPassphrase = ref('')
  const error = ref('')
  const submitting = ref(false)

  const needsConfirm = computed((): boolean => face.value !== 'unlock')
  const submitLabel = computed((): string => {
    if (face.value === 'unlock') return t('central.vault.unlock')
    if (face.value === 'reset') return t('central.vault.resetAccept')
    return t('central.vault.create')
  })

  const clearFields = (): void => {
    passphrase.value = ''
    confirmPassphrase.value = ''
    error.value = ''
    submitting.value = false
  }

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

  /**
   * Install (create), replace (reset) or verify (unlock) the vault key. A wrong
   * unlock passphrase surfaces `wrongPassphrase` and keeps the form open; a
   * crypto/IndexedDB failure surfaces `failed`. The store closes the app-global
   * prompt on success; the inline drawer gate reacts to `central.isUnlocked`.
   */
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
      acceptProps: { severity: 'danger', 'data-testid': options.resetConfirmTestId },
      accept: () => {
        face.value = 'reset'
        clearFields()
      },
    })
  }

  return {
    face,
    passphrase,
    confirmPassphrase,
    error,
    submitting,
    needsConfirm,
    submitLabel,
    clearFields,
    validate,
    submit,
    forgot,
  }
}
