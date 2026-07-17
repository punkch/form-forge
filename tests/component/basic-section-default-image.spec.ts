import type { Pinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import BasicSection from '@/components/properties/BasicSection.vue'
import { newDocument } from '@/core/model/factory'
import type { QuestionNode } from '@/core/model/types'
import { useFormStore } from '@/stores/form'

import { freshPinia, mountWith } from './helpers'

// Upload isn't exercised here (covered by AttachmentPicker's own emit
// contract + use-media-attachment.spec.ts's conflict/upload coverage) but
// useMediaAttachment's composable is wired regardless, so keep the repo
// mocked to avoid touching IndexedDB.
const repo = vi.hoisted(() => ({
  addAttachment: vi.fn(),
  deleteAttachment: vi.fn(async (): Promise<void> => {}),
  getAttachment: vi.fn(async () => undefined),
  listAttachments: vi.fn(async () => []),
  pruneOrphans: vi.fn(async (): Promise<void> => {}),
}))
vi.mock('@/persistence/attachments-repo', () => repo)

describe('BasicSection default-image swap', () => {
  let pinia: Pinia

  beforeEach(() => {
    pinia = freshPinia()
    const form = useFormStore()
    form.doc = newDocument('T')
    form.recordId = 'r1'
  })

  const addNode = (type: string): QuestionNode => {
    const form = useFormStore()
    const id = form.addNode(type, null) as string
    return form.getNode(id) as QuestionNode
  }

  it('renders the attachment picker for an image question with a plain (or empty) default', () => {
    const node = addNode('image')
    const wrapper = mountWith(pinia, BasicSection, { props: { node } })
    expect(wrapper.find('[data-testid="prop-default-image"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="prop-default"]').exists()).toBe(false)
  })

  it('renders a plain InputText for a non-image question default', () => {
    const node = addNode('text')
    const wrapper = mountWith(pinia, BasicSection, { props: { node } })
    expect(wrapper.find('[data-testid="prop-default"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="prop-default-image"]').exists()).toBe(false)
  })

  it('falls back to InputText for a dynamic (expression) stored default', () => {
    const node = addNode('image')
    const form = useFormStore()
    form.updateNode(node.id, 'set default', (n) => { n.defaultValue = '${photo_template}' })
    const wrapper = mountWith(pinia, BasicSection, { props: { node } })
    expect(wrapper.find('[data-testid="prop-default-image"]').exists()).toBe(false)
    const input = wrapper.find('[data-testid="prop-default"]')
    expect(input.exists()).toBe(true)
    expect((input.element as HTMLInputElement).value).toBe('${photo_template}')
  })

  it('picking an existing attachment writes the bare filename (no jr://images/ prefix)', async () => {
    const node = addNode('image')
    const form = useFormStore()
    form.doc!.attachments.push({ id: '1', filename: 'template.png', mediatype: 'image/png', size: 10, role: 'media' })
    const wrapper = mountWith(pinia, BasicSection, { props: { node } })

    await wrapper.findComponent({ name: 'Select' }).vm.$emit('update:modelValue', 'template.png')

    expect((form.getNode(node.id) as QuestionNode).defaultValue).toBe('template.png')
  })

  it('clearing the picker clears defaultValue', async () => {
    const node = addNode('image')
    const form = useFormStore()
    form.updateNode(node.id, 'set default', (n) => { n.defaultValue = 'template.png' })
    const wrapper = mountWith(pinia, BasicSection, { props: { node } })

    await wrapper.findComponent({ name: 'Select' }).vm.$emit('update:modelValue', null)

    expect((form.getNode(node.id) as QuestionNode).defaultValue).toBeUndefined()
  })

  it('flags a set filename absent from doc.attachments as missing', () => {
    const node = addNode('image')
    const form = useFormStore()
    form.updateNode(node.id, 'set default', (n) => { n.defaultValue = 'gone.png' })
    const wrapper = mountWith(pinia, BasicSection, { props: { node } })

    expect(wrapper.find('[data-testid="prop-default-image-status"]').attributes('data-state')).toBe('missing')
  })
})
