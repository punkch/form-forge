import type { Pinia } from 'pinia'
import type { VueWrapper } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import ChoicesSection from '@/components/properties/ChoicesSection.vue'
import { newDocument } from '@/core/model/factory'
import type { QuestionNode } from '@/core/model/types'
import { useFormStore } from '@/stores/form'

import { freshPinia, mountWith } from './helpers'

const repo = vi.hoisted(() => ({
  addAttachment: vi.fn(),
  deleteAttachment: vi.fn(async (): Promise<void> => {}),
  getAttachment: vi.fn(async () => undefined),
  listAttachments: vi.fn(async () => []),
  pruneOrphans: vi.fn(async (): Promise<void> => {}),
}))
vi.mock('@/persistence/attachments-repo', () => repo)

const settle = async (): Promise<void> => {
  await nextTick()
  await nextTick()
}

describe('ChoicesSection choice media', () => {
  let pinia: Pinia
  let node: QuestionNode

  beforeEach(() => {
    pinia = freshPinia()
    const form = useFormStore()
    form.doc = newDocument('T')
    const id = form.addNode('select_one', null) as string
    node = form.getNode(id) as QuestionNode
  })

  const mountSection = (): VueWrapper =>
    mountWith(pinia, ChoicesSection, {
      props: { node },
      global: { stubs: { teleport: true } },
    })

  it('shows no warning dot on a choice with no media', () => {
    const wrapper = mountSection()
    expect(wrapper.find('[data-testid="choice-media-missing-0"]').exists()).toBe(false)
  })

  it('opens the media popover for a choice and sets an image via the select', async () => {
    const form = useFormStore()
    form.doc!.attachments.push({ id: '1', filename: 'opt.png', mediatype: 'image/png', size: 10, role: 'media' })
    const wrapper = mountSection()

    await wrapper.find('[data-testid="choice-media-0"]').trigger('click')
    await settle()
    await wrapper.find('[data-testid="choice-media-add-0-image"]').trigger('click')
    await settle()

    // The Choices section also has its own "Choice list" Select — target the
    // media popover's specific one by its data-testid.
    const mediaSelect = wrapper.findAllComponents({ name: 'Select' })
      .find((s) => s.attributes('data-testid') === 'choice-media-0-image-select')
    expect(mediaSelect).toBeDefined()
    await mediaSelect!.vm.$emit('update:modelValue', 'opt.png')

    const list = form.doc!.choiceLists[node.listRef as string]
    expect(list.choices[0].media?.image).toEqual({ default: 'opt.png' })
  })

  it('marks a choice with a missing media reference with a warning dot', async () => {
    const form = useFormStore()
    const list = form.doc!.choiceLists[node.listRef as string]
    list.choices[0].media = { image: { default: 'gone.png' } }
    const wrapper = mountSection()

    expect(wrapper.find('[data-testid="choice-media-missing-0"]').exists()).toBe(true)
  })
})
