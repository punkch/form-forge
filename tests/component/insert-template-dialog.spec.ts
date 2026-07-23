import type { VueWrapper } from '@vue/test-utils'
import type { Pinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import InsertTemplateDialog from '@/components/library/InsertTemplateDialog.vue'
import { newDocument } from '@/core/model/factory'
import { db } from '@/persistence/db'
import { useEditorStore } from '@/stores/editor'
import { useFormStore } from '@/stores/form'
import { useUiStore } from '@/stores/ui'
import { bundledTemplates } from '@/templates'

import { freshPinia, mountWith } from './helpers'

// The dialog reaches useSelectionActions for the shared merge-outcome toast;
// no Toast provider is registered in the component test setup, so mock it
// (use-selection-actions.spec.ts pattern).
const toast = { add: vi.fn() }
vi.mock('primevue/usetoast', () => ({ useToast: () => toast }))

const findTestId = (wrapper: VueWrapper, id: string) => wrapper.find(`[data-testid="${id}"]`)

const waitForTestId = async (wrapper: VueWrapper, id: string): Promise<void> => {
  // PrimeVue Dialog renders its content a tick after mount (new-form-dialog
  // .spec.ts precedent) — same for content that appears after an async
  // update (e.g. a template load resolving).
  await vi.waitUntil(() => findTestId(wrapper, id).exists())
}

const mountDialog = (pinia: Pinia): VueWrapper =>
  mountWith(pinia, InsertTemplateDialog, { global: { stubs: { teleport: true } } })

beforeEach(async () => {
  await db.templates.clear()
  // The ui store persists hidden-starter ids to localStorage; isolate each
  // test (guide-callout.spec.ts precedent).
  localStorage.clear()
})

describe('InsertTemplateDialog', () => {
  it('renders every visible bundled starter and drops one that gets hidden', async () => {
    const pinia = freshPinia()
    const editor = useEditorStore(pinia)
    const ui = useUiStore(pinia)
    editor.activeDialog = 'insert-template'

    const wrapper = mountDialog(pinia)
    await waitForTestId(wrapper, 'insert-template-card-household-survey')

    for (const template of bundledTemplates) {
      expect(findTestId(wrapper, `insert-template-card-${template.id}`).exists()).toBe(true)
    }
    expect(findTestId(wrapper, 'insert-template-card-household-survey').text()).toContain('Household survey')

    ui.hideBundledTemplate('household-survey')
    await vi.waitUntil(() => !findTestId(wrapper, 'insert-template-card-household-survey').exists())
    expect(findTestId(wrapper, 'insert-template-card-individual-registration').exists()).toBe(true)
  })

  it('inserts the picked template at the end of the open form, closes, and selects what landed', async () => {
    const pinia = freshPinia()
    const editor = useEditorStore(pinia)
    const form = useFormStore(pinia)
    form.doc = newDocument('T')
    editor.activeDialog = 'insert-template'

    const template = bundledTemplates.find((tpl) => tpl.id === 'household-survey')
    if (template === undefined) throw new Error('household-survey template missing')
    const templateDoc = await template.load()

    const wrapper = mountDialog(pinia)
    await waitForTestId(wrapper, 'insert-template-card-household-survey')

    await findTestId(wrapper, 'insert-template-card-household-survey').trigger('click')
    await vi.waitUntil(() => editor.activeDialog === null)

    // The dialog closed and the whole selection is now the inserted subtree.
    expect(form.doc?.children).toHaveLength(templateDoc.children.length)
    expect(editor.selectedNodeIds.size).toBe(templateDoc.children.length)
    expect(editor.revealNodeId).not.toBeNull()
    expect(form.doc?.children.map((n) => n.id)).toContain(editor.revealNodeId)
  })

  it('a double-click inserts the template only once (re-entrancy latch)', async () => {
    const pinia = freshPinia()
    const editor = useEditorStore(pinia)
    const form = useFormStore(pinia)
    form.doc = newDocument('T')
    editor.activeDialog = 'insert-template'

    const template = bundledTemplates.find((tpl) => tpl.id === 'feedback-satisfaction')
    if (template === undefined) throw new Error('feedback-satisfaction template missing')
    const templateDoc = await template.load()

    const wrapper = mountDialog(pinia)
    await waitForTestId(wrapper, 'insert-template-card-feedback-satisfaction')

    const card = findTestId(wrapper, 'insert-template-card-feedback-satisfaction')
    // Both clicks land before the async load resolves / the dialog unmounts.
    await Promise.all([card.trigger('click'), card.trigger('click')])
    await vi.waitUntil(() => editor.activeDialog === null)

    expect(form.doc?.children).toHaveLength(templateDoc.children.length)
  })

  it('shows the empty state when every starter is hidden and no local template is saved', async () => {
    const pinia = freshPinia()
    const editor = useEditorStore(pinia)
    const ui = useUiStore(pinia)
    for (const template of bundledTemplates) ui.hideBundledTemplate(template.id)
    editor.activeDialog = 'insert-template'

    const wrapper = mountDialog(pinia)
    await waitForTestId(wrapper, 'insert-template-empty')

    expect(findTestId(wrapper, 'insert-template-empty').text()).toContain('No templates yet')
    expect(findTestId(wrapper, 'insert-template-card-household-survey').exists()).toBe(false)
    expect(findTestId(wrapper, 'insert-template-local').exists()).toBe(false)
  })
})
