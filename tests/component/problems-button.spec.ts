import type { VueWrapper } from '@vue/test-utils'
import type { Pinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'

import ProblemsButton from '@/components/shell/ProblemsButton.vue'
import { createNode, newDocument } from '@/core/model/factory'
import { insertNode } from '@/core/model/ops'
import { DEFAULT_LANG, type FormNode } from '@/core/model/types'
import { error, warning } from '@/core/validate/issues'
import { useEditorStore } from '@/stores/editor'
import { useFormStore } from '@/stores/form'

import { freshPinia, mountWith } from './helpers'

const settle = async (): Promise<void> => {
  await nextTick()
  await nextTick()
}

describe('ProblemsButton', () => {
  let pinia: Pinia

  beforeEach(() => {
    pinia = freshPinia()
    const form = useFormStore()
    // Built outside store mutations so no debounced re-validation can
    // overwrite the manually seeded issues below.
    form.doc = newDocument('T')
  })

  const addQuestion = (label?: string): FormNode => {
    const form = useFormStore()
    const doc = form.doc!
    const node = createNode(doc, 'text')
    // createNode seeds a default label; clear it to exercise the name fallback.
    node.label = label === undefined ? undefined : { [DEFAULT_LANG]: label }
    insertNode(doc, node, null)
    return node
  }

  const mountAndOpen = async (): Promise<VueWrapper> => {
    const wrapper = mountWith(pinia, ProblemsButton, {
      global: { stubs: { teleport: true } },
    })
    await wrapper.find('[data-testid="problems-button"]').trigger('click')
    await settle()
    return wrapper
  }

  it('shows a location chip with the node label, falling back to the name', async () => {
    const form = useFormStore()
    const labelled = addQuestion('Your age?')
    const unlabelled = addQuestion()
    form.issues = [
      error('a.code', 'Broken thing', { nodeId: labelled.id }),
      error('b.code', 'Other thing', { nodeId: unlabelled.id }),
    ]

    const wrapper = await mountAndOpen()
    const chips = wrapper.findAll('[data-testid="problem-location"]')
    expect(chips.map((c) => c.text())).toEqual(['Your age?', unlabelled.name])
    expect(wrapper.find('[data-testid="problems-list"]').text()).toContain('Broken thing')
  })

  it('groups issues sharing code and message into one row with a chip per node', async () => {
    const form = useFormStore()
    const first = addQuestion('First')
    const second = addQuestion('Second')
    form.issues = [
      error('name.duplicate', 'The name "age" is used 2 times.', { nodeId: first.id }),
      error('name.duplicate', 'The name "age" is used 2 times.', { nodeId: second.id }),
      warning('other.code', 'Something else entirely.', { nodeId: first.id }),
    ]

    const wrapper = await mountAndOpen()
    const rows = wrapper.findAll('[data-testid="problem-row"]')
    expect(rows).toHaveLength(2)
    const grouped = rows[0]
    expect(grouped.text()).toContain('used 2 times')
    expect(grouped.findAll('[data-testid="problem-location"]').map((c) => c.text()))
      .toEqual(['First', 'Second'])
  })

  it('clicking a location chip selects the node and closes the popover', async () => {
    const form = useFormStore()
    const editor = useEditorStore()
    const node = addQuestion('Target')
    form.issues = [error('a.code', 'Broken thing', { nodeId: node.id })]

    const wrapper = await mountAndOpen()
    await wrapper.find('[data-testid="problem-location"]').trigger('click')
    expect(editor.selectedNodeId).toBe(node.id)
  })

  it('shows localized scope words for issues without a node', async () => {
    const form = useFormStore()
    form.issues = [
      error('settings.bad', 'Bad setting.', { setting: 'version' }),
      warning('trans.missing', 'Missing translation.', { language: 'French (fr)' }),
      error('sheet.bad', 'Bad cell.', { sheet: 'survey', row: 3 }),
      error('list.bad', 'Bad choice list.', { listName: 'yes_no' }),
    ]

    const wrapper = await mountAndOpen()
    const chips = wrapper.findAll('[data-testid="problem-location"]')
    expect(chips.map((c) => c.text()))
      .toEqual(['Settings', 'Translations', 'Spreadsheet', 'yes_no'])
  })

  it('renders the count with danger severity while errors exist', () => {
    const form = useFormStore()
    const node = addQuestion('X')
    form.issues = [
      error('a.code', 'Broken thing', { nodeId: node.id }),
      warning('b.code', 'Sketchy thing', { nodeId: node.id }),
    ]

    const wrapper = mountWith(pinia, ProblemsButton, { global: { stubs: { teleport: true } } })
    const button = wrapper.find('[data-testid="problems-button"]')
    expect(button.text()).toContain('2')
    expect(button.text()).not.toContain('Ready')
    expect(button.classes()).toContain('p-button-danger')
    expect(button.classes()).not.toContain('p-button-success')
    expect(button.find('.pi-times-circle').exists()).toBe(true)
  })

  it('renders the warning treatment when only warnings exist', () => {
    const form = useFormStore()
    const node = addQuestion('X')
    form.issues = [warning('b.code', 'Sketchy thing', { nodeId: node.id })]

    const wrapper = mountWith(pinia, ProblemsButton, { global: { stubs: { teleport: true } } })
    const button = wrapper.find('[data-testid="problems-button"]')
    expect(button.text()).toContain('1')
    expect(button.text()).not.toContain('Ready')
    expect(button.classes()).toContain('p-button-secondary')
    expect(button.find('.pi-exclamation-triangle').exists()).toBe(true)
  })

  it('renders the Ready state when there are no issues', async () => {
    const wrapper = mountWith(pinia, ProblemsButton, { global: { stubs: { teleport: true } } })
    const button = wrapper.find('[data-testid="problems-button"]')
    expect(button.text()).toContain('Ready')
    expect(button.classes()).toContain('p-button-success')
    expect(button.find('.pi-check-circle').exists()).toBe(true)

    await button.trigger('click')
    await settle()
    expect(wrapper.find('[data-testid="problems-list"]').text()).toContain('No problems found.')
  })
})
