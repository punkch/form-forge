import type { Pinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { VueDraggable } from 'vue-draggable-plus'

import PropertyPanel from '@/components/properties/PropertyPanel.vue'
import { newDocument } from '@/core/model/factory'
import { useEditorStore } from '@/stores/editor'
import { useFormStore } from '@/stores/form'
import { useUiStore } from '@/stores/ui'

import { freshPinia, mountWith } from './helpers'

describe('PropertyPanel', () => {
  let pinia: Pinia

  beforeEach(() => {
    // The ui store persists collapse state; isolate it per test.
    localStorage.clear()
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

  it('wraps properties in collapsible sections', () => {
    selectNew('text')
    const wrapper = mountWith(pinia, PropertyPanel)
    expect(wrapper.find('[data-testid="prop-section-basics"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="prop-section-appearance"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="prop-section-logic"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="prop-section-choices"]').exists()).toBe(false)
  })

  it('omits the Appearance section for types without config', () => {
    selectNew('note')
    const wrapper = mountWith(pinia, PropertyPanel)
    expect(wrapper.find('[data-testid="prop-section-appearance"]').exists()).toBe(false)
  })

  it('shows the node name in the panel header', () => {
    const id = selectNew('text')
    const form = useFormStore()
    const wrapper = mountWith(pinia, PropertyPanel)
    expect(wrapper.find('.property-header-name').text()).toBe(form.getNode(id)?.name)
  })

  it('collapses and re-expands a section, persisting to the ui store', async () => {
    selectNew('text')
    const ui = useUiStore()
    const wrapper = mountWith(pinia, PropertyPanel)
    const header = wrapper.find('[data-testid="prop-section-basics"]')
    const body = wrapper.find('[data-testid="prop-section-body-basics"]')
    // v-show keeps children in the DOM, so section internals stay queryable.
    expect(header.attributes('aria-expanded')).toBe('true')
    expect(body.attributes('style') ?? '').not.toContain('display: none')

    await header.trigger('click')
    expect(ui.propSectionsCollapsed.basics).toBe(true)
    expect(header.attributes('aria-expanded')).toBe('false')
    expect(body.attributes('style')).toContain('display: none')
    expect(wrapper.find('[data-testid="prop-label"]').exists()).toBe(true)

    await header.trigger('click')
    expect(ui.propSectionsCollapsed.basics).toBe(false)
    expect(body.attributes('style') ?? '').not.toContain('display: none')
  })

  it('sentence-cases parameter display labels without touching keys', () => {
    selectNew('select_one')
    const wrapper = mountWith(pinia, PropertyPanel)
    expect(wrapper.text()).toContain('Randomize')
    expect(wrapper.text()).toContain('Seed')
    expect(wrapper.find('[data-testid="prop-param-randomize"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="prop-param-seed"]').exists()).toBe(true)
  })

  it('drag-reorders choices through the undo path', () => {
    selectNew('select_one')
    const form = useFormStore()
    const wrapper = mountWith(pinia, PropertyPanel)
    const listName = Object.keys(form.doc?.choiceLists ?? {})[0]
    const names = (): string[] =>
      (form.doc?.choiceLists[listName]?.choices ?? []).map((c) => c.name)
    const before = names()
    const reversed = [...(form.doc?.choiceLists[listName]?.choices ?? [])].reverse()

    wrapper.findComponent(VueDraggable).vm.$emit('update:modelValue', reversed)
    expect(names()).toEqual([...before].reverse())

    form.undo()
    expect(names()).toEqual(before)
    form.redo()
    expect(names()).toEqual([...before].reverse())
  })
})
