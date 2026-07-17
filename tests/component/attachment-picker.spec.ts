import type { Pinia } from 'pinia'
import type { VueWrapper } from '@vue/test-utils'
import { beforeEach, describe, expect, it } from 'vitest'

import AttachmentPicker from '@/components/properties/AttachmentPicker.vue'
import { newDocument } from '@/core/model/factory'
import { useFormStore } from '@/stores/form'

import { freshPinia, mountWith } from './helpers'

describe('AttachmentPicker', () => {
  let pinia: Pinia

  beforeEach(() => {
    pinia = freshPinia()
    const form = useFormStore()
    form.doc = newDocument('T')
    form.doc.attachments = [
      { id: '1', filename: 'a.png', mediatype: 'image/png', size: 10, role: 'media' },
      { id: '2', filename: 'b.mp3', mediatype: 'audio/mpeg', size: 10, role: 'media' },
    ]
  })

  const mountPicker = (props: Record<string, unknown> = {}): VueWrapper =>
    mountWith(pinia, AttachmentPicker, {
      props: {
        filename: null,
        kind: 'image',
        missing: false,
        varies: false,
        testidPrefix: 'prop-media-image',
        ...props,
      },
    })

  const select = (wrapper: VueWrapper) => wrapper.findComponent({ name: 'Select' })

  it('renders empty with no status line and an Upload label', () => {
    const wrapper = mountPicker()
    expect(wrapper.find('[data-testid="prop-media-image-status"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="prop-media-image-varies"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="prop-media-image-upload"]').text()).toBe('Upload')
  })

  it('renders attached with a Replace label', () => {
    const wrapper = mountPicker({ filename: 'a.png' })
    const status = wrapper.find('[data-testid="prop-media-image-status"]')
    expect(status.attributes('data-state')).toBe('attached')
    expect(status.text()).toContain('a.png')
    expect(wrapper.find('[data-testid="prop-media-image-upload"]').text()).toBe('Replace')
  })

  it('renders missing with the missing data-state', () => {
    const wrapper = mountPicker({ filename: 'a.png', missing: true })
    expect(wrapper.find('[data-testid="prop-media-image-status"]').attributes('data-state')).toBe('missing')
  })

  it('renders the varies hint instead of a status line', () => {
    const wrapper = mountPicker({ varies: true })
    expect(wrapper.find('[data-testid="prop-media-image-varies"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="prop-media-image-status"]').exists()).toBe(false)
  })

  it('filters the select options by mediatype prefix for the kind', () => {
    const wrapper = mountPicker({ kind: 'audio', testidPrefix: 'prop-media-audio' })
    const options = select(wrapper).props('options') as Array<{ value: string }>
    expect(options.map((o) => o.value)).toEqual(['b.mp3'])
  })

  it('treats bigImage like image for the mediatype filter', () => {
    const wrapper = mountPicker({ kind: 'bigImage', testidPrefix: 'prop-media-bigImage' })
    const options = select(wrapper).props('options') as Array<{ value: string }>
    expect(options.map((o) => o.value)).toEqual(['a.png'])
  })

  it('includes a set-but-missing filename as a synthetic option so it still shows as selected', () => {
    const wrapper = mountPicker({ filename: 'gone.png', missing: true })
    const options = select(wrapper).props('options') as Array<{ value: string }>
    expect(options.map((o) => o.value)).toContain('gone.png')
  })

  it('emits pick with the chosen filename', async () => {
    const wrapper = mountPicker()
    await select(wrapper).vm.$emit('update:modelValue', 'a.png')
    expect(wrapper.emitted('pick')).toEqual([['a.png']])
  })

  it('emits pick(null) on clear', async () => {
    const wrapper = mountPicker({ filename: 'a.png' })
    await select(wrapper).vm.$emit('update:modelValue', null)
    expect(wrapper.emitted('pick')).toEqual([[null]])
  })

  it('emits upload with the picked file', async () => {
    const wrapper = mountPicker()
    const input = wrapper.find('[data-testid="prop-media-image-upload-input"]')
    const file = new File(['x'], 'new.png', { type: 'image/png' })
    Object.defineProperty(input.element, 'files', { value: [file], configurable: true })
    await input.trigger('change')
    expect(wrapper.emitted('upload')?.[0]).toEqual([file])
  })
})
