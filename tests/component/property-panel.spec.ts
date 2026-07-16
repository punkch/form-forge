import type { Pinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import { VueDraggable } from 'vue-draggable-plus'

import PropertyPanel from '@/components/properties/PropertyPanel.vue'
import { newDocument } from '@/core/model/factory'
import { useEditorStore } from '@/stores/editor'
import { useFormStore } from '@/stores/form'
import { useUiStore } from '@/stores/ui'

import { freshPinia, mountWith } from './helpers'

const FR = 'French (fr)'

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

  describe('field help popovers', () => {
    // The popover teleports to body; stub teleport so it renders in the wrapper.
    const mountPanel = (): ReturnType<typeof mountWith> =>
      mountWith(pinia, PropertyPanel, { global: { stubs: { teleport: true } } })

    const openHelp = async (wrapper: ReturnType<typeof mountWith>, field: string): Promise<string> => {
      expect(wrapper.find(`[data-testid="field-help-body-${field}"]`).exists()).toBe(false)
      await wrapper.find(`[data-testid="field-help-${field}"]`).trigger('click')
      await nextTick()
      await nextTick()
      const body = wrapper.find(`[data-testid="field-help-body-${field}"]`)
      expect(body.exists()).toBe(true)
      return body.text()
    }

    it('basics: the name field help opens with the name content', async () => {
      selectNew('text')
      const text = await openHelp(mountPanel(), 'name')
      expect(text).toContain('variable name')
      expect(text).toContain('name')
    })

    it('appearance: the appearance field help opens with the appearance content', async () => {
      selectNew('select_one')
      const text = await openHelp(mountPanel(), 'appearance')
      expect(text).toContain('dropdown instead of radio buttons')
      expect(text).toContain('appearance')
    })

    it('choices: the list field help opens with the choice-list content', async () => {
      selectNew('select_one')
      const text = await openHelp(mountPanel(), 'choiceList')
      expect(text).toContain('named list of choices')
      expect(text).toContain('after the type token')
    })

    it('logic: the relevant field help opens with the relevant content', async () => {
      selectNew('text')
      const text = await openHelp(mountPanel(), 'relevant')
      expect(text).toContain('Skip logic')
      expect(text).toContain('relevant')
    })

    it('parameters: an options-bearing parameter shows its own description, tokens and mapping', async () => {
      selectNew('audit')
      const text = await openHelp(mountPanel(), 'param-location-priority')
      expect(text).toContain('Location tracking priority')
      expect(text).toContain('no-power')
      expect(text).toContain('low-power')
      expect(text).toContain('balanced')
      expect(text).toContain('high-accuracy')
      expect(text).toContain('location-priority')
    })

    it('parameters: a boolean parameter with defaultValue false renders "false" explicitly', async () => {
      selectNew('select_one')
      const text = await openHelp(mountPanel(), 'param-randomize')
      expect(text).toContain('false')
    })

    it('parameters: a from-file column parameter still renders correctly', async () => {
      selectNew('select_one_from_file')
      const text = await openHelp(mountPanel(), 'param-value')
      expect(text).toContain('Column to use for choice values')
      expect(text).toContain('name')
    })
  })

  describe('editing-language control', () => {
    it('renders nothing for monolingual forms', () => {
      selectNew('text')
      const wrapper = mountWith(pinia, PropertyPanel)
      expect(wrapper.find('[data-testid="panel-editing-language"]').exists()).toBe(false)
    })

    it('appears with languages, drives editor.displayLanguage and the input badges', async () => {
      selectNew('text')
      const form = useFormStore()
      const editor = useEditorStore()
      form.mutate('Add language', (d) => { d.languages = [FR] })
      const wrapper = mountWith(pinia, PropertyPanel)
      const select = wrapper
        .findAllComponents({ name: 'Select' })
        .find((c) => c.attributes('data-testid') === 'panel-editing-language')
      expect(select).toBeDefined()
      // The "Default" option English must match the Translations dialog's.
      const options = select!.props('options') as { label: string, value: string | null }[]
      expect(options[0]).toEqual({ label: 'Default', value: null })
      expect(options[1]).toEqual({ label: FR, value: FR })

      select!.vm.$emit('update:modelValue', FR)
      await nextTick()
      expect(editor.displayLanguage).toBe(FR)
      const badge = wrapper.find('[data-testid="prop-label-lang-badge"]')
      expect(badge.exists()).toBe(true)
      expect(badge.text()).toBe(FR)
    })
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
