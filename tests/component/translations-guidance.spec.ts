import type { Pinia } from 'pinia'
import type { VueWrapper } from '@vue/test-utils'
import { beforeEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'

import TranslationsDialog from '@/components/translations/TranslationsDialog.vue'
import { newDocument } from '@/core/model/factory'
import { useEditorStore } from '@/stores/editor'
import { useFormStore } from '@/stores/form'
import { useUiStore } from '@/stores/ui'

import { freshPinia, mountWith } from './helpers'

describe('TranslationsDialog guidance', () => {
  let pinia: Pinia

  beforeEach(() => {
    // The ui store persists callout dismissals to localStorage; isolate tests.
    localStorage.clear()
    pinia = freshPinia()
    const form = useFormStore()
    const editor = useEditorStore()
    form.doc = newDocument('T')
    editor.activeDialog = 'translations'
  })

  const mountDialog = async (): Promise<VueWrapper> => {
    const wrapper = mountWith(pinia, TranslationsDialog, {
      global: { stubs: { teleport: true } },
    })
    await nextTick()
    return wrapper
  }

  it('renders the guide trigger in the dialog header and opens the translations guide', async () => {
    const editor = useEditorStore()
    const wrapper = await mountDialog()

    const trigger = wrapper.find('[data-testid="guide-trigger-translations"]')
    expect(trigger.exists()).toBe(true)

    await trigger.trigger('click')
    expect(editor.helpGuideId).toBe('translations')
    expect(editor.activeDialog).toBe('help-reference')
  })

  it('keeps the dialog title text next to the trigger', async () => {
    const wrapper = await mountDialog()
    expect(wrapper.find('.translations-header').text()).toContain('Translations')
  })

  it('shows the first-use callout until dismissed, then records the dismissal', async () => {
    const ui = useUiStore()
    const wrapper = await mountDialog()

    expect(wrapper.find('[data-testid="guide-callout-translations"]').exists()).toBe(true)

    await wrapper.find('[data-testid="guide-callout-dismiss-translations"]').trigger('click')
    expect(wrapper.find('[data-testid="guide-callout-translations"]').exists()).toBe(false)
    expect(ui.isCalloutDismissed('translations')).toBe(true)
  })

  it('does not render the callout when it was already dismissed', async () => {
    useUiStore().dismissCallout('translations')
    const wrapper = await mountDialog()

    expect(wrapper.find('[data-testid="guide-callout-translations"]').exists()).toBe(false)
    // The header trigger stays available as the pull-based entry point.
    expect(wrapper.find('[data-testid="guide-trigger-translations"]').exists()).toBe(true)
  })

  it('opens the translations guide from the callout learn-more link', async () => {
    const editor = useEditorStore()
    const wrapper = await mountDialog()

    await wrapper.find('[data-testid="guide-callout-learn-more-translations"]').trigger('click')
    expect(editor.helpGuideId).toBe('translations')
    expect(editor.activeDialog).toBe('help-reference')
  })
})
