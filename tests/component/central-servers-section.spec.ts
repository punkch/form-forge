import { type VueWrapper } from '@vue/test-utils'
import ConfirmationService from 'primevue/confirmationservice'
import ConfirmDialog from 'primevue/confirmdialog'
import ToastService from 'primevue/toastservice'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, nextTick } from 'vue'

import CentralServersSection from '@/components/central/CentralServersSection.vue'
import { vault } from '@/core/central/vault'
import { db } from '@/persistence/db'
import { useCentralStore } from '@/stores/central'

import { freshPinia, mountWith } from './helpers'

// Host the section beside a ConfirmDialog so the remove danger-confirm renders
// and its accept button is clickable (the app mounts ConfirmDialog globally).
const Host = defineComponent({
  components: { CentralServersSection, ConfirmDialog },
  template: '<div><CentralServersSection /><ConfirmDialog /></div>',
})

const mountHost = (): VueWrapper =>
  mountWith(freshPinia(), Host, {
    global: {
      stubs: { teleport: true },
      plugins: [ToastService, ConfirmationService],
    },
  })

const findTestId = (wrapper: VueWrapper, id: string) => wrapper.find(`[data-testid="${id}"]`)

beforeEach(async () => {
  // The vault key is a module-closure singleton that survives across specs in
  // the same worker — lock it so "save password" reliably opens the prompt.
  vault.lock()
  await Promise.all([db.centralServers.clear(), db.centralVault.clear(), db.publishTargets.clear()])
})

afterEach(() => {
  useCentralStore().stopWatching()
})

describe('CentralServersSection', () => {
  it('renders the section and the empty state', () => {
    const wrapper = mountHost()

    expect(findTestId(wrapper, 'settings-central').exists()).toBe(true)
    expect(findTestId(wrapper, 'settings-central').text()).toContain('ODK Central servers')
    expect(findTestId(wrapper, 'central-empty').exists()).toBe(true)
    expect(findTestId(wrapper, 'central-add-server').exists()).toBe(true)
  })

  it('adds a server and persists it', async () => {
    const wrapper = mountHost()
    const central = useCentralStore()

    await findTestId(wrapper, 'central-add-server').trigger('click')

    await vi.waitUntil(() => central.servers.length === 1)
    // A row for the persisted server renders, keyed by its record id.
    await vi.waitUntil(() => findTestId(wrapper, `central-server-row-${central.servers[0].id}`).exists())
    expect(findTestId(wrapper, 'central-empty').exists()).toBe(false)
  })

  it('commits an edited name and URL to the store', async () => {
    const wrapper = mountHost()
    const central = useCentralStore()

    await findTestId(wrapper, 'central-add-server').trigger('click')
    await vi.waitUntil(() => central.servers.length === 1)

    const nameInput = findTestId(wrapper, 'central-server-name')
    await nameInput.setValue('Field team Central')
    const urlInput = findTestId(wrapper, 'central-server-url')
    await urlInput.setValue('https://central.example.org')
    await urlInput.trigger('change')

    await vi.waitUntil(() => central.servers[0]?.baseUrl === 'https://central.example.org')
    expect(central.servers[0].name).toBe('Field team Central')
    expect(central.servers[0].baseUrl).toBe('https://central.example.org')
  })

  it('shows a validation message for a non-loopback http URL', async () => {
    const wrapper = mountHost()
    const central = useCentralStore()

    await findTestId(wrapper, 'central-add-server').trigger('click')
    await vi.waitUntil(() => central.servers.length === 1)

    await findTestId(wrapper, 'central-server-name').setValue('Test')
    const urlInput = findTestId(wrapper, 'central-server-url')
    await urlInput.setValue('http://central.example.org')
    await urlInput.trigger('change')
    await nextTick()

    const error = findTestId(wrapper, 'central-server-url-error')
    expect(error.exists()).toBe(true)
    expect(error.text()).toContain('https')
    // An invalid URL is not persisted.
    expect(central.servers[0].baseUrl).toBe('')
  })

  it('accepts plain http for loopback', async () => {
    const wrapper = mountHost()
    const central = useCentralStore()

    await findTestId(wrapper, 'central-add-server').trigger('click')
    await vi.waitUntil(() => central.servers.length === 1)

    await findTestId(wrapper, 'central-server-name').setValue('Local')
    const urlInput = findTestId(wrapper, 'central-server-url')
    await urlInput.setValue('http://localhost:8383')
    await urlInput.trigger('change')

    await vi.waitUntil(() => central.servers[0]?.baseUrl === 'http://localhost:8383')
    expect(findTestId(wrapper, 'central-server-url-error').exists()).toBe(false)
  })

  it('save password opens the vault unlock prompt', async () => {
    const wrapper = mountHost()
    const central = useCentralStore()

    await findTestId(wrapper, 'central-add-server').trigger('click')
    await vi.waitUntil(() => central.servers.length === 1)

    await findTestId(wrapper, 'central-server-password').setValue('s3cret')
    await findTestId(wrapper, 'central-server-save-password').trigger('click')

    await vi.waitUntil(() => central.unlockPromptOpen === true)
    expect(central.unlockPromptOpen).toBe(true)
  })

  it('flags a missing password before opening the prompt', async () => {
    const wrapper = mountHost()
    const central = useCentralStore()

    await findTestId(wrapper, 'central-add-server').trigger('click')
    await vi.waitUntil(() => central.servers.length === 1)

    await findTestId(wrapper, 'central-server-save-password').trigger('click')
    await nextTick()

    expect(findTestId(wrapper, 'central-server-password-error').exists()).toBe(true)
    expect(central.unlockPromptOpen).toBe(false)
  })

  it('confirms then removes a server', async () => {
    const wrapper = mountHost()
    const central = useCentralStore()

    await findTestId(wrapper, 'central-add-server').trigger('click')
    await vi.waitUntil(() => central.servers.length === 1)

    await findTestId(wrapper, 'central-server-remove').trigger('click')
    // The danger confirm renders in the hosted ConfirmDialog.
    await vi.waitUntil(() => findTestId(wrapper, 'central-server-remove-confirm').exists())
    await findTestId(wrapper, 'central-server-remove-confirm').trigger('click')

    await vi.waitUntil(() => central.servers.length === 0)
    expect(findTestId(wrapper, 'central-empty').exists()).toBe(true)
  })
})
