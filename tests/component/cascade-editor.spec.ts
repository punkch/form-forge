import type { Pinia } from 'pinia'
import type { VueWrapper } from '@vue/test-utils'
import { beforeEach, describe, expect, it } from 'vitest'

import CascadeEditor from '@/components/choices/CascadeEditor.vue'
import { newDocument } from '@/core/model/factory'
import { DEFAULT_LANG, type QuestionNode } from '@/core/model/types'
import { useFormStore } from '@/stores/form'

import { freshPinia, mountWith } from './helpers'

describe('CascadeEditor', () => {
  let pinia: Pinia
  let stateId: string
  let countyId: string

  beforeEach(() => {
    pinia = freshPinia()
    const form = useFormStore()
    form.doc = newDocument('T')
    form.mutate('Seed', (d) => {
      d.choiceLists.states = {
        name: 'states',
        choices: [
          { name: 'tx', label: { [DEFAULT_LANG]: 'Texas' } },
          { name: 'wa', label: { [DEFAULT_LANG]: 'Washington' } },
        ],
      }
      d.choiceLists.counties = {
        name: 'counties',
        choices: [
          { name: 'travis', label: { [DEFAULT_LANG]: 'Travis' } },
          { name: 'king', label: { [DEFAULT_LANG]: 'King' } },
        ],
      }
    })
    stateId = form.addNode('select_one', null) as string
    form.updateNode(stateId, 'Edit name', (n) => {
      n.name = 'state'
      if (n.kind === 'question') n.listRef = 'states'
    })
    countyId = form.addNode('select_one', null) as string
    form.updateNode(countyId, 'Edit name', (n) => {
      n.name = 'county'
      if (n.kind === 'question') n.listRef = 'counties'
    })
  })

  const county = (): QuestionNode => useFormStore().getNode(countyId) as QuestionNode

  const mountEditor = (node: QuestionNode = county()): VueWrapper =>
    mountWith(pinia, CascadeEditor, { props: { node } })

  const pickSelect = async (wrapper: VueWrapper, testid: string, value: string | null): Promise<void> => {
    const select = wrapper
      .findAllComponents({ name: 'Select' })
      .find((c) => c.attributes('data-testid') === testid)
    expect(select, `select ${testid}`).toBeDefined()
    select!.vm.$emit('update:modelValue', value)
    await wrapper.vm.$nextTick()
  }

  it('offers only select_one questions BEFORE this one as parents', () => {
    const form = useFormStore()
    const stateWrapper = mountEditor(form.getNode(stateId) as QuestionNode)
    expect(stateWrapper.text()).toContain('Add a select_one question above')

    const countyWrapper = mountEditor()
    const parent = countyWrapper
      .findAllComponents({ name: 'Select' })
      .find((c) => c.attributes('data-testid') === 'cascade-parent')
    expect(parent?.props('options')).toEqual([
      expect.objectContaining({ value: 'state' }),
    ])
  })

  it('generates choiceFilter and adds the filter column on parent+column pick', async () => {
    const form = useFormStore()
    const wrapper = mountEditor()
    await pickSelect(wrapper, 'cascade-parent', 'state')
    await pickSelect(wrapper, 'cascade-column', 'state')

    expect(county().choiceFilter).toBe('state=${state}')
    const list = form.doc?.choiceLists.counties
    expect(list?.extraColumnOrder).toEqual(['state'])
    expect(list?.choices.map((c) => c.extras)).toEqual([{ state: '' }, { state: '' }])
    expect(wrapper.text()).toContain('state=${state}')
  })

  it('assigns parent values per choice through the dropdowns', async () => {
    const form = useFormStore()
    const wrapper = mountEditor()
    await pickSelect(wrapper, 'cascade-parent', 'state')
    await pickSelect(wrapper, 'cascade-column', 'state')

    expect(wrapper.find('[data-testid="cascade-assignments"]').exists()).toBe(true)
    await pickSelect(wrapper, 'cascade-value-0', 'tx')
    await pickSelect(wrapper, 'cascade-value-1', 'wa')

    const list = form.doc?.choiceLists.counties
    expect(list?.choices.map((c) => c.extras)).toEqual([{ state: 'tx' }, { state: 'wa' }])
  })

  it('shows visual mode for simple filters and raw mode for complex ones', async () => {
    const form = useFormStore()
    form.updateNode(countyId, 'Edit filter', (n) => {
      if (n.kind === 'question') n.choiceFilter = 'state=${state}'
    })
    let wrapper = mountEditor()
    expect(wrapper.find('[data-testid="cascade-parent"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="expr-choiceFilter"]').exists()).toBe(false)

    form.updateNode(countyId, 'Edit filter', (n) => {
      if (n.kind === 'question') n.choiceFilter = 'state=${state} and county=${county}'
    })
    wrapper = mountEditor()
    expect(wrapper.find('[data-testid="expr-choiceFilter"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="cascade-parent"]').exists()).toBe(false)
  })

  it('advanced toggle exposes the raw expression editor', async () => {
    const wrapper = mountEditor()
    const toggle = wrapper.findComponent({ name: 'ToggleSwitch' })
    toggle.vm.$emit('update:modelValue', true)
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-testid="expr-choiceFilter"]').exists()).toBe(true)
  })

  it('editing the raw expression writes choiceFilter', async () => {
    const wrapper = mountEditor()
    const toggle = wrapper.findComponent({ name: 'ToggleSwitch' })
    toggle.vm.$emit('update:modelValue', true)
    await wrapper.vm.$nextTick()
    await wrapper.find('[data-testid="expr-choiceFilter"]').setValue('starts-with(name, ${prefix})')
    expect(county().choiceFilter).toBe('starts-with(name, ${prefix})')
  })

  it('clearing the parent removes the filter', async () => {
    const wrapper = mountEditor()
    await pickSelect(wrapper, 'cascade-parent', 'state')
    await pickSelect(wrapper, 'cascade-column', 'state')
    expect(county().choiceFilter).toBe('state=${state}')
    await pickSelect(wrapper, 'cascade-parent', null)
    expect(county().choiceFilter).toBeUndefined()
  })
})
