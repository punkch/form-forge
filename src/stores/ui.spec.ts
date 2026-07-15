// @vitest-environment happy-dom
// happy-dom (not the unit project's node env) so the store has localStorage to
// persist into and a window for its viewport-relative panel clamps.
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'

import { useUiStore } from './ui'

const STORAGE_KEY = 'odk-builder:ui:v1'

describe('ui store locale persistence', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })

  afterEach(() => {
    localStorage.clear()
  })

  it('persists the locale to localStorage when it changes', async () => {
    const ui = useUiStore()
    ui.locale = 'fr'
    await nextTick()

    const raw = localStorage.getItem(STORAGE_KEY)
    expect(raw).not.toBeNull()
    expect((JSON.parse(raw as string) as { locale: string }).locale).toBe('fr')
  })

  it('restores a persisted locale in a fresh store', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, locale: 'es' }))
    setActivePinia(createPinia())

    expect(useUiStore().locale).toBe('es')
  })

  it("defaults to 'en' when storage is missing", () => {
    expect(useUiStore().locale).toBe('en')
  })

  it("defaults to 'en' when the persisted locale is empty", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, locale: '' }))
    setActivePinia(createPinia())

    expect(useUiStore().locale).toBe('en')
  })
})

describe('ui store theme + accent persistence', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })

  afterEach(() => {
    localStorage.clear()
  })

  it('persists the theme and accent to localStorage when they change', async () => {
    const ui = useUiStore()
    ui.theme = 'dark'
    ui.accent = 'green'
    await nextTick()

    const raw = localStorage.getItem(STORAGE_KEY)
    expect(raw).not.toBeNull()
    const parsed = JSON.parse(raw as string) as { theme: string, accent: string }
    expect(parsed.theme).toBe('dark')
    expect(parsed.accent).toBe('green')
  })

  it('restores a persisted theme and accent in a fresh store', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, theme: 'light', accent: 'rose' }))
    setActivePinia(createPinia())

    const ui = useUiStore()
    expect(ui.theme).toBe('light')
    expect(ui.accent).toBe('rose')
  })

  it("defaults to 'system' / 'purple' when storage is missing", () => {
    const ui = useUiStore()
    expect(ui.theme).toBe('system')
    expect(ui.accent).toBe('purple')
  })

  it('falls back to defaults when the persisted theme/accent are invalid', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, theme: 'auto', accent: 'orange' }))
    setActivePinia(createPinia())

    const ui = useUiStore()
    expect(ui.theme).toBe('system')
    expect(ui.accent).toBe('purple')
  })

  it('discards a persisted theme/accent on a version mismatch', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 2, theme: 'dark', accent: 'teal' }))
    setActivePinia(createPinia())

    const ui = useUiStore()
    expect(ui.theme).toBe('system')
    expect(ui.accent).toBe('purple')
  })
})
