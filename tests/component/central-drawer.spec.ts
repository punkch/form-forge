import { flushPromises, type VueWrapper } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import CentralDrawer from '@/components/central/CentralDrawer.vue'
import { CentralError } from '@/core/central/types'
import { newDocument } from '@/core/model/factory'
import type { PublishTargetRecord } from '@/persistence/db'
import { useEditorStore } from '@/stores/editor'
import { useFormStore } from '@/stores/form'

import { freshPinia, mountWith } from './helpers'

// --- Mocked seams -----------------------------------------------------------
// The Central store (its `publishForm` keeps the token + client private), the
// attachments repo, and the content fingerprint are stubbed so the drawer's
// orchestration — list, one-click re-publish, 409 recoveries, warnings, error
// copy, check-server — is exercised without any network or WebCrypto.
const h = vi.hoisted(() => ({
  publishForm: vi.fn(),
  listTargetsForForm: vi.fn(),
  upsertTarget: vi.fn(),
  listProjects: vi.fn(),
  listForms: vi.fn(),
  listAttachments: vi.fn(),
  lockVault: vi.fn(),
  hasVaultMeta: vi.fn(async () => true),
  servers: [
    {
      id: 'srv1',
      name: 'Field Central',
      baseUrl: 'https://c.example.org',
      email: 'field@example.org',
      encryptedPassword: { iv: new Uint8Array(1), ciphertext: new Uint8Array(1) },
    },
    // A server with no saved password — drives the needs-password affordance.
    { id: 'srv2', name: 'Staging Central', baseUrl: 'https://s.example.org', email: 'staging@example.org' },
  ],
}))

vi.mock('@/persistence/attachments-repo', () => ({ listAttachments: h.listAttachments }))
vi.mock('@/core/central/fingerprint', () => ({ contentFingerprint: vi.fn(async () => 'hash-current') }))
vi.mock('@/stores/central', () => ({
  useCentralStore: () => ({
    servers: h.servers,
    hasServers: true,
    isUnlocked: true,
    isConnected: () => true,
    connectionState: () => ({ status: 'connected', email: 'field@example.org' }),
    listTargetsForForm: h.listTargetsForForm,
    upsertTarget: h.upsertTarget,
    publishForm: h.publishForm,
    listProjects: h.listProjects,
    listForms: h.listForms,
    lockVault: h.lockVault,
    hasVaultMeta: h.hasVaultMeta,
  }),
}))

// Stub the shared pickers so the new-destination flow can choose a
// server/project with a click (fixed ids), no PrimeVue Select interaction.
const pickerStub = vi.hoisted(() => (testid: string, value: unknown) => {
  const lit = typeof value === 'string' ? `'${value}'` : String(value)
  return {
    default: {
      emits: ['update:modelValue', 'error'],
      template: `<button data-testid="${testid}" @click="$emit('update:modelValue', ${lit})">pick</button>`,
    },
  }
})
vi.mock('@/components/central/CentralServerPicker.vue', () => pickerStub('stub-pick-server', 'srv1'))
vi.mock('@/components/central/CentralProjectPicker.vue', () => pickerStub('stub-pick-project', 1))
vi.mock('@/components/central/CentralFormPicker.vue', () => pickerStub('stub-pick-form', 'water_survey'))

const target = (over: Partial<PublishTargetRecord> = {}): PublishTargetRecord => ({
  id: 't1',
  formRecordId: 'rec1',
  serverId: 'srv1',
  projectId: 1,
  xmlFormId: 'water_survey',
  lastPublishedVersion: 'v1',
  lastPublishedAt: 1000,
  lastPublishedContentHash: 'hash-current',
  ...over,
})

const settle = async (): Promise<void> => {
  for (let i = 0; i < 4; i++) {
    await flushPromises()
    await nextTick()
  }
}

interface Opened {
  wrapper: VueWrapper
  form: ReturnType<typeof useFormStore>
  editor: ReturnType<typeof useEditorStore>
}

const openWith = async (targets: PublishTargetRecord[]): Promise<Opened> => {
  const pinia = freshPinia()
  const form = useFormStore()
  const editor = useEditorStore()

  form.recordId = 'rec1'
  const doc = newDocument('Water Survey') // formId => 'water_survey'
  doc.settings.version = 'v1'
  form.doc = doc
  editor.centralDrawerOpen = true

  h.listTargetsForForm.mockResolvedValue(targets)
  h.upsertTarget.mockResolvedValue({})
  h.listProjects.mockResolvedValue([{ id: 1, name: 'Field project', verbs: ['form.update'] }])
  h.listForms.mockResolvedValue([])
  h.listAttachments.mockResolvedValue([])

  const wrapper = mountWith(pinia, CentralDrawer, { global: { stubs: { teleport: true } } })
  await vi.waitUntil(() => wrapper.find('[data-testid="central-drawer"]').exists())
  await settle()
  return { wrapper, form, editor }
}

