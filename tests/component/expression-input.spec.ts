import type { Pinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import ExpressionInput from '@/components/properties/ExpressionInput.vue'
import { newDocument } from '@/core/model/factory'
import { useFormStore } from '@/stores/form'

import { freshPinia, mountWith } from './helpers'

describe('ExpressionInput', () => {
  let pinia: Pinia

  beforeEach(() => {
    pinia = freshPinia()
    const form = useFormStore()
    form.doc = newDocument('T')
    const a = form.addNode('integer', null)
    form.updateNode(a as string, 'Edit name', (n) => { n.name = 'age' })
    const b = form.addNode('text', null)
    form.updateNode(b as string, 'Edit name', (n) => { n.name = 'agreement' })
  })

  const mountInput = (modelValue = '') =>
    mountWith(pinia, ExpressionInput, {
      props: { modelValue, field: 'relevant', nodeId: 'n1' },
    })

  it('suggests matching field names after ${', async () => {
    const wrapper = mountInput('${ag')
    const textarea = wrapper.find('textarea')
    textarea.element.selectionStart = 4
    await textarea.trigger('input')
    const options = wrapper.findAll('[role="option"]')
    expect(options.map((o) => o.text())).toEqual(['${age}', '${agreement}'])
  })

  it('applies a suggestion, closing the brace', async () => {
    const wrapper = mountInput('${ag')
    const textarea = wrapper.find('textarea')
    textarea.element.selectionStart = 4
    await textarea.trigger('input')
    await wrapper.findAll('[role="option"]')[0].trigger('mousedown')
    const emitted = wrapper.emitted('update:modelValue')
    expect(emitted?.at(-1)).toEqual(['${age}'])
  })

  it('offers no suggestions outside a ${ context', async () => {
    const wrapper = mountInput('age + 1')
    const textarea = wrapper.find('textarea')
    textarea.element.selectionStart = 7
    await textarea.trigger('input')
    expect(wrapper.findAll('[role="option"]')).toHaveLength(0)
  })
})
