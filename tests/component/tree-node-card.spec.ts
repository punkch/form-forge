import type { Pinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import TreeNodeCard from '@/components/canvas/TreeNodeCard.vue'
import { newDocument } from '@/core/model/factory'
import type { QuestionNode } from '@/core/model/types'
import { useFormStore } from '@/stores/form'

import { freshPinia, mountWith } from './helpers'

describe('TreeNodeCard', () => {
  let pinia: Pinia

  beforeEach(() => {
    pinia = freshPinia()
    const form = useFormStore()
    form.doc = newDocument('T')
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
})
