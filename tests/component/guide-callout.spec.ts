import { beforeEach, describe, expect, it } from 'vitest'

import GuideCallout from '@/components/help/GuideCallout.vue'
import GuideTrigger from '@/components/help/GuideTrigger.vue'
import { useEditorStore } from '@/stores/editor'
import { useUiStore } from '@/stores/ui'

import { freshPinia, mountWith } from './helpers'

describe('GuideCallout', () => {
  beforeEach(() => {
    // The ui store persists dismissals to localStorage; isolate each test.
    localStorage.clear()
  })

  it('renders while its id is not dismissed', () => {
    const pinia = freshPinia()
    const wrapper = mountWith(pinia, GuideCallout, { props: { id: 'translations' } })

    expect(wrapper.find('[data-testid="guide-callout-translations"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="guide-callout-dismiss-translations"]').exists()).toBe(true)
  })

  it('hides after the dismiss button and records the id in the ui store', async () => {
    const pinia = freshPinia()
    const ui = useUiStore()
    const wrapper = mountWith(pinia, GuideCallout, { props: { id: 'translations' } })

    await wrapper.find('[data-testid="guide-callout-dismiss-translations"]').trigger('click')

    expect(wrapper.find('[data-testid="guide-callout-translations"]').exists()).toBe(false)
    expect(ui.dismissedCallouts).toContain('translations')
    expect(ui.isCalloutDismissed('translations')).toBe(true)
  })

  it('does not render when the id was already dismissed', () => {
    const pinia = freshPinia()
    useUiStore().dismissCallout('logicRaw')
    const wrapper = mountWith(pinia, GuideCallout, { props: { id: 'logicRaw' } })

    expect(wrapper.find('[data-testid="guide-callout-logicRaw"]').exists()).toBe(false)
  })

  it('dismissing one id leaves other callouts visible', async () => {
    const pinia = freshPinia()
    const translations = mountWith(pinia, GuideCallout, { props: { id: 'translations' } })
    const logicRaw = mountWith(pinia, GuideCallout, { props: { id: 'logicRaw' } })

    await translations.find('[data-testid="guide-callout-dismiss-translations"]').trigger('click')

    expect(translations.find('[data-testid="guide-callout-translations"]').exists()).toBe(false)
    expect(logicRaw.find('[data-testid="guide-callout-logicRaw"]').exists()).toBe(true)
  })

  it('renders slot content inside the callout body', () => {
    const pinia = freshPinia()
    const wrapper = mountWith(pinia, GuideCallout, {
      props: { id: 'translations' },
      slots: { default: '<span data-testid="callout-extra">extra</span>' },
    })

    expect(wrapper.find('[data-testid="callout-extra"]').exists()).toBe(true)
  })
})

describe('GuideTrigger', () => {
  it('renders a real button with the per-guide testid', () => {
    const pinia = freshPinia()
    const wrapper = mountWith(pinia, GuideTrigger, { props: { guide: 'logic' } })

    const button = wrapper.find('[data-testid="guide-trigger-logic"]')
    expect(button.exists()).toBe(true)
    expect(button.element.tagName).toBe('BUTTON')
    expect(button.attributes('type')).toBe('button')
    expect(button.attributes('aria-label')).toBeTruthy()
  })

  it('opens the help drawer at its guide via editor.openGuideHelp', async () => {
    const pinia = freshPinia()
    const editor = useEditorStore()
    const wrapper = mountWith(pinia, GuideTrigger, { props: { guide: 'logic' } })

    await wrapper.find('[data-testid="guide-trigger-logic"]').trigger('click')

    expect(editor.helpGuideId).toBe('logic')
    expect(editor.activeDialog).toBe('help-reference')
  })
})
