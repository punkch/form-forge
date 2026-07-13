import { flushPromises, type VueWrapper } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import PublishDialog from '@/components/central/PublishDialog.vue'
import { CentralError } from '@/core/central/types'
import { newDocument } from '@/core/model/factory'
import type { PublishTargetRecord } from '@/persistence/db'
import { useEditorStore } from '@/stores/editor'
import { useFormStore } from '@/stores/form'

import { freshPinia, mountWith } from './helpers'

// --- Mocked seams -----------------------------------------------------------
// The whole Central store (including its `publishForm` action, which keeps the
// token + transport client behind its private closure) and the attachments repo
// are stubbed so the dialog's orchestration — pre-fill, one-click re-deploy,
// rename warning, and the 409 recoveries (update-existing + version bump) — is
// exercised without any network.
const h = vi.hoisted(() => ({
  publishForm: vi.fn(),
  listTargetsForForm: vi.fn(),
  upsertTarget: vi.fn(),
  listProjects: vi.fn(),
  listForms: vi.fn(),
  listAttachments: vi.fn(),
  servers: [{ id: 'srv1', name: 'Field Central', baseUrl: 'https://c.example.org' }],
}))

vi.mock('@/persistence/attachments-repo', () => ({ listAttachments: h.listAttachments }))
vi.mock('@/stores/central', () => ({
  useCentralStore: () => ({
    servers: h.servers,
    hasServers: true,
    isConnected: () => true,
    connectionState: () => ({ status: 'connected', email: 'field@example.org' }),
    listTargetsForForm: h.listTargetsForForm,
    upsertTarget: h.upsertTarget,
    publishForm: h.publishForm,
    listProjects: h.listProjects,
    listForms: h.listForms,
  }),
}))

