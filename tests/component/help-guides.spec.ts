import { describe, expect, it } from 'vitest'
import { nextTick } from 'vue'

import QuestionTypeHelpDrawer from '@/components/help/QuestionTypeHelpDrawer.vue'
import { guideHelp } from '@/help/content'
import { GUIDE_KEYS, guideDocsUrl } from '@/help/guides'
import { translate } from '@/i18n'
import { useEditorStore } from '@/stores/editor'

import { freshPinia, mountWith } from './helpers'

const settle = async (): Promise<void> => {
  await nextTick()
  await nextTick()
}

const mountDrawer = () => {
  const pinia = freshPinia()
  const editor = useEditorStore()
  const wrapper = mountWith(pinia, QuestionTypeHelpDrawer, {
    global: { stubs: { teleport: true } },
  })
  return { editor, wrapper }
}

describe('help drawer — workflow guides', () => {
  it('list mode renders a Guides section with every guide above the type groups', async () => {
    const { editor, wrapper } = mountDrawer()
    editor.activeDialog = 'help-reference'
    await settle()

    expect(wrapper.find('[data-testid="help-guides-section"]').exists()).toBe(true)
    for (const key of GUIDE_KEYS) {
      expect(wrapper.find(`[data-testid="help-guide-item-${key}"]`).exists()).toBe(true)
    }
    // Question types still listed alongside the guides.
    expect(wrapper.find('[data-testid="help-ref-item-select_one"]').exists()).toBe(true)
  })

  it('one search filters guides and question types together and drops empty sections', async () => {
    const { editor, wrapper } = mountDrawer()
    editor.activeDialog = 'help-reference'
    await settle()

    // A guide-only query: the matching guide stays, type groups drop.
    await wrapper.find('[data-testid="help-search"]').setValue(translate(guideHelp.logic.title))
    expect(wrapper.find('[data-testid="help-guide-item-logic"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="help-guide-item-backup"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="help-ref-item-select_one"]').exists()).toBe(false)

    // A type-only query: the Guides section drops entirely.
    await wrapper.find('[data-testid="help-search"]').setValue('barcode')
    expect(wrapper.find('[data-testid="help-guides-section"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="help-ref-item-barcode"]').exists()).toBe(true)

    // Nothing at all matching shows the shared empty state.
    await wrapper.find('[data-testid="help-search"]').setValue('zzz-no-such-topic')
    expect(wrapper.find('[data-testid="help-ref-empty"]').exists()).toBe(true)
  })

  it('opens a guide detail from the list and back returns to the list', async () => {
    const { editor, wrapper } = mountDrawer()
    editor.activeDialog = 'help-reference'
    await settle()

    await wrapper.find('[data-testid="help-guide-item-templates"]').trigger('click')
    const detail = wrapper.find('[data-testid="help-guide-templates"]')
    expect(detail.exists()).toBe(true)
    // Title in the drawer header, summary + every step in the body.
    expect(wrapper.text()).toContain(translate(guideHelp.templates.title))
    expect(detail.text()).toContain(translate(guideHelp.templates.summary))
    expect(detail.findAll('[data-testid="guide-steps"] li'))
      .toHaveLength(guideHelp.templates.steps.length)
    // Templates is an app-specific guide with no docsUrl — no "read more" link.
    expect(detail.find('[data-testid="guide-read-more"]').exists()).toBe(false)

    await wrapper.find('[data-testid="help-ref-back"]').trigger('click')
    expect(editor.helpGuideId).toBe(null)
    expect(wrapper.find('[data-testid="help-search"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="help-guide-templates"]').exists()).toBe(false)
  })

  it('openGuideHelp deep-links the drawer straight to the guide', async () => {
    const { editor, wrapper } = mountDrawer()
    expect(wrapper.find('[data-testid="help-guide-logic"]').exists()).toBe(false)

    editor.openGuideHelp('logic')
    await settle()

    expect(editor.activeDialog).toBe('help-reference')
    const detail = wrapper.find('[data-testid="help-guide-logic"]')
    expect(detail.exists()).toBe(true)
    expect(detail.findAll('[data-testid="guide-steps"] li'))
      .toHaveLength(guideHelp.logic.steps.length)

    // The logic guide carries a docs deep link, rendered as "read more".
    const url = guideDocsUrl('logic')
    expect(url).toMatch(/^https:\/\/docs\.getodk\.org\//)
    expect(detail.find('[data-testid="guide-read-more"]').attributes('href')).toBe(url)
  })

  it('closing the drawer clears the selected guide so it reopens on the list', async () => {
    const { editor, wrapper } = mountDrawer()
    editor.openGuideHelp('datasets')
    await settle()
    expect(wrapper.find('[data-testid="help-guide-datasets"]').exists()).toBe(true)

    editor.activeDialog = null
    await settle()
    editor.activeDialog = 'help-reference'
    await settle()
    expect(wrapper.find('[data-testid="help-reference"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="help-guide-datasets"]').exists()).toBe(false)
  })

  it('type help and guide help deep links displace each other', async () => {
    const { editor } = mountDrawer()
    editor.openTypeHelp('text')
    editor.openGuideHelp('logic')
    expect(editor.helpTypeId).toBe(null)
    expect(editor.helpGuideId).toBe('logic')

    editor.openTypeHelp('text')
    expect(editor.helpGuideId).toBe(null)
    expect(editor.helpTypeId).toBe('text')

    editor.reset()
    expect(editor.helpGuideId).toBe(null)
    expect(editor.activeDialog).toBe(null)
  })
})
