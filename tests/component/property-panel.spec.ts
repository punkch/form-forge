import type { Pinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import PropertyPanel from '@/components/properties/PropertyPanel.vue'
import { newDocument } from '@/core/model/factory'
import { useEditorStore } from '@/stores/editor'
import { useFormStore } from '@/stores/form'

import { freshPinia, mountWith } from './helpers'

describe('PropertyPanel', () => {
  let pinia: Pinia

  beforeEach(() => {
    pinia = freshPinia()
    const form = useFormStore()
    form.doc = newDocument('T')
  })

  const selectNew = (type: string): string => {
    const form = useFormStore()
    const editor = useEditorStore()
    const id = form.addNode(type, null) as string
    editor.select(id)
    return id
  }

  it('shows an empty state without a selection', () => {
    const wrapper = mountWith(pinia, PropertyPanel)
    expect(wrapper.text()).toContain('Select a question')
  })

  it('shows text-question sections for a text node', () => {
    selectNew('text')
    const wrapper = mountWith(pinia, PropertyPanel)
    expect(wrapper.find('[data-testid="prop-label"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="prop-name"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="prop-required"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="expr-relevant"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="prop-choice-list"]').exists()).toBe(false)
  })

  it('shows the choices section for select questions', () => {
    selectNew('select_one')
    const wrapper = mountWith(pinia, PropertyPanel)
    expect(wrapper.find('[data-testid="prop-choice-list"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="choices-editor"]').exists()).toBe(true)
    expect(wrapper.findAll('[data-testid^="choice-name-"]')).toHaveLength(3)
  })

  it('shows repeat count only for repeats', () => {
    selectNew('repeat')
    const wrapper = mountWith(pinia, PropertyPanel)
    expect(wrapper.find('[data-testid="expr-repeatCount"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="prop-required"]').exists()).toBe(false)
  })

  it('hides label/hint for metadata questions', () => {
    selectNew('start')
    const wrapper = mountWith(pinia, PropertyPanel)
    expect(wrapper.find('[data-testid="prop-label"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="prop-name"]').exists()).toBe(true)
  })

  it('edits flow into the store (label)', async () => {
    const id = selectNew('text')
    const form = useFormStore()
    const wrapper = mountWith(pinia, PropertyPanel)
    await wrapper.find('[data-testid="prop-label"]').setValue('What is your name?')
    expect(form.getNode(id)?.label?.default).toBe('What is your name?')
  })
})
