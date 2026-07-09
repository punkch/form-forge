import type { Pinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import TreeNodeCard from '@/components/canvas/TreeNodeCard.vue'
import BasicSection from '@/components/properties/BasicSection.vue'
import { newDocument } from '@/core/model/factory'
import { DEFAULT_LANG, type QuestionNode } from '@/core/model/types'
import { useEditorStore } from '@/stores/editor'
import { useFormStore } from '@/stores/form'

import { freshPinia, mountWith } from './helpers'

const FR = 'French (fr)'

describe('display language', () => {
  let pinia: Pinia
  let node: QuestionNode

  beforeEach(() => {
    pinia = freshPinia()
    const form = useFormStore()
    form.doc = newDocument('T')
    const id = form.addNode('text', null) as string
    form.updateNode(id, 'Edit label', (n) => {
      n.label = { [DEFAULT_LANG]: 'Your name?', [FR]: 'Votre nom ?' }
    })
    form.mutate('Add language', (d) => { d.languages = [FR] })
    node = form.getNode(id) as QuestionNode
  })

  it('TreeNodeCard shows the default label without a display language', () => {
    const wrapper = mountWith(pinia, TreeNodeCard, { props: { node } })
    expect(wrapper.find('.node-label').text()).toBe('Your name?')
  })

  it('TreeNodeCard switches with editor.displayLanguage', async () => {
    const editor = useEditorStore()
    const wrapper = mountWith(pinia, TreeNodeCard, { props: { node } })
    editor.displayLanguage = FR
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.node-label').text()).toBe('Votre nom ?')
  })

  it('TreeNodeCard falls back to default when the translation is missing', async () => {
    const form = useFormStore()
    const editor = useEditorStore()
    form.updateNode(node.id, 'Edit label', (n) => { n.label = { [DEFAULT_LANG]: 'Only default' } })
    editor.displayLanguage = FR
    const wrapper = mountWith(pinia, TreeNodeCard, { props: { node } })
    expect(wrapper.find('.node-label').text()).toBe('Only default')
  })

  it('BasicSection shows and edits the display language', async () => {
    const form = useFormStore()
    const editor = useEditorStore()
    editor.displayLanguage = FR
    const wrapper = mountWith(pinia, BasicSection, { props: { node } })
    const label = wrapper.find('[data-testid="prop-label"]')
    expect((label.element as HTMLTextAreaElement).value).toBe('Votre nom ?')

    await label.setValue('Nouveau nom ?')
    const updated = form.getNode(node.id) as QuestionNode
    expect(updated.label).toEqual({ [DEFAULT_LANG]: 'Your name?', [FR]: 'Nouveau nom ?' })
  })

  it('BasicSection writes to default when no display language is set', async () => {
    const form = useFormStore()
    const wrapper = mountWith(pinia, BasicSection, { props: { node } })
    await wrapper.find('[data-testid="prop-label"]').setValue('Changed default')
    const updated = form.getNode(node.id) as QuestionNode
    expect(updated.label).toEqual({ [DEFAULT_LANG]: 'Changed default', [FR]: 'Votre nom ?' })
  })
})
