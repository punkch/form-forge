import { flushPromises, type VueWrapper } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import DrawerUnlock from '@/components/central/DrawerUnlock.vue'

import { freshPinia, mountWith } from './helpers'

// The store's vault callbacks + the confirm service are stubbed so the inline
// gate's three faces (create / unlock / reset) run without crypto or a mounted
// ConfirmDialog.
const h = vi.hoisted(() => ({
  submitCreate: vi.fn(async () => {}),
  submitUnlock: vi.fn(async () => true),
  resetVault: vi.fn(async () => {}),
  hasVaultMeta: vi.fn(async () => true),
}))
vi.mock('@/stores/central', () => ({
  useCentralStore: () => ({ ...h, isUnlocked: false }),
}))
vi.mock('primevue/useconfirm', () => ({
  useConfirm: () => ({ require: (opts: { accept?: () => void }) => opts.accept?.() }),
}))

const settle = async (): Promise<void> => {
  for (let i = 0; i < 4; i++) {
    await flushPromises()
    await nextTick()
  }
}

const mount = async (): Promise<VueWrapper> => {
  const wrapper = mountWith(freshPinia(), DrawerUnlock, { global: { stubs: { teleport: true } } })
  await settle() // let onMounted resolve the face from hasVaultMeta
  return wrapper
}

const findId = (wrapper: VueWrapper, id: string) => wrapper.find(`[data-testid="${id}"]`)
const setInput = async (wrapper: VueWrapper, id: string, value: string): Promise<void> => {
  await findId(wrapper, id).setValue(value)
}

beforeEach(() => {
  h.submitCreate.mockClear()
  h.submitUnlock.mockClear().mockResolvedValue(true)
  h.resetVault.mockClear()
  h.hasVaultMeta.mockClear().mockResolvedValue(true)
})

describe('DrawerUnlock', () => {
  it('unlocks an existing vault with the entered passphrase', async () => {
    const wrapper = await mount()

    expect(findId(wrapper, 'central-unlock-confirm').exists()).toBe(false) // unlock face: no confirm
    await setInput(wrapper, 'central-unlock-passphrase', 'correct horse')
    await findId(wrapper, 'central-unlock-submit').trigger('click')
    await settle()

    expect(h.submitUnlock).toHaveBeenCalledWith('correct horse')
  })

  it('surfaces the wrong-passphrase message when unlock is rejected', async () => {
    h.submitUnlock.mockResolvedValue(false)
    const wrapper = await mount()

    await setInput(wrapper, 'central-unlock-passphrase', 'nope')
    await findId(wrapper, 'central-unlock-submit').trigger('click')
    await settle()

    expect(findId(wrapper, 'central-unlock-error').text()).toContain('passphrase')
    expect(h.submitUnlock).toHaveBeenCalled()
  })

  it('creates a vault when none exists, requiring a confirmed passphrase', async () => {
    h.hasVaultMeta.mockResolvedValue(false)
    const wrapper = await mount()

    expect(findId(wrapper, 'central-unlock-confirm').exists()).toBe(true) // create face: confirm shown
    await setInput(wrapper, 'central-unlock-passphrase', 'short')
    await setInput(wrapper, 'central-unlock-confirm', 'short')
    await findId(wrapper, 'central-unlock-submit').trigger('click')
    await settle()
    // Too short (<8): rejected before any store call, error shown.
    expect(h.submitCreate).not.toHaveBeenCalled()
    expect(findId(wrapper, 'central-unlock-error').exists()).toBe(true)

    await setInput(wrapper, 'central-unlock-passphrase', 'longenough')
    await setInput(wrapper, 'central-unlock-confirm', 'longenough')
    await findId(wrapper, 'central-unlock-submit').trigger('click')
    await settle()
    expect(h.submitCreate).toHaveBeenCalledWith('longenough')
  })

  it('resets the vault from the forgotten-passphrase path', async () => {
    const wrapper = await mount()

    await findId(wrapper, 'central-unlock-forgot').trigger('click')
    await settle() // confirm auto-accepts → reset face
    await setInput(wrapper, 'central-unlock-passphrase', 'brand-new-pass')
    await setInput(wrapper, 'central-unlock-confirm', 'brand-new-pass')
    await findId(wrapper, 'central-unlock-submit').trigger('click')
    await settle()

    expect(h.resetVault).toHaveBeenCalledWith('brand-new-pass')
  })
})
