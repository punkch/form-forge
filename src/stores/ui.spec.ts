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

describe('ui store preferences export/apply (workspace backup)', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })
  afterEach(() => { localStorage.clear() })

  it('exports a snapshot of the current preferences', () => {
    const ui = useUiStore()
    ui.theme = 'dark'
    ui.accent = 'teal'
    ui.locale = 'fr'
    ui.previewPreset = 'phone'
    ui.dismissedCallouts = ['a', 'b']

    const prefs = ui.exportPreferences()
    expect(prefs).toMatchObject({
      theme: 'dark', accent: 'teal', locale: 'fr', previewPreset: 'phone', dismissedCallouts: ['a', 'b'],
    })
    // Snapshot is detached — mutating it must not touch the store.
    prefs.dismissedCallouts.push('c')
    expect(ui.dismissedCallouts).toEqual(['a', 'b'])
  })

  it('applies valid preferences and persists them', async () => {
    const ui = useUiStore()
    ui.applyPreferences({
      theme: 'light',
      accent: 'rose',
      locale: 'es',
      previewPreset: 'tablet',
      paletteVisible: false,
      dismissedCallouts: ['x'],
      storageHintDismissed: true,
    })
    expect(ui.theme).toBe('light')
    expect(ui.accent).toBe('rose')
    expect(ui.locale).toBe('es')
    expect(ui.previewPreset).toBe('tablet')
    expect(ui.paletteVisible).toBe(false)
    expect(ui.dismissedCallouts).toEqual(['x'])

    await nextTick()
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) as string) as { theme: string, locale: string }
    expect(parsed.theme).toBe('light')
    expect(parsed.locale).toBe('es')
  })

  it('ignores invalid or unknown preference fields, keeping current values', () => {
    const ui = useUiStore()
    ui.theme = 'dark'
    ui.accent = 'green'
    ui.applyPreferences({ theme: 'auto', accent: 'orange', locale: '', bogus: 1, paletteWidth: 'wide' })
    expect(ui.theme).toBe('dark')
    expect(ui.accent).toBe('green')
    expect(ui.locale).toBe('en')
  })

  it('ignores a non-object payload', () => {
    const ui = useUiStore()
    ui.theme = 'dark'
    ui.applyPreferences(null)
    ui.applyPreferences('nope')
    expect(ui.theme).toBe('dark')
  })

  it('clamps out-of-range panel widths on apply', () => {
    const ui = useUiStore()
    ui.applyPreferences({ paletteWidth: 99999 })
    // Clamped to the palette max (340), not stored raw.
    expect(ui.paletteWidth).toBe(340)
  })
})
