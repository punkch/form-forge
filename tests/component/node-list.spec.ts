import { flushPromises } from '@vue/test-utils'
import type { Pinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import NodeList from '@/components/canvas/NodeList.vue'
import { newDocument } from '@/core/model/factory'
import { useFormStore } from '@/stores/form'

import { freshPinia, mountWith } from './helpers'

// Pins the canvas ARIA-tree contract established by the 2026-07-23 a11y
// remediation: the ROOT list carries role="tree" (the role used to sit on
// FormEditorView's <main>, wrongly wrapping the guide callout + empty state),
// while nested container lists are role="group" — never a nested tree.
describe('NodeList tree/group roles', () => {
  let pinia: Pinia

  beforeEach(() => {
    pinia = freshPinia()
    const form = useFormStore()
    form.doc = newDocument('T')
  })

  it('the root list is a labelled multiselectable tree', () => {
    const form = useFormStore()
    form.addNode('text', null)
    const wrapper = mountWith(pinia, NodeList, {
      props: { list: form.doc!.children, parentId: null, root: true },
    })
    const list = wrapper.find('.node-list')
    expect(list.attributes('role')).toBe('tree')
    expect(list.attributes('aria-multiselectable')).toBe('true')
    expect(list.attributes('aria-label')).toBe('Form structure')
  })

  it('the empty state renders OUTSIDE the tree element', () => {
    const wrapper = mountWith(pinia, NodeList, {
      props: { list: [], parentId: null, root: true },
    })
    const empty = wrapper.find('[data-testid="canvas-empty"]')
    expect(empty.exists()).toBe(true)
    expect(wrapper.find('.node-list [data-testid="canvas-empty"]').exists()).toBe(false)
  })

  it('nested lists are groups, not trees', async () => {
    const form = useFormStore()
    const groupId = form.addNode('group', null) as string
    form.addNode('text', groupId)
    const wrapper = mountWith(pinia, NodeList, {
      props: { list: form.doc!.children, parentId: null, root: true },
    })
    // TreeNodeCard pulls its nested NodeList in via defineAsyncComponent
    // (import-cycle breaker) — let it resolve before asserting.
    await flushPromises()
    const lists = wrapper.findAll('.node-list')
    expect(lists.length).toBeGreaterThan(1)
    const nested = lists[1]
    expect(nested.attributes('role')).toBe('group')
    expect(nested.attributes('aria-multiselectable')).toBeUndefined()
    expect(nested.attributes('aria-label')).toBeUndefined()
  })
})
