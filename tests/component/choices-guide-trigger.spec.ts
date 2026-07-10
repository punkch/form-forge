import type { Pinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import ChoicesSection from '@/components/properties/ChoicesSection.vue'
import TypeConfigSection from '@/components/properties/TypeConfigSection.vue'
import { newDocument } from '@/core/model/factory'
import type { QuestionNode } from '@/core/model/types'
import { useEditorStore } from '@/stores/editor'
import { useFormStore } from '@/stores/form'

import { freshPinia, mountWith } from './helpers'

describe('ChoicesSection datasets guide trigger', () => {
  let pinia: Pinia
  let node: QuestionNode

  beforeEach(() => {
    pinia = freshPinia()
    const form = useFormStore()
    form.doc = newDocument('T')
    const id = form.addNode('select_one', null) as string
    node = form.getNode(id) as QuestionNode
  })

  it('renders the datasets guide trigger for a choice-based select', () => {
    const wrapper = mountWith(pinia, ChoicesSection, { props: { node } })
    expect(wrapper.find('[data-testid="guide-trigger-datasets"]').exists()).toBe(true)
  })

  it('opens the help drawer at the datasets guide on click', async () => {
    const editor = useEditorStore()
    const wrapper = mountWith(pinia, ChoicesSection, { props: { node } })

    await wrapper.find('[data-testid="guide-trigger-datasets"]').trigger('click')

    expect(editor.helpGuideId).toBe('datasets')
    expect(editor.activeDialog).toBe('help-reference')
  })

  it('renders the trigger on the Choices-file field for a file-backed select', async () => {
    const form = useFormStore()
    const editor = useEditorStore()
    const fileId = form.addNode('select_one_from_file', null) as string
    const fileNode = form.getNode(fileId) as QuestionNode
    const wrapper = mountWith(pinia, TypeConfigSection, { props: { node: fileNode } })

    const trigger = wrapper.find('[data-testid="guide-trigger-datasets"]')
    expect(trigger.exists()).toBe(true)

    await trigger.trigger('click')
    expect(editor.helpGuideId).toBe('datasets')
    expect(editor.activeDialog).toBe('help-reference')
  })

  it('shows the trigger even before a choice list is bound', () => {
    const form = useFormStore()
    form.updateNode(node.id, 'Unbind list', (n) => {
      if (n.kind === 'question') n.listRef = undefined
    })
    const unbound = form.getNode(node.id) as QuestionNode
    const wrapper = mountWith(pinia, ChoicesSection, { props: { node: unbound } })

    expect(wrapper.find('[data-testid="guide-trigger-datasets"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="choices-editor"]').exists()).toBe(false)
  })
})