const target = (over: Partial<PublishTargetRecord> = {}): PublishTargetRecord => ({
  id: 't1',
  formRecordId: 'rec1',
  serverId: 'srv1',
  projectId: 1,
  xmlFormId: 'water_survey',
  lastPublishedVersion: 'v1',
  lastPublishedAt: 1000,
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

  h.listTargetsForForm.mockResolvedValue(targets)
  h.upsertTarget.mockResolvedValue({})
  h.listProjects.mockResolvedValue([{ id: 1, name: 'Field project', verbs: ['form.update'] }])
  h.listForms.mockResolvedValue([])
  h.listAttachments.mockResolvedValue([])

  const wrapper = mountWith(pinia, PublishDialog, { global: { stubs: { teleport: true } } })
  editor.activeDialog = 'publish'
  await vi.waitUntil(() => wrapper.find('[data-testid="publish-dialog"]').exists())
  await settle()
  return { wrapper, form, editor }
}

const selectByTestId = (wrapper: VueWrapper, testid: string) =>
  wrapper.findAllComponents({ name: 'Select' })
    .find((s) => s.attributes('data-testid') === testid)

beforeEach(() => {
  h.publishForm.mockReset()
  h.listTargetsForForm.mockReset()
  h.upsertTarget.mockReset()
  h.listProjects.mockReset()
  h.listForms.mockReset()
  h.listAttachments.mockReset()
})

describe('PublishDialog', () => {
  it('pre-fills the most recent publish target on open', async () => {
    const { wrapper } = await openWith([target()])

    expect(wrapper.find('[data-testid="publish-target-t1"]').exists()).toBe(true)
    expect(selectByTestId(wrapper, 'central-server-select')?.props('modelValue')).toBe('srv1')
    expect(selectByTestId(wrapper, 'central-project-select')?.props('modelValue')).toBe(1)
  })

  it('one-click re-deploys to a remembered target', async () => {
    h.publishForm.mockResolvedValue({
      xmlFormId: 'water_survey', mode: 'update', attachmentsUploaded: 0, warnings: [],
    })
    const { wrapper } = await openWith([target()])

    await wrapper.find('[data-testid="publish-redeploy-t1"]').trigger('click')
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
    }))
  })

  it('warns when the form id was renamed since the last publish', async () => {
    const { wrapper } = await openWith([target({ xmlFormId: 'old_water_id' })])

    expect(wrapper.find('[data-testid="publish-rename-warning"]').exists()).toBe(true)
  })

  it('does not warn when the form id still matches the target', async () => {
    const { wrapper } = await openWith([target()])

    expect(wrapper.find('[data-testid="publish-rename-warning"]').exists()).toBe(false)
  })

  it('offers to update the existing form on a 409.3 conflict, then retries in update mode', async () => {
    h.publishForm
      .mockRejectedValueOnce(new CentralError('exists', { kind: 'conflict', code: '409.3', status: 409 }))
      .mockResolvedValueOnce({ xmlFormId: 'water_survey', mode: 'update', attachmentsUploaded: 0, warnings: [] })

    // A rename mismatch (target id differs from the form's current id) forces
    // create mode, so the first publish attempts a create and 409.3s.
    const { wrapper } = await openWith([target({ xmlFormId: 'old_water_id' })])

    await wrapper.find('[data-testid="publish-submit"]').trigger('click')
    await settle()
    // A create-mode collision offers BOTH recoveries.
    expect(wrapper.find('[data-testid="publish-update-instead"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="publish-bump-version"]').exists()).toBe(true)

    await wrapper.find('[data-testid="publish-update-instead"]').trigger('click')
    await settle()

    expect(h.publishForm).toHaveBeenCalledTimes(2)
    // The retry updates the existing form (its current id) rather than re-creating.
    expect(h.publishForm).toHaveBeenLastCalledWith('srv1', 1, expect.objectContaining({
      xmlFormId: 'water_survey',
      mode: 'update',
    }))
    expect(wrapper.find('[data-testid="publish-result"]').exists()).toBe(true)
  })

  it('offers only the version bump on an update-mode conflict, then retries with a fresh version', async () => {
    h.publishForm
      .mockRejectedValueOnce(new CentralError('version in use', { kind: 'conflict', code: '409.x', status: 409 }))
      .mockResolvedValueOnce({ xmlFormId: 'water_survey', mode: 'update', attachmentsUploaded: 0, warnings: [] })

    // A matching target id (no rename) defaults the dialog to update mode.
    const { wrapper, form } = await openWith([target()])

    await wrapper.find('[data-testid="publish-submit"]').trigger('click')
    await settle()
    // A version clash on an update offers only the bump — never "update instead".
    expect(wrapper.find('[data-testid="publish-bump-version"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="publish-update-instead"]').exists()).toBe(false)

    await wrapper.find('[data-testid="publish-bump-version"]').trigger('click')
    await settle()

    // The bump stamps a fresh, distinct version onto the live doc before retrying.
    expect(form.doc?.settings.version).not.toBe('v1')
    expect(h.publishForm).toHaveBeenCalledTimes(2)
    expect(h.publishForm).toHaveBeenLastCalledWith('srv1', 1, expect.objectContaining({ mode: 'update' }))
    expect(wrapper.find('[data-testid="publish-result"]').exists()).toBe(true)
  })

  it('renders Central warnings on a published-with-warnings result', async () => {
    h.publishForm.mockResolvedValue({
      xmlFormId: 'water_survey',
      mode: 'update',
      attachmentsUploaded: 0,
      warnings: ['unused choice list', 'label too long'],
    })
    const { wrapper } = await openWith([target()])

    await wrapper.find('[data-testid="publish-redeploy-t1"]').trigger('click')
    await settle()

    const warnings = wrapper.find('[data-testid="publish-warnings"]')
    expect(warnings.exists()).toBe(true)
    expect(warnings.text()).toContain('unused choice list')
    expect(warnings.text()).toContain('label too long')
  })

  it('shows the mapped error copy when publishing fails with a non-conflict error', async () => {
    h.publishForm.mockRejectedValue(new CentralError('nope', { kind: 'auth', status: 401 }))
    const { wrapper } = await openWith([target()])

    await wrapper.find('[data-testid="publish-submit"]').trigger('click')
    await settle()

    const error = wrapper.find('[data-testid="publish-error"]')
    expect(error.exists()).toBe(true)
    expect(error.text()).toContain('Sign-in failed')
    // A non-conflict failure never surfaces the conflict recovery prompt.
    expect(wrapper.find('[data-testid="publish-conflict"]').exists()).toBe(false)
  })
})
