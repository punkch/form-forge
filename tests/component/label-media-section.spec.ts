import type { Pinia } from 'pinia'
import type { VueWrapper } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import LabelMediaSection from '@/components/properties/LabelMediaSection.vue'
import { newDocument } from '@/core/model/factory'
import { setSiteText, type TranslationSiteRef } from '@/core/model/translations'
import type { FormNode } from '@/core/model/types'
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

const EN = 'English (en)'
const FR = 'French (fr)'

describe('LabelMediaSection', () => {
  let pinia: Pinia
  let node: FormNode

  beforeEach(() => {
    pinia = freshPinia()
    const form = useFormStore()
    form.doc = newDocument('T')
    const id = form.addNode('text', null) as string
    node = form.getNode(id) as FormNode
  })

  const settle = async (): Promise<void> => {
    await nextTick()
    await nextTick()
  }

  const mountSection = (): VueWrapper =>
    mountWith(pinia, LabelMediaSection, {
      props: { node },
      global: { stubs: { teleport: true } },
    })

  const imageRef: TranslationSiteRef = { kind: 'node-media', nodeId: '', slot: 'image' }
  const refFor = (): TranslationSiteRef => ({ ...imageRef, nodeId: node.id })

  it('shows only the add-media button when nothing is set', () => {
    const wrapper = mountSection()
    expect(wrapper.find('[data-testid="prop-media-add"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="prop-media-image"]').exists()).toBe(false)
  })

  it('adding a kind from the menu opens an empty, fillable row', async () => {
    const wrapper = mountSection()
    await wrapper.find('[data-testid="prop-media-add"]').trigger('click')
    await settle()
    await wrapper.find('[data-testid="prop-media-add-image"]').trigger('click')

    expect(wrapper.find('[data-testid="prop-media-image"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="prop-media-image-select"]').exists()).toBe(true)
  })

  it('picking a filename fans out to every current language in one undo step', async () => {
    const form = useFormStore()
    form.doc!.languages.push(EN, FR)
    form.doc!.settings.defaultLanguage = EN
    setSiteText(form.doc!, refFor(), EN, 'a.png')
    setSiteText(form.doc!, refFor(), FR, 'a.png')
    const wrapper = mountSection()

    await wrapper.findComponent({ name: 'Select' }).vm.$emit('update:modelValue', 'b.png')

    const media = (form.getNode(node.id) as FormNode).media
    expect(media?.image).toEqual({ [EN]: 'b.png', [FR]: 'b.png' })

    // One undo step restores BOTH languages to their pre-pick value.
    form.undo()
    const restored = (form.getNode(node.id) as FormNode).media
    expect(restored?.image).toEqual({ [EN]: 'a.png', [FR]: 'a.png' })
  })

  it('clearing preserves a language deliberately left empty, with no {} debris', async () => {
    const form = useFormStore()
    form.doc!.languages.push(EN, FR)
    form.doc!.settings.defaultLanguage = EN
    // Fan-out sets both, then a grid edit deliberately empties FR only.
    setSiteText(form.doc!, refFor(), EN, 'a.png')
    setSiteText(form.doc!, refFor(), FR, 'a.png')
    setSiteText(form.doc!, refFor(), FR, '')
    const wrapper = mountSection()
    expect(wrapper.find('[data-testid="prop-media-image-varies"]').exists()).toBe(false)

    await wrapper.findComponent({ name: 'Select' }).vm.$emit('update:modelValue', null)

    const node2 = form.getNode(node.id) as FormNode
    expect(node2.media?.image).toBeUndefined()
    expect(node2.media).toBeUndefined()
  })

  it('renders a divergent slot as varying rather than a single filename', () => {
    const form = useFormStore()
    form.doc!.languages.push(EN, FR)
    form.doc!.settings.defaultLanguage = EN
    setSiteText(form.doc!, refFor(), EN, 'a.png')
    setSiteText(form.doc!, refFor(), FR, 'fr-specific.png')
    const wrapper = mountSection()

    expect(wrapper.find('[data-testid="prop-media-image-varies"]').exists()).toBe(true)
  })
})
