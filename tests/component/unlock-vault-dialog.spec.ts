import { flushPromises, type VueWrapper } from '@vue/test-utils'
import ConfirmationService from 'primevue/confirmationservice'
import ConfirmDialog from 'primevue/confirmdialog'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent } from 'vue'

import UnlockVaultDialog from '@/components/central/UnlockVaultDialog.vue'
import { vault } from '@/core/central/vault'
import { db } from '@/persistence/db'
import { useCentralStore } from '@/stores/central'

import { freshPinia, mountWith } from './helpers'

// Host both the dialog and a ConfirmDialog so the forgotten-passphrase danger
// confirm renders and its accept button is clickable in the test.
const Host = defineComponent({
  components: { UnlockVaultDialog, ConfirmDialog },
  template: '<div><UnlockVaultDialog /><ConfirmDialog /></div>',
})

const mountHost = (): VueWrapper =>
  mountWith(freshPinia(), Host, {
    global: {
      stubs: { teleport: true },
      plugins: [ConfirmationService],
    },
  })

const findTestId = (wrapper: VueWrapper, id: string) => wrapper.find(`[data-testid="${id}"]`)

const PASSPHRASE = 'correct horse'

beforeEach(async () => {
  vault.lock()
  await Promise.all([db.centralServers.clear(), db.centralVault.clear(), db.publishTargets.clear()])
})

afterEach(() => {
  useCentralStore().stopWatching()
})

describe('UnlockVaultDialog', () => {
  it('is hidden until the store opens the prompt', () => {
    const wrapper = mountHost()
    expect(findTestId(wrapper, 'unlock-vault-dialog').exists()).toBe(false)
  })

  it('create mode: sets a passphrase and resolves the ensureUnlocked gate', async () => {
    const wrapper = mountHost()
    const store = useCentralStore()

    const gate = store.ensureUnlocked() // no vault → create mode
    await vi.waitUntil(() => findTestId(wrapper, 'unlock-vault-dialog').exists())
    // Create mode shows the confirm field.
    expect(findTestId(wrapper, 'unlock-vault-confirm').exists()).toBe(true)

    await findTestId(wrapper, 'unlock-vault-passphrase').setValue('a-strong-pass')
    await findTestId(wrapper, 'unlock-vault-confirm').setValue('a-strong-pass')
    await findTestId(wrapper, 'unlock-vault-submit').trigger('click')

    await expect(gate).resolves.toBeUndefined()
    expect(store.isUnlocked).toBe(true)
    expect(store.unlockPromptOpen).toBe(false)
  })

  it('create mode: shows a mismatch error and stays open', async () => {
    const wrapper = mountHost()
    const store = useCentralStore()
    void store.ensureUnlocked()
    await vi.waitUntil(() => findTestId(wrapper, 'unlock-vault-dialog').exists())

    await findTestId(wrapper, 'unlock-vault-passphrase').setValue('a-strong-pass')
    await findTestId(wrapper, 'unlock-vault-confirm').setValue('different-pass')
    await findTestId(wrapper, 'unlock-vault-submit').trigger('click')
    await flushPromises()

    expect(findTestId(wrapper, 'unlock-vault-error').text()).toContain('do not match')
    expect(store.isUnlocked).toBe(false)
    expect(store.unlockPromptOpen).toBe(true)
  })

  it('unlock mode: rejects a wrong passphrase then accepts the right one', async () => {
    const wrapper = mountHost()
    const store = useCentralStore()
    // A vault already exists, and it is locked.
    await store.submitCreate(PASSPHRASE)
    store.lockVault()

    void store.ensureUnlocked()
    await vi.waitUntil(() => findTestId(wrapper, 'unlock-vault-dialog').exists())
    // Unlock mode: no confirm field.
    expect(findTestId(wrapper, 'unlock-vault-confirm').exists()).toBe(false)

    await findTestId(wrapper, 'unlock-vault-passphrase').setValue('wrong')
    await findTestId(wrapper, 'unlock-vault-submit').trigger('click')
    await vi.waitUntil(() => findTestId(wrapper, 'unlock-vault-error').exists())

    expect(findTestId(wrapper, 'unlock-vault-error').text()).toContain('incorrect')
    expect(store.isUnlocked).toBe(false)
    expect(store.unlockPromptOpen).toBe(true)

    await findTestId(wrapper, 'unlock-vault-passphrase').setValue(PASSPHRASE)
    await findTestId(wrapper, 'unlock-vault-submit').trigger('click')
    await vi.waitUntil(() => !store.unlockPromptOpen)

    expect(store.isUnlocked).toBe(true)
  })

  it('forgotten passphrase: the danger confirm switches to reset and re-keys the vault', async () => {
    const wrapper = mountHost()
    const store = useCentralStore()
    await store.submitCreate(PASSPHRASE)
    store.lockVault()

    void store.ensureUnlocked()
    await vi.waitUntil(() => findTestId(wrapper, 'unlock-vault-dialog').exists())

    // Open the danger confirm and accept it.
    await findTestId(wrapper, 'unlock-vault-forgot').trigger('click')
    await vi.waitUntil(() => findTestId(wrapper, 'unlock-vault-reset-confirm').exists())
    await findTestId(wrapper, 'unlock-vault-reset-confirm').trigger('click')
    await flushPromises()

    // Now in reset mode: the confirm field is back, and submit re-keys the vault.
    expect(findTestId(wrapper, 'unlock-vault-confirm').exists()).toBe(true)
    await findTestId(wrapper, 'unlock-vault-passphrase').setValue('brand-new-pass')
    await findTestId(wrapper, 'unlock-vault-confirm').setValue('brand-new-pass')
    await findTestId(wrapper, 'unlock-vault-submit').trigger('click')
    await vi.waitUntil(() => !store.unlockPromptOpen)

    expect(store.isUnlocked).toBe(true)
  })
})
