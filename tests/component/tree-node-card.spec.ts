import type { Pinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import TreeNodeCard from '@/components/canvas/TreeNodeCard.vue'
import { newDocument } from '@/core/model/factory'
import type { QuestionNode } from '@/core/model/types'
import { useEditorStore } from '@/stores/editor'
import { useFormStore } from '@/stores/form'

import { freshPinia, mountWith } from './helpers'

describe('TreeNodeCard', () => {
  let pinia: Pinia

  beforeEach(() => {
    pinia = freshPinia()
    const form = useFormStore()
    form.doc = newDocument('T')
  })

  // The shift-range test below attaches cards to document.body (needed for
  // the real document.querySelectorAll walk it exercises); wipe it after
  // every test so a leaked node never leaks into another test's DOM query.
  afterEach(() => {
    document.body.innerHTML = ''
  })

  const makeNode = (): QuestionNode => {
    const form = useFormStore()
    const id = form.addNode('integer', null) as string
    return form.getNode(id) as QuestionNode
  }

  it('renders label, type and name', () => {
    const node = makeNode()
    node.label = { default: 'Your age?' }
    const wrapper = mountWith(pinia, TreeNodeCard, { props: { node } })
    expect(wrapper.text()).toContain('Your age?')
    expect(wrapper.text()).toContain('Integer')
    expect(wrapper.text()).toContain(node.name)
  })

  it('shows badges for required/relevant/constraint/calculation/appearance', () => {
    const node = makeNode()
    node.bind.required = 'true()'
    node.bind.relevant = '${x} = 1'
    node.bind.constraint = '. > 0'
    node.bind.calculation = '1 + 1'
    node.body.appearance = 'thousands-sep'
    const wrapper = mountWith(pinia, TreeNodeCard, { props: { node } })
    expect(wrapper.findAll('.node-badge')).toHaveLength(5)
    expect(wrapper.text()).toContain('thousands-sep')
    expect(wrapper.text()).toContain('logic')
    expect(wrapper.text()).toContain('constraint')
    expect(wrapper.text()).toContain('calc')
    // Required stays icon-only: 4 of the 5 badges carry short text.
    expect(wrapper.findAll('.node-badge .badge-text')).toHaveLength(4)
  })

  it('places meta, badges and actions in the footer row', () => {
    const node = makeNode()
    node.bind.required = 'true()'
    const wrapper = mountWith(pinia, TreeNodeCard, { props: { node } })
    const footer = wrapper.find('.node-main .node-footer')
    expect(footer.exists()).toBe(true)
    expect(footer.find('.node-name').exists()).toBe(true)
    expect(footer.find('.node-badge').exists()).toBe(true)
    // Actions are always in the DOM (space reserved; reveal is CSS opacity).
    expect(footer.findAll('.node-actions button')).toHaveLength(2)
    // The label owns the title row alone — no siblings competing for width.
    expect(wrapper.find('.node-main > .node-label').exists()).toBe(true)
  })

  it('duplicate button clones the node', async () => {
    const form = useFormStore()
    const node = makeNode()
    const wrapper = mountWith(pinia, TreeNodeCard, { props: { node } })
    await wrapper.find('.node-actions button').trigger('click')
    expect(form.doc?.children).toHaveLength(2)
  })

  it('delete button removes the node', async () => {
    const form = useFormStore()
    const node = makeNode()
    const wrapper = mountWith(pinia, TreeNodeCard, { props: { node } })
    await wrapper.find('[data-testid="delete-node"]').trigger('click')
    expect(form.doc?.children).toHaveLength(0)
  })

  it('keyboard Alt+ArrowDown moves the node', async () => {
    const form = useFormStore()
    const node = makeNode()
    const secondId = form.addNode('text', null) as string
    const wrapper = mountWith(pinia, TreeNodeCard, { props: { node } })
    await wrapper.find('.node-card').trigger('keydown', { key: 'ArrowDown', altKey: true })
    expect(form.doc?.children.map((n) => n.id)).toEqual([secondId, node.id])
  })

  it('Delete key removes the node', async () => {
    const form = useFormStore()
    const node = makeNode()
    const wrapper = mountWith(pinia, TreeNodeCard, { props: { node } })
    await wrapper.find('.node-card').trigger('keydown', { key: 'Delete' })
    expect(form.doc?.children).toHaveLength(0)
  })

  it('renders children lists for groups', () => {
    const form = useFormStore()
    const groupId = form.addNode('group', null) as string
    const group = form.getNode(groupId)
    const wrapper = mountWith(pinia, TreeNodeCard, { props: { node: group! } })
    expect(wrapper.find('.node-children').exists()).toBe(true)
  })

  describe('multi-select interaction', () => {
    it('ctrl+click toggles the node into, then back out of, the selection', async () => {
      const editor = useEditorStore()
      const a = makeNode()
      const b = makeNode()
      editor.select(a.id)
      const wrapper = mountWith(pinia, TreeNodeCard, { props: { node: b } })

      await wrapper.find('.node-card').trigger('click', { ctrlKey: true })
      expect(editor.selectedNodeIds).toEqual(new Set([a.id, b.id]))
      expect(editor.selectedNodeId).toBe(b.id) // toggled-in node becomes the new anchor

      await wrapper.find('.node-card').trigger('click', { ctrlKey: true })
      expect(editor.selectedNodeIds).toEqual(new Set([a.id]))
    })

    it('shift+click range-selects over the visible cards in DOM order', async () => {
      const editor = useEditorStore()
      const a = makeNode()
      const b = makeNode()
      const c = makeNode()
      // Cards must be attached to the real document — the shift-range walk
      // reads document.querySelectorAll('.node-card[data-node-id]'), which a
      // VTU wrapper's default detached container is invisible to.
      const wrapperA = mountWith(pinia, TreeNodeCard, { props: { node: a }, attachTo: document.body })
      const wrapperB = mountWith(pinia, TreeNodeCard, { props: { node: b }, attachTo: document.body })
      const wrapperC = mountWith(pinia, TreeNodeCard, { props: { node: c }, attachTo: document.body })
      editor.select(a.id)

      await wrapperC.find('.node-card').trigger('click', { shiftKey: true })

      expect(editor.selectedNodeIds).toEqual(new Set([a.id, b.id, c.id]))
      expect(editor.selectedNodeId).toBe(a.id) // the anchor never moves on a range-select

      wrapperA.unmount(); wrapperB.unmount(); wrapperC.unmount()
    })

    it('focus during a pointer interaction does not override the selection', async () => {
      const editor = useEditorStore()
      const a = makeNode()
      const b = makeNode()
      editor.select(a.id)
      const wrapper = mountWith(pinia, TreeNodeCard, { props: { node: b } })

      await wrapper.find('.node-card').trigger('mousedown')
      await wrapper.find('.node-card').trigger('focus')

      // The browser's native mousedown->focus->click sequence must not let
      // focus collapse the selection before the click handler runs its
      // plain/ctrl/shift matrix.
      expect(editor.selectedNodeId).toBe(a.id)
      expect(editor.selectedNodeIds).toEqual(new Set([a.id]))
    })

    it('a plain focus (no preceding pointer interaction) still selects, e.g. keyboard tabbing', async () => {
      const editor = useEditorStore()
      const a = makeNode()
      const b = makeNode()
      editor.select(a.id)
      const wrapper = mountWith(pinia, TreeNodeCard, { props: { node: b } })

      await wrapper.find('.node-card').trigger('focus')

      expect(editor.selectedNodeId).toBe(b.id)
      expect(editor.selectedNodeIds).toEqual(new Set([b.id]))
    })
  })

  describe('multi-selection Delete and Alt+Arrow', () => {
    it('Delete key removes the whole multi-selection, not just this card', async () => {
      const form = useFormStore()
      const editor = useEditorStore()
      const a = makeNode()
      const b = makeNode()
      const c = makeNode()
      editor.selectMany([a.id, b.id])
      const wrapper = mountWith(pinia, TreeNodeCard, { props: { node: a } })

      await wrapper.find('.node-card').trigger('keydown', { key: 'Delete' })

      expect(form.doc?.children.map((n) => n.id)).toEqual([c.id])
      expect(editor.selectedNodeIds.size).toBe(0)
    })

    it('the delete button also removes the whole multi-selection when this card is part of one', async () => {
      const form = useFormStore()
      const editor = useEditorStore()
      const a = makeNode()
      const b = makeNode()
      editor.selectMany([a.id, b.id])
      const wrapper = mountWith(pinia, TreeNodeCard, { props: { node: a } })

      await wrapper.find('[data-testid="delete-node"]').trigger('click')

      expect(form.doc?.children).toHaveLength(0)
    })

    it('Alt+ArrowDown with a multi-selection moves the whole block, not just this card', async () => {
      const form = useFormStore()
      const editor = useEditorStore()
      const a = makeNode()
      const b = makeNode()
      const c = makeNode()
      editor.selectMany([a.id, b.id])
      const wrapper = mountWith(pinia, TreeNodeCard, { props: { node: a } })

      await wrapper.find('.node-card').trigger('keydown', { key: 'ArrowDown', altKey: true })

      // The a/b block moves past c as one unit rather than a lone `a` moving
      // one slot (which would just swap a and b).
      expect(form.doc?.children.map((n) => n.id)).toEqual([c.id, a.id, b.id])
    })

    it('Alt+ArrowDown on a single (non-multi) selection keeps the pre-existing single-node behavior', async () => {
      const form = useFormStore()
      const node = makeNode()
      const secondId = form.addNode('text', null) as string
      const wrapper = mountWith(pinia, TreeNodeCard, { props: { node } })

      await wrapper.find('.node-card').trigger('keydown', { key: 'ArrowDown', altKey: true })

      expect(form.doc?.children.map((n) => n.id)).toEqual([secondId, node.id])
    })
  })
})
