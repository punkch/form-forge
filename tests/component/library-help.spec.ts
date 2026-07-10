import { flushPromises, type VueWrapper } from '@vue/test-utils'
import ConfirmationService from 'primevue/confirmationservice'
import ToastService from 'primevue/toastservice'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, nextTick } from 'vue'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'

import { db } from '@/persistence/db'
import { useEditorStore } from '@/stores/editor'
import FormLibraryView from '@/views/FormLibraryView.vue'

import { freshPinia, mountWith } from './helpers'

const Empty = defineComponent({ template: '<div />' })

const makeRouter = (): Router =>
  createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'library', component: Empty },
      { path: '/forms/:formId', name: 'editor', component: Empty },
      { path: '/settings', name: 'settings', component: Empty },
    ],
  })

const mountView = (): VueWrapper =>
  mountWith(freshPinia(), FormLibraryView, {
    global: {
      stubs: { teleport: true },
      plugins: [makeRouter(), ToastService, ConfirmationService],
    },
  })

// The drawer is a defineAsyncComponent; dynamicImportSettled awaits its loader,
// then the tick/flush let the resolved component render.
const settle = async (): Promise<void> => {
  await vi.dynamicImportSettled()
  await nextTick()
  await flushPromises()
}

beforeEach(async () => {
  await db.forms.clear()
})

describe('FormLibraryView — help drawer entry point', () => {
  it('renders the help button in the toolbar actions', () => {
    const wrapper = mountView()
    const actions = wrapper.find('.library-actions')
    expect(actions.find('[data-testid="library-help"]').exists()).toBe(true)
    // Existing toolbar controls stay intact.
    expect(actions.find('[data-testid="import-form"]').exists()).toBe(true)
    expect(actions.find('[data-testid="new-form"]').exists()).toBe(true)
    expect(actions.find('[data-testid="settings-gear"]').exists()).toBe(true)
  })

  it('clicking the help button opens the drawer in list mode', async () => {
    const wrapper = mountView()
    const editor = useEditorStore()
    expect(wrapper.find('[data-testid="help-drawer"]').exists()).toBe(false)

    await wrapper.find('[data-testid="library-help"]').trigger('click')
    await settle()

    // List mode: no type/guide preselected, so the browsable list renders.
    expect(editor.activeDialog).toBe('help-reference')
    expect(editor.helpGuideId).toBe(null)
    expect(editor.helpTypeId).toBe(null)
    expect(wrapper.find('[data-testid="help-drawer"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="help-reference"]').exists()).toBe(true)
  })

  it('closing the drawer returns the library to its idle state', async () => {
    const wrapper = mountView()
    const editor = useEditorStore()
    await wrapper.find('[data-testid="library-help"]').trigger('click')
    await settle()

    editor.activeDialog = null
    await settle()
    expect(wrapper.find('[data-testid="help-drawer"]').exists()).toBe(false)
  })
})
