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
