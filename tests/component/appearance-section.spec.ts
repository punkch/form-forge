import type { VueWrapper } from '@vue/test-utils'
import ConfirmationService from 'primevue/confirmationservice'
import ToastService from 'primevue/toastservice'
import { beforeEach, describe, expect, it } from 'vitest'
import { defineComponent, nextTick } from 'vue'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'

import { db } from '@/persistence/db'
import { useUiStore } from '@/stores/ui'
import { ACCENTS } from '@/theme'
import SettingsView from '@/views/SettingsView.vue'

import { freshPinia, mountWith } from './helpers'

const Empty = defineComponent({ template: '<div />' })

const makeRouter = (): Router =>
  createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'library', component: Empty },
      { path: '/settings', name: 'settings', component: Empty },
    ],
  })

const findTestId = (wrapper: VueWrapper, id: string) => wrapper.find(`[data-testid="${id}"]`)

const mountView = (pinia = freshPinia()): VueWrapper =>
  mountWith(pinia, SettingsView, {
    global: {
      stubs: { teleport: true },
      // SettingsView embeds CentralServersSection (useConfirm) and toasts.
      plugins: [makeRouter(), ToastService, ConfirmationService],
    },
  })

beforeEach(async () => {
  localStorage.clear()
  await db.forms.clear()
})

describe('SettingsView appearance section', () => {
  it('renders the colour-scheme select and one swatch per accent', () => {
    const wrapper = mountView()

    expect(findTestId(wrapper, 'settings-theme-select').exists()).toBe(true)
    expect(findTestId(wrapper, 'settings-accent-swatches').exists()).toBe(true)
    for (const accent of ACCENTS) {
      expect(findTestId(wrapper, `accent-swatch-${accent.id}`).exists()).toBe(true)
    }

    const select = wrapper
      .findAllComponents({ name: 'Select' })
      .find((c) => c.attributes('data-testid') === 'settings-theme-select')
    expect(select, 'settings-theme-select').toBeDefined()
    expect(select!.props('options')).toEqual([
      { value: 'light', label: 'Light' },
      { value: 'dark', label: 'Dark' },
      { value: 'system', label: 'Follow system' },
    ])
  })

  it('updates ui.theme when the scheme select changes', async () => {
    const pinia = freshPinia()
    const ui = useUiStore()
    const wrapper = mountView(pinia)

    const select = wrapper
      .findAllComponents({ name: 'Select' })
      .find((c) => c.attributes('data-testid') === 'settings-theme-select')
    select!.vm.$emit('update:modelValue', 'dark')
    await nextTick()

    expect(ui.theme).toBe('dark')
  })

  it('updates ui.accent when a swatch is clicked and reflects aria-pressed', async () => {
    const pinia = freshPinia()
    const ui = useUiStore()
    const wrapper = mountView(pinia)

    // Default accent stays until a swatch is chosen.
    expect(ui.accent).toBe('purple')
    expect(findTestId(wrapper, 'accent-swatch-purple').attributes('aria-pressed')).toBe('true')

    await findTestId(wrapper, 'accent-swatch-blue').trigger('click')
    await nextTick()

    expect(ui.accent).toBe('blue')
    expect(findTestId(wrapper, 'accent-swatch-blue').attributes('aria-pressed')).toBe('true')
    expect(findTestId(wrapper, 'accent-swatch-purple').attributes('aria-pressed')).toBe('false')
  })

  it('renders the contrast select with three options next to the scheme select', () => {
    const wrapper = mountView()

    expect(findTestId(wrapper, 'settings-contrast-select').exists()).toBe(true)

    const select = wrapper
      .findAllComponents({ name: 'Select' })
      .find((c) => c.attributes('data-testid') === 'settings-contrast-select')
    expect(select, 'settings-contrast-select').toBeDefined()
    expect(select!.props('options')).toEqual([
      { value: 'normal', label: 'Normal' },
      { value: 'high', label: 'High' },
      { value: 'system', label: 'Follow system' },
    ])
  })

  it('updates ui.contrast when the contrast select changes', async () => {
    const pinia = freshPinia()
    const ui = useUiStore()
    const wrapper = mountView(pinia)

    expect(ui.contrast).toBe('system')

    const select = wrapper
      .findAllComponents({ name: 'Select' })
      .find((c) => c.attributes('data-testid') === 'settings-contrast-select')
    select!.vm.$emit('update:modelValue', 'high')
    await nextTick()

    expect(ui.contrast).toBe('high')
  })
})
