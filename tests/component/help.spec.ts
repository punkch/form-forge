import { describe, expect, it } from 'vitest'
import { nextTick } from 'vue'

import HelpPopover from '@/components/help/HelpPopover.vue'
import HelpReference from '@/components/help/HelpReference.vue'
import QuestionTypeHelpDrawer from '@/components/help/QuestionTypeHelpDrawer.vue'
import { useEditorStore } from '@/stores/editor'

import { freshPinia, mountWith } from './helpers'

const settle = async (): Promise<void> => {
  await nextTick()
  await nextTick()
}

describe('QuestionTypeHelpDrawer', () => {
  it('renders behavior text, appearances and platform badges for the help type', async () => {
    const pinia = freshPinia()
    const editor = useEditorStore()
    const wrapper = mountWith(pinia, QuestionTypeHelpDrawer, {
      global: { stubs: { teleport: true } },
    })
    expect(wrapper.find('[data-testid="help-content"]').exists()).toBe(false)

    editor.openTypeHelp('select_one')
    await settle()

    const content = wrapper.find('[data-testid="help-content"]')
    expect(content.exists()).toBe(true)
    expect(wrapper.text()).toContain('Select one')
    expect(wrapper.text()).toContain('exactly one choice')

    const appearances = wrapper.find('[data-testid="help-appearances"]')
    expect(appearances.exists()).toBe(true)
    expect(appearances.text()).toContain('minimal')
    expect(appearances.text()).toContain('likert')
    expect(appearances.text()).toContain('Collect')
    expect(appearances.text()).toContain('Enketo')

    // Parameters straight from the registry (randomize/seed on selects).
    const parameters = wrapper.find('[data-testid="help-parameters"]')
    expect(parameters.exists()).toBe(true)
    expect(parameters.text()).toContain('randomize')

    expect(wrapper.find('[data-testid="help-read-more"]').attributes('href'))
      .toBe('https://docs.getodk.org/form-question-types/#single-select-widget')
  })

  it('closing the drawer clears the active dialog', async () => {
    const pinia = freshPinia()
    const editor = useEditorStore()
    const wrapper = mountWith(pinia, QuestionTypeHelpDrawer, {
      global: { stubs: { teleport: true } },
    })
    editor.openTypeHelp('text')
    await settle()
    await wrapper.find('.p-drawer-close-button').trigger('click')
    await settle()
    expect(editor.activeDialog).toBe(null)
  })
})

describe('HelpReference', () => {
  it('filters the grouped type list by search and opens an entry inline', async () => {
    const pinia = freshPinia()
    const editor = useEditorStore()
    const wrapper = mountWith(pinia, HelpReference, {
      global: { stubs: { teleport: true } },
    })
    editor.activeDialog = 'help-reference'
    await settle()

    expect(wrapper.find('[data-testid="help-ref-item-select_one"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="help-ref-item-rank"]').exists()).toBe(true)

    await wrapper.find('[data-testid="help-search"]').setValue('rank')
    expect(wrapper.find('[data-testid="help-ref-item-rank"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="help-ref-item-select_one"]').exists()).toBe(false)

    await wrapper.find('[data-testid="help-ref-item-rank"]').trigger('click')
    const detail = wrapper.find('[data-testid="help-ref-detail"]')
    expect(detail.exists()).toBe(true)
    expect(detail.text()).toContain('Rank')
    expect(detail.text()).toContain('preferred order')

    await wrapper.find('[data-testid="help-ref-back"]').trigger('click')
    expect(wrapper.find('[data-testid="help-search"]').exists()).toBe(true)
  })

  it('shows an empty state when nothing matches', async () => {
    const pinia = freshPinia()
    const editor = useEditorStore()
    const wrapper = mountWith(pinia, HelpReference, {
      global: { stubs: { teleport: true } },
    })
    editor.activeDialog = 'help-reference'
    await settle()
    await wrapper.find('[data-testid="help-search"]').setValue('zzz-no-such-type')
    expect(wrapper.find('[data-testid="help-ref-empty"]').exists()).toBe(true)
  })
})

describe('HelpPopover', () => {
  it('renders the field explanation and XLSForm column on toggle', async () => {
    const pinia = freshPinia()
    const wrapper = mountWith(pinia, HelpPopover, {
      props: { field: 'relevant' },
      global: { stubs: { teleport: true } },
    })
    expect(wrapper.find('[data-testid="field-help-body-relevant"]').exists()).toBe(false)

    await wrapper.find('[data-testid="field-help-relevant"]').trigger('click')
    await settle()

    const body = wrapper.find('[data-testid="field-help-body-relevant"]')
    expect(body.exists()).toBe(true)
    expect(body.text()).toContain('Skip logic')
    expect(body.text()).toContain('relevant')
  })
})
