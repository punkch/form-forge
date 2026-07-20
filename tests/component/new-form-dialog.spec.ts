import type { VueWrapper } from '@vue/test-utils'
import Dialog from 'primevue/dialog'
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

// Mocked exactly like the toast recipe in workspace-archive-dialog.spec.ts —
// there is no existing recipe for driving PrimeVue's confirm in this suite.
// Defaults to auto-accepting (matching every existing delete flow in this
// file); the confirm-gating test below overrides this once to hold the
// accept callback back instead of invoking it immediately.
const confirmService = vi.hoisted(() => ({
  require: vi.fn((options: { accept?: () => void }) => { options.accept?.() }),
}))
vi.mock('primevue/useconfirm', () => ({ useConfirm: () => confirmService }))

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
  confirmService.require.mockClear()
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

  it('does not delete a saved template until the confirm is accepted', async () => {
    const saved = await templatesRepo.addTemplate(newDocument('Source'), 'Local one', '')

    let captured: { header: string, message: string, accept: () => void } | undefined
    confirmService.require.mockImplementationOnce((options) => {
      captured = options as typeof captured
    })

    const wrapper = mountDialog()
    await waitForTestId(wrapper, 'new-form-local-template')

    await findTestId(wrapper, 'new-form-local-delete').trigger('click')

    expect(confirmService.require).toHaveBeenCalledTimes(1)
    expect(captured?.header).toBe('Delete template')
    expect(captured?.message).toBe('Delete "Local one"? This cannot be undone.')

    // Not deleted yet: the confirm callback hasn't fired.
    expect(await db.templates.get(saved.id)).not.toBeUndefined()
    expect(findTestId(wrapper, 'new-form-local-template').exists()).toBe(true)

    captured?.accept()
    await vi.waitUntil(async () => (await db.templates.count()) === 0)
    expect(await db.templates.get(saved.id)).toBeUndefined()
    expect(findTestId(wrapper, 'new-form-local-template').exists()).toBe(false)
  })

  it('hides a starter template from the grid and lists it under hidden starters, then unhides it', async () => {
    const wrapper = mountDialog()
    await waitForTestId(wrapper, 'new-form-template-household-survey')

    await findTestId(wrapper, 'new-form-starter-hide-household-survey').trigger('click')

    expect(findTestId(wrapper, 'new-form-template-household-survey').exists()).toBe(false)
    const hidden = findTestId(wrapper, 'new-form-hidden-starters')
    expect(hidden.exists()).toBe(true)
    expect(hidden.text()).toContain('Hidden starters (1)')
    // Collapsed by default — the hidden starter is only listed once expanded,
    // so hiding actually declutters the gallery.
    expect(findTestId(wrapper, 'new-form-starter-unhide-household-survey').exists()).toBe(false)
    await findTestId(wrapper, 'new-form-hidden-starters-toggle').trigger('click')
    expect(hidden.text()).toContain('Household survey')

    await findTestId(wrapper, 'new-form-starter-unhide-household-survey').trigger('click')

    expect(findTestId(wrapper, 'new-form-hidden-starters').exists()).toBe(false)
    expect(findTestId(wrapper, 'new-form-template-household-survey').exists()).toBe(true)
  })

  it('restores every hidden starter via Restore all', async () => {
    const wrapper = mountDialog()
    await waitForTestId(wrapper, 'new-form-template-household-survey')

    await findTestId(wrapper, 'new-form-starter-hide-household-survey').trigger('click')
    await findTestId(wrapper, 'new-form-starter-hide-individual-registration').trigger('click')

    expect(findTestId(wrapper, 'new-form-hidden-starters').text()).toContain('Hidden starters (2)')

    await findTestId(wrapper, 'new-form-restore-starters').trigger('click')

    expect(findTestId(wrapper, 'new-form-hidden-starters').exists()).toBe(false)
    for (const template of bundledTemplates) {
      expect(findTestId(wrapper, `new-form-template-${template.id}`).exists()).toBe(true)
    }
  })

  it('renames a saved template and updates the card title', async () => {
    await templatesRepo.addTemplate(newDocument('Source'), 'Old name', 'Old description')

    const wrapper = mountDialog()
    await waitForTestId(wrapper, 'new-form-local-template')
    expect(findTestId(wrapper, 'new-form-local-template').text()).toContain('Old name')

    await findTestId(wrapper, 'new-form-local-rename').trigger('click')
    await waitForTestId(wrapper, 'template-edit-name')

    expect((findTestId(wrapper, 'template-edit-name').element as HTMLInputElement).value).toBe('Old name')

    await findTestId(wrapper, 'template-edit-name').setValue('New name')
    await findTestId(wrapper, 'template-edit-save').trigger('click')

    await vi.waitUntil(() => findTestId(wrapper, 'new-form-local-template').text().includes('New name'))
    expect(findTestId(wrapper, 'new-form-local-template').text()).not.toContain('Old name')
  })

  it('survives every starter being hidden, keeping Blank form and Restore all reachable', async () => {
    const wrapper = mountDialog()
    await waitForTestId(wrapper, 'new-form-template-household-survey')

    for (const template of bundledTemplates) {
      await findTestId(wrapper, `new-form-starter-hide-${template.id}`).trigger('click')
    }

    // Empty grid, but the blank card lives outside it and stays reachable.
    for (const template of bundledTemplates) {
      expect(findTestId(wrapper, `new-form-template-${template.id}`).exists()).toBe(false)
    }
    expect(findTestId(wrapper, 'new-form-blank').exists()).toBe(true)
    const hidden = findTestId(wrapper, 'new-form-hidden-starters')
    expect(hidden.text()).toContain(`Hidden starters (${bundledTemplates.length})`)

    await findTestId(wrapper, 'new-form-restore-starters').trigger('click')
    for (const template of bundledTemplates) {
      expect(findTestId(wrapper, `new-form-template-${template.id}`).exists()).toBe(true)
    }
  })

  it('will not save an edited template under a whitespace-only name', async () => {
    await templatesRepo.addTemplate(newDocument('Source'), 'Keep me', 'Keep this')

    const wrapper = mountDialog()
    await waitForTestId(wrapper, 'new-form-local-template')
    await findTestId(wrapper, 'new-form-local-rename').trigger('click')
    await waitForTestId(wrapper, 'template-edit-name')

    await findTestId(wrapper, 'template-edit-name').setValue('   ')
    const save = findTestId(wrapper, 'template-edit-save')
    expect((save.element as HTMLButtonElement).disabled).toBe(true)
    await save.trigger('click')

    // Nothing persisted, and the stored title is untouched.
    const [stored] = await db.templates.toArray()
    expect(stored.title).toBe('Keep me')
    expect(findTestId(wrapper, 'template-edit-name').exists()).toBe(true)
  })

  // Regression guard for a bug caught only in the browser: both this dialog and
  // a nested overlay see the same Escape keydown, so one Esc used to collapse
  // the gallery along with the overlay. Esc must back out ONE level.
  it('parks its own Esc handling while a nested overlay is open', async () => {
    await templatesRepo.addTemplate(newDocument('Source'), 'Saved', '')

    const wrapper = mountDialog()
    await waitForTestId(wrapper, 'new-form-local-template')
    const gallery = wrapper.findComponent(Dialog)
    expect(gallery.props('closeOnEscape')).toBe(true)

    await findTestId(wrapper, 'new-form-local-rename').trigger('click')
    await waitForTestId(wrapper, 'template-edit-name')
    expect(gallery.props('closeOnEscape')).toBe(false)

    // Closing the overlay hands Esc back to the gallery.
    await findTestId(wrapper, 'template-edit-cancel').trigger('click')
    await vi.waitUntil(() => gallery.props('closeOnEscape') === true)
  })
})
