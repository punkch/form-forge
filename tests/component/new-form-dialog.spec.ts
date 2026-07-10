import type { VueWrapper } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import NewFormDialog from '@/components/library/NewFormDialog.vue'
import { createNode, newDocument } from '@/core/model/factory'
import { insertNode } from '@/core/model/ops'
import { DEFAULT_LANG } from '@/core/model/types'
import { db, type TemplateRecord } from '@/persistence/db'
import * as templatesRepo from '@/persistence/templates-repo'
import { useWorkspaceStore } from '@/stores/workspace'
import { bundledTemplates } from '@/templates'

import { freshPinia, mountWith } from './helpers'

const mountDialog = (pinia = freshPinia()): VueWrapper =>
  mountWith(pinia, NewFormDialog, {
    props: { visible: true },
    global: { stubs: { teleport: true } },
  })

const findTestId = (wrapper: VueWrapper, id: string) => wrapper.find(`[data-testid="${id}"]`)

const waitForTestId = async (wrapper: VueWrapper, id: string): Promise<void> => {
  // PrimeVue Dialog renders its content a tick after mount.
  await vi.waitUntil(() => findTestId(wrapper, id).exists())
}

beforeEach(async () => {
  await db.forms.clear()
  await db.templates.clear()
})

describe('NewFormDialog', () => {
  it('renders the blank card plus bundled and local templates', async () => {
    await templatesRepo.addTemplate(newDocument('My saved form'), 'My local template', 'Kept in this browser')

    const wrapper = mountDialog()
    await waitForTestId(wrapper, 'new-form-blank')

    for (const template of bundledTemplates) {
      expect(findTestId(wrapper, `new-form-template-${template.id}`).exists()).toBe(true)
    }
    expect(findTestId(wrapper, 'new-form-template-household-survey').text()).toContain('Household survey')
    expect(findTestId(wrapper, 'new-form-template-household-survey').text()).toContain('13 questions')

    await vi.waitUntil(() => findTestId(wrapper, 'new-form-local-template').exists())
    const local = findTestId(wrapper, 'new-form-local-template')
    expect(local.text()).toContain('My local template')
    expect(local.text()).toContain('Local')
  })

  it('shows the create hint only while the title is empty', async () => {
    const wrapper = mountDialog()
    await waitForTestId(wrapper, 'new-form-create-hint')
    expect(findTestId(wrapper, 'new-form-create-hint').text()).toContain('title')

    // Typing a title hides the hint on the gallery step.
    await findTestId(wrapper, 'new-form-title').setValue('Named Survey')
    expect(findTestId(wrapper, 'new-form-create-hint').exists()).toBe(false)
    await findTestId(wrapper, 'new-form-title').setValue('   ')
    expect(findTestId(wrapper, 'new-form-create-hint').exists()).toBe(true)

    // Picking a template prefills the title, so no hint on the title step —
    // until the user clears the prefilled value again.
    await findTestId(wrapper, 'new-form-template-household-survey').trigger('click')
    expect(findTestId(wrapper, 'new-form-back').exists()).toBe(true)
    expect(findTestId(wrapper, 'new-form-create-hint').exists()).toBe(false)
    await findTestId(wrapper, 'new-form-title').setValue('')
    expect(findTestId(wrapper, 'new-form-create-hint').exists()).toBe(true)
  })

  it('creates a blank form without leaving the first step', async () => {
    const pinia = freshPinia()
    const workspace = useWorkspaceStore(pinia)
    const spy = vi.spyOn(workspace, 'createForm')

    const wrapper = mountDialog(pinia)
    await waitForTestId(wrapper, 'new-form-title')

    await findTestId(wrapper, 'new-form-title').setValue('Plain Survey')
    await findTestId(wrapper, 'new-form-create').trigger('click')

    await vi.waitUntil(() => wrapper.emitted('created') !== undefined)
    expect(spy).toHaveBeenCalledWith('Plain Survey')
    const [record] = wrapper.emitted('created')![0] as [{ title: string }]
    expect(record.title).toBe('Plain Survey')
    expect(await db.forms.count()).toBe(1)
  })

  it('creates from a bundled template via createFormFromTemplate', async () => {
    const pinia = freshPinia()
    const workspace = useWorkspaceStore(pinia)
    const spy = vi.spyOn(workspace, 'createFormFromTemplate')

    const wrapper = mountDialog(pinia)
    await waitForTestId(wrapper, 'new-form-template-household-survey')

    await findTestId(wrapper, 'new-form-template-household-survey').trigger('click')
    // Step 2: prefilled title + back affordance.
    expect(findTestId(wrapper, 'new-form-back').exists()).toBe(true)
    const input = findTestId(wrapper, 'new-form-title').element as HTMLInputElement
    expect(input.value).toBe('Household survey')

    await findTestId(wrapper, 'new-form-title').setValue('Village Census')
    await findTestId(wrapper, 'new-form-create').trigger('click')

    await vi.waitUntil(() => wrapper.emitted('created') !== undefined)
    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy.mock.calls[0][1]).toBe('Village Census')

    const records = await db.forms.toArray()
    expect(records).toHaveLength(1)
    expect(records[0].title).toBe('Village Census')
    expect(records[0].formId).toBe('village_census')
    expect(records[0].questionCount).toBe(13)
  })

  it('creates from a local template and can delete one', async () => {
    const doc = newDocument('Source')
    const q = createNode(doc, 'text')
    q.label = { [DEFAULT_LANG]: 'Only question' }
    insertNode(doc, q, null)
    const saved = await templatesRepo.addTemplate(doc, 'Local one', '')

    const pinia = freshPinia()
    const workspace = useWorkspaceStore(pinia)
    const spy = vi.spyOn(workspace, 'createFormFromTemplate')

    const wrapper = mountDialog(pinia)
    await waitForTestId(wrapper, 'new-form-local-template')

    await findTestId(wrapper, 'new-form-local-template').find('[data-testid="new-form-local-open"]').trigger('click')
    const input = findTestId(wrapper, 'new-form-title').element as HTMLInputElement
    expect(input.value).toBe('Local one')
    await findTestId(wrapper, 'new-form-create').trigger('click')

    await vi.waitUntil(() => wrapper.emitted('created') !== undefined)
    expect(spy).toHaveBeenCalledTimes(1)
    const records = await db.forms.toArray()
    expect(records[0].questionCount).toBe(1)

    // Delete the local template from a fresh dialog.
    const wrapper2 = mountDialog(pinia)
    await waitForTestId(wrapper2, 'new-form-local-delete')
    await findTestId(wrapper2, 'new-form-local-delete').trigger('click')
    await vi.waitUntil(async () => (await db.templates.count()) === 0)
    expect(await db.templates.get(saved.id)).toBeUndefined()
    await vi.waitUntil(() => !findTestId(wrapper2, 'new-form-local-template').exists())
  })

  it('rejects a local template whose stored doc fails migration', async () => {
    // A local record whose doc bypasses migrateDoc (unsupported schema version)
    // must not reach the editor — the create path guards it like the bundled one.
    const now = Date.now()
    await db.templates.add({
      id: 'bad-1',
      title: 'Corrupt local',
      description: '',
      questionCount: 0,
      preview: [],
      createdAt: now,
      updatedAt: now,
      doc: { schemaVersion: 999 },
    } as unknown as TemplateRecord)

    const pinia = freshPinia()
    const workspace = useWorkspaceStore(pinia)
    const spy = vi.spyOn(workspace, 'createFormFromTemplate')

    const wrapper = mountDialog(pinia)
    await waitForTestId(wrapper, 'new-form-local-template')
    await findTestId(wrapper, 'new-form-local-template').find('[data-testid="new-form-local-open"]').trigger('click')
    await findTestId(wrapper, 'new-form-create').trigger('click')

    await vi.waitUntil(() => findTestId(wrapper, 'new-form-error').exists())
    expect(spy).not.toHaveBeenCalled()
    expect(await db.forms.count()).toBe(0)
  })

  it('surfaces an error when form creation fails', async () => {
    const pinia = freshPinia()
    const workspace = useWorkspaceStore(pinia)
    vi.spyOn(workspace, 'createFormFromTemplate').mockRejectedValue(new Error('boom'))

    const wrapper = mountDialog(pinia)
    await waitForTestId(wrapper, 'new-form-template-household-survey')
    await findTestId(wrapper, 'new-form-template-household-survey').trigger('click')
    await findTestId(wrapper, 'new-form-title').setValue('Village Census')
    await findTestId(wrapper, 'new-form-create').trigger('click')

    await vi.waitUntil(() => findTestId(wrapper, 'new-form-error').exists())
    expect(findTestId(wrapper, 'new-form-error').text()).toContain('could not be loaded')
    expect(wrapper.emitted('created')).toBeUndefined()
    expect(await db.forms.count()).toBe(0)
  })
})
