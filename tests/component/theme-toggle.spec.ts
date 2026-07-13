import { beforeEach, describe, expect, it } from 'vitest'

import ThemeToggle from '@/components/shell/ThemeToggle.vue'
import { useUiStore } from '@/stores/ui'

import { freshPinia, mountWith } from './helpers'

beforeEach(() => {
  localStorage.clear()
})

describe('ThemeToggle', () => {
  it('cycles system -> light -> dark -> system on the ui store', async () => {
    const pinia = freshPinia()
    const ui = useUiStore()
    // Cleared storage → the store's DEFAULT_THEME.
    expect(ui.theme).toBe('system')

    const wrapper = mountWith(pinia, ThemeToggle)
    const toggle = wrapper.get('[data-testid="theme-toggle"]')

    // system → desktop icon, aria-label names the current state.
    expect(toggle.find('.pi-desktop').exists()).toBe(true)
    expect(toggle.attributes('aria-label')).toContain('Follow system')

    await toggle.trigger('click')
    expect(ui.theme).toBe('light')
    expect(toggle.find('.pi-sun').exists()).toBe(true)
    expect(toggle.attributes('aria-label')).toContain('Light')

    await toggle.trigger('click')
    expect(ui.theme).toBe('dark')
    expect(toggle.find('.pi-moon').exists()).toBe(true)
    expect(toggle.attributes('aria-label')).toContain('Dark')

    await toggle.trigger('click')
    expect(ui.theme).toBe('system')
    expect(toggle.find('.pi-desktop').exists()).toBe(true)
  })

  it('persists the chosen scheme through the ui store watcher', async () => {
    const pinia = freshPinia()
    useUiStore()
    const wrapper = mountWith(pinia, ThemeToggle)

    await wrapper.get('[data-testid="theme-toggle"]').trigger('click')

    const persisted: unknown = JSON.parse(localStorage.getItem('odk-builder:ui:v1') ?? '{}')
    expect((persisted as { theme?: string }).theme).toBe('light')
  })
})
