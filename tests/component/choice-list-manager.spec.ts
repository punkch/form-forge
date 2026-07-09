import type { Pinia } from 'pinia'
import type { VueWrapper } from '@vue/test-utils'
import { beforeEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'

import ChoiceListManagerDialog from '@/components/choices/ChoiceListManagerDialog.vue'
import { newDocument } from '@/core/model/factory'
import type { QuestionNode } from '@/core/model/types'
import { useEditorStore } from '@/stores/editor'
import { useFormStore } from '@/stores/form'

import { freshPinia, mountWith } from './helpers'

describe('ChoiceListManagerDialog', () => {
  let pinia: Pinia

  beforeEach(() => {
    pinia = freshPinia()
    const form = useFormStore()
    const editor = useEditorStore()
    form.doc = newDocument('T')
    // Two selects sharing one list ('choices'), one select on its own list.
    form.addNode('select_one', null)
    const first = form.doc.children[0] as QuestionNode
    form.addNode('select_multiple', null, undefined)
    const second = form.doc.children[1] as QuestionNode
    // Rebinding leaves 'choices_2' (auto-created for the select_multiple)
    // unused, giving the delete-unused test a target.
    form.updateNode(second.id, 'Edit list', (n) => {
      if (n.kind === 'question') n.listRef = first.listRef
    })
    editor.activeDialog = 'choice-lists'
  })

  // PrimeVue's Portal renders the dialog body one tick after mount.
  const mountDialog = async (): Promise<VueWrapper> => {
    const wrapper = mountWith(pinia, ChoiceListManagerDialog, {
      global: { stubs: { teleport: true } },
    })
    await nextTick()
    return wrapper
  }

  it('lists every choice list with its usage count', async () => {
    const wrapper = await mountDialog()
    expect(wrapper.find('[data-testid="list-row-choices"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="list-usage-choices"]').text()).toContain('used by 2 questions')
    expect(wrapper.find('[data-testid="list-usage-choices_2"]').text()).toContain('used by 0 questions')
  })

  it('creates a new list', async () => {
    const form = useFormStore()
    const wrapper = await mountDialog()
    await wrapper.find('[data-testid="new-choice-list"]').trigger('click')
    expect(Object.keys(form.doc?.choiceLists ?? {})).toContain('choices_3')
  })

  it('renames a list and updates every listRef in one mutate', async () => {
    const form = useFormStore()
    const wrapper = await mountDialog()
    await wrapper.find('[data-testid="rename-list-choices"]').trigger('click')
    await wrapper.find('[data-testid="rename-input"]').setValue('yes_no')
    await wrapper.find('[data-testid="rename-confirm"]').trigger('click')

    expect(form.doc?.choiceLists.yes_no).toBeDefined()
    expect(form.doc?.choiceLists.choices).toBeUndefined()
    const questions = (form.doc?.children ?? []) as QuestionNode[]
    expect(questions.map((q) => q.listRef)).toEqual(['yes_no', 'yes_no'])
    expect(form.undoLabel).toBe('Rename choice list')

    // One undo restores the old name AND both refs.
    form.undo()
    const restored = (form.doc?.children ?? []) as QuestionNode[]
    expect(restored.map((q) => q.listRef)).toEqual(['choices', 'choices'])
    expect(form.doc?.choiceLists.choices).toBeDefined()
  })

  it('rejects renaming onto an existing list name', async () => {
    const form = useFormStore()
    const wrapper = await mountDialog()
    await wrapper.find('[data-testid="rename-list-choices"]').trigger('click')
    await wrapper.find('[data-testid="rename-input"]').setValue('choices_2')
    expect(wrapper.text()).toContain('already exists')
    await wrapper.find('[data-testid="rename-confirm"]').trigger('click')
    expect(form.doc?.choiceLists.choices).toBeDefined()
  })

  it('deletes an unused list immediately', async () => {
    const form = useFormStore()
    const wrapper = await mountDialog()
    await wrapper.find('[data-testid="delete-list-choices_2"]').trigger('click')
    expect(form.doc?.choiceLists.choices_2).toBeUndefined()
  })

  it('asks for confirmation before deleting a used list, then clears refs', async () => {
    const form = useFormStore()
    const wrapper = await mountDialog()
    await wrapper.find('[data-testid="delete-list-choices"]').trigger('click')
    // First click only warns.
    expect(form.doc?.choiceLists.choices).toBeDefined()
    expect(wrapper.find('[data-testid="delete-confirm"]').text()).toContain('used by 2 questions')

    await wrapper.find('[data-testid="delete-confirm-button"]').trigger('click')
    expect(form.doc?.choiceLists.choices).toBeUndefined()
    const questions = (form.doc?.children ?? []) as QuestionNode[]
    expect(questions.map((q) => q.listRef)).toEqual([undefined, undefined])
  })

  it('closing the dialog clears editor.activeDialog', async () => {
    const editor = useEditorStore()
    const wrapper = await mountDialog()
    await wrapper.findComponent({ name: 'Dialog' }).vm.$emit('update:visible', false)
    expect(editor.activeDialog).toBeNull()
  })
})
