import type { VueWrapper } from '@vue/test-utils'
import JSZip from 'jszip'
import ConfirmationService from 'primevue/confirmationservice'
import ToastService from 'primevue/toastservice'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, nextTick } from 'vue'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'

import { vault } from '@/core/central/vault'
import { newDocument } from '@/core/model/factory'
import { i18n, type MessageSchema } from '@/i18n'
import { setLocale } from '@/i18n/setLocale'
import { db } from '@/persistence/db'
import * as formsRepo from '@/persistence/forms-repo'
import { useCentralStore } from '@/stores/central'
import SettingsView from '@/views/SettingsView.vue'

import { freshPinia, mountWith } from './helpers'

// Spy on the browser download seam so the export flow runs for real
// (gatherArchiveForms + buildWorkspaceArchive) up to the final anchor click.
const downloadBlob = vi.hoisted(() => vi.fn())
vi.mock('@/composables/useDownload', () => ({ downloadBlob }))

// Drive the durable-storage probe so each of the three About-line branches is
// exercised: set storageGrant.value before mounting, then await the exact line.
const storageGrant = vi.hoisted(() => ({ value: null as boolean | null }))
vi.mock('@/pwa/persistentStorage', () => ({
  isStoragePersistent: () => Promise.resolve(storageGrant.value),
  requestPersistentStorage: () => Promise.resolve(false),
  resetPersistentStorageRequest: () => {},
}))

const Empty = defineComponent({ template: '<div />' })

const makeRouter = (): Router =>
  createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'library', component: Empty },
      { path: '/settings', name: 'settings', component: Empty },
    ],
  })

const mountView = (router: Router): VueWrapper =>
  mountWith(freshPinia(), SettingsView, {
    global: {
      stubs: { teleport: true },
      // SettingsView now embeds CentralServersSection, which uses useConfirm();
      // the app registers ConfirmationService globally in main.ts.
      plugins: [router, ToastService, ConfirmationService],
    },
  })

const findTestId = (wrapper: VueWrapper, id: string) => wrapper.find(`[data-testid="${id}"]`)

const findCredentialCheckbox = (wrapper: VueWrapper) =>
  wrapper.findAllComponents({ name: 'Checkbox' })
    .find((c) => c.attributes('data-testid') === 'settings-include-credentials')

beforeEach(async () => {
  localStorage.clear()
  downloadBlob.mockClear()
  storageGrant.value = null
  vault.lock() // reset the module-singleton key between tests
  await Promise.all([
    db.forms.clear(),
    db.centralServers.clear(),
    db.centralVault.clear(),
    db.publishTargets.clear(),
  ])
})

afterEach(() => {
  // A language test may have switched the shared i18n instance away from en.
  setLocale('en')
})

