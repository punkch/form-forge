import type { Pinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import TreeNodeCard from '@/components/canvas/TreeNodeCard.vue'
import BasicSection from '@/components/properties/BasicSection.vue'
import ChoicesSection from '@/components/properties/ChoicesSection.vue'
import LogicSection from '@/components/properties/LogicSection.vue'
import { newDocument } from '@/core/model/factory'
import { addLanguage } from '@/core/model/translations'
import { DEFAULT_LANG, type QuestionNode } from '@/core/model/types'
import { useEditorStore } from '@/stores/editor'
import { useFormStore } from '@/stores/form'

import { freshPinia, mountWith } from './helpers'

const EN = 'English (en)'
const FR = 'French (fr)'

describe('display language', () => {
  let pinia: Pinia
  let node: QuestionNode

  // Clean Shape B fixture built the way an author would: text starts under
  // the sentinel, addLanguage moves it into EN (the primary), FR is the
  // translation target added second.
  beforeEach(() => {
    pinia = freshPinia()
    const form = useFormStore()
    form.doc = newDocument('T')
    const id = form.addNode('text', null) as string
    form.updateNode(id, 'Edit label', (n) => {
      n.label = { [DEFAULT_LANG]: 'Your name?' }
    })
    form.mutate('Add languages', (d) => {
      addLanguage(d, EN)
      addLanguage(d, FR)
    })
    form.updateNode(id, 'Edit label', (n) => {
      n.label = { ...n.label, [FR]: 'Votre nom ?' }
    })
    node = form.getNode(id) as QuestionNode
  })

  it('TreeNodeCard shows the primary-language label without a display language', () => {
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

  it('TreeNodeCard falls back to the primary language when the translation is missing', async () => {
    const form = useFormStore()
    const editor = useEditorStore()
    form.updateNode(node.id, 'Edit label', (n) => { n.label = { [EN]: 'Only English' } })
    editor.displayLanguage = FR
    const wrapper = mountWith(pinia, TreeNodeCard, { props: { node } })
    expect(wrapper.find('.node-label').text()).toBe('Only English')
  })

  it('TreeNodeCard still displays leftover sentinel text in a mixed doc', () => {
    // Imported/legacy docs can carry unassigned (sentinel) text next to named
    // languages until the author resolves it — displayText's fallback chain
    // (primary → sentinel → first non-empty) keeps it visible on the canvas.
    const form = useFormStore()
    form.updateNode(node.id, 'Edit label', (n) => { n.label = { [DEFAULT_LANG]: 'Leftover text' } })
    const wrapper = mountWith(pinia, TreeNodeCard, { props: { node } })
    expect(wrapper.find('.node-label').text()).toBe('Leftover text')
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
    expect(updated.label).toEqual({ [EN]: 'Your name?', [FR]: 'Nouveau nom ?' })
  })

  it('BasicSection writes the primary language when no display language is set', async () => {
    const form = useFormStore()
    const wrapper = mountWith(pinia, BasicSection, { props: { node } })
    await wrapper.find('[data-testid="prop-label"]').setValue('Changed primary')
    const updated = form.getNode(node.id) as QuestionNode
    expect(updated.label).toEqual({ [EN]: 'Changed primary', [FR]: 'Votre nom ?' })
  })

  it('BasicSection shows the fallback as placeholder only when the selected language is empty', () => {
    const form = useFormStore()
    const editor = useEditorStore()
    form.updateNode(node.id, 'Edit label', (n) => { n.label = { [EN]: 'Only English' } })
    editor.displayLanguage = FR
    const wrapper = mountWith(pinia, BasicSection, { props: { node } })
    const label = wrapper.find('[data-testid="prop-label"]')
    expect((label.element as HTMLTextAreaElement).value).toBe('')
    expect(label.attributes('placeholder')).toBe('Only English')
    const badge = wrapper.find('[data-testid="prop-label-lang-badge"]')
    expect(badge.exists()).toBe(true)
    expect(badge.text()).toBe(FR)
  })

  it('BasicSection shows no badge while editing the primary language', () => {
    const editor = useEditorStore()
    editor.displayLanguage = EN
    const wrapper = mountWith(pinia, BasicSection, { props: { node } })
    expect(wrapper.find('[data-testid="prop-label-lang-badge"]').exists()).toBe(false)
  })

  it('BasicSection hint and guidance hint write the editing language', async () => {
    const form = useFormStore()
    const editor = useEditorStore()
    editor.displayLanguage = FR
    const wrapper = mountWith(pinia, BasicSection, { props: { node } })
    await wrapper.find('[data-testid="prop-hint"]').setValue('Indice')
    await wrapper.find('[data-testid="prop-guidance-hint"]').setValue('Guide enquêteur')
    const updated = form.getNode(node.id) as QuestionNode
    expect(updated.hint).toEqual({ [FR]: 'Indice' })
    expect(updated.guidanceHint).toEqual({ [FR]: 'Guide enquêteur' })
  })

  it('clearing an input removes only the selected language key', async () => {
    const form = useFormStore()
    const editor = useEditorStore()
    editor.displayLanguage = FR
    const wrapper = mountWith(pinia, BasicSection, { props: { node } })
    await wrapper.find('[data-testid="prop-label"]').setValue('')
    const updated = form.getNode(node.id) as QuestionNode
    expect(updated.label).toEqual({ [EN]: 'Your name?' })
  })

  it('LogicSection constraint message writes the selected language, not the primary', async () => {
    const form = useFormStore()
    const editor = useEditorStore()
    form.updateNode(node.id, 'Edit constraint', (n) => { n.bind.constraint = '. > 0' })
    editor.displayLanguage = FR
    const wrapper = mountWith(pinia, LogicSection, { props: { node } })
    await wrapper.find('[data-testid="prop-constraint-message"]').setValue('Valeur invalide')
    const updated = form.getNode(node.id) as QuestionNode
    expect(updated.bind.constraintMessage).toEqual({ [FR]: 'Valeur invalide' })
  })

  it('LogicSection shows a required-message input only when required, writing the selected language', async () => {
    const form = useFormStore()
    const editor = useEditorStore()
    const before = mountWith(pinia, LogicSection, { props: { node } })
    expect(before.find('[data-testid="prop-required-message"]').exists()).toBe(false)

    form.updateNode(node.id, 'Toggle required', (n) => { n.bind.required = 'true()' })
    editor.displayLanguage = FR
    const wrapper = mountWith(pinia, LogicSection, { props: { node } })
    await wrapper.find('[data-testid="prop-required-message"]').setValue('Réponse requise')
    const updated = form.getNode(node.id) as QuestionNode
    expect(updated.bind.requiredMessage).toEqual({ [FR]: 'Réponse requise' })
  })

  it('ChoicesSection choice labels write the selected language', async () => {
    const form = useFormStore()
    const editor = useEditorStore()
    const selectId = form.addNode('select_one', null) as string
    const selectNode = form.getNode(selectId) as QuestionNode
    editor.displayLanguage = FR
    const wrapper = mountWith(pinia, ChoicesSection, { props: { node: selectNode } })
    await wrapper.find('[data-testid="choice-label-0"]').setValue('Oui')
    const list = form.doc?.choiceLists[selectNode.listRef as string]
    // The factory seeds new choice labels under the doc's primary language.
    expect(list?.choices[0].label).toEqual({ [EN]: 'Option 1', [FR]: 'Oui' })
  })
})