const findId = (wrapper: VueWrapper, id: string) => wrapper.find(`[data-testid="${id}"]`)

beforeEach(() => {
  h.publishForm.mockReset()
  h.listTargetsForForm.mockReset()
  h.upsertTarget.mockReset()
  h.listProjects.mockReset()
  h.listForms.mockReset()
  h.listAttachments.mockReset()
  h.lockVault.mockReset()
})

describe('CentralDrawer', () => {
  it('lists every remembered destination for the form', async () => {
    const { wrapper } = await openWith([target(), target({ id: 't2', serverId: 'srv1', projectId: 2 })])

    expect(findId(wrapper, 'central-destination-t1').exists()).toBe(true)
    expect(findId(wrapper, 'central-destination-t2').exists()).toBe(true)
  })

  it('shows the empty state when the form has no destinations', async () => {
    const { wrapper } = await openWith([])
    expect(findId(wrapper, 'central-no-destinations').exists()).toBe(true)
  })

  it('one-click re-publishes a destination as an update, stamping the content hash', async () => {
    h.publishForm.mockResolvedValue({
      xmlFormId: 'water_survey', mode: 'update', attachmentsUploaded: 0, warnings: [],
    })
    const { wrapper } = await openWith([target()])

    await findId(wrapper, 'central-republish-t1').trigger('click')
    await settle()

    expect(h.publishForm).toHaveBeenCalledTimes(1)
    expect(h.publishForm).toHaveBeenCalledWith('srv1', 1, expect.objectContaining({
      xmlFormId: 'water_survey',
      mode: 'update',
    }))
    expect(h.upsertTarget).toHaveBeenCalledWith(expect.objectContaining({
      formRecordId: 'rec1',
      serverId: 'srv1',
      projectId: 1,
      xmlFormId: 'water_survey',
      lastPublishedVersion: 'v1',
      lastPublishedContentHash: 'hash-current',
    }))
    expect(findId(wrapper, 'publish-result').exists()).toBe(true)
  })

  it('offers only the version bump on an update-mode conflict, then retries with a fresh version', async () => {
    h.publishForm
      .mockRejectedValueOnce(new CentralError('version in use', { kind: 'conflict', code: '409.x', status: 409 }))
      .mockResolvedValueOnce({ xmlFormId: 'water_survey', mode: 'update', attachmentsUploaded: 0, warnings: [] })
    const { wrapper, form } = await openWith([target()])

    await findId(wrapper, 'central-republish-t1').trigger('click')
    await settle()
    expect(findId(wrapper, 'publish-bump-version').exists()).toBe(true)
    expect(findId(wrapper, 'publish-update-instead').exists()).toBe(false)

    await findId(wrapper, 'publish-bump-version').trigger('click')
    await settle()

    expect(form.doc?.settings.version).not.toBe('v1')
    expect(h.publishForm).toHaveBeenCalledTimes(2)
    expect(h.publishForm).toHaveBeenLastCalledWith('srv1', 1, expect.objectContaining({ mode: 'update' }))
    expect(findId(wrapper, 'publish-result').exists()).toBe(true)
  })

  it('renders Central warnings on a published-with-warnings result', async () => {
    h.publishForm.mockResolvedValue({
      xmlFormId: 'water_survey',
      mode: 'update',
      attachmentsUploaded: 0,
      warnings: ['unused choice list', 'label too long'],
    })
    const { wrapper } = await openWith([target()])

    await findId(wrapper, 'central-republish-t1').trigger('click')
    await settle()

    const warnings = findId(wrapper, 'publish-warnings')
    expect(warnings.exists()).toBe(true)
    expect(warnings.text()).toContain('unused choice list')
    expect(warnings.text()).toContain('label too long')
  })

  it('shows the mapped error copy when publishing fails with a non-conflict error', async () => {
    h.publishForm.mockRejectedValue(new CentralError('nope', { kind: 'auth', status: 401 }))
    const { wrapper } = await openWith([target()])

    await findId(wrapper, 'central-republish-t1').trigger('click')
    await settle()

    const error = findId(wrapper, 'publish-error')
    expect(error.exists()).toBe(true)
    expect(error.text()).toContain('Sign-in failed')
    expect(findId(wrapper, 'publish-conflict').exists()).toBe(false)
  })

  it('offers update-instead and bump on a create-mode 409.3 from a new destination, then retries as update', async () => {
    h.publishForm
      .mockRejectedValueOnce(new CentralError('exists', { kind: 'conflict', code: '409.3', status: 409 }))
      .mockResolvedValueOnce({ xmlFormId: 'water_survey', mode: 'update', attachmentsUploaded: 0, warnings: [] })
    const { wrapper } = await openWith([])

    await findId(wrapper, 'central-new-destination-toggle').trigger('click')
    await settle()
    await findId(wrapper, 'stub-pick-server').trigger('click')
    await findId(wrapper, 'stub-pick-project').trigger('click')
    await nextTick()
    await findId(wrapper, 'central-new-publish').trigger('click')
    await settle()

    // A create-mode collision offers BOTH recoveries.
    expect(findId(wrapper, 'publish-update-instead').exists()).toBe(true)
    expect(findId(wrapper, 'publish-bump-version').exists()).toBe(true)

    await findId(wrapper, 'publish-update-instead').trigger('click')
    await settle()

    expect(h.publishForm).toHaveBeenCalledTimes(2)
    expect(h.publishForm).toHaveBeenNthCalledWith(1, 'srv1', 1, expect.objectContaining({ mode: 'create' }))
    expect(h.publishForm).toHaveBeenLastCalledWith('srv1', 1, expect.objectContaining({ mode: 'update' }))
    expect(findId(wrapper, 'publish-result').exists()).toBe(true)
  })

  it('checks a server and reports a version match without pulling XML', async () => {
    const { wrapper } = await openWith([target()])
    // Set after openWith, which primes listForms to [] for the initial load.
    h.listForms.mockResolvedValue([{ xmlFormId: 'water_survey', name: 'Water', version: 'v1', publishedAt: '2026-07-15T00:00:00Z' }])

    await findId(wrapper, 'central-check-t1').trigger('click')
    await settle()

    expect(h.listForms).toHaveBeenCalledWith('srv1', 1)
    expect(findId(wrapper, 'central-destination-t1').text()).toContain('Central matches what you last sent.')
  })

  it('shows a "Changed" chip and "Publish update" when local content drifted from the destination', async () => {
    const { wrapper } = await openWith([target({ lastPublishedContentHash: 'hash-old' })])

    const chip = findId(wrapper, 'central-freshness-t1')
    expect(chip.text()).toBe('Changed')
    expect(findId(wrapper, 'central-republish-t1').text()).toContain('Publish update')
  })

  it('shows the needs-password affordance and no publish action for a server without a saved password', async () => {
    const { wrapper } = await openWith([target({ id: 't2', serverId: 'srv2' })])

    const row = findId(wrapper, 'central-destination-t2')
    expect(row.text()).toContain('Needs password')
    expect(findId(wrapper, 'central-republish-t2').exists()).toBe(false)
  })

  it('reports "N versions differ" from Check server when Central holds a different version', async () => {
    const { wrapper } = await openWith([target()])
    h.listForms.mockResolvedValue([{ xmlFormId: 'water_survey', name: 'Water', version: 'v9', publishedAt: '2026-07-15T00:00:00Z' }])

    await findId(wrapper, 'central-check-t1').trigger('click')
    await settle()

    expect(findId(wrapper, 'central-destination-t1').text()).toContain('Central now has version v9')
  })

  it('reports a Check-server error when the metadata read fails', async () => {
    const { wrapper } = await openWith([target()])
    h.listForms.mockRejectedValue(new CentralError('down', { kind: 'network' }))

    await findId(wrapper, 'central-check-t1').trigger('click')
    await settle()

    expect(findId(wrapper, 'central-destination-t1').text()).toContain("Couldn't reach the server to check")
  })

  it('refreshes the destinations list after a 409-recovery publish (not just on reopen)', async () => {
    h.publishForm
      .mockRejectedValueOnce(new CentralError('version in use', { kind: 'conflict', code: '409.x', status: 409 }))
      .mockResolvedValueOnce({ xmlFormId: 'water_survey', mode: 'update', attachmentsUploaded: 0, warnings: [] })
    const { wrapper } = await openWith([target()])

    await findId(wrapper, 'central-republish-t1').trigger('click')
    await settle()
    const callsBeforeRecovery = h.listTargetsForForm.mock.calls.length

    await findId(wrapper, 'publish-bump-version').trigger('click')
    await settle()

    // The recovery path reloads targets — the regression was that it did not.
    expect(h.listTargetsForForm.mock.calls.length).toBeGreaterThan(callsBeforeRecovery)
  })

  it('disables every row while one publish is in flight (no concurrent publishes)', async () => {
    let release: (v: unknown) => void = () => {}
    h.publishForm.mockReturnValue(new Promise((resolve) => { release = resolve }))
    const { wrapper } = await openWith([target(), target({ id: 't2', serverId: 'srv1', projectId: 2 })])

    await findId(wrapper, 'central-republish-t1').trigger('click')
    await settle()

    // A second publish must not be startable on another row while t1 is running.
    expect(findId(wrapper, 'central-republish-t2').attributes('disabled')).toBeDefined()

    release({ xmlFormId: 'water_survey', mode: 'update', attachmentsUploaded: 0, warnings: [] })
    await settle()
    expect(findId(wrapper, 'central-republish-t2').attributes('disabled')).toBeUndefined()
  })

  it('locks the vault from the header control', async () => {
    const { wrapper } = await openWith([target()])
    await findId(wrapper, 'central-lock').trigger('click')
    expect(h.lockVault).toHaveBeenCalledTimes(1)
  })
})