describe('SettingsView', () => {
  it('renders the workspace, language and about sections', async () => {
    const wrapper = mountView(makeRouter())

    expect(findTestId(wrapper, 'settings-view').exists()).toBe(true)
    expect(findTestId(wrapper, 'settings-export-workspace').text()).toContain('Export workspace')
    expect(findTestId(wrapper, 'settings-import-workspace').text()).toContain('Import workspace')
    expect(findTestId(wrapper, 'settings-language-select').exists()).toBe(true)
    expect(findTestId(wrapper, 'settings-about').exists()).toBe(true)
    expect(findTestId(wrapper, 'settings-about-version').text())
      .toMatch(/^Form Forge for ODK v\d+\.\d+\.\d+/)
    // isStoragePersistent() resolves async; all three outcomes render a line.
    await vi.waitUntil(() => findTestId(wrapper, 'settings-about-storage').text().startsWith('Storage:'))
  })

  it('disables workspace export while the library is empty', () => {
    const wrapper = mountView(makeRouter())
    expect(findTestId(wrapper, 'settings-export-workspace').attributes('disabled')).toBeDefined()
  })

  it('routes back to the library', async () => {
    const router = makeRouter()
    await router.push({ name: 'settings' })
    const wrapper = mountView(router)

    await findTestId(wrapper, 'settings-back').trigger('click')
    await vi.waitUntil(() => router.currentRoute.value.name === 'library')
    expect(router.currentRoute.value.name).toBe('library')
  })

  it('exports the whole workspace as a dated .formforge.zip', async () => {
    await formsRepo.createForm(newDocument('Water Survey'))
    const wrapper = mountView(makeRouter())

    const exportButton = () => findTestId(wrapper, 'settings-export-workspace')
    await vi.waitUntil(() => exportButton().attributes('disabled') === undefined)
    await exportButton().trigger('click')

    await vi.waitUntil(() => downloadBlob.mock.calls.length > 0)
    expect(downloadBlob).toHaveBeenCalledWith(
      expect.anything(),
      expect.stringMatching(/^formforge-workspace-\d{4}-\d{2}-\d{2}\.formforge\.zip$/),
      'application/zip'
    )
  })

  it('disables the credential opt-in while the vault is locked, offering an unlock action', () => {
    const wrapper = mountView(makeRouter())
    const checkbox = findCredentialCheckbox(wrapper)
    expect(checkbox, 'settings-include-credentials').toBeDefined()
    expect(checkbox!.props('disabled')).toBe(true)
    expect(findTestId(wrapper, 'settings-credential-warning').exists()).toBe(false)
    expect(wrapper.text()).toContain('Unlock the credential vault')
    // A direct unlock affordance so the opt-in is reachable from this page.
    expect(findTestId(wrapper, 'settings-unlock-vault').exists()).toBe(true)
  })

  it('opens the unlock prompt from the credential opt-in unlock button', async () => {
    const wrapper = mountView(makeRouter())
    const central = useCentralStore()
    expect(central.unlockPromptOpen).toBe(false)
    await findTestId(wrapper, 'settings-unlock-vault').trigger('click')
    await vi.waitUntil(() => central.unlockPromptOpen)
    expect(central.unlockPromptOpen).toBe(true)
  })

  it('exports a v2 backup with the vault when credentials are opted in', async () => {
    await formsRepo.createForm(newDocument('Water Survey'))
    const wrapper = mountView(makeRouter())

    // Unlock the vault, then tick the opt-in box and confirm the warning shows.
    const central = useCentralStore()
    await central.submitCreate('passphrase-123')
    await nextTick()
    const checkbox = findCredentialCheckbox(wrapper)!
    expect(checkbox.props('disabled')).toBe(false)
    // Unlock affordance gone once the vault is unlocked.
    expect(findTestId(wrapper, 'settings-unlock-vault').exists()).toBe(false)
    checkbox.vm.$emit('update:modelValue', true)
    await nextTick()
    expect(findTestId(wrapper, 'settings-credential-warning').exists()).toBe(true)

    const exportButton = () => findTestId(wrapper, 'settings-export-workspace')
    await vi.waitUntil(() => exportButton().attributes('disabled') === undefined)
    await exportButton().trigger('click')
    await vi.waitUntil(() => downloadBlob.mock.calls.length > 0)

    const bytes = downloadBlob.mock.calls[0][0] as Uint8Array
    const zip = await JSZip.loadAsync(bytes)
    expect(Object.keys(zip.files)).toContain('central/vault.json')
  })

  it('renders the persistent storage line when the grant is held', async () => {
    storageGrant.value = true
    const wrapper = mountView(makeRouter())
    const line = () => findTestId(wrapper, 'settings-about-storage')
    // Initial render shows the unknown line until the async probe resolves.
    await vi.waitUntil(() => line().text().startsWith('Storage: persistent —'))
    expect(line().text())
      .toBe('Storage: persistent — the browser will not clear your forms under storage pressure.')
  })

  it('renders the best-effort storage line when the grant is absent', async () => {
    storageGrant.value = false
    const wrapper = mountView(makeRouter())
    const line = () => findTestId(wrapper, 'settings-about-storage')
    await vi.waitUntil(() => line().text().startsWith('Storage: best effort'))
    expect(line().text())
      .toBe('Storage: best effort — the browser may clear data under storage pressure. Export a workspace backup to be safe.')
  })

  it('renders the unavailable storage line when the API is absent', async () => {
    storageGrant.value = null
    const wrapper = mountView(makeRouter())
    const line = () => findTestId(wrapper, 'settings-about-storage')
    await vi.waitUntil(() => line().text() !== '')
    expect(line().text())
      .toBe('Storage: persistence status is unavailable in this browser.')
  })

  it('opens the workspace archive import dialog', async () => {
    const wrapper = mountView(makeRouter())
    expect(findTestId(wrapper, 'workspace-archive-dialog').exists()).toBe(false)

    await findTestId(wrapper, 'settings-import-workspace').trigger('click')
    // PrimeVue Dialog renders its content a tick after becoming visible.
    await vi.waitUntil(() => findTestId(wrapper, 'workspace-archive-dialog').exists())
  })

  it('switches the UI language via setLocale and persists it to ui.locale', async () => {
    // Deliberately partial test catalog: fallbackLocale covers missing keys,
    // hence the cast past the full-schema requirement (see workspace-export.spec).
    i18n.global.setLocaleMessage('eo', {
      appSettings: { title: 'Agordoj' },
    } as unknown as MessageSchema)

    const wrapper = mountView(makeRouter())
    const select = wrapper
      .findAllComponents({ name: 'Select' })
      .find((c) => c.attributes('data-testid') === 'settings-language-select')
    expect(select, 'settings-language-select').toBeDefined()

    // The registered catalog appears as a second option, labeled by its code
    // (no SUPPORTED_LOCALES entry for a test catalog).
    expect(select!.props('options')).toEqual([
      { code: 'en', label: 'English' },
      { code: 'eo', label: 'eo' },
    ])

    select!.vm.$emit('update:modelValue', 'eo')
    await nextTick()

    // setLocale ran: the shared i18n instance switched, <html lang> follows,
    // and the page re-rendered in the new catalog.
    expect(i18n.global.locale.value).toBe('eo')
    expect(document.documentElement.lang).toBe('eo')
    expect(wrapper.find('.settings-heading').text()).toBe('Agordoj')

    // …and the preference persisted through the ui store watcher.
    await nextTick()
    const persisted: unknown = JSON.parse(localStorage.getItem('odk-builder:ui:v1') ?? '{}')
    expect((persisted as { locale?: string }).locale).toBe('eo')
  })
})
