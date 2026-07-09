import { describe, expect, it } from 'vitest'
import { nextTick } from 'vue'

import EditorDialogs from '@/components/EditorDialogs.vue'
import { newDocument } from '@/core/model/factory'
import { useEditorStore } from '@/stores/editor'
import { useFormStore } from '@/stores/form'

import { freshPinia, mountWith } from './helpers'

describe('EditorDialogs', () => {
  it('opens the dialog matching editor.activeDialog', async () => {
    const pinia = freshPinia()
    const form = useFormStore()
    const editor = useEditorStore()
    form.doc = newDocument('T')

    const wrapper = mountWith(pinia, EditorDialogs, {
      global: { stubs: { teleport: true } },
    })
    await nextTick()
    expect(wrapper.find('[data-testid="choice-list-manager"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="translations-dialog"]').exists()).toBe(false)

    editor.activeDialog = 'choice-lists'
    await nextTick()
    await nextTick()
    expect(wrapper.find('[data-testid="choice-list-manager"]').exists()).toBe(true)

    editor.activeDialog = 'translations'
    await nextTick()
    await nextTick()
    expect(wrapper.find('[data-testid="translations-dialog"]').exists()).toBe(true)
  })
})
